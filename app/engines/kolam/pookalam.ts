/**
 * Pookalam: concentric flower rings. Each ring is bounded by petal-edged
 * curves (scalloped or pointed) and split into petal segments, each ring set
 * half a petal round from the one inside it. Segments tile each ring exactly:
 * neighbouring regions share the same boundary cubics.
 *
 * Region ids: center, center-inner, ring-<k>-seg-<m> (k = 1 inner .. n outer).
 */
import { circle, line, polar, polarCurve, reverseSubPath, rotationMatrix, shapeToPath, type Cubic } from "./geometry";
import type { Decoration, FillValue, PookalamParams, Region } from "./types";
import type { RadialBuild } from "./rangoli";

const R_OUT = 474;
const R0 = 58;
const BASE = 8;

type Style = "round" | "point";

interface Boundary {
  r: (t: number) => number;
  /** Subdivision count per full turn (all segment endpoints lie on it). */
  grid: number;
}

/** Petal-edged boundary: crests at phase + 2πj/C, valleys halfway between. */
function boundaryFn(R: number, A: number, C: number, phase: number, style: Style): (t: number) => number {
  return (t) => {
    let u = (C * (t - phase)) / 2;
    u = u - Math.PI * Math.round(u / Math.PI); // fold into [-π/2, π/2]
    const x = Math.min(1, Math.abs(u) / (Math.PI / 2));
    // round: near-semicircular scallop; point: convex sides meeting in a tip
    const f = style === "round" ? Math.pow(1 - x * x, 0.62) : Math.pow(1 - x, 0.45);
    return R - A * (1 - f);
  };
}

/** Polar curve along boundary b from angle a0 to a1 (a0 < a1), split on its grid. */
function piece(b: Boundary, a0: number, a1: number): Cubic[] {
  const step = (2 * Math.PI) / b.grid;
  const angles = [a0];
  let g = Math.floor(a0 / step + 1e-7) + 1;
  while (g * step < a1 - 1e-7) {
    angles.push(g * step);
    g++;
  }
  angles.push(a1);
  return polarCurve(b.r, angles);
}

export function buildPookalam(params: PookalamParams): RadialBuild {
  const n = params.rings;
  const radii: number[] = [];
  for (let k = 0; k <= n; k++) radii.push(R0 + (R_OUT - R0) * Math.pow(k / n, 0.92));
  // Segment counts: keep, or double when petals would get too wide.
  const counts: number[] = [BASE];
  for (let k = 1; k <= n; k++) {
    const rm = (radii[k - 1] + radii[k]) / 2;
    const hk = radii[k] - radii[k - 1];
    const prev = counts[k - 1];
    counts.push((2 * Math.PI * rm) / prev > 1.7 * hk ? prev * 2 : prev);
  }
  // Each ring's petals sit half a step round from the ring inside it.
  const phases: number[] = [0];
  for (let k = 1; k <= n; k++) phases.push(phases[k - 1] + Math.PI / counts[k]);
  const style = (k: number): Style => (k === n || (n >= 5 && k === 2) ? "point" : "round");

  const boundaries: Boundary[] = [];
  for (let k = 0; k <= n; k++) {
    const hk = k === 0 ? R0 : radii[k] - radii[k - 1];
    const halfChord = radii[k] * Math.sin(Math.PI / counts[k]);
    const A = k === 0 ? R0 * 0.24 : Math.min(hk * (style(k) === "point" ? 0.62 : 0.46), halfChord * (style(k) === "point" ? 1.4 : 0.85));
    const finest = counts[Math.min(k + 1, n)];
    boundaries.push({ r: boundaryFn(radii[k], A, counts[k], phases[k], style(k)), grid: finest * 4 });
  }

  const all = params.palette ?? [];
  // Green, when present, is kept for the outer ring of leaves.
  const leafOuter = all.includes("hara") && all.length > 2;
  const pal = leafOuter ? all.filter((c) => c !== "hara") : all;
  const L = pal.length;
  const colourFor = (k: number, m: number): FillValue => {
    if (!L) return "none";
    if (k === n && leafOuter) return "hara";
    const doubled = counts[k] > counts[k - 1];
    return doubled && m % 2 === 1 ? pal[(k + 2) % L] : pal[k % L];
  };

  const regions: Region[] = [];
  const decorations: Decoration[] = [];

  // centre flower
  const g0 = boundaries[0].grid;
  regions.push({
    id: "center",
    zone: "center",
    zones: ["center"],
    role: "area",
    fill: L ? pal[0] : "none",
    d: shapeToPath([polarCurve(boundaries[0].r, Array.from({ length: g0 + 1 }, (_, i) => (i * 2 * Math.PI) / g0))]),
  });
  const inner: Region = {
    id: "center-inner",
    zone: "center-accent",
    zones: ["center-accent", "accent"],
    role: "area",
    fill: L ? pal[(n + 1) % L] : "none",
    d: shapeToPath([circle([500, 500], R0 * 0.38)]),
  };
  decorations.push({ id: "center-bindu", style: "fill", d: shapeToPath([circle([500, 500], 4.5)]) });

  for (let k = 1; k <= n; k++) {
    const C = counts[k];
    const bIn = boundaries[k - 1];
    const bOut = boundaries[k];
    const span = (2 * Math.PI) / C;
    const divider = (a: number): Cubic => line(polar(bIn.r(a), a), polar(bOut.r(a), a));
    for (let m = 0; m < C; m++) {
      // segment centred on its outer petal crest; dividers sit in the valleys
      let a0 = phases[k] + (m - 0.5) * span;
      a0 = a0 - 2 * Math.PI * Math.floor(a0 / (2 * Math.PI));
      const a1 = a0 + span;
      const sp: Cubic[] = [
        ...piece(bIn, a0, a1),
        divider(a1),
        ...reverseSubPath(piece(bOut, a0, a1)),
        ...reverseSubPath([divider(a0)]),
      ];
      const zones = [`ring-${k}`, "segment", `segment-${m + 1}`];
      if (k === n) zones.push("outer", "border");
      regions.push({ id: `ring-${k}-seg-${m + 1}`, zone: `ring-${k}`, zones, role: "area", fill: colourFor(k, m), d: shapeToPath([sp]) });
      // chalk bindu near each rounded petal crest
      if (style(k) === "round") {
        const ac = a0 + span / 2;
        const rr = bOut.r(ac) - (radii[k] - radii[k - 1]) * 0.3;
        decorations.push({ id: `ring-${k}-bindu-${m + 1}`, style: "fill", d: shapeToPath([circle(polar(rr, ac), 3.2)]) });
      }
    }
  }
  regions.push(inner);

  return {
    regions,
    decorations,
    meta: {
      symmetry: `${BASE}-fold`,
      symmetryOps: [{ name: "rot45", m: rotationMatrix((2 * Math.PI) / BASE) }],
      ringCount: n,
    },
  };
}
