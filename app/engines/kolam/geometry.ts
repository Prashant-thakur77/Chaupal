/**
 * Minimal path geometry: every shape is a list of closed sub-paths made of
 * cubic Béziers. Paths are written with M/C/Z only (absolute, 2 decimals) so
 * they can be parsed back exactly for validation.
 */

export type Pt = [number, number];

export interface Cubic {
  p0: Pt;
  c1: Pt;
  c2: Pt;
  p3: Pt;
}

/** A closed sub-path. */
export type SubPath = Cubic[];
export type Shape = SubPath[];

export const CX = 500;
export const CY = 500;

export function fmt(n: number): string {
  if (!Number.isFinite(n)) throw new Error(`kolam geometry produced a non-finite number (${n})`);
  const v = Math.round(n * 100) / 100;
  return Object.is(v, -0) || v === 0 ? "0" : String(v);
}

export function add(a: Pt, b: Pt): Pt {
  return [a[0] + b[0], a[1] + b[1]];
}
export function sub(a: Pt, b: Pt): Pt {
  return [a[0] - b[0], a[1] - b[1]];
}
export function scale(a: Pt, k: number): Pt {
  return [a[0] * k, a[1] * k];
}
export function len(a: Pt): number {
  return Math.hypot(a[0], a[1]);
}
export function unit(a: Pt): Pt {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l];
}
export function dist(a: Pt, b: Pt): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** Polar point about the canvas centre; angle 0 points straight up, clockwise. */
export function polar(r: number, theta: number): Pt {
  return [CX + r * Math.sin(theta), CY - r * Math.cos(theta)];
}

export function line(a: Pt, b: Pt): Cubic {
  return {
    p0: a,
    c1: [a[0] + (b[0] - a[0]) / 3, a[1] + (b[1] - a[1]) / 3],
    c2: [a[0] + ((b[0] - a[0]) * 2) / 3, a[1] + ((b[1] - a[1]) * 2) / 3],
    p3: b,
  };
}

/** Hermite-style cubic from a to b with unit tangents ta, tb and handle factor k. */
export function hermite(a: Pt, ta: Pt, b: Pt, tb: Pt, k: number): Cubic {
  const c = dist(a, b) * k;
  return { p0: a, c1: add(a, scale(ta, c)), c2: sub(b, scale(tb, c)), p3: b };
}

export function reverseCubic(c: Cubic): Cubic {
  return { p0: c.p3, c1: c.c2, c2: c.c1, p3: c.p0 };
}

export function reverseSubPath(sp: SubPath): SubPath {
  return sp.map(reverseCubic).reverse();
}

/** Circle as four cubics, starting at the top, clockwise. */
export function circle(c: Pt, r: number): SubPath {
  const k = 0.5522847498 * r;
  const [x, y] = c;
  return [
    { p0: [x, y - r], c1: [x + k, y - r], c2: [x + r, y - k], p3: [x + r, y] },
    { p0: [x + r, y], c1: [x + r, y + k], c2: [x + k, y + r], p3: [x, y + r] },
    { p0: [x, y + r], c1: [x - k, y + r], c2: [x - r, y + k], p3: [x - r, y] },
    { p0: [x - r, y], c1: [x - r, y - k], c2: [x - k, y - r], p3: [x, y - r] },
  ];
}

/** Arc about the canvas centre from angle a0 to a1 (radians, clockwise from up). */
export function arc(r: number, a0: number, a1: number): Cubic[] {
  const out: Cubic[] = [];
  const steps = Math.max(1, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 4)));
  const da = (a1 - a0) / steps;
  const k = (4 / 3) * Math.tan(da / 4) * r;
  for (let i = 0; i < steps; i++) {
    const t0 = a0 + da * i;
    const t1 = t0 + da;
    const p0 = polar(r, t0);
    const p3 = polar(r, t1);
    // tangent of polar(r, t) wrt t: (cos t, sin t)
    out.push({
      p0,
      c1: [p0[0] + k * Math.cos(t0), p0[1] + k * Math.sin(t0)],
      c2: [p3[0] - k * Math.cos(t1), p3[1] - k * Math.sin(t1)],
      p3,
    });
  }
  return out;
}

/**
 * Smooth curve through a polar function r(θ) from a0 to a1, split at the given
 * angles (must include a0 and a1). Tangents come from one-sided differences so
 * cusps stay sharp. Shared boundaries use the same angles → identical numbers.
 */
