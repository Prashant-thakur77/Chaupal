/**
 * Radial rangoli: centre medallion, a ring of petals, motif rings, and a
 * scalloped border. Every motif part and every ring band is a fillable region.
 *
 * Region ids:
 *   center, center-petal-<m>                 medallion and its small flower
 *   ring-1-petal-<m>, ring-1-petal-<m>-inner petal ring around the medallion
 *   ring-<k>-<motif>-<m>[-part]              motif instance m in ring k
 *   ring-<k>-band                            the band behind ring k
 *   border                                   scalloped outer border
 */
import {
  arc,
  circle,
  polar,
  polarCurve,
  radialFrame,
  reverseSubPath,
  rotationMatrix,
  shapeToOpenPath,
  shapeToPath,
  type Shape,
  type SubPath,
} from "./geometry";
import { buildMotif, petal, transform } from "./motifs";
import type { Decoration, DesignMeta, FillValue, MotifName, RangoliParams, Region } from "./types";

const R_OUT = 474;
const BORDER_W = 30;
const R0 = 66;

function annulus(rIn: number, rOut: number): Shape {
  const outer = arc(rOut, 0, 2 * Math.PI);
  const inner = rIn > 0 ? reverseSubPath(arc(rIn, 0, 2 * Math.PI)) : [];
  return inner.length ? [outer, inner] : [outer];
}

export interface RadialBuild {
  regions: Region[];
  decorations: Decoration[];
  meta: DesignMeta;
}

export function ringMotif(params: RangoliParams, k: number, m: number): MotifName {
  const motifRings = params.rings - 1;
  const L = params.motifs.length;
  const alternate = L > motifRings;
  const base = (k - 2) % L;
  if (!alternate || m % 2 === 0) return params.motifs[base];
  return params.motifs[(base + motifRings) % L];
}

