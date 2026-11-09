/**
 * Reference validation, ported from the base repo's reference-asset gate.
 *
 * - `validateReference(ref, requestedText)` checks a Sulekh vector render
 *   (REFERENCE_* codes).
 * - `validateAgentImage(input)` checks an agent-supplied raster with the
 *   base repo's pixel gate (REFERENCE_IMAGE_* codes, same thresholds and
 *   order) plus an exact NFC match of the OCR text.
 *
 * Every issue carries a repair hint so the agent can regenerate with the
 * named defect, as in the base repo's repair loop.
 */

import { decodePng, isPng, pngSize } from "./png";
import { detectScript, fontFor, SCRIPT_CATALOG, type ScriptId } from "./scripts";
import type { SulekhReference } from "./render";

export type ReferenceCode =
  | "REFERENCE_EMPTY"
  | "REFERENCE_TEXT_MISMATCH"
  | "REFERENCE_NOTDEF_GLYPH"
  | "REFERENCE_BROKEN_CLUSTER"
  | "REFERENCE_SCRIPT_MISMATCH"
  | "REFERENCE_OPAQUE_BACKGROUND"
  | "REFERENCE_INK_NOT_BLACK"
  | "REFERENCE_WRONG_RATIO"
  | "REFERENCE_CLIPPED"
  | "REFERENCE_INK_TOO_SMALL"
  | "REFERENCE_TOO_MANY_LINES";

export type AgentImageCode =
  | "REFERENCE_IMAGE_FORMAT_REQUIRES_PNG_OR_WEBP"
  | "REFERENCE_IMAGE_DECODE_FAILED"
  | "REFERENCE_IMAGE_INSPECTION_UNAVAILABLE"
  | "REFERENCE_IMAGE_TOO_SMALL:use_1536x1024"
  | "REFERENCE_IMAGE_REQUIRES_3_BY_2:use_1536x1024"
  | "REFERENCE_IMAGE_REQUIRES_TRUE_ALPHA"
  | "REFERENCE_IMAGE_NEEDS_TRANSPARENT_MARGIN"
  | "REFERENCE_IMAGE_FOREGROUND_INVALID"
  | "REFERENCE_IMAGE_NEEDS_BLACK_INK_ONLY"
  | "REFERENCE_IMAGE_INK_TOO_SMALL:fill_the_1536x1024_canvas"
  | "REFERENCE_IMAGE_NEEDS_SAFE_MARGIN"
  | "REFERENCE_OCR_REQUIRED"
  | "REFERENCE_TEXT_MISMATCH";

export interface ValidationIssue<C extends string = string> {
  code: C;
  message: string;
  /** What to change before regenerating. */
  repairHint: string;
  /** Machine-readable repair parameters, when there is a concrete fix. */
  repair?: Record<string, unknown>;
}

export interface ValidationResult<C extends string = string> {
  ok: boolean;
  /** First failing code (the base repo reports one code per rejection). */
  code?: C;
  issues: ValidationIssue<C>[];
}

const RATIO = 1.5;
const RATIO_TOLERANCE = 0.015;
const SAFE_MARGIN = 0.08;
/** Below this fill in both dimensions a vector reference is too small to trace. */
const MIN_VECTOR_FILL = 0.35;

function canonical(text: string): string {
  return text.normalize("NFC").trim().replace(/\s+/gu, " ");
}

function finish<C extends string>(issues: ValidationIssue<C>[]): ValidationResult<C> {
  return issues.length ? { ok: false, code: issues[0].code, issues } : { ok: true, issues };
}

function parseViewBox(svg: string): { w: number; h: number } | null {
  const m = /<svg\b[^>]*\bviewBox="\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/i.exec(svg);
  if (m) return { w: Number(m[3]), h: Number(m[4]) };
  const w = /<svg\b[^>]*\bwidth="([\d.]+)"/i.exec(svg);
  const h = /<svg\b[^>]*\bheight="([\d.]+)"/i.exec(svg);
  return w && h ? { w: Number(w[1]), h: Number(h[1]) } : null;
}

