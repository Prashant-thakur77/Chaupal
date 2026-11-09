/**
 * Motif outlines in a local frame: x across (symmetric about x = 0), y
 * outward from the ring's inner edge. Shapes are built from the right half
 * (bottom → top) and mirrored, so every motif is exactly bilaterally
 * symmetric. Sizes: W = available width, h = available height.
 */
import { add, hermite, line, scale, unit, type Cubic, type Pt, type Shape, type SubPath } from "./geometry";
import type { MotifName } from "./types";

export interface HalfPt {
  p: Pt;
  /** Tangent arriving (direction of travel, bottom → top). */
  tin?: Pt;
  /** Tangent leaving. Defaults to tin. */
  tout?: Pt;
  /** Handle factor for the segment leaving this point. */
  k?: number;
  /** Straight segment to the next point. */
  straight?: boolean;
}

function chain(pts: HalfPt[]): Cubic[] {
  const out: Cubic[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (a.straight) {
      out.push(line(a.p, b.p));
      continue;
    }
    const ta = unit(a.tout ?? a.tin ?? [0, 1]);
    const tb = unit(b.tin ?? b.tout ?? [0, 1]);
    out.push(hermite(a.p, ta, b.p, tb, a.k ?? 0.4));
  }
  return out;
}

/** Mirror a right half (bottom on/near axis → top on axis) into a closed sub-path. */
export function symShape(right: HalfPt[]): SubPath {
  const r = chain(right);
  const mirror = (p: Pt): Pt => [-p[0], p[1]];
  const left: Cubic[] = r
    .slice()
    .reverse()
    .map((c) => ({ p0: mirror(c.p3), c1: mirror(c.c2), c2: mirror(c.c1), p3: mirror(c.p0) }));
  const sp = [...r, ...left];
  const first = sp[0].p0;
  const last = sp[sp.length - 1].p3;
  if (Math.abs(first[0] - last[0]) > 1e-9 || Math.abs(first[1] - last[1]) > 1e-9) {
    // bottom off-axis: close across the base with a gentle curve
    sp.push(line(last, first));
  }
  return sp;
}

/** Scale a half-point list from unit space (x in ±1 → ±W/2, y in 0..1 → 0..h). */
function sized(pts: HalfPt[], W: number, h: number, y0 = 0): HalfPt[] {
  const sv = (v: Pt): Pt => [v[0] * (W / 2), v[1] * h];
  const out: HalfPt[] = [];
  for (const q of pts) {
    const o: HalfPt = { p: [q.p[0] * (W / 2), y0 + q.p[1] * h] };
    if (q.tin) o.tin = unit(sv(q.tin));
    if (q.tout) o.tout = unit(sv(q.tout));
    if (q.k !== undefined) o.k = q.k;
    if (q.straight) o.straight = true;
    out.push(o);
  }
  return out;
}

export function transform(sp: SubPath, f: (p: Pt) => Pt): SubPath {
  return sp.map((c) => ({ p0: f(c.p0), c1: f(c.c1), c2: f(c.c2), p3: f(c.p3) }));
}

export function rotateAbout(origin: Pt, angle: number): (p: Pt) => Pt {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return ([x, y]) => {
    const dx = x - origin[0];
    const dy = y - origin[1];
    return [origin[0] + dx * c - dy * s, origin[1] + dx * s + dy * c];
  };
}

/** Pointed petal (teardrop with a sharp tip), base rounded on the axis. */
export function petal(W: number, h: number, y0 = 0): SubPath {
  return symShape(
    sized(
      [
        { p: [0, 0], tin: [1, 0], k: 0.45 },
        { p: [0.92, 0.36], tin: [0.15, 1], k: 0.42 },
        { p: [0.5, 0.78], tin: [-0.7, 1], k: 0.42 },
        { p: [0, 1], tin: [-0.55, 1] },
      ],
      W,
      h,
      y0,
    ),
  );
}

/** Rounded oval (egg), wider low. */
export function oval(W: number, h: number, y0 = 0): SubPath {
  return symShape(
    sized(
      [
        { p: [0, 0], tin: [1, 0], k: 0.5 },
        { p: [1, 0.48], tin: [0, 1], k: 0.5 },
        { p: [0, 1], tin: [-1, 0] },
      ],
      W,
      h,
      y0,
    ),
  );
}

export interface MotifPart {
  /** Suffix for the region id ("" for the main part). */
  suffix: string;
  role: "main" | "accent";
  /** Extra zone tags. */
  tags: string[];
  shape: SubPath;
}

export interface MotifBuild {
  parts: MotifPart[];
  /** Chalk details (open or closed strokes / dots). */
  details: { suffix: string; style: "stroke" | "fill"; shape: Shape; open?: boolean }[];
}

/**
 * Build a motif in its local frame. W = width budget, h = height budget.
 */