export function buildRangoli(params: RangoliParams): RadialBuild {
  const P = params.petals;
  const R = params.rings;
  const rB = R_OUT - BORDER_W;
  const weights = Array.from({ length: R }, (_, i) => (i === 0 ? 0.9 : 1));
  const wsum = weights.reduce((a, b) => a + b, 0);
  const radii: number[] = [R0];
  for (let i = 0; i < R; i++) radii.push(radii[i] + ((rB - R0) * weights[i]) / wsum);
  const pal = params.palette ?? [];
  const pc = (i: number): FillValue => (pal.length ? pal[((i % pal.length) + pal.length) % pal.length] : "none");
  const flameColour: FillValue = pal.length ? (pal.includes("peela") ? "peela" : pal.includes("kesariya") ? "kesariya" : pc(1)) : "none";

  const bands: Region[] = [];
  const mains: Region[] = [];
  const accents: Region[] = [];
  const decorations: Decoration[] = [];
  const motifsUsed = new Set<MotifName>();

  // ---- bands ----
  for (let k = 1; k <= R; k++) {
    const id = `ring-${k}-band`;
    bands.push({ id, zone: id, zones: [id, "band"], role: "area", fill: "none", d: shapeToPath(annulus(radii[k - 1], radii[k])) });
  }

  // ---- centre medallion ----
  mains.push({ id: "center", zone: "center", zones: ["center", "medallion"], role: "area", fill: pc(0), d: shapeToPath([circle([500, 500], R0)]) });
  const cpH = R0 * 0.72;
  for (let m = 0; m < P; m++) {
    const theta = (m * 2 * Math.PI) / P;
    const W = 2 * (8 + cpH * 0.4) * Math.sin(Math.PI / P) * 1.5;
    const sp = transform(petal(Math.min(W, cpH * 0.55), cpH, 0), radialFrame(theta, 8));
    accents.push({
      id: `center-petal-${m + 1}`,
      zone: "center-accent",
      zones: ["center-accent", "accent"],
      role: "area",
      fill: pal.length ? pc(2) : "none",
      d: shapeToPath([sp]),
    });
  }
  decorations.push({ id: "center-bindu", style: "fill", d: shapeToPath([circle([500, 500], 5)]) });

  // ---- ring 1: petals ----
  {
    const r0 = radii[0];
    const h = (radii[1] - r0) * 0.95;
    for (let m = 0; m < P; m++) {
      const theta = (m * 2 * Math.PI) / P;
      const W = 2 * (r0 + h * 0.36) * Math.sin(Math.PI / P) * 1.04;
      const frame = radialFrame(theta, r0);
      const id = `ring-1-petal-${m + 1}`;
      const zones = ["ring-1", "petal", `petal-${m + 1}`];
      if (R === 1) zones.push("outer");
      mains.push({ id, zone: "ring-1", zones, role: "area", fill: pc(1), d: shapeToPath([transform(petal(W, h * 0.98), frame)]) });
      accents.push({
        id: `${id}-inner`,
        zone: "ring-1-accent",
        zones: ["ring-1-accent", "accent", "petal-accent"],
        role: "area",
        fill: pal.length ? pc(3) : "none",
        d: shapeToPath([transform(petal(W * 0.42, h * 0.62, h * 0.2), frame)]),
      });
    }
  }

  // ---- motif rings ----
  for (let k = 2; k <= R; k++) {
    const rin = radii[k - 1];
    const rout = radii[k];
    const hk = rout - rin;
    const rm = (rin + rout) / 2;
    const alternate = params.motifs.length > R - 1;
    let mult = Math.max(1, Math.round((2 * Math.PI * rm) / (P * hk * 0.95)));
    if (alternate && mult % 2 === 1) mult += 1;
    const count = P * mult;
    const offset = k % 2 === 0 ? 0.5 : 0;
    const h = hk * 0.86;
    const W = 2 * (rin + h * 0.5) * Math.sin(Math.PI / count) * 0.94;
    for (let m = 0; m < count; m++) {
      const motif = ringMotif(params, k, m);
      motifsUsed.add(motif);
      const theta = ((m + offset) * 2 * Math.PI) / count;
      const frame = radialFrame(theta, rin + hk * 0.07);
      const built = buildMotif(motif, Math.min(W, h * 1.1), h);
      const baseId = `ring-${k}-${motif}-${m + 1}`;
      for (const part of built.parts) {
        const id = `${baseId}${part.suffix}`;
        const shape = [transform(part.shape, frame)];
        if (part.role === "main") {
          const zones = [`ring-${k}`, `motif-${motif}`, ...part.tags];
          if (k === R) zones.push("outer");
          mains.push({ id, zone: `ring-${k}`, zones, role: "area", fill: pc(k), d: shapeToPath(shape) });
        } else {
          const zones = [`ring-${k}-accent`, "accent", `motif-${motif}-accent`, ...part.tags];
          const fill: FillValue = part.tags.includes("flame") ? flameColour : pal.length ? pc(k + 2) : "none";
          accents.push({ id, zone: `ring-${k}-accent`, zones, role: "area", fill, d: shapeToPath(shape) });
        }
      }
      for (const det of built.details) {
        const shape = det.shape.map((sp) => transform(sp, frame));
        decorations.push({
          id: `${baseId}${det.suffix}`,
          style: det.style,
          d: det.open ? shapeToOpenPath(shape) : shapeToPath(shape),
        });
      }
      // bindu between neighbours, near the outer edge of the band
      const between = theta + Math.PI / count;
      const br = Math.max(2.5, Math.min(hk * 0.035, rm * Math.sin(Math.PI / count) * 0.12));
      decorations.push({ id: `ring-${k}-bindu-${m + 1}`, style: "fill", d: shapeToPath([circle(polar(rout - hk * 0.14, between), br)]) });
    }
  }

  // ---- scalloped border ----
  const S = P * Math.max(2, Math.round((2 * Math.PI * rB) / (P * 46)));
  const steps = S * 4;
  const angles = Array.from({ length: steps + 1 }, (_, i) => (i * 2 * Math.PI) / steps);
  const scallop = (t: number) => rB + BORDER_W * (0.35 + 0.65 * Math.abs(Math.cos((S * t) / 2)));
  const outer: SubPath = polarCurve(scallop, angles);
  const inner: SubPath = reverseSubPath(arc(rB, 0, 2 * Math.PI));
  const border: Region = { id: "border", zone: "border", zones: ["border"], role: "area", fill: pal.length ? pc(R + 1) : "none", d: shapeToPath([outer, inner]) };
  for (let i = 0; i < S; i++) {
    // scallop crests are at 2πi/S; a bindu sits in each one
    const t = (i * 2 * Math.PI) / S;
    decorations.push({ id: `border-bindu-${i + 1}`, style: "fill", d: shapeToPath([circle(polar(rB + BORDER_W * 0.5, t), 3.4)]) });
  }

  const regions = [...bands, ...mains, border, ...accents];
  const meta: DesignMeta = {
    symmetry: `${P}-fold`,
    symmetryOps: [{ name: `rot${fmtDeg(360 / P)}`, m: rotationMatrix((2 * Math.PI) / P) }],
    ringCount: R,
    motifs: params.motifs.filter((m) => motifsUsed.has(m)),
  };
  return { regions, decorations, meta };
}

function fmtDeg(d: number): string {
  return Number.isInteger(d) ? String(d) : d.toFixed(1);
}