const BLACK = new Set(["#000", "#000000", "black", "rgb(0,0,0)", "none", "currentcolor"]);

export function validateReference(
  ref: SulekhReference,
  requestedText: string,
): ValidationResult<ReferenceCode> {
  const issues: ValidationIssue<ReferenceCode>[] = [];
  const svg = ref.svg ?? "";
  const requested = canonical(requestedText);
  const detected = detectScript(requested);
  const script: ScriptId = detected.script ?? ref.script;
  const style = ref.style ?? "kalam";
  const expectedFont = SCRIPT_CATALOG[script] ? fontFor(script, style).id : undefined;

  // Empty.
  const hasInk = /<path\b[^>]*\bd="[^"]*[Mm]/.test(svg);
  if (!requested || ref.glyphs === 0 || !hasInk || !ref.bbox || ref.bbox.width <= 0 || ref.bbox.height <= 0) {
    issues.push({
      code: "REFERENCE_EMPTY",
      message: "The reference has no visible ink.",
      repairHint: requested
        ? "Render again with the requested phrase as `text`; do not pass whitespace or an empty string."
        : "Ask the person (or choose) a phrase first; an empty phrase cannot be rendered.",
      repair: requested ? { text: requested } : undefined,
    });
  }

  // Exact text.
  const svgText = /data-sulekh-text="([^"]*)"/.exec(svg)?.[1];
  const svgTextDecoded = svgText
    ?.replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
  if (requested && (canonical(ref.textNFC ?? "") !== requested || (svgTextDecoded !== undefined && canonical(svgTextDecoded) !== requested))) {
    issues.push({
      code: "REFERENCE_TEXT_MISMATCH",
      message: `Rendered text "${ref.textNFC}" is not the requested "${requested}" (NFC compare).`,
      repairHint: "Render again with the exact requested phrase as `text`; never paraphrase, transliterate or drop matras.",
      repair: { text: requested },
    });
  }

  // Broken shaping.
  if (ref.notdefCount > 0) {
    issues.push({
      code: "REFERENCE_NOTDEF_GLYPH",
      message: `${ref.notdefCount} glyph(s) fell back to .notdef: the font does not cover this ${SCRIPT_CATALOG[script]?.nameEn ?? ""} text.`,
      repairHint: `Use the catalog font for the detected script (${script}/${style}: ${expectedFont}); do not pass a font from another script.`,
      repair: { script, style, fontId: expectedFont },
    });
  }
  if (ref.brokenClusterCount > 0) {
    issues.push({
      code: "REFERENCE_BROKEN_CLUSTER",
      message: `HarfBuzz inserted ${ref.brokenClusterCount} dotted circle(s): a vowel sign or virama has no base consonant.`,
      repairHint: "Check the phrase spelling (a matra or halant must follow a consonant); confirm the phrase with the person before rendering.",
    });
  }
  if (detected.script && ref.script !== detected.script) {
    issues.push({
      code: "REFERENCE_SCRIPT_MISMATCH",
      message: `Text is ${detected.script} but the reference was rendered as ${ref.script}.`,
      repairHint: `Render with script "${detected.script}" (detectScript(text)).`,
      repair: { script: detected.script, fontId: expectedFont },
    });
  }

  // Background and ink colour.
  if (
    /<(rect|image|foreignObject|pattern|feFlood)\b/i.test(svg) ||
    /background(-color)?\s*:/i.test(svg) ||
    /\bbackground="/i.test(svg)
  ) {
    issues.push({
      code: "REFERENCE_OPAQUE_BACKGROUND",
      message: "The SVG paints a background; references need real transparency.",
      repairHint: "Remove every rect/image/background; only black glyph paths on a transparent canvas.",
      repair: { background: "transparent" },
    });
  }
  const colours = [...svg.matchAll(/\b(?:fill|stroke)\s*[=:]\s*"?\s*([^";\s>]+)/gi)].map((m) =>
    m[1].toLowerCase().replace(/\s+/g, ""),
  );
  const nonBlack = colours.filter((c) => !BLACK.has(c));
  if (nonBlack.length && !issues.some((i) => i.code === "REFERENCE_OPAQUE_BACKGROUND")) {
    issues.push({
      code: "REFERENCE_INK_NOT_BLACK",
      message: `Non-black paint found: ${[...new Set(nonBlack)].join(", ")}.`,
      repairHint: "Use solid #000 ink only; no colour, seal, signature or decoration.",
      repair: { ink: "#000" },
    });
  }

  // Ratio.
  const vb = parseViewBox(svg);
  const ratio = vb ? vb.w / vb.h : NaN;
  if (!vb || !(Math.abs(ratio - RATIO) <= RATIO_TOLERANCE) || ref.aspect !== "3:2") {
    issues.push({
      code: "REFERENCE_WRONG_RATIO",
      message: `Canvas ratio is ${vb ? `${vb.w}×${vb.h} (${ratio.toFixed(3)})` : "unknown"}, not 3:2.`,
      repairHint: "Render on the 1500×1000 (3:2) canvas; do not crop or pad to another shape.",
      repair: { width: 1500, height: 1000 },
    });
  }

  // Fit: ink inside the 8% safe area of the actual canvas.
  if (ref.bbox && vb) {
    const sx = vb.w * SAFE_MARGIN;
    const sy = vb.h * SAFE_MARGIN;
    const b = ref.bbox;
    const eps = 0.5;
    if (b.x < sx - eps || b.y < sy - eps || b.x + b.width > vb.w - sx + eps || b.y + b.height > vb.h - sy + eps) {
      issues.push({
        code: "REFERENCE_CLIPPED",
        message: `Ink box ${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}×${Math.round(b.height)} leaves the 8% safe area.`,
        repairHint: "Re-render with a smaller size (large → medium → small); the engine scales the glyph run to fit the safe margins.",
        repair: { size: ref.size === "large" ? "medium" : "small" },
      });
    } else if (b.width / vb.w < MIN_VECTOR_FILL && b.height / vb.h < MIN_VECTOR_FILL) {
      issues.push({
        code: "REFERENCE_INK_TOO_SMALL",
        message: "The phrase fills too little of the canvas to trace.",
        repairHint: "Re-render with size medium or large.",
        repair: { size: "large" },
      });
    }
  }
  if ((ref.lines?.length ?? 1) > 2) {
    issues.push({
      code: "REFERENCE_TOO_MANY_LINES",
      message: "A reference holds one phrase on at most two lines.",
      repairHint: "Use a shorter phrase.",
    });
  }
  return finish(issues);
}

