/**
 * Pure geometry for her ink: sampling, simplification and the variable-width
 * SVG rendering of committed strokes. Points are [x, y, pressure?] in 0..1 of
 * the drawing box; pressure here is the "ink load" (real pen pressure, or a
 * value derived from speed for touch, mouse and air input).
 */

export const MAX_STROKE_POINTS = 400;

export interface RawSample {
  x: number;
  y: number;
  /** ms */
  t: number;
  /** Real hardware pressure (pen) or undefined. */
  pressure?: number;
}

const clamp = (value: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, value));

const round = (value: number, digits = 4) => {
  const k = 10 ** digits;
  return Math.round(value * k) / k;
};

/**
 * Turns raw samples into [x, y, load] points. Fast movement thins the line and
 * slow movement loads it, like a kalam or a chalk stick dragged across slate.
 * `boxWidth`/`boxHeight` are CSS pixels so speed is measured on screen.
 */
export function samplesToPoints(
  samples: readonly RawSample[],
  boxWidth: number,
  boxHeight: number,
): number[][] {
  if (!samples.length) return [];
  const out: number[][] = [];
  let load = 0.75;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]!;
    let target: number;
    if (s.pressure !== undefined && s.pressure > 0 && s.pressure !== 0.5) {
      target = clamp(0.25 + s.pressure * 0.85, 0.2, 1);
    } else if (i === 0) {
      target = 0.75;
    } else {
      const p = samples[i - 1]!;
      const dist = Math.hypot((s.x - p.x) * boxWidth, (s.y - p.y) * boxHeight);
      const dt = Math.max(4, s.t - p.t);
      const speed = dist / dt; // px per ms
      target = clamp(1.05 - speed * 0.28, 0.42, 1);
    }
    load = i === 0 ? target : load + (target - load) * 0.35;
    out.push([round(clamp(s.x, 0, 1)), round(clamp(s.y, 0, 1)), round(load, 3)]);
  }
  return out;
}

function perpendicularDistance(
  p: number[],
  a: number[],
  b: number[],
  aspect: number,
): number {
  const px = p[0]! * aspect;
  const ax = a[0]! * aspect;
  const bx = b[0]! * aspect;
  const dx = bx - ax;
  const dy = b[1]! - a[1]!;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, p[1]! - a[1]!);
  const t = clamp(((px - ax) * dx + (p[1]! - a[1]!) * dy) / len2, 0, 1);
  return Math.hypot(px - (ax + dx * t), p[1]! - (a[1]! + dy * t));
}

function rdp(points: number[][], epsilon: number, aspect: number): number[][] {
  if (points.length < 3) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    let maxDistance = 0;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const d = perpendicularDistance(points[i]!, points[start]!, points[end]!, aspect);
      // A big change of ink load is a feature worth keeping too.
      const loadJump =
        Math.abs((points[i]![2] ?? 0.75) - (points[start]![2] ?? 0.75)) * 0.004;
      const score = d + loadJump;
      if (score > maxDistance) {
        maxDistance = score;
        index = i;
      }
    }
    if (index > 0 && maxDistance > epsilon) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

/** Ramer-Douglas-Peucker simplification, tightened until ≤ maxPoints remain. */
export function simplifyPoints(
  points: readonly number[][],
  aspect = 1,
  maxPoints = MAX_STROKE_POINTS,
): number[][] {
  if (points.length <= 2) return points.map((p) => p.slice());
  let epsilon = 0.0007;
  let result = rdp(points as number[][], epsilon, aspect);
  while (result.length > maxPoints) {
    epsilon *= 1.6;
    result = rdp(points as number[][], epsilon, aspect);
  }
  return result;
}

export interface InkRun {
  d: string;
  width: number;
}

export interface StrokeShape {
  /** Width-quantized runs, drawn with round caps so the joins are seamless. */
  runs: InkRun[];
  /** One path through the whole stroke (for the halo and the hit outline). */
  spine: string;
  /** Widest run, viewBox units. */
  maxWidth: number;
  /** A single tap renders as a dot. */
  dot?: { cx: number; cy: number; r: number };
}

const fmt = (n: number) => (Math.round(n * 10) / 10).toString();

