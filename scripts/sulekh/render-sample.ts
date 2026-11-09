/**
 * Render Sulekh sample references to SVG + PNG for eyeballing.
 *
 *   pnpm exec tsx scripts/sulekh/render-sample.ts [outDir]
 *
 * Default outDir: ../.chaupal-work/sulekh-samples (outside the repo).
 * Also runs the raster gate (validateAgentImage, strict) on each PNG with the
 * requested text as a stand-in OCR transcript, to confirm pixel-level rules.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { Resvg } from "@resvg/resvg-js";

import {
  fontFor,
  loadFontBytesNode,
  renderReference,
  SCRIPT_CATALOG,
  validateAgentImage,
  type FontId,
  type ScriptId,
  type SizeId,
  type StyleId,
} from "../../app/engines/sulekh";

const outDir = path.resolve(process.argv[2] ?? path.join(process.cwd(), "..", ".chaupal-work", "sulekh-samples"));

interface Sample {
  name: string;
  text: string;
  script: ScriptId;
  style: StyleId;
  size: SizeId;
  fontId?: FontId;
}

const SAMPLES: Sample[] = [
  { name: "deva-kalam-diwali", text: "शुभ दीपावली", script: "devanagari", style: "kalam", size: "medium" },
  { name: "deva-brush-satyameva", text: "सत्यमेव जयते", script: "devanagari", style: "brush", size: "large" },
  { name: "deva-modern-conjuncts", text: "क्ष त्र ज्ञ", script: "devanagari", style: "modern", size: "medium" },
  { name: "deva-kalam-ki", text: "कि", script: "devanagari", style: "kalam", size: "large" },
  { name: "deva-kalam-shanti-small", text: "शांति", script: "devanagari", style: "kalam", size: "small" },
  { name: "deva-yatra-dhairya", text: "धैर्य", script: "devanagari", style: "brush", size: "medium", fontId: "yatra-one" },
  { name: "deva-rozha-sukoon", text: "सुकून", script: "devanagari", style: "modern", size: "medium", fontId: "rozha-one" },
  { name: "deva-kalam-long-wrap", text: "सदा सुखी रहो और मुस्कुराते रहो", script: "devanagari", style: "kalam", size: "medium" },
  { name: "guru-kalam-satsriakal", text: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ", script: "gurmukhi", style: "kalam", size: "medium" },
  { name: "guru-modern-chardikala", text: "ਚੜ੍ਹਦੀ ਕਲਾ", script: "gurmukhi", style: "modern", size: "medium" },
  { name: "taml-kalam-vanakkam", text: "வணக்கம்", script: "tamil", style: "kalam", size: "medium" },
  { name: "taml-modern-anbu", text: "அன்பு", script: "tamil", style: "modern", size: "large" },
  { name: "beng-kalam-bijoya", text: "শুভ বিজয়া", script: "bengali", style: "kalam", size: "medium" },
  { name: "beng-modern-bhalobasha", text: "ভালোবাসা", script: "bengali", style: "modern", size: "medium" },
  { name: "urdu-kalam-mohabbat", text: "محبت", script: "urdu", style: "kalam", size: "medium" },
  { name: "urdu-kalam-khushamdeed", text: "خوش آمدید", script: "urdu", style: "kalam", size: "large" },
];

await mkdir(outDir, { recursive: true });
const summary: unknown[] = [];
for (const s of SAMPLES) {
  const fontId = s.fontId ?? fontFor(s.script, s.style).id;
  const ref = await renderReference({
    text: s.text,
    script: s.script,
    style: s.style,
    size: s.size,
    fontBytes: await loadFontBytesNode(fontId),
    fontId,
  });
  await writeFile(path.join(outDir, `${s.name}.svg`), ref.svg);
  // Preview PNG on white so it is easy to look at; the gate PNG keeps alpha.
  const png = new Resvg(ref.svg, { fitTo: { mode: "width", value: 1536 } }).render().asPng();
  const preview = new Resvg(ref.svg, { fitTo: { mode: "width", value: 900 }, background: "#ffffff" }).render().asPng();
  await writeFile(path.join(outDir, `${s.name}.png`), png);
  await writeFile(path.join(outDir, `${s.name}.preview.png`), preview);
  const gate = await validateAgentImage({ pngBytes: png, requestedText: s.text, ocrText: s.text, strict: true });
  summary.push({
    name: s.name,
    text: ref.textNFC,
    font: fontId,
    script: SCRIPT_CATALOG[s.script].nameEn,
    lines: ref.lines,
    glyphs: ref.glyphs,
    notdef: ref.notdefCount,
    bbox: ref.bbox,
    fill: ref.fill,
    checks: ref.checks.ok ? "ok" : ref.checks.issues.map((i) => i.code),
    rasterGate: gate.ok ? "ok" : gate.issues.map((i) => i.code),
    rasterStats: gate.stats,
    altEn: ref.altEn,
  });
  console.log(`${ref.checks.ok && gate.ok ? "ok  " : "FAIL"} ${s.name} ${fontId} lines=${ref.lines.length} fill=${ref.fill.widthRatio}x${ref.fill.heightRatio} ${gate.ok ? "" : JSON.stringify(gate.issues.map((i) => i.code))}${ref.checks.ok ? "" : JSON.stringify(ref.checks.issues.map((i) => i.code))}`);
}
await writeFile(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
console.log(`wrote ${SAMPLES.length} samples to ${outDir}`);