// ---------------------------------------------------------------------------
// Agent-supplied raster images
// ---------------------------------------------------------------------------

/** Pixel statistics of the base repo's gate (ratios rounded to 4 decimals). */
export interface AlphaStats {
  transparentRatio: number;
  edgeTransparentRatio: number;
  foregroundRatio: number;
  darkVisibleRatio: number;
  inkBounds: { widthRatio: number; heightRatio: number };
}

const r4 = (n: number) => Math.round(n * 10000) / 10000;

/**
 * Compute the gate's pixel statistics from RGBA8 pixels. Downsamples to at
 * most 320 px on the long edge (area average, premultiplied) like the base
 * repo's canvas inspection, then: transparent if alpha ≤ 16, visible if
 * alpha > 32 (builds the ink box), dark if luminance ≤ 112, edge band = 6%
 * of the short side.
 */
export function rasterStats(rgba: Uint8Array, width: number, height: number): AlphaStats {
  const scale = Math.min(1, 320 / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const small = new Float32Array(w * h * 4);
  const count = new Float32Array(w * h);
  for (let y = 0; y < height; y++) {
    const sy = Math.min(h - 1, Math.floor((y * h) / height));
    for (let x = 0; x < width; x++) {
      const sx = Math.min(w - 1, Math.floor((x * w) / width));
      const i = (y * width + x) * 4;
      const j = sy * w + sx;
      const a = rgba[i + 3] / 255;
      small[j * 4] += rgba[i] * a;
      small[j * 4 + 1] += rgba[i + 1] * a;
      small[j * 4 + 2] += rgba[i + 2] * a;
      small[j * 4 + 3] += rgba[i + 3];
      count[j] += 1;
    }
  }
  const band = Math.max(1, Math.round(Math.min(w, h) * 0.06));
  let transparent = 0;
  let edge = 0;
  let edgeTransparent = 0;
  let visible = 0;
  let dark = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const j = y * w + x;
      const n = count[j] || 1;
      const alpha = small[j * 4 + 3] / n;
      const premul = alpha / 255 || 1;
      const r = small[j * 4] / n / premul;
      const g = small[j * 4 + 1] / n / premul;
      const b = small[j * 4 + 2] / n / premul;
      const isTransparent = alpha <= 16;
      const isEdge = x < band || y < band || x >= w - band || y >= h - band;
      if (isTransparent) transparent++;
      if (isEdge) {
        edge++;
        if (isTransparent) edgeTransparent++;
      }
      if (alpha > 32) {
        visible++;
        if (0.2126 * r + 0.7152 * g + 0.0722 * b <= 112) dark++;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  const total = w * h;
  return {
    transparentRatio: r4(transparent / total),
    edgeTransparentRatio: r4(edge ? edgeTransparent / edge : 0),
    foregroundRatio: r4(visible / total),
    darkVisibleRatio: r4(visible ? dark / visible : 0),
    inkBounds: visible
      ? { widthRatio: r4((maxX - minX + 1) / w), heightRatio: r4((maxY - minY + 1) / h) }
      : { widthRatio: 0, heightRatio: 0 },
  };
}

/** Minimum ink width by akshara count (base repo: by character count, 1–4). */
const MIN_WIDTH_BY_COUNT: Record<number, number> = { 1: 0.24, 2: 0.42, 3: 0.58, 4: 0.68 };

/** Visible units for the ink-width rule: grapheme clusters without spaces. */
export function aksharaCount(text: string): number {
  const t = canonical(text).replace(/\s/g, "");
  // Intl.Segmenter (ES2022) is typed loosely: the app's tsconfig lib predates it.
  const Segmenter = (Intl as unknown as {
    Segmenter?: new (locale: undefined, options: { granularity: "grapheme" }) => {
      segment(input: string): Iterable<unknown>;
    };
  }).Segmenter;
  if (Segmenter) {
    return [...new Segmenter(undefined, { granularity: "grapheme" }).segment(t)].length;
  }
  return [...t].length;
}

/** Levenshtein distance over code points. */
export function editDistance(a: string, b: string): number {
  const x = [...a];
  const y = [...b];
  let prev = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[y.length];
}

/** Character error rate (code points, NFC, whitespace-normalised). */
export function characterErrorRate(reference: string, hypothesis: string): number {
  const ref = canonical(reference);
  const hyp = canonical(hypothesis);
  if (!ref.length) return hyp.length ? 1 : 0;
  return editDistance(ref, hyp) / [...ref].length;
}

export interface AgentImageInput {
  requestedText: string;
  /** OCR transcript of the image (e.g. tesseract with the script's language). */
  ocrText?: string;
  /** Raw PNG bytes; or give width/height/alphaStats measured elsewhere (e.g. a browser canvas). */
  pngBytes?: Uint8Array;
  width?: number;
  height?: number;
  alphaStats?: AlphaStats;
  mimeType?: string;
  /** Apply the base repo grader's stricter asset thresholds. */
  strict?: boolean;
}

export interface AgentImageResult extends ValidationResult<AgentImageCode> {
  width?: number;
  height?: number;
  aspectRatio?: number;
  stats?: AlphaStats;
  trueAlpha?: boolean;
  ocr?: { text: string; exact: boolean; cer: number };
}

export async function validateAgentImage(input: AgentImageInput): Promise<AgentImageResult> {
  const issues: ValidationIssue<AgentImageCode>[] = [];
  const result: AgentImageResult = { ok: false, issues };
  let width = input.width;
  let height = input.height;
  let stats = input.alphaStats;
  let hasAlphaChannel = true;

  if (input.mimeType && !/^image\/(png|webp)$/i.test(input.mimeType)) {
    issues.push({
      code: "REFERENCE_IMAGE_FORMAT_REQUIRES_PNG_OR_WEBP",
      message: `Unsupported type ${input.mimeType}.`,
      repairHint: "Submit a PNG (or WebP) with an alpha channel.",
    });
    return Object.assign(result, finish(issues));
  }
  if (input.pngBytes) {
    if (!isPng(input.pngBytes)) {
      issues.push({
        code: "REFERENCE_IMAGE_FORMAT_REQUIRES_PNG_OR_WEBP",
        message: "Bytes are not a PNG.",
        repairHint: "Submit a PNG with an alpha channel (WebP must be measured by the caller and passed as alphaStats).",
      });
      return Object.assign(result, finish(issues));
    }
    const size = pngSize(input.pngBytes)!;
    width = size.width;
    height = size.height;
    if (!stats) {
      try {
        const img = await decodePng(input.pngBytes);
        hasAlphaChannel = img.hasAlphaChannel;
        stats = rasterStats(img.rgba, img.width, img.height);
      } catch (e) {
        issues.push({
          code: "REFERENCE_IMAGE_DECODE_FAILED",
          message: `PNG could not be decoded: ${(e as Error).message}`,
          repairHint: "Export a standard non-interlaced 8-bit RGBA PNG.",
        });
        return Object.assign(result, finish(issues));
      }
    }
  }
  if (!width || !height || !stats) {
    issues.push({
      code: "REFERENCE_IMAGE_INSPECTION_UNAVAILABLE",
      message: "No pixels or alpha statistics to inspect.",
      repairHint: "Pass pngBytes, or width + height + alphaStats.",
    });
    return Object.assign(result, finish(issues));
  }
  result.width = width;
  result.height = height;
  result.aspectRatio = r4(width / height);
  result.stats = stats;

  if (width < 1200 || height < 800) {
    issues.push({
      code: "REFERENCE_IMAGE_TOO_SMALL:use_1536x1024",
      message: `Image is ${width}×${height}; minimum 1200×800.`,
      repairHint: "Generate at 1536×1024.",
      repair: { width: 1536, height: 1024 },
    });
  }
  if (Math.abs(width / height - RATIO) > RATIO_TOLERANCE) {
    issues.push({
      code: "REFERENCE_IMAGE_REQUIRES_3_BY_2:use_1536x1024",
      message: `Aspect ratio ${(width / height).toFixed(3)} is not 3:2.`,
      repairHint: "Generate a 3:2 canvas at 1536×1024.",
      repair: { width: 1536, height: 1024 },
    });
  }
  const s = stats;
  const edgeMin = input.strict ? 0.98 : 0.8;
  const darkMin = input.strict ? 0.9 : 0.72;
  if (!hasAlphaChannel || s.transparentRatio < 0.12) {
    issues.push({
      code: "REFERENCE_IMAGE_REQUIRES_TRUE_ALPHA",
      message: `Only ${(s.transparentRatio * 100).toFixed(1)}% of pixels are transparent.`,
      repairHint: "Real transparent alpha (RGBA alpha=0), never white paper or a baked checkerboard.",
      repair: { background: "transparent" },
    });
  } else if (s.edgeTransparentRatio < edgeMin) {
    issues.push({
      code: "REFERENCE_IMAGE_NEEDS_TRANSPARENT_MARGIN",
      message: `Edge band is ${(s.edgeTransparentRatio * 100).toFixed(1)}% transparent (need ${edgeMin * 100}%).`,
      repairHint: "Keep an empty transparent margin of at least 8% on every edge.",
    });
  }
  if (s.foregroundRatio < 0.001 || s.foregroundRatio > 0.65) {
    issues.push({
      code: "REFERENCE_IMAGE_FOREGROUND_INVALID",
      message: `Ink covers ${(s.foregroundRatio * 100).toFixed(2)}% of the canvas.`,
      repairHint: "One phrase of black ink on a transparent canvas; not blank, not filled.",
    });
  }
  if (s.darkVisibleRatio < darkMin) {
    issues.push({
      code: "REFERENCE_IMAGE_NEEDS_BLACK_INK_ONLY",
      message: `${(s.darkVisibleRatio * 100).toFixed(1)}% of visible pixels are dark (need ${darkMin * 100}%).`,
      repairHint: "Black brush ink only; no seal, colour, signature, decoration, translation or extra text.",
      repair: { ink: "#000" },
    });
  }
  // Phrase adaptation of the base repo's size rule: a phrase is either
  // width-bound (long) or height-bound (short), so it passes when either the
  // width meets the akshara-count minimum or the height reaches 46%.
  const n = Math.max(1, Math.min(4, aksharaCount(input.requestedText)));
  const minW = MIN_WIDTH_BY_COUNT[n];
  if (s.inkBounds.widthRatio < minW && s.inkBounds.heightRatio < 0.46) {
    issues.push({
      code: "REFERENCE_IMAGE_INK_TOO_SMALL:fill_the_1536x1024_canvas",
      message: `Ink box ${s.inkBounds.widthRatio}×${s.inkBounds.heightRatio} is too small (need width ≥ ${minW} or height ≥ 0.46).`,
      repairHint: "Make the phrase fill the 1536×1024 canvas inside the 8% margins.",
    });
  }
  if (s.inkBounds.widthRatio > 0.88 || s.inkBounds.heightRatio > 0.84) {
    issues.push({
      code: "REFERENCE_IMAGE_NEEDS_SAFE_MARGIN",
      message: `Ink box ${s.inkBounds.widthRatio}×${s.inkBounds.heightRatio} exceeds 0.88×0.84.`,
      repairHint: "Shrink the phrase so it sits inside the 8% safe margin on every edge.",
    });
  }
  // Exact text via OCR.
  if (input.ocrText === undefined) {
    issues.push({
      code: "REFERENCE_OCR_REQUIRED",
      message: "No OCR transcript was supplied; exact text cannot be confirmed.",
      repairHint: "OCR the image with the script's language and pass ocrText, or use the Sulekh renderer instead.",
    });
  } else {
    const exact = canonical(input.ocrText) === canonical(input.requestedText);
    result.ocr = {
      text: canonical(input.ocrText),
      exact,
      cer: r4(characterErrorRate(input.requestedText, input.ocrText)),
    };
    if (!exact) {
      issues.push({
        code: "REFERENCE_TEXT_MISMATCH",
        message: `OCR read "${canonical(input.ocrText)}", not "${canonical(input.requestedText)}".`,
        repairHint: "The image does not spell the phrase exactly (broken conjunct or matra). Use the Sulekh HarfBuzz render instead of a generated image.",
        repair: { useRenderer: true, text: canonical(input.requestedText) },
      });
    }
  }
  result.trueAlpha = hasAlphaChannel && s.transparentRatio >= 0.12;
  return Object.assign(result, finish(issues));
}
