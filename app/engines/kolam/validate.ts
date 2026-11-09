/**
 * Design validation. Works from the emitted path data (parsed back), so it
 * checks what is actually drawn, not just the intent.
 */
import {
  SegmentIndex,
  applyOp,
  cubicAt,
  flatten,
  parsePath,
  type Pt,
} from "./geometry";
import { isColourName } from "./palette";
import { minLoops, symmetryGridOps, traceLoops } from "./pulli";
import { MOTIF_NAMES, type Design, type Region, type Validation, type ValidationCheck } from "./types";

type Checkable = Pick<Design, "params" | "regions" | "meta"> & Partial<Pick<Design, "dots">>;

const CLOSE_EPS = 0.01;
const SYM_EPS = 1.0;

function safeParse(d: string) {
  try {
    return parsePath(d);
  } catch {
    return []; // reported by the curves-closed check
  }
}

function regionPolylines(r: Region, n = 24): Pt[][] {
  return safeParse(r.d).map((sp) => flatten(sp.cubics, n));
}

/** Samples at t = (s + 0.5) / n: the same point set whichever way a path runs. */
function midSamples(r: Region, n = 6): Pt[] {
  const out: Pt[] = [];
  for (const sp of safeParse(r.d))
    for (const c of sp.cubics) for (let s = 0; s < n; s++) out.push(cubicAt(c, (s + 0.5) / n));
  return out;
}

function centroid(pls: Pt[][]): Pt {
  let x = 0;
  let y = 0;
  let k = 0;
  for (const pl of pls)
    for (const p of pl) {
      x += p[0];
      y += p[1];
      k++;
    }
  return k ? [x / k, y / k] : [0, 0];
}

