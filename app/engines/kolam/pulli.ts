/**
 * Pulli (sikku) kolam on an N×N dot grid, built as a mirror curve.
 *
 * Grid model (doubled coordinates, 0..2N): dot (row j, col i) sits at
 * (2i+1, 2j+1). Every cell edge midpoint ((even, odd) or (odd, even)) is a
 * place where the line passes between two dots. Inside each cell the line
 * runs diagonally between neighbouring edge midpoints, so each dot is ringed
 * by four strokes. At an edge midpoint the strands either cross (no mirror)
 * or bounce off a two-sided mirror lying on that edge. The outer frame is
 * all mirror, which turns the line back around the boundary dots.
 *
 * Tracing a strand from midpoint to midpoint (reflecting at mirrors) always
 * returns to its start, so every curve is closed. Mirrors are chosen in
 * symmetry orbits and searched (seeded, deterministic) to join the strands
 * into a single line when possible ("ek hi rekha").
 */
import {
  hermite,
  hashString,
  rng,
  rotationMatrix,
  shapeToPath,
  circle,
  unit,
  type Cubic,
  type Pt,
} from "./geometry";
import type {
  DesignMeta,
  DotInfo,
  KolamParams,
  LoopInfo,
  PulliSymmetry,
  Region,
  SymmetryOp,
} from "./types";

type XY = readonly [number, number];
type GridOp = (p: XY) => XY;

/** Crossing tangent squash: <1 makes the line hug each dot like a circle. */
const CROSS_SQUASH = 0.62;
/** How far a bounce turns back before the mirror (in half-spacing units). */
const BOUNCE_PULLBACK = 0.3;
/** Bézier handle factor. */
const HANDLE = 0.44;
const MARGIN = 70;

export interface PulliLayout {
  n: number;
  /** px per doubled-grid unit. */
  s: number;
  toPx: (p: Pt) => Pt;
}

export function pulliLayout(n: number): PulliLayout {
  const s = (1000 - 2 * MARGIN) / (2 * n);
  return { n, s, toPx: ([x, y]) => [MARGIN + x * s, MARGIN + y * s] };
}

export function symmetryGridOps(n: number, symmetry: PulliSymmetry): { name: string; f: GridOp }[] {
  const m = 2 * n;
  const rot90: GridOp = ([x, y]) => [m - y, x];
  const rot180: GridOp = ([x, y]) => [m - x, m - y];
  const flip: GridOp = ([x, y]) => [m - x, y];
  if (symmetry === "2-fold") return [{ name: "rot180", f: rot180 }];
  if (symmetry === "4-fold") return [{ name: "rot90", f: rot90 }];
  return [
    { name: "rot90", f: rot90 },
    { name: "flip-x", f: flip },
  ];
}

export function symmetryPixelOps(symmetry: PulliSymmetry): SymmetryOp[] {
  if (symmetry === "2-fold") return [{ name: "rot180", m: rotationMatrix(Math.PI) }];
  if (symmetry === "4-fold") return [{ name: "rot90", m: rotationMatrix(Math.PI / 2) }];
  return [
    { name: "rot90", m: rotationMatrix(Math.PI / 2) },
    { name: "flip-x", m: [-1, 0, 0, 1] },
  ];
}

const key = (x: number, y: number) => `${x},${y}`;

/** Internal edge midpoints (where a mirror may sit). */
function internalMidpoints(n: number): XY[] {
  const out: XY[] = [];
  const m = 2 * n;
  for (let y = 1; y < m; y++)
    for (let x = 1; x < m; x++) if ((x + y) % 2 === 1) out.push([x, y]);
  return out;
}

function isBoundary(n: number, x: number, y: number): boolean {
  return x === 0 || y === 0 || x === 2 * n || y === 2 * n;
}

interface TracedLoop {
  points: XY[];
  dirs: XY[];
}

