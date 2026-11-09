import { Resvg } from "@resvg/resvg-js";
import { beforeAll, describe, expect, it } from "vitest";

import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  detectScript,
  FIXTURE_KINDS,
  FONT_CATALOG,
  fontFor,
  getShaperFont,
  harfbuzzVersion,
  initShaper,
  loadFontBytesNode,
  loadHarfBuzzWasmNode,
  makeFixture,
  PHRASES,
  renderReference,
  SAFE_AREA,
  SCRIPT_CATALOG,
  suggestPhrases,
  validateAgentImage,
  validateReference,
  type FontId,
  type ScriptId,
  type StyleId,
  type SulekhReference,
} from "./index";

beforeAll(async () => {
  // Exercise the Worker path: a precompiled WebAssembly.Module passed in.
  const bytes = await loadHarfBuzzWasmNode();
  await initShaper(new WebAssembly.Module(bytes as BufferSource));
});

async function render(text: string, script: ScriptId, style: StyleId = "kalam", size: "small" | "medium" | "large" = "medium", fontId?: FontId) {
  const id = fontId ?? fontFor(script, style).id;
  return renderReference({ text, script, style, size, fontBytes: await loadFontBytesNode(id), fontId: id });
}

function expectGoodReference(ref: SulekhReference, text: string) {
  expect(ref.textNFC).toBe(text.normalize("NFC"));
  expect(ref.notdefCount).toBe(0);
  expect(ref.brokenClusterCount).toBe(0);
  expect(ref.glyphs).toBeGreaterThan(0);
  expect(ref.aspect).toBe("3:2");
  expect(ref.width / ref.height).toBeCloseTo(1.5, 5);
  expect(ref.svg).toContain(`viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}"`);
  expect(ref.svg).not.toMatch(/<rect|<image|background/i);
  // Ink inside the 8% margins on every side.
  const b = ref.bbox!;
  expect(b.x).toBeGreaterThanOrEqual(SAFE_AREA.x);
  expect(b.y).toBeGreaterThanOrEqual(SAFE_AREA.y);
  expect(b.x + b.width).toBeLessThanOrEqual(SAFE_AREA.x + SAFE_AREA.width);
  expect(b.y + b.height).toBeLessThanOrEqual(SAFE_AREA.y + SAFE_AREA.height);
  expect(ref.checks).toEqual({ ok: true, issues: [] });
  expect(validateReference(ref, text).ok).toBe(true);
}

const EXACT_CASES: Array<[string, ScriptId]> = [
  ["शुभ दीपावली", "devanagari"],
  ["सत्यमेव जयते", "devanagari"],
  ["क्ष त्र ज्ञ", "devanagari"],
  ["कि", "devanagari"],
  ["ਸਤ ਸ੍ਰੀ ਅਕਾਲ", "gurmukhi"],
  ["வணக்கம்", "tamil"],
  ["শুভ বিজয়া", "bengali"],
  ["محبت", "urdu"],
];