export function polarCurve(r: (t: number) => number, angles: number[]): Cubic[] {
  const out: Cubic[] = [];
  const eps = 1e-5;
  const pt = (t: number): Pt => polar(r(t), t);
  const deriv = (t: number, side: 1 | -1): Pt => {
    const p = pt(t + side * eps);
    const q = pt(t);
    return side === 1 ? scale(sub(p, q), 1 / eps) : scale(sub(q, p), 1 / eps);
  };
  for (let i = 0; i + 1 < angles.length; i++) {
    const t0 = angles[i];
    const t1 = angles[i + 1];
    const h = (t1 - t0) / 3;
    const p0 = pt(t0);
    const p3 = pt(t1);
    // Clamp handles so infinite-slope cusps stay sharp instead of overshooting.
    const maxLen = dist(p0, p3) * 0.45;
    const clampV = (v: Pt): Pt => {
      const l = len(v);
      return l > maxLen ? scale(v, maxLen / l) : v;
    };
    out.push({
      p0,
      c1: add(p0, clampV(scale(deriv(t0, 1), h))),
      c2: sub(p3, clampV(scale(deriv(t1, -1), h))),
      p3,
    });
  }
  return out;
}

export function mapPt(p: Pt, f: (p: Pt) => Pt): Pt {
  return f(p);
}

export function mapCubic(c: Cubic, f: (p: Pt) => Pt): Cubic {
  return { p0: f(c.p0), c1: f(c.c1), c2: f(c.c2), p3: f(c.p3) };
}

export function mapShape(s: Shape, f: (p: Pt) => Pt): Shape {
  return s.map((sp) => sp.map((c) => mapCubic(c, f)));
}

/** Local motif frame → canvas: x across, y outward from radius `base` at angle θ. */
export function radialFrame(theta: number, base: number): (p: Pt) => Pt {
  const s = Math.sin(theta);
  const c = Math.cos(theta);
  return ([x, y]) => {
    // outward unit u = (s, -c), across unit v = (c, s)
    const r = base + y;
    return [CX + r * s + x * c, CY - r * c + x * s];
  };
}

export function shapeToPath(shape: Shape): string {
  const parts: string[] = [];
  for (const sp of shape) {
    if (sp.length === 0) continue;
    const first = sp[0];
    parts.push(`M${fmt(first.p0[0])} ${fmt(first.p0[1])}`);
    for (const c of sp) {
      parts.push(
        `C${fmt(c.c1[0])} ${fmt(c.c1[1])} ${fmt(c.c2[0])} ${fmt(c.c2[1])} ${fmt(c.p3[0])} ${fmt(c.p3[1])}`,
      );
    }
    parts.push("Z");
  }
  return parts.join("");
}

/** Same as shapeToPath but leaves sub-paths open (no Z), for chalk details. */
export function shapeToOpenPath(shape: Shape): string {
  return shape
    .filter((sp) => sp.length)
    .map(
      (sp) =>
        `M${fmt(sp[0].p0[0])} ${fmt(sp[0].p0[1])}` +
        sp.map((c) => `C${fmt(c.c1[0])} ${fmt(c.c1[1])} ${fmt(c.c2[0])} ${fmt(c.c2[1])} ${fmt(c.p3[0])} ${fmt(c.p3[1])}`).join(""),
    )
    .join("");
}

export interface ParsedSubPath {
  cubics: Cubic[];
  closed: boolean;
}