/** Trace all loops for a mirror set. */
export function traceLoops(n: number, mirrors: ReadonlySet<string>): TracedLoop[] {
  const bounce = (x: number, y: number) => isBoundary(n, x, y) || mirrors.has(key(x, y));
  const seen = new Set<string>();
  const segKey = (a: XY, b: XY) => {
    const ka = key(a[0], a[1]);
    const kb = key(b[0], b[1]);
    return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
  };
  const loops: TracedLoop[] = [];
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      // each cell's four segments, scanned top→right, right→bottom, ...
      const cx = 2 * i + 1;
      const cy = 2 * j + 1;
      const starts: [XY, XY][] = [
        [[cx, cy - 1], [1, 1]],
        [[cx + 1, cy], [-1, 1]],
        [[cx, cy + 1], [-1, -1]],
        [[cx - 1, cy], [1, -1]],
      ];
      for (const [p0, d0] of starts) {
        if (seen.has(segKey(p0, [p0[0] + d0[0], p0[1] + d0[1]]))) continue;
        const points: XY[] = [];
        const dirs: XY[] = [];
        let p: XY = p0;
        let d: XY = d0;
        for (let guard = 0; guard < 16 * n * n + 8; guard++) {
          const q: XY = [p[0] + d[0], p[1] + d[1]];
          seen.add(segKey(p, q));
          points.push(p);
          dirs.push(d);
          let nd: XY = d;
          if (bounce(q[0], q[1])) nd = q[0] % 2 === 0 ? [-d[0], d[1]] : [d[0], -d[1]];
          p = q;
          d = nd;
          if (p[0] === p0[0] && p[1] === p0[1] && d[0] === d0[0] && d[1] === d0[1]) break;
        }
        loops.push({ points, dirs });
      }
    }
  return loops;
}

function countLoops(n: number, mirrors: ReadonlySet<string>): number {
  return traceLoops(n, mirrors).length;
}

function orbitsOf(n: number, symmetry: PulliSymmetry): string[][] {
  const ops = symmetryGridOps(n, symmetry).map((o) => o.f);
  const seen = new Set<string>();
  const orbits: string[][] = [];
  for (const p of internalMidpoints(n)) {
    const k0 = key(p[0], p[1]);
    if (seen.has(k0)) continue;
    const orbit: string[] = [];
    const stack: XY[] = [p];
    seen.add(k0);
    while (stack.length) {
      const cur = stack.pop()!;
      orbit.push(key(cur[0], cur[1]));
      for (const f of ops) {
        const nx = f(cur);
        const k = key(nx[0], nx[1]);
        if (!seen.has(k)) {
          seen.add(k);
          stack.push(nx);
        }
      }
    }
    orbit.sort();
    orbits.push(orbit);
  }
  return orbits;
}

