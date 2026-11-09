/**
 * Sulekh reference renderer: exact, HarfBuzz-shaped text → transparent 3:2 SVG.
 *
 * Reference contract (ported from the base repo's reference-asset rules):
 * - viewBox 1500×1000 (3:2), no background element, real transparency;
 * - ink is solid black (#000) glyph outlines only: no seal, paper or extra text;
 * - the ink box sits inside an 8% safe margin on every edge, nothing clipped;
 * - exactly one phrase; long multi-word phrases may wrap to two lines;
 * - `size` sets how much of the safe area the ink fills.
 */

import {
  commandsToPath,
  getShaperFont,
  initShaper,
  placeRun,
  runBox,
  type Box,
  type PlacedGlyph,
  type ShaperFont,
} from "./shape";
import {
  detectScript,
  SCRIPT_CATALOG,
  STYLE_NAMES,
  type FontId,
  type LanguageHint,
  type ScriptId,
  type SizeId,
  type StyleId,
} from "./scripts";
import { validateReference, type ValidationResult } from "./validate";

export const CANVAS_WIDTH = 1500;
export const CANVAS_HEIGHT = 1000;
export const SAFE_MARGIN_RATIO = 0.08;
export const INK_COLOR = "#000";
/** A multi-word line wider than this many times its height may wrap to two lines. */
export const WRAP_ASPECT = 6;

/**
 * Fraction of the safe area the ink box may fill, per size. Even `small`
 * keeps a long phrase at ≥ 68% of the canvas width, the base repo's minimum
 * ink width for four or more characters, so every size passes the pixel gate.
 */
export const SIZE_FILL: Record<SizeId, number> = {
  small: 0.82,
  medium: 0.9,
  large: 0.98,
};

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const SAFE_AREA: Rect = {
  x: CANVAS_WIDTH * SAFE_MARGIN_RATIO,
  y: CANVAS_HEIGHT * SAFE_MARGIN_RATIO,
  width: CANVAS_WIDTH * (1 - 2 * SAFE_MARGIN_RATIO),
  height: CANVAS_HEIGHT * (1 - 2 * SAFE_MARGIN_RATIO),
};

export interface RenderInput {
  text: string;
  script: ScriptId;
  style: StyleId;
  size: SizeId;
  /** Raw TTF bytes of the font to shape with (see FONT_CATALOG / fontFor). */
  fontBytes: Uint8Array;
  /** Recorded in the result; not used for lookup. */
  fontId?: FontId | string;
  /** Shaping language; defaults to the script's default (hi, pa, ta, bn, ur). */
  language?: LanguageHint;
}

export interface Stroke {
  /** SVG path data for one glyph, in canvas coordinates. */
  d: string;
  glyphId: number;
  /** UTF-16 offset of the glyph's cluster within its line. */
  cluster: number;
  line: number;
}

export interface SulekhReference {
  svg: string;
  width: number;
  height: number;
  aspect: "3:2";
  /** Ink bounding box in canvas pixels (null when nothing was drawn). */
  bbox: Rect | null;
  safeArea: Rect;
  /** Number of shaped glyphs, spaces included. */
  glyphs: number;
  notdefCount: number;
  /** Dotted-circle glyphs HarfBuzz inserted for invalid sequences (e.g. a stray matra). */
  brokenClusterCount: number;
  textNFC: string;
  lines: string[];
  script: ScriptId;
  style: StyleId;
  size: SizeId;
  language: LanguageHint;
  direction: "ltr" | "rtl";
  fontId: string | null;
  altHi: string;
  altEn: string;
  /** Ink box as a fraction of the canvas. */
  fill: { widthRatio: number; heightRatio: number };
  /**
   * Per-glyph paths in drawing order for the kalam stroke animation:
   * lines top to bottom; within a line, left to right for LTR scripts and
   * right to left for Urdu. Joining the `d`s reproduces the SVG ink.
   */
  strokes: Stroke[];
  checks: ValidationResult;
}