/** Catmull-Rom densification in viewBox units; load is interpolated linearly. */
function densify(
  pts: readonly number[][],
  step: number,
): number[][] {
  if (pts.length < 2) return pts.map((p) => p.slice());
  const out: number[][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    const segment = Math.hypot(p2[0]! - p1[0]!, p2[1]! - p1[1]!);
    const n = Math.max(1, Math.min(24, Math.ceil(segment / step)));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const x =
        0.5 *
        (2 * p1[0]! +
          (-p0[0]! + p2[0]!) * t +
          (2 * p0[0]! - 5 * p1[0]! + 4 * p2[0]! - p3[0]!) * t2 +
          (-p0[0]! + 3 * p1[0]! - 3 * p2[0]! + p3[0]!) * t3);
      const y =
        0.5 *
        (2 * p1[1]! +
          (-p0[1]! + p2[1]!) * t +
          (2 * p0[1]! - 5 * p1[1]! + 4 * p2[1]! - p3[1]!) * t2 +
          (-p0[1]! + 3 * p1[1]! - 3 * p2[1]! + p3[1]!) * t3);
      const load = (p1[2] ?? 0.75) * (1 - t) + (p2[2] ?? 0.75) * t;
      out.push([x, y, load]);
    }
  }
  const last = pts[pts.length - 1]!;
  out.push([last[0]!, last[1]!, last[2] ?? 0.75]);
  return out;
}

const WIDTH_LEVELS = 9;

/**
 * Builds the SVG geometry for one stroke in a viewBox of `width`×`height`.
 * `baseWidth` is the full-load line width in viewBox units.
 */
export function strokeShape(
  points: readonly number[][],
  width: number,
  height: number,
  baseWidth: number,
): StrokeShape | null {
  if (!points.length) return null;
  const scaled = points.map((p) => [p[0]! * width, p[1]! * height, p[2] ?? 0.75]);
  // Drop exact repeats; they break tangents.
  const pts: number[][] = [];
  for (const p of scaled) {
    const prev = pts[pts.length - 1];
    if (!prev || Math.hypot(p[0]! - prev[0]!, p[1]! - prev[1]!) > 0.05) pts.push(p);
  }

  const widthAt = (load: number) => baseWidth * (0.38 + 0.62 * clamp(load, 0, 1));

  if (pts.length === 1) {
    const p = pts[0]!;
    return {
      runs: [],
      spine: `M${fmt(p[0]!)} ${fmt(p[1]!)}`,
      maxWidth: widthAt(p[2]!),
      dot: { cx: p[0]!, cy: p[1]!, r: widthAt(p[2]!) * 0.55 },
    };
  }

  const dense = densify(pts, Math.max(1.5, baseWidth * 0.35));
  // Arc length for the tapered entry and the lifted exit of the nib.
  const lengths = [0];
  for (let i = 1; i < dense.length; i++) {
    lengths.push(
      lengths[i - 1]! +
        Math.hypot(dense[i]![0]! - dense[i - 1]![0]!, dense[i]![1]! - dense[i - 1]![1]!),
    );
  }
  const total = lengths[lengths.length - 1]!;
  const entry = Math.min(total * 0.25, baseWidth * 1.6);
  const exit = Math.min(total * 0.3, baseWidth * 2.4);
  const widths = dense.map((p, i) => {
    const s = lengths[i]!;
    let taper = 1;
    if (entry > 0 && s < entry) taper = Math.min(taper, 0.62 + 0.38 * (s / entry));
    if (exit > 0 && total - s < exit) taper = Math.min(taper, 0.42 + 0.58 * ((total - s) / exit));
    return widthAt(p[2]!) * taper;
  });
  const maxWidth = Math.max(...widths);
  const minWidth = Math.min(...widths);
  const span = Math.max(1e-6, maxWidth - minWidth);
  const level = (w: number) =>
    maxWidth - minWidth < baseWidth * 0.04
      ? 0
      : Math.round(((w - minWidth) / span) * (WIDTH_LEVELS - 1));
  const levelWidth = (l: number) =>
    maxWidth - minWidth < baseWidth * 0.04
      ? maxWidth
      : minWidth + (span * l) / (WIDTH_LEVELS - 1);

  const runs: InkRun[] = [];
  let start = 0;
  let current = level(widths[0]!);
  const pushRun = (from: number, to: number, l: number) => {
    const slice = dense.slice(from, to + 1);
    if (slice.length < 2) {
      const p = slice[0]!;
      runs.push({ d: `M${fmt(p[0]!)} ${fmt(p[1]!)}l0 0`, width: levelWidth(l) });
      return;
    }
    runs.push({
      d:
        `M${fmt(slice[0]![0]!)} ${fmt(slice[0]![1]!)}` +
        slice
          .slice(1)
          .map((p) => `L${fmt(p[0]!)} ${fmt(p[1]!)}`)
          .join(""),
      width: levelWidth(l),
    });
  };
  for (let i = 1; i < dense.length; i++) {
    const l = level(widths[i]!);
    if (l !== current) {
      pushRun(start, i, current);
      start = i;
      current = l;
    }
  }
  pushRun(start, dense.length - 1, current);

  const spine =
    `M${fmt(dense[0]![0]!)} ${fmt(dense[0]![1]!)}` +
    dense
      .slice(1)
      .map((p) => `L${fmt(p[0]!)} ${fmt(p[1]!)}`)
      .join("");

  return { runs, spine, maxWidth };
}
