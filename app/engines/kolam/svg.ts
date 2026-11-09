/**
 * Exact SVG output. One element per line so diffs are line-exact: applyFills
 * changes only the lines of the regions whose fill changed.
 */
import { fmt } from "./geometry";
import { CHALK, fillHex, normalizeWord, resolveColour } from "./palette";
import type { Design, FillRequest, FillValue, Region } from "./types";
import { resolveZone } from "./zones";

const AREA_STROKE = 2.2;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function regionAttrs(r: Region): string {
  return (
    `id="r-${esc(r.id)}" data-region-id="${esc(r.id)}" data-zone="${esc(r.zone)}" ` +
    `data-zones="${esc(r.zones.join(" "))}" data-fill="${r.fill}"`
  );
}

export function regionElement(r: Region, lineWidth: number): string {
  if (r.role === "area") {
    return `<path ${regionAttrs(r)} fill="${fillHex(r.fill)}" stroke="${CHALK}" stroke-width="${AREA_STROKE}" pointer-events="all" d="${r.d}"/>`;
  }
  if (r.role === "line") {
    const stroke = r.fill === "none" ? CHALK : fillHex(r.fill);
    const loopAttr = r.loop !== undefined ? ` data-loop="${r.loop}"` : "";
    return `<path ${regionAttrs(r)}${loopAttr} fill="none" stroke="${stroke}" stroke-width="${fmt(lineWidth)}" d="${r.d}"/>`;
  }
  // dots
  const colour = r.fill === "none" ? CHALK : fillHex(r.fill);
  const circles = (r.dots ?? []).map(
    (d) => `<circle data-dot="${d.id}" cx="${fmt(d.cx)}" cy="${fmt(d.cy)}" r="${fmt(d.r)}"/>`,
  );
  return [`<g ${regionAttrs(r)} fill="${colour}">`, ...circles, `</g>`].join("\n");
}

export function renderSvg(design: Omit<Design, "svg">): string {
  const { params, meta, validation } = design;
  const attrs: string[] = [
    `xmlns="http://www.w3.org/2000/svg"`,
    `viewBox="0 0 1000 1000"`,
    `width="1000"`,
    `height="1000"`,
    `data-kind="${params.kind}"`,
  ];
  if (params.kind === "pulli") attrs.push(`data-grid="${params.grid}"`);
  else attrs.push(`data-rings="${params.rings}"`);
  if (params.kind === "rangoli") attrs.push(`data-petals="${params.petals}"`);
  attrs.push(`data-symmetry="${meta.symmetry}"`);
  if (meta.loopCount !== undefined) attrs.push(`data-loop-count="${meta.loopCount}"`);
  attrs.push(`data-valid="${validation.valid}"`);

  const lw = meta.lineWidth ?? 6;
  const lines: string[] = [`<svg ${attrs.join(" ")}>`];
  lines.push(`<title>${esc(design.altEn)}</title>`);
  lines.push(`<desc>${esc(design.altHi)}</desc>`);
  lines.push(`<g data-layer="areas" stroke-linejoin="round">`);
  for (const r of design.regions) if (r.role === "area") lines.push(regionElement(r, lw));
  lines.push(`</g>`);
  if (design.decorations.length) {
    lines.push(`<g data-layer="detail" stroke-linejoin="round" stroke-linecap="round">`);
    for (const dec of design.decorations) {
      lines.push(
        dec.style === "fill"
          ? `<path data-detail="${esc(dec.id)}" fill="${CHALK}" stroke="none" d="${dec.d}"/>`
          : `<path data-detail="${esc(dec.id)}" fill="none" stroke="${CHALK}" stroke-width="${AREA_STROKE}" d="${dec.d}"/>`,
      );
    }
    lines.push(`</g>`);
  }
  const lineRegions = design.regions.filter((r) => r.role === "line");
  if (lineRegions.length) {
    lines.push(`<g data-layer="lines" stroke-linejoin="round" stroke-linecap="round">`);
    for (const r of lineRegions) lines.push(regionElement(r, lw));
    lines.push(`</g>`);
  }
  for (const r of design.regions) if (r.role === "dots") lines.push(regionElement(r, lw));
  lines.push(`</svg>`);
  return lines.join("\n");
}

export interface ApplyFillsResult {
  design: Design;
  svg: string;
  /** Region ids whose fill actually changed. */
  changed: string[];
  /** Requests that could not be resolved (unknown colour, zone or region). */
  unresolved: { request: FillRequest; reason: string }[];
}

/**
 * Apply fills by region id or zone. Returns a new design; the input is not
 * mutated, and only the targeted regions' fills change.
 */
export function applyFills(design: Design, fills: FillRequest[]): ApplyFillsResult {
  const next = new Map<string, FillValue>(design.regions.map((r) => [r.id, r.fill]));
  const unresolved: ApplyFillsResult["unresolved"] = [];
  for (const req of fills) {
    const cw = normalizeWord(req.colour);
    const colour: FillValue | undefined = cw === "none" || cw === "clear" ? "none" : resolveColour(cw);
    if (!colour) {
      unresolved.push({ request: req, reason: `unknown colour "${req.colour}"` });
      continue;
    }
    let ids: string[];
    if (req.regionId !== undefined) {
      ids = next.has(req.regionId) ? [req.regionId] : [];
      if (!ids.length) {
        unresolved.push({ request: req, reason: `unknown region "${req.regionId}"` });
        continue;
      }
    } else if (req.zone !== undefined) {
      ids = resolveZone(design, req.zone);
      if (!ids.length) {
        unresolved.push({ request: req, reason: `zone "${req.zone}" matches no region` });
        continue;
      }
    } else {
      unresolved.push({ request: req, reason: "no regionId or zone" });
      continue;
    }
    for (const id of ids) next.set(id, colour);
  }
  const changed: string[] = [];
  const regions = design.regions.map((r) => {
    const f = next.get(r.id)!;
    if (f === r.fill) return r;
    changed.push(r.id);
    return { ...r, fill: f };
  });
  const base = { ...design, regions };
  const svg = changed.length ? renderSvg(base) : design.svg;
  return { design: { ...base, svg }, svg, changed, unresolved };
}
