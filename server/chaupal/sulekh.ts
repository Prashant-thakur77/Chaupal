import {
  detectScript,
  fontFor,
  loadFontBytesFetch,
  renderReference,
  validateReference,
  type SulekhReference,
} from "../../app/engines/sulekh/core.js";
import { ensureShaper } from "./sulekh-runtime.js";
import { config } from "./config.js";

export type ScriptId = "devanagari" | "gurmukhi" | "tamil" | "bengali" | "urdu";
export type StyleId = "kalam" | "brush" | "modern";
export type SizeId = "small" | "medium" | "large";

const fontCache = new Map<string, Uint8Array>();

async function loadFont(fontId: string): Promise<Uint8Array> {
  const hit = fontCache.get(fontId);
  if (hit) return hit;
  const { loadFontBytesNodeIfAvailable } = await import("./sulekh-runtime.js");
  let bytes = await loadFontBytesNodeIfAvailable(fontId);
  if (!bytes) {
    const origin = config.publicUrl();
    if (!origin) throw new Error("FONT_ORIGIN_UNKNOWN");
    bytes = await loadFontBytesFetch(fontId as never, origin);
  }
  fontCache.set(fontId, bytes);
  return bytes;
}

export interface RenderRequest {
  text: string;
  script?: ScriptId;
  style: StyleId;
  size: SizeId;
  /** Eval-only: deliberately break this render so the repair path is exercised. */
  fixture?: "broken-shaping" | "opaque" | "wrong-ratio" | null;
}

/**
 * The provider renders the reference itself: exact text, shaped by HarfBuzz
 * with an OFL font, black ink on a transparent 3:2 canvas, checked against the
 * reference contract before it can reach her screen.
 */
export async function renderSulekh(req: RenderRequest) {
  await ensureShaper();
  const text = req.text.normalize("NFC").trim();
  const detected = detectScript(text);
  const script = (req.script ?? detected.script ?? "devanagari") as ScriptId;
  const font = fontFor(script as never, req.style as never);
  let fontBytes = await loadFont(font.id);
  if (req.fixture === "broken-shaping") {
    // A font without this script: every letter falls back to .notdef.
    const wrong = script === "tamil" ? fontFor("devanagari" as never, "kalam" as never) : fontFor("tamil" as never, "kalam" as never);
    fontBytes = await loadFont(wrong.id);
  }
  let ref: SulekhReference = await renderReference({
    text,
    script: script as never,
    style: req.style as never,
    size: req.size,
    fontBytes,
    fontId: font.id,
  });
  if (req.fixture === "opaque") {
    ref = { ...ref, svg: ref.svg.replace(/(<svg\b[^>]*>)/, `$1<rect width="1500" height="1000" fill="#fff"/>`) };
  }
  if (req.fixture === "wrong-ratio") {
    ref = {
      ...ref,
      width: 1000,
      svg: ref.svg.replace('viewBox="0 0 1500 1000"', 'viewBox="250 0 1000 1000"').replace('width="1500"', 'width="1000"'),
    };
  }
  const validation = validateReference(ref, text);
  return { ref, validation, script, fontId: font.id, detected };
}