/** Canonical form used for every text comparison: NFC, trimmed, single spaces. */
export function canonicalText(text: string): string {
  return text.normalize("NFC").trim().replace(/\s+/gu, " ");
}

export function altText(
  text: string,
  script: ScriptId,
  style: StyleId,
): { altHi: string; altEn: string } {
  const s = SCRIPT_CATALOG[script];
  const st = STYLE_NAMES[style];
  return {
    altHi: `संदर्भ: ${text}, ${s.nameHi} ${st.hi} शैली`,
    altEn: `Reference: ${text} in ${s.nameEn} ${st.en} style`,
  };
}

interface ShapedLine {
  text: string;
  placed: PlacedGlyph[];
  box: Box | null;
}

function shapeLine(
  font: ShaperFont,
  text: string,
  script: ScriptId,
  language: LanguageHint,
): ShapedLine {
  const entry = SCRIPT_CATALOG[script];
  const glyphs = font.shape(text, {
    script: entry.hbScript,
    language,
    direction: entry.direction,
  });
  const { placed } = placeRun(font, glyphs);
  return { text, placed, box: runBox(placed) };
}

interface Layout {
  lines: ShapedLine[];
  scale: number;
  /** Ink block size in font units. */
  width: number;
  height: number;
  gap: number;
}

function layoutFor(lines: ShapedLine[], fill: number): Layout | null {
  const boxes = lines.map((l) => l.box);
  if (boxes.some((b) => !b)) return null;
  const heights = boxes.map((b) => b!.maxY - b!.minY);
  const width = Math.max(...boxes.map((b) => b!.maxX - b!.minX));
  const gap = lines.length > 1 ? 0.22 * Math.max(...heights) : 0;
  const height = heights.reduce((a, h) => a + h, 0) + gap * (lines.length - 1);
  const scale = Math.min(
    (fill * SAFE_AREA.width) / width,
    (fill * SAFE_AREA.height) / height,
  );
  return { lines, scale, width, height, gap };
}

/** Internal knobs used by fixtures; not part of the public API. */
export interface RenderInternals {
  /** Override the size fill ratio (values > 1 overflow the safe area). */
  fill?: number;
  /** Disable two-line wrapping. */
  noWrap?: boolean;
}

export async function renderReference(input: RenderInput): Promise<SulekhReference> {
  return renderReferenceInternal(input, {});
}

