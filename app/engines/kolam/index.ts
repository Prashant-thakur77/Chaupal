/**
 * Kolam / rangoli / pookalam engine. Pure TS, no DOM: runs in Node and in a
 * Cloudflare Worker. The provider owns the drawing; callers only pick
 * parameters, then fill regions by id or zone.
 */
import { describeDesign } from "./describe";
import { isColourName } from "./palette";
import { buildPookalam } from "./pookalam";
import { PRESETS, isFestival, presetParams, type Festival } from "./presets";
import { buildPulli } from "./pulli";
import { buildRangoli } from "./rangoli";
import { renderSvg } from "./svg";
import { MOTIF_NAMES, type ColourName, type Design, type DesignParams } from "./types";
import { validateDesign } from "./validate";

export * from "./types";
export { COLOURS, CHALK, PREVIEW_BG, resolveColour, normalizeWord } from "./palette";
export { applyFills, renderSvg, type ApplyFillsResult } from "./svg";
export { parseFillPhrase, resolveZone, canonicalZone } from "./zones";
export { validateDesign } from "./validate";
export { describeDesign, describeFills } from "./describe";
export { FESTIVALS, PRESETS, presetParams, type Festival, type Preset } from "./presets";
export { minLoops } from "./pulli";

function intIn(v: unknown, lo: number, hi: number): boolean {
  return typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi;
}

/** Throws a RangeError naming the bad field; returns nothing when params are usable. */
export function assertParams(params: DesignParams): void {
  const bad = (msg: string) => {
    throw new RangeError(`kolam: ${msg}`);
  };
  const palette = (params as { palette?: unknown }).palette;
  if (palette !== undefined) {
    if (!Array.isArray(palette) || palette.some((c) => typeof c !== "string" || !isColourName(c)))
      bad(`palette must be colour names (${JSON.stringify(palette)})`);
  }
  switch (params.kind) {
    case "pulli":
      if (!intIn(params.grid, 3, 9)) bad(`grid must be an integer 3..9 (got ${params.grid})`);
      if (!["2-fold", "4-fold", "8-fold"].includes(params.symmetry)) bad(`symmetry must be 2-fold, 4-fold or 8-fold`);
      if (params.loops !== undefined && params.loops !== "single" && params.loops !== "any") bad(`loops must be "single" or "any"`);
      if (params.seed !== undefined && !Number.isFinite(params.seed)) bad(`seed must be a number`);
      return;
    case "rangoli":
      if (params.template !== "radial") bad(`template must be "radial"`);
      if (!intIn(params.rings, 2, 5)) bad(`rings must be an integer 2..5 (got ${params.rings})`);
      if (!intIn(params.petals, 6, 16)) bad(`petals must be an integer 6..16 (got ${params.petals})`);
      if (!Array.isArray(params.motifs) || !params.motifs.length || params.motifs.some((m) => !MOTIF_NAMES.includes(m)))
        bad(`motifs must be a non-empty list of ${MOTIF_NAMES.join(", ")}`);
      return;
    case "pookalam":
      if (!intIn(params.rings, 3, 7)) bad(`rings must be an integer 3..7 (got ${params.rings})`);
      return;
    default:
      bad(`unknown kind ${(params as { kind?: unknown }).kind}`);
  }
}

/** Generate a design. Same params (and seed) → byte-identical output. */
export function generateDesign(params: DesignParams): Design {
  assertParams(params);
  const p = structuredClone(params);
  let built: Pick<Design, "regions" | "decorations" | "meta"> & Partial<Pick<Design, "dots" | "loops">>;
  if (p.kind === "pulli") {
    const b = buildPulli(p);
    built = { regions: b.regions, decorations: [], meta: b.meta, dots: b.dots, loops: b.loops };
  } else if (p.kind === "rangoli") built = buildRangoli(p);
  else built = buildPookalam(p);

  const base = { params: p, kind: p.kind, ...built };
  const validation = validateDesign(base);
  const alt = describeDesign(base);
  const draft = { ...base, validation, altHi: alt.hi, altEn: alt.en };
  return { ...draft, svg: renderSvg(draft) };
}

export interface DesignSuggestion {
  labelHi: string;
  labelEn: string;
  params: DesignParams;
  /** Colours that suit the design, if the elder wants a starting point. */
  suggestedPalette?: ColourName[];
}

/**
 * Two or three parameter sets to offer. Festival presets are used only when a
 * festival is passed.
 */
export function suggestDesigns(context: { festival?: string; small?: boolean } = {}): DesignSuggestion[] {
  const fest = context.festival?.toLowerCase();
  const small = !!context.small;
  const pulli = (grid: number): DesignSuggestion => ({
    labelHi: `${grid}×${grid} बिंदुओं का पुल्ली कोलम, एक ही रेखा`,
    labelEn: `${grid}×${grid} pulli kolam, one continuous line`,
    params: { kind: "pulli", grid, symmetry: "4-fold", loops: "single", seed: 0 },
  });
  if (fest && isFestival(fest)) {
    const preset = PRESETS[fest as Festival];
    const plain = presetParams(fest as Festival);
    const palette = plain.palette;
    delete plain.palette;
    const out: DesignSuggestion[] = [
      { labelHi: preset.labelHi, labelEn: preset.labelEn, params: presetParams(fest as Festival) },
      {
        labelHi: `${preset.labelHi} (बिना रंग, खुद भरें)`,
        labelEn: `${preset.labelEn} (uncoloured, fill it yourself)`,
        params: plain,
        ...(palette ? { suggestedPalette: palette } : {}),
      },
    ];
    out.push(pulli(small ? 3 : fest === "pongal" ? 7 : 5));
    return out;
  }
  if (small)
    return [
      pulli(3),
      pulli(5),
      {
        labelHi: "छोटी गोल रंगोली: कमल की पंखुड़ियाँ",
        labelEn: "Small radial rangoli with lotus petals",
        params: { kind: "rangoli", template: "radial", rings: 2, motifs: ["lotus"], petals: 8 },
        suggestedPalette: ["gulabi", "peela", "hara"],
      },
    ];
  return [
    pulli(5),
    {
      labelHi: "गोल रंगोली: कमल और ज्यामितीय नमूने",
      labelEn: "Radial rangoli with lotus and geometric motifs",
      params: { kind: "rangoli", template: "radial", rings: 3, motifs: ["lotus", "geometric"], petals: 8 },
      suggestedPalette: ["gulabi", "peela", "hara", "kesariya"],
    },
    {
      labelHi: "फूलों का पूकलम, 4 घेरे",
      labelEn: "Flower pookalam with 4 rings",
      params: { kind: "pookalam", rings: 4 },
      suggestedPalette: ["peela", "kesariya", "safed", "laal", "hara"],
    },
  ];
}