function shuffle<T>(arr: T[], r: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Deterministic seeded search for a symmetric mirror layout: a random walk
 * over symmetry orbits that never accepts more loops (rare escapes aside),
 * then settles the mirror density near a seeded target so designs breathe.
 */
export function chooseMirrors(params: KolamParams): Set<string> {
  const n = params.grid;
  const wantSingle = (params.loops ?? "single") === "single";
  const orbits = orbitsOf(n, params.symmetry);
  const total = orbits.reduce((a, o) => a + o.length, 0);
  const r = rng(hashString(`pulli:${n}:${params.symmetry}:${params.loops ?? "single"}:${params.seed ?? 0}`));
  const toSet = (on: boolean[]) => {
    const s = new Set<string>();
    on.forEach((v, i) => v && orbits[i].forEach((k) => s.add(k)));
    return s;
  };
  const targetDensity = 0.22 + 0.16 * r();
  const density = (on: boolean[]) => on.reduce((a, v, i) => a + (v ? orbits[i].length : 0), 0) / total;
  const cost = (on: boolean[]) => {
    const dd = Math.abs(density(on) - targetDensity);
    return wantSingle ? countLoops(n, toSet(on)) + 0.9 * dd : dd;
  };

  const on = orbits.map(() => false);
  let cur = cost(on);
  let best = { on: on.slice(), cost: cur };
  const iterations = Math.min(2400, 300 + 60 * orbits.length);
  for (let it = 0; it < iterations; it++) {
    const idx = Math.floor(r() * orbits.length);
    on[idx] = !on[idx];
    const c = cost(on);
    if (c <= cur + 1e-9 || r() < 0.015) {
      cur = c;
      if (c < best.cost - 1e-9) best = { on: on.slice(), cost: c };
    } else on[idx] = !on[idx];
  }
  return toSet(best.on);
}

/** Fewest loops a symmetric layout can reach on an N×N grid (from exhaustive search). */
export function minLoops(n: number, symmetry: PulliSymmetry): number {
  if (symmetry === "8-fold") return n; // mirror symmetry keeps the N diagonal strands apart
  // A centred rotation on an even grid always pairs strands into at least two loops.
  return n % 2 === 1 ? 1 : 2;
}

/** Geometry of the stroke inside one cell from midpoint a to midpoint b. */
function segmentCubic(n: number, mirrors: ReadonlySet<string>, a: XY, d: XY, toPx: (p: Pt) => Pt): Cubic {
  const b: XY = [a[0] + d[0], a[1] + d[1]];
  const bounce = (x: number, y: number) => isBoundary(n, x, y) || mirrors.has(key(x, y));
  const crossTan = (p: XY): Pt =>
    unit(p[0] % 2 === 0 ? [d[0] * CROSS_SQUASH, d[1]] : [d[0], d[1] * CROSS_SQUASH]);
  let pa: Pt;
  let ta: Pt;
  if (bounce(a[0], a[1])) {
    if (a[0] % 2 === 0) {
      pa = [a[0] + d[0] * BOUNCE_PULLBACK, a[1]];
      ta = [0, d[1]];
    } else {
      pa = [a[0], a[1] + d[1] * BOUNCE_PULLBACK];
      ta = [d[0], 0];
    }
  } else {
    pa = [a[0], a[1]];
    ta = crossTan(a);
  }
  let pb: Pt;
  let tb: Pt;
  if (bounce(b[0], b[1])) {
    if (b[0] % 2 === 0) {
      pb = [b[0] - d[0] * BOUNCE_PULLBACK, b[1]];
      tb = [0, d[1]];
    } else {
      pb = [b[0], b[1] - d[1] * BOUNCE_PULLBACK];
      tb = [d[0], 0];
    }
  } else {
    pb = [b[0], b[1]];
    tb = crossTan(b);
  }
  // Build in grid units then map (uniform scale keeps tangents valid).
  const c = hermite(pa, ta, pb, tb, HANDLE);
  return { p0: toPx(c.p0), c1: toPx(c.c1), c2: toPx(c.c2), p3: toPx(c.p3) };
}

export interface PulliBuild {
  regions: Region[];
  dots: DotInfo[];
  loops: LoopInfo[];
  meta: DesignMeta;
}

export function cellRing(n: number, row: number, col: number): number {
  const c = (n - 1) / 2;
  const cheb = Math.max(Math.abs(row - c), Math.abs(col - c));
  return n % 2 === 1 ? cheb : cheb - 0.5;
}

export function buildPulli(params: KolamParams): PulliBuild {
  const n = params.grid;
  const mirrors = chooseMirrors(params);
  const { s, toPx } = pulliLayout(n);
  const traced = traceLoops(n, mirrors);
  const maxRing = cellRing(n, 0, 0);
  const palette = params.palette ?? [];

  const regions: Region[] = [];
  // Cells: the face of the line around each dot.
  for (let row = 0; row < n; row++)
    for (let col = 0; col < n; col++) {
      const cx = 2 * col + 1;
      const cy = 2 * row + 1;
      const sp: Cubic[] = [
        segmentCubic(n, mirrors, [cx, cy - 1], [1, 1], toPx),
        segmentCubic(n, mirrors, [cx + 1, cy], [-1, 1], toPx),
        segmentCubic(n, mirrors, [cx, cy + 1], [-1, -1], toPx),
        segmentCubic(n, mirrors, [cx - 1, cy], [1, -1], toPx),
      ];
      const ring = cellRing(n, row, col);
      const zone = ring === 0 ? "center" : `ring-${ring}`;
      const zones = [zone, "cell"];
      if (ring === maxRing && ring > 0) zones.push("outer", "border");
      const fill = palette.length ? palette[ring % palette.length] : "none";
      regions.push({
        id: `cell-${row}-${col}`,
        zone,
        zones,
        role: "area",
        fill,
        d: shapeToPath([sp]),
      });
    }

  // Loops.
  const loops: LoopInfo[] = [];
  traced.forEach((lp, idx) => {
    const cubics = lp.points.map((p, i) => segmentCubic(n, mirrors, p, lp.dirs[i], toPx));
    const id = `loop-${idx + 1}`;
    loops.push({ id, segments: lp.points.length });
    regions.push({
      id,
      zone: "loop",
      zones: ["loop", id, "line"],
      role: "line",
      fill: "none",
      d: shapeToPath([cubics]),
      loop: idx + 1,
    });
  });

  // Dots.
  const dotR = Math.max(4, s * 0.12);
  const dots: DotInfo[] = [];
  for (let row = 0; row < n; row++)
    for (let col = 0; col < n; col++) {
      const [x, y] = toPx([2 * col + 1, 2 * row + 1]);
      dots.push({ id: `${row},${col}`, row, col, cx: x, cy: y, r: dotR });
    }
  regions.push({
    id: "dots",
    zone: "dots",
    zones: ["dots"],
    role: "dots",
    fill: "none",
    d: shapeToPath(dots.map((dt) => circle([dt.cx, dt.cy], dt.r))),
    dots,
  });

  const meta: DesignMeta = {
    symmetry: params.symmetry,
    symmetryOps: symmetryPixelOps(params.symmetry),
    loopCount: traced.length,
    mirrors: [...mirrors].sort(),
    lineWidth: Math.max(4, s * 0.095),
    ringCount: maxRing,
  };
  return { regions, dots, loops, meta };
}