export async function renderReferenceInternal(
  input: RenderInput,
  internals: RenderInternals,
): Promise<SulekhReference> {
  await initShaper();
  const font = getShaperFont(input.fontBytes);
  const entry = SCRIPT_CATALOG[input.script];
  if (!entry) throw new Error(`SULEKH_UNKNOWN_SCRIPT:${input.script}`);
  const language = input.language ?? entry.defaultLanguage;
  const textNFC = canonicalText(input.text);
  const fill = internals.fill ?? SIZE_FILL[input.size] ?? SIZE_FILL.medium;

  // 1. Shape as one line.
  const single = textNFC ? [shapeLine(font, textNFC, input.script, language)] : [];
  let layout = single.length ? layoutFor(single, fill) : null;

  // 2. Very long multi-word phrases may wrap to two lines when that lets
  //    the ink grow meaningfully (one phrase, never more than two lines).
  const words = textNFC.split(" ");
  if (layout && !internals.noWrap && words.length >= 2) {
    // "Very long": the single line is more than WRAP_ASPECT times wider than tall.
    if (layout.width / layout.height > WRAP_ASPECT) {
      let best: Layout | null = null;
      for (let i = 1; i < words.length; i++) {
        const a = shapeLine(font, words.slice(0, i).join(" "), input.script, language);
        const b = shapeLine(font, words.slice(i).join(" "), input.script, language);
        const candidate = layoutFor([a, b], fill);
        if (candidate && (!best || candidate.scale > best.scale)) best = candidate;
      }
      if (best && best.scale > layout.scale * 1.2) layout = best;
    }
  }

  const lines = layout?.lines ?? single;
  const allGlyphs = lines.flatMap((l) => l.placed);
  const notdefCount = allGlyphs.filter((g) => g.glyphId === 0).length;
  const dottedCircle = font.nominalGlyph(0x25cc);
  const brokenClusterCount =
    dottedCircle && !textNFC.includes("◌")
      ? allGlyphs.filter((g) => g.glyphId === dottedCircle).length
      : 0;

  // 3. Place: ink block centred on the canvas, each line centred horizontally.
  const strokes: Stroke[] = [];
  let bbox: Rect | null = null;
  if (layout) {
    const s = layout.scale;
    let top = (CANVAS_HEIGHT - layout.height * s) / 2;
    layout.lines.forEach((line, lineIndex) => {
      const b = line.box!;
      const lineW = (b.maxX - b.minX) * s;
      const lineH = (b.maxY - b.minY) * s;
      const tx = (CANVAS_WIDTH - lineW) / 2 - b.minX * s;
      const ty = top + b.maxY * s; // baseline in canvas px (SVG y grows down)
      const ordered = entry.direction === "rtl" ? [...line.placed].reverse() : line.placed;
      for (const g of ordered) {
        if (!g.commands.length) continue;
        strokes.push({
          d: commandsToPath(g.commands, g.x, g.y, s, tx, ty),
          glyphId: g.glyphId,
          cluster: g.cluster,
          line: lineIndex,
        });
      }
      const lineRect = { x: (CANVAS_WIDTH - lineW) / 2, y: top, width: lineW, height: lineH };
      bbox = bbox ? unionRect(bbox, lineRect) : lineRect;
      top += lineH + layout.gap * s;
    });
  }

  const { altHi, altEn } = altText(textNFC, input.script, input.style);
  const svg = buildSvg(strokes, altEn, textNFC, input.script);
  const box = bbox as Rect | null;
  const ref: SulekhReference = {
    svg,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    aspect: "3:2",
    bbox: box ? roundRect(box) : null,
    safeArea: { ...SAFE_AREA },
    glyphs: allGlyphs.length,
    notdefCount,
    brokenClusterCount,
    textNFC,
    lines: lines.map((l) => l.text),
    script: input.script,
    style: input.style,
    size: input.size,
    language,
    direction: entry.direction,
    fontId: input.fontId ?? null,
    altHi,
    altEn,
    fill: box
      ? {
          widthRatio: round4(box.width / CANVAS_WIDTH),
          heightRatio: round4(box.height / CANVAS_HEIGHT),
        }
      : { widthRatio: 0, heightRatio: 0 },
    strokes,
    checks: { ok: true, issues: [] },
  };
  ref.checks = validateReference(ref, input.text);
  return ref;
}

function unionRect(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round4 = (n: number) => Math.round(n * 10000) / 10000;

function roundRect(r: Rect): Rect {
  // Round outward so the reported box always contains the ink.
  const x = Math.floor(r.x * 10) / 10;
  const y = Math.floor(r.y * 10) / 10;
  return {
    x,
    y,
    width: round1(Math.ceil((r.x + r.width) * 10) / 10 - x),
    height: round1(Math.ceil((r.y + r.height) * 10) / 10 - y),
  };
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildSvg(strokes: Stroke[], altEn: string, text: string, script: ScriptId): string {
  const paths = strokes.map((s) => `<path d="${s.d}"/>`).join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" ` +
    `width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" role="img" ` +
    `aria-label="${escapeXml(altEn)}" data-sulekh-text="${escapeXml(text)}" data-sulekh-script="${script}">` +
    `<g fill="${INK_COLOR}" fill-rule="nonzero">${paths}</g></svg>`
  );
}