/** Parse the M/C/L/Z subset this engine writes. Throws on anything else. */
export function parsePath(d: string): ParsedSubPath[] {
  const tokens = d.match(/[MCLZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  const out: ParsedSubPath[] = [];
  let cur: ParsedSubPath | null = null;
  let pos: Pt = [0, 0];
  let i = 0;
  const num = (): number => {
    const t = tokens[i++];
    const v = Number(t);
    if (t === undefined || Number.isNaN(v)) throw new Error(`bad path number near token ${i}`);
    return v;
  };
  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (cmd === "M") {
      pos = [num(), num()];
      cur = { cubics: [], closed: false };
      out.push(cur);
    } else if (cmd === "C") {
      if (!cur) throw new Error("C before M");
      const c1: Pt = [num(), num()];
      const c2: Pt = [num(), num()];
      const p3: Pt = [num(), num()];
      cur.cubics.push({ p0: pos, c1, c2, p3 });
      pos = p3;
    } else if (cmd === "L") {
      if (!cur) throw new Error("L before M");
      const p3: Pt = [num(), num()];
      cur.cubics.push(line(pos, p3));
      pos = p3;
    } else if (cmd === "Z" || cmd === "z") {
      if (!cur) throw new Error("Z before M");
      cur.closed = true;
      const first = cur.cubics[0];
      if (first) pos = first.p0;
    } else {
      throw new Error(`unsupported path command ${cmd}`);
    }
  }
  return out;
}

export function cubicAt(c: Cubic, t: number): Pt {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const d = 3 * u * t * t;
  const e = t * t * t;
  return [
    a * c.p0[0] + b * c.c1[0] + d * c.c2[0] + e * c.p3[0],
    a * c.p0[1] + b * c.c1[1] + d * c.c2[1] + e * c.p3[1],
  ];
}

/** Flatten cubics into a polyline (n samples per cubic, endpoints included once). */
export function flatten(cubics: Cubic[], n = 12): Pt[] {
  const pts: Pt[] = [];
  cubics.forEach((c, idx) => {
    for (let s = idx === 0 ? 0 : 1; s <= n; s++) pts.push(cubicAt(c, s / n));
  });
  return pts;
}

/** Segment–segment intersection test (proper or touching). */
export function segmentsIntersect(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o = (p: Pt, q: Pt, r: Pt) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = o(c, d, a);
  const d2 = o(c, d, b);
  const d3 = o(a, b, c);
  const d4 = o(a, b, d);
  return d1 * d2 <= 0 && d3 * d4 <= 0 && !(d1 === 0 && d2 === 0 && d3 === 0 && d4 === 0);
}

export function pointSegDist(p: Pt, a: Pt, b: Pt): number {
  const ab = sub(b, a);
  const l2 = ab[0] * ab[0] + ab[1] * ab[1];
  let t = l2 === 0 ? 0 : ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / l2;
  t = Math.max(0, Math.min(1, t));
  return dist(p, [a[0] + ab[0] * t, a[1] + ab[1] * t]);
}

/** Spatial hash of polyline segments for fast nearest-distance queries. */
export class SegmentIndex {
  private cells = new Map<string, Array<[Pt, Pt]>>();
  constructor(
    polylines: Pt[][],
    private cell = 20,
    closed = true,
  ) {
    for (const pl of polylines) {
      const n = pl.length;
      const count = closed ? n : n - 1;
      for (let i = 0; i < count; i++) {
        const a = pl[i];
        const b = pl[(i + 1) % n];
        const x0 = Math.floor(Math.min(a[0], b[0]) / cell);
        const x1 = Math.floor(Math.max(a[0], b[0]) / cell);
        const y0 = Math.floor(Math.min(a[1], b[1]) / cell);
        const y1 = Math.floor(Math.max(a[1], b[1]) / cell);
        for (let x = x0; x <= x1; x++)
          for (let y = y0; y <= y1; y++) {
            const k = `${x},${y}`;
            let arr = this.cells.get(k);
            if (!arr) this.cells.set(k, (arr = []));
            arr.push([a, b]);
          }
      }
    }
  }
  /** Distance to nearest segment, or Infinity if none within one cell ring. */
  nearest(p: Pt): number {
    const cx = Math.floor(p[0] / this.cell);
    const cy = Math.floor(p[1] / this.cell);
    let best = Infinity;
    for (let x = cx - 1; x <= cx + 1; x++)
      for (let y = cy - 1; y <= cy + 1; y++) {
        const arr = this.cells.get(`${x},${y}`);
        if (!arr) continue;
        for (const [a, b] of arr) best = Math.min(best, pointSegDist(p, a, b));
      }
    return best;
  }
  /** Does segment p→q cross any indexed segment? */
  crosses(p: Pt, q: Pt): boolean {
    const x0 = Math.floor(Math.min(p[0], q[0]) / this.cell);
    const x1 = Math.floor(Math.max(p[0], q[0]) / this.cell);
    const y0 = Math.floor(Math.min(p[1], q[1]) / this.cell);
    const y1 = Math.floor(Math.max(p[1], q[1]) / this.cell);
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++) {
        const arr = this.cells.get(`${x},${y}`);
        if (!arr) continue;
        for (const [a, b] of arr) if (segmentsIntersect(p, q, a, b)) return true;
      }
    return false;
  }
}

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/** Rotation op (clockwise by `deg`) as a SymmetryOp matrix about the centre. */
export function rotationMatrix(rad: number): [number, number, number, number] {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [c, -s, s, c];
}

export function applyOp(m: [number, number, number, number], p: Pt): Pt {
  const x = p[0] - CX;
  const y = p[1] - CY;
  return [CX + m[0] * x + m[1] * y, CY + m[2] * x + m[3] * y];
}