describe("shaper", () => {
  it("runs HarfBuzz from a precompiled module", () => {
    expect(harfbuzzVersion()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("places the i-matra of कि before (left of) the consonant", async () => {
    const font = getShaperFont(await loadFontBytesNode("kalam-bold"));
    const glyphs = font.shape("कि", { script: "Deva", language: "hi" });
    expect(glyphs).toHaveLength(2);
    const ka = font.nominalGlyph(0x0915);
    const iMatra = font.nominalGlyph(0x093f);
    // Visual order: matra glyph first, then क.
    expect(glyphs[1].glyphId).toBe(ka);
    expect(glyphs[0].glyphId).not.toBe(ka);
    // Unshaped order would be क then ि; shaping must move the matra in front.
    expect(font.shape("कि", { script: "Deva" })[0].glyphId).not.toBe(ka);
    expect(iMatra).not.toBe(0);
    expect(glyphs[0].xAdvance).toBeGreaterThan(0); // occupies space left of क
    expect(glyphs.every((g) => g.cluster === 0)).toBe(true);
  });

  it("forms conjuncts as ligatures instead of consonant + virama + consonant", async () => {
    const font = getShaperFont(await loadFontBytesNode("kalam-bold"));
    for (const conj of ["क्ष", "त्र", "ज्ञ"]) {
      const glyphs = font.shape(conj, { script: "Deva", language: "hi" });
      expect(glyphs.length, conj).toBe(1);
      expect(glyphs[0].glyphId).not.toBe(0);
    }
  });

  it("shapes Urdu right-to-left with joined forms", async () => {
    const font = getShaperFont(await loadFontBytesNode("noto-nastaliq-urdu"));
    const glyphs = font.shape("محبت", { script: "Arab", language: "ur", direction: "rtl" });
    const clusters = glyphs.map((g) => g.cluster);
    expect(clusters[0]).toBeGreaterThan(clusters[clusters.length - 1]);
    const nominal = [..."محبت"].map((c) => font.nominalGlyph(c.codePointAt(0)!));
    // Joined (initial/medial/final) forms differ from the isolated cmap glyphs.
    expect(glyphs.map((g) => g.glyphId).filter((g) => nominal.includes(g)).length).toBeLessThan(nominal.length);
  });
});

describe("renderReference", () => {
  it.each(EXACT_CASES)("renders %s exactly (%s)", async (text, script) => {
    const ref = await render(text, script);
    expectGoodReference(ref, text);
    expect(ref.altHi).toBe(`संदर्भ: ${text.normalize("NFC")}, ${SCRIPT_CATALOG[script].nameHi} कलम शैली`);
    expect(ref.altEn).toBe(`Reference: ${text.normalize("NFC")} in ${SCRIPT_CATALOG[script].nameEn} kalam style`);
  });

  it("gives the documented alt text for शुभ दीपावली", async () => {
    const ref = await render("शुभ दीपावली", "devanagari");
    expect(ref.altHi).toBe("संदर्भ: शुभ दीपावली, देवनागरी कलम शैली");
    expect(ref.altEn).toBe("Reference: शुभ दीपावली in Devanagari kalam style");
  });

  it("renders every catalog phrase in every style without notdef", async () => {
    for (const p of PHRASES) {
      for (const style of ["kalam", "brush", "modern"] as const) {
        const ref = await render(p.text, p.script, style);
        expect(ref.notdefCount, `${p.text} ${style}`).toBe(0);
        expect(ref.checks.ok, `${p.text} ${style} ${JSON.stringify(ref.checks.issues)}`).toBe(true);
      }
    }
  });

  it("scales with size and always keeps the margins", async () => {
    const fills = [];
    for (const size of ["small", "medium", "large"] as const) {
      const ref = await render("शांति", "devanagari", "kalam", size);
      expectGoodReference(ref, "शांति");
      fills.push(ref.fill.heightRatio);
    }
    expect(fills[0]).toBeLessThan(fills[1]);
    expect(fills[1]).toBeLessThan(fills[2]);
  });

  it("wraps a very long multi-word phrase onto two lines, never clipped", async () => {
    const text = "सदा सुखी रहो और मुस्कुराते रहो";
    const ref = await render(text, "devanagari");
    expect(ref.lines).toHaveLength(2);
    expect(ref.lines.join(" ")).toBe(text);
    expectGoodReference(ref, text);
  });

  it("returns strokes in drawing order (RTL reversed for Urdu)", async () => {
    const deva = await render("कि", "devanagari");
    expect(deva.strokes.length).toBe(2);
    const urdu = await render("محبت", "urdu");
    expect(urdu.direction).toBe("rtl");
    const firstX = Number(/^M([\d.]+)/.exec(urdu.strokes[0].d)![1]);
    const lastX = Number(/^M([\d.]+)/.exec(urdu.strokes[urdu.strokes.length - 1].d)![1]);
    expect(firstX).toBeGreaterThan(lastX);
  });

  it("draws y-down: the Devanagari headline sits above the baseline body", async () => {
    // In कि the shirorekha is near the top of the ink box, so the topmost
    // path coordinate is close to bbox.y (not mirrored to the bottom).
    const ref = await render("कि", "devanagari", "kalam", "large");
    const ys = [...ref.svg.matchAll(/[MLQ][\d.]+ ([\d.]+)/g)].map((m) => Number(m[1]));
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(ref.bbox!.y - 1);
    expect(Math.max(...ys)).toBeLessThanOrEqual(ref.bbox!.y + ref.bbox!.height + 1);
  });
});

describe("fixtures fail validation with the right codes", () => {
  it.each(FIXTURE_KINDS.map((k) => [k]))("%s", async (kind) => {
    const fx = await makeFixture(kind, (id) => loadFontBytesNode(id));
    expect(fx.validation.ok).toBe(false);
    expect(fx.validation.code).toBe(fx.expectedCode);
    expect(fx.validation.issues[0].repairHint.length).toBeGreaterThan(10);
  });

  it("the notdef repair (catalog font for the detected script) passes", async () => {
    const fx = await makeFixture("notdef", (id) => loadFontBytesNode(id));
    const fontId = fx.validation.issues[0].repair!.fontId as FontId;
    expect(FONT_CATALOG[fontId].scripts).toContain("tamil");
    const ref = await render(fx.requestedText, "tamil", "kalam", "medium", fontId);
    expectGoodReference(ref, fx.requestedText);
  });

  it("the clipped repair (smaller size) passes", async () => {
    const fx = await makeFixture("clipped", (id) => loadFontBytesNode(id));
    const size = fx.validation.issues[0].repair!.size as "medium";
    const ref = await render(fx.requestedText, "devanagari", "kalam", size);
    expectGoodReference(ref, fx.requestedText);
  });
});

describe("validateAgentImage", () => {
  const png = (svg: string, width = 1536, background?: string) =>
    new Uint8Array(new Resvg(svg, { fitTo: { mode: "width", value: width }, background }).render().asPng());

  it("accepts a transparent 3:2 image whose OCR matches exactly", async () => {
    const ref = await render("शुभ दीपावली", "devanagari");
    const res = await validateAgentImage({ pngBytes: png(ref.svg), requestedText: "शुभ दीपावली", ocrText: "शुभ  दीपावली\n", strict: true });
    expect(res.issues).toEqual([]);
    expect(res.ok).toBe(true);
    expect(res.width).toBe(1536);
    expect(res.height).toBe(1024);
    expect(res.trueAlpha).toBe(true);
  });

  it("rejects OCR that differs (broken matra)", async () => {
    const ref = await render("कि", "devanagari");
    const res = await validateAgentImage({ pngBytes: png(ref.svg), requestedText: "कि", ocrText: "क" });
    expect(res.code).toBe("REFERENCE_TEXT_MISMATCH");
    expect(res.ocr!.cer).toBeCloseTo(0.5);
  });

  it("rejects an opaque background", async () => {
    const ref = await render("शांति", "devanagari");
    const res = await validateAgentImage({ pngBytes: png(ref.svg, 1536, "#ffffff"), requestedText: "शांति", ocrText: "शांति" });
    expect(res.code).toBe("REFERENCE_IMAGE_REQUIRES_TRUE_ALPHA");
  });

  it("rejects a non-3:2 canvas", async () => {
    const fx = await makeFixture("wrong-ratio", (id) => loadFontBytesNode(id));
    const res = await validateAgentImage({ pngBytes: png(fx.ref.svg, 1200), requestedText: fx.requestedText, ocrText: fx.requestedText });
    expect(res.issues.map((i) => i.code)).toContain("REFERENCE_IMAGE_REQUIRES_3_BY_2:use_1536x1024");
  });

  it("requires OCR text", async () => {
    const ref = await render("शांति", "devanagari");
    const res = await validateAgentImage({ pngBytes: png(ref.svg), requestedText: "शांति" });
    expect(res.code).toBe("REFERENCE_OCR_REQUIRED");
  });

  it("accepts precomputed alpha stats (browser canvas path)", async () => {
    const res = await validateAgentImage({
      width: 1536,
      height: 1024,
      alphaStats: { transparentRatio: 0.9, edgeTransparentRatio: 1, foregroundRatio: 0.1, darkVisibleRatio: 1, inkBounds: { widthRatio: 0.7, heightRatio: 0.3 } },
      requestedText: "धैर्य",
      ocrText: "धैर्य",
    });
    expect(res.ok).toBe(true);
  });
});

describe("worker safety", () => {
  it("core.ts imports nothing from Node or the DOM, transitively", async () => {
    const { readFile } = await import("node:fs/promises");
    const path = await import("node:path");
    const dir = path.dirname(new URL(import.meta.url).pathname);
    const seen = new Set<string>();
    const visit = async (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      const src = await readFile(path.join(dir, file), "utf8");
      expect(src, file).not.toMatch(/from\s+["']node:|import\(\s*["']node:|\bprocess\.|\bdocument\.|\bwindow\./);
      for (const m of src.matchAll(/from\s+["']\.\/([\w-]+)["']/g)) await visit(`${m[1]}.ts`);
    };
    await visit("core.ts");
    expect([...seen].sort()).toEqual(["core.ts", "fixtures.ts", "loaders.ts", "png.ts", "render.ts", "scripts.ts", "sfnt.ts", "shape.ts", "validate.ts"]);
  });
});

describe("scripts", () => {
  it("detects the script from Unicode ranges", () => {
    expect(detectScript("शुभ दीपावली").script).toBe("devanagari");
    expect(detectScript("ਸਤ ਸ੍ਰੀ ਅਕਾਲ").script).toBe("gurmukhi");
    expect(detectScript("வணக்கம்").script).toBe("tamil");
    expect(detectScript("শুভ বিজয়া").script).toBe("bengali");
    expect(detectScript("محبت").script).toBe("urdu");
    expect(detectScript("hello").script).toBeNull();
    expect(detectScript("hello").unsupported.length).toBeGreaterThan(0);
  });

  it("suggests secular phrases by default and religious ones only when asked", () => {
    const calm = suggestPhrases({ mood: "calm", script: "devanagari" });
    expect(calm.map((p) => p.text)).toEqual(["शांति", "धैर्य", "सुकून"]);
    expect(suggestPhrases({ limit: 100 }).some((p) => p.religious)).toBe(false);
    expect(suggestPhrases({ mood: "diwali" })[0].text).toBe("शुभ दीपावली");
    const spiritual = suggestPhrases({ mood: "spiritual", includeReligious: true, script: "devanagari" });
    expect(spiritual[0].text).toBe("ॐ");
  });
});
