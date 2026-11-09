/**
 * Worker-safe entry of the Sulekh engine: no Node APIs, no DOM. Use this from
 * a Cloudflare Worker and call initShaper(wasmModule) once. Node code imports
 * `app/engines/sulekh` (index.ts), which adds the Node loaders.
 *
 * Sulekh: Indic calligraphy reference engine.
 *
 * The agent picks phrase, script, style and size; the engine guarantees the
 * exact text by shaping it with HarfBuzz and drawing the font's own glyph
 * outlines as a transparent 3:2 SVG.
 *
 *   await initShaper(hbWasmModule);           // Worker; in Node (index.ts) this is automatic
 *   const font = fontFor("devanagari", "kalam");
 *   const ref = await renderReference({
 *     text: "शुभ दीपावली", script: "devanagari", style: "kalam", size: "medium",
 *     fontBytes: await loadFontBytesNode(font.id), fontId: font.id,
 *   });
 *   validateReference(ref, "शुभ दीपावली").ok === true
 */

export {
  initShaper,
  isShaperReady,
  setDefaultWasmLoader,
  harfbuzzVersion,
  getShaperFont,
  ShaperFont,
  type WasmSource,
  type ShapedGlyph,
  type ShapeOptions,
} from "./shape";
export {
  renderReference,
  canonicalText,
  altText,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  SAFE_AREA,
  SAFE_MARGIN_RATIO,
  SIZE_FILL,
  type RenderInput,
  type SulekhReference,
  type Stroke,
  type Rect,
} from "./render";
export {
  validateReference,
  validateAgentImage,
  rasterStats,
  characterErrorRate,
  editDistance,
  aksharaCount,
  type ReferenceCode,
  type AgentImageCode,
  type AgentImageInput,
  type AgentImageResult,
  type AlphaStats,
  type ValidationIssue,
  type ValidationResult,
} from "./validate";
export { decodePng, isPng, pngSize, type DecodedImage } from "./png";
export {
  SCRIPT_IDS,
  STYLE_IDS,
  SIZE_IDS,
  SCRIPT_CATALOG,
  FONT_CATALOG,
  STYLE_NAMES,
  LANGUAGE_SCRIPT,
  PHRASES,
  fontFor,
  detectScript,
  suggestPhrases,
  type ScriptId,
  type StyleId,
  type SizeId,
  type LanguageHint,
  type FontId,
  type FontEntry,
  type ScriptEntry,
  type MoodId,
  type PhraseSuggestion,
  type SuggestOptions,
  type ScriptDetection,
} from "./scripts";
export { makeFixture, FIXTURE_KINDS, type Fixture, type FixtureKind, type FontLoader } from "./fixtures";
export { loadFontBytesFetch } from "./loaders";