export function validateDesign(design: Checkable): Validation {
  const checks: ValidationCheck[] = [];
  const add = (id: string, ok: boolean, detail: string, severity: "error" | "info" = "error") =>
    checks.push({ id, ok, detail, severity });
  const { params, regions, meta } = design;

  // ---- params ----
  if (params.kind === "pulli") {
    const okGrid = Number.isInteger(params.grid) && params.grid >= 3 && params.grid <= 9;
    add("grid-size", okGrid, `grid ${params.grid}×${params.grid} (allowed 3..9)`);
    add(
      "symmetry-type",
      ["2-fold", "4-fold", "8-fold"].includes(params.symmetry),
      `symmetry ${params.symmetry}`,
    );
  } else if (params.kind === "rangoli") {
    add("ring-count", params.rings >= 2 && params.rings <= 5 && meta.ringCount === params.rings, `${meta.ringCount} motif rings (asked ${params.rings}, allowed 2..5)`);
    add("petal-count", params.petals >= 6 && params.petals <= 16, `${params.petals} petals (allowed 6..16)`);
    const badMotifs = params.motifs.filter((m) => !MOTIF_NAMES.includes(m));
    add("motifs-known", params.motifs.length > 0 && badMotifs.length === 0, badMotifs.length ? `unknown motifs: ${badMotifs.join(", ")}` : `motifs: ${params.motifs.join(", ")}`);
  } else {
    add("ring-count", params.rings >= 3 && params.rings <= 7 && meta.ringCount === params.rings, `${meta.ringCount} flower rings (asked ${params.rings}, allowed 3..7)`);
  }

  // ---- ids & palette ----
  const ids = new Set<string>();
  const dup: string[] = [];
  for (const r of regions) {
    if (ids.has(r.id)) dup.push(r.id);
    ids.add(r.id);
  }
  add("region-ids-unique", dup.length === 0, dup.length ? `duplicate ids: ${dup.join(", ")}` : `${regions.length} unique region ids`);
  const badFills = regions.filter((r) => r.fill !== "none" && !isColourName(r.fill)).map((r) => `${r.id}:${r.fill}`);
  const badPalette = (params.palette ?? []).filter((c) => !isColourName(c));
  add(
    "palette-known",
    badFills.length === 0 && badPalette.length === 0,
    badFills.length || badPalette.length ? `unknown colours: ${[...badFills, ...badPalette].join(", ")}` : "all colours are known names",
  );

  // ---- closed curves ----
  let open = 0;
  let subpaths = 0;
  const openIds: string[] = [];
  for (const r of regions) {
    let parsed;
    try {
      parsed = parsePath(r.d);
    } catch {
      openIds.push(r.id);
      open++;
      continue;
    }
    for (const sp of parsed) {
      subpaths++;
      const first = sp.cubics[0];
      const last = sp.cubics[sp.cubics.length - 1];
      const closed =
        sp.closed &&
        !!first &&
        !!last &&
        Math.hypot(first.p0[0] - last.p3[0], first.p0[1] - last.p3[1]) <= CLOSE_EPS;
      if (!closed) {
        open++;
        openIds.push(r.id);
      }
    }
  }
  add("curves-closed", open === 0, open ? `open sub-paths in: ${[...new Set(openIds)].join(", ")}` : `${subpaths} sub-paths, all closed`);

  // ---- pulli specifics ----
  const lineRegions = regions.filter((r) => r.role === "line");
  if (params.kind === "pulli") {
    const n = params.grid;
    const mirrors = new Set(meta.mirrors ?? []);
    const traced = traceLoops(n, mirrors).length;
    add(
      "loop-count",
      traced === meta.loopCount && lineRegions.length === traced,
      `${lineRegions.length} drawn loop(s), ${traced} traced from the mirror layout`,
    );
    const floor = minLoops(n, params.symmetry);
    add(
      "single-line",
      traced === 1,
      traced === 1
        ? "one continuous line (ek hi rekha)"
        : `${traced} separate loops (fewest possible for ${n}×${n} ${params.symmetry}: ${floor})`,
      "info",
    );
    if ((params.loops ?? "single") === "single")
      add("fewest-loops", traced === floor, `${traced} loop(s); fewest possible ${floor}`);
    // Mirror layout invariant under the symmetry generators.
    const ops = symmetryGridOps(n, params.symmetry);
    const broken = ops.filter((op) =>
      [...mirrors].some((k) => {
        const [x, y] = k.split(",").map(Number);
        const [nx, ny] = op.f([x, y]);
        return !mirrors.has(`${nx},${ny}`);
      }),
    );
    add(
      "symmetry-mirrors",
      broken.length === 0,
      broken.length ? `mirror layout breaks ${broken.map((b) => b.name).join(", ")}` : `mirror layout invariant under ${ops.map((o) => o.name).join(", ")}`,
    );
    // Every dot ringed by the line: rays to each neighbour / out of the grid cross it.
    const loopPolys = lineRegions.flatMap((r) => regionPolylines(r));
    const index = new SegmentIndex(loopPolys, 25);
    const dots = design.dots ?? [];
    const spacing = dots.length > 1 ? Math.abs(dots[1].cx - dots[0].cx) : 100;
    const loose: string[] = [];
    for (const d of dots) {
      const rays: Pt[] = [
        [d.cx + spacing * 0.95, d.cy],
        [d.cx - spacing * 0.95, d.cy],
        [d.cx, d.cy + spacing * 0.95],
        [d.cx, d.cy - spacing * 0.95],
      ];
      if (!rays.every((q) => index.crosses([d.cx, d.cy], q))) loose.push(d.id);
    }
    add(
      "dots-enclosed",
      dots.length === n * n && loose.length === 0,
      loose.length ? `dots not ringed: ${loose.join(" ")}` : `all ${dots.length} dots ringed by the line`,
    );
  }

  // ---- geometric symmetry ----
  const symFail: string[] = [];
  const areas = regions.filter((r) => r.role === "area");
  const areaSamples = areas.map((r) => midSamples(r));
  const areaCentroids = areaSamples.map((s) => centroid([s]));
  const areaIndex = areas.map((r) => new SegmentIndex(regionPolylines(r), 30));
  const lineIndex = new SegmentIndex(lineRegions.flatMap((r) => regionPolylines(r)), 30);
  const lineSamples = lineRegions.flatMap((r) => midSamples(r));
  for (const op of meta.symmetryOps) {
    let worst = 0;
    areas.forEach((r, i) => {
      // Concentric regions share a centroid, so try every candidate near the
      // rotated centroid and keep the best fit.
      const c = applyOp(op.m, areaCentroids[i]);
      const moved = areaSamples[i].map((p) => applyOp(op.m, p));
      let bestFit = Infinity;
      areaCentroids.forEach((c2, j) => {
        if (Math.hypot(c2[0] - c[0], c2[1] - c[1]) > SYM_EPS * 2) return;
        if (areas[j].role !== r.role) return;
        let w = 0;
        for (const p of moved) {
          w = Math.max(w, areaIndex[j].nearest(p));
          if (w > bestFit) break;
        }
        bestFit = Math.min(bestFit, w);
      });
      worst = Math.max(worst, bestFit);
    });
    for (const p of lineSamples) worst = Math.max(worst, lineIndex.nearest(applyOp(op.m, p)));
    if (worst > SYM_EPS) symFail.push(`${op.name} (off by ${worst === Infinity ? "∞" : worst.toFixed(2)}px)`);
  }
  add(
    "symmetry-geometry",
    symFail.length === 0,
    symFail.length ? `geometry not invariant under ${symFail.join(", ")}` : `geometry invariant under ${meta.symmetryOps.map((o) => o.name).join(", ")} (${meta.symmetry})`,
  );

  const valid = checks.every((c) => c.ok || c.severity === "info");
  return { valid, checks };
}