export function buildMotif(name: MotifName, W: number, h: number): MotifBuild {
  switch (name) {
    case "lotus": {
      // side petals splay out from the base so outlines never cross
      const centre = petal(W * 0.4, h * 0.94, h * 0.04);
      // sized from the slot width too, so neighbouring lotuses never touch
      const sideH = Math.min(h * 0.5, W * 0.52);
      const side = petal(Math.min(W * 0.26, sideH * 0.5), sideH, 0);
      const lean = 0.75;
      const left = transform(transform(side, ([x, y]) => [x - W * 0.12, y + h * 0.04]), rotateAbout([-W * 0.12, h * 0.04], lean));
      const right = transform(transform(side, ([x, y]) => [x + W * 0.12, y + h * 0.04]), rotateAbout([W * 0.12, h * 0.04], -lean));
      const inner = petal(W * 0.18, h * 0.5, h * 0.3);
      return {
        parts: [
          { suffix: "-left", role: "main", tags: ["petal"], shape: left },
          { suffix: "-right", role: "main", tags: ["petal"], shape: right },
          { suffix: "", role: "main", tags: ["petal"], shape: centre },
          { suffix: "-inner", role: "accent", tags: [], shape: inner },
        ],
        details: [],
      };
    }
    case "diya": {
      const bowl = symShape(
        sized(
          [
            { p: [0, 0.02], tin: [1, 0], k: 0.5 },
            { p: [0.8, 0.15], tin: [1, 0.75], k: 0.42 },
            { p: [1, 0.5], tin: [0.15, 1], tout: [-1, -0.25], k: 0.38 },
            { p: [0, 0.42], tin: [-1, 0] },
          ],
          W * 0.86,
          h,
        ),
      );
      const flame = symShape(
        sized(
          [
            { p: [0, 0.4], tin: [1, 0], k: 0.55 },
            { p: [0.66, 0.6], tin: [0, 1], k: 0.42 },
            { p: [0, 1], tin: [-0.3, 1] },
          ],
          W * 0.42,
          h,
        ),
      );
      const flameCore = symShape(
        sized(
          [
            { p: [0, 0.5], tin: [1, 0], k: 0.55 },
            { p: [0.6, 0.63], tin: [0, 1], k: 0.42 },
            { p: [0, 0.84], tin: [-0.35, 1] },
          ],
          W * 0.2,
          h,
        ),
      );
      return {
        parts: [
          { suffix: "", role: "main", tags: [], shape: bowl },
          { suffix: "-flame", role: "accent", tags: ["flame"], shape: flame },
        ],
        details: [{ suffix: "-flame-core", style: "stroke", shape: [flameCore] }],
      };
    }
    case "peacock-feather": {
      const outer = symShape(
        sized(
          [
            { p: [0, 0.1], tin: [0.45, 1], k: 0.4 },
            { p: [0.9, 0.6], tin: [0, 1], k: 0.5 },
            { p: [0, 1], tin: [-1, 0] },
          ],
          W * 0.9,
          h,
        ),
      );
      const ring = oval(W * 0.66, h * 0.56, h * 0.4);
      const eye = oval(W * 0.42, h * 0.36, h * 0.5);
      const pupil = oval(W * 0.2, h * 0.17, h * 0.6);
      const stalk: Cubic = line([0, 0], [0, h * 0.1]);
      return {
        parts: [
          { suffix: "", role: "main", tags: [], shape: outer },
          { suffix: "-ring", role: "accent", tags: ["eye"], shape: ring },
          { suffix: "-eye", role: "accent", tags: ["eye"], shape: eye },
          { suffix: "-pupil", role: "accent", tags: ["eye"], shape: pupil },
        ],
        details: [{ suffix: "-stalk", style: "stroke", shape: [[stalk]], open: true }],
      };
    }
    case "mango-leaf": {
      const leaf = symShape(
        sized(
          [
            { p: [0, 0], tin: [0.6, 1], k: 0.45 },
            { p: [0.95, 0.42], tin: [0, 1], k: 0.42 },
            { p: [0, 1], tin: [-0.35, 1] },
          ],
          W * 0.62,
          h,
        ),
      );
      const veins: SubPath[] = [];
      const rib: Cubic = line([0, h * 0.06], [0, h * 0.86]);
      veins.push([rib]);
      for (const t of [0.3, 0.48, 0.66]) {
        const y = h * t;
        const dx = W * 0.62 * 0.5 * (0.62 - Math.abs(t - 0.42) * 0.7);
        veins.push([hermite([0, y], [0.6, 0.8], [dx, y + h * 0.1], [1, 0.5], 0.4)]);
        veins.push([hermite([0, y], [-0.6, 0.8], [-dx, y + h * 0.1], [-1, 0.5], 0.4)]);
      }
      return {
        parts: [{ suffix: "", role: "main", tags: ["leaf"], shape: leaf }],
        details: [{ suffix: "-veins", style: "stroke", shape: veins, open: true }],
      };
    }
    case "geometric": {
      const diamond = symShape(
        sized(
          [
            { p: [0, 0], straight: true },
            { p: [1, 0.5], straight: true },
            { p: [0, 1] },
          ],
          W * 0.8,
          h,
        ),
      );
      const inner = symShape(
        sized(
          [
            { p: [0, 0.25], straight: true },
            { p: [0.5, 0.5], straight: true },
            { p: [0, 0.75] },
          ],
          W * 0.8,
          h,
        ),
      );
      const dotR = Math.min(W, h) * 0.05;
      const dot = circleLocal([0, h * 0.5], dotR);
      return {
        parts: [
          { suffix: "", role: "main", tags: [], shape: diamond },
          { suffix: "-inner", role: "accent", tags: [], shape: inner },
        ],
        details: [{ suffix: "-bindu", style: "fill", shape: [dot] }],
      };
    }
  }
}

export function circleLocal(c: Pt, r: number): SubPath {
  const k = 0.5522847498 * r;
  const [x, y] = c;
  const pts: Pt[] = [
    [x, y - r],
    [x + r, y],
    [x, y + r],
    [x - r, y],
  ];
  const tans: Pt[] = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ];
  const out: Cubic[] = [];
  for (let i = 0; i < 4; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % 4];
    out.push({ p0: a, c1: add(a, scale(tans[i], k)), c2: add(b, scale(tans[(i + 1) % 4], -k)), p3: b });
  }
  return out;
}
