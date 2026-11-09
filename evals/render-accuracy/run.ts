/**
 * Indic render accuracy: does the rendered reference spell the phrase?
 *
 *   pnpm exec tsx evals/render-accuracy/run.ts
 *
 * For each of the 50 phrases in phrases.json (10 per script) we render:
 *   shaped          Sulekh provider render: HarfBuzz-shaped, script's kalam-style font
 *   unshaped        "unshaped baseline": each code point's nominal (cmap) glyph drawn
 *                   left to right with its advance, no shaping, same font and layout.
 *                   It reproduces the failure class (broken conjuncts, misplaced
 *                   matras, unjoined Arabic letters). It is NOT an image model.
 *   shaped-plain    as `shaped`, with the script's plainest catalog font (OCR control).
 *                   Urdu has only Noto Nastaliq Urdu in the catalog, so its plain
 *                   control is Noto Naskh Arabic (OFL), downloaded to the work cache
 *                   for this measurement only and not shipped with the app.
 *   unshaped-plain  as `unshaped`, with the plain font
 *
 * Each SVG is rasterised with resvg (white background, 1500×1000) and read by
 * tesseract.js (LSTM, tessdata 4.0.0_best_int; hin, pan, tam, ben, urd). Score:
 * exact NFC match after whitespace normalisation, and character error rate
 * (code-point Levenshtein / reference length). A secondary count also ignores
 * ZWJ/ZWNJ, which Tesseract appends after word-final viramas (invisible).
 *
 * Traineddata is cached in ../.chaupal-work/tessdata and every SVG/PNG is kept
 * in ../.chaupal-work/render-accuracy/<arm>/ (both outside the repo).
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { Resvg } from "@resvg/resvg-js";
import { createWorker, OEM, PSM, type Worker } from "tesseract.js";

import {
  canonicalText,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  characterErrorRate,
  fontFor,
  getShaperFont,
  harfbuzzVersion,
  initShaper,
  loadFontBytesNode,
  renderReference,
  SAFE_AREA,
  SCRIPT_CATALOG,
  SIZE_FILL,
  type FontId,
  type ScriptId,
} from "../../app/engines/sulekh";
import { commandsToPath, placeRun, runBox, type ShapedGlyph } from "../../app/engines/sulekh/shape";

const ROOT = process.cwd();
const HERE = path.join(ROOT, "evals/render-accuracy");
const WORK = path.resolve(ROOT, "..", ".chaupal-work");
const TESSDATA = path.join(WORK, "tessdata");
const CONTROL_FONTS = path.join(WORK, "ocr-control-fonts");

/** OCR-control fonts outside the catalog (never shipped). */
const CONTROL_FONT: Partial<Record<ScriptId, { id: string; dir: string; file: string; url: string }>> = {
  urdu: {
    id: "noto-naskh-arabic (OCR control, not shipped)",
    dir: "notonaskharabic",
    file: "NotoNaskhArabic-wght.ttf",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/notonaskharabic/NotoNaskhArabic%5Bwght%5D.ttf",
  },
};

async function loadControlFont(script: ScriptId): Promise<Uint8Array | null> {
  const c = CONTROL_FONT[script];
  if (!c) return null;
  const dir = path.join(CONTROL_FONTS, c.dir);
  const file = path.join(dir, c.file);
  try {
    return new Uint8Array(await readFile(file));
  } catch {
    await mkdir(dir, { recursive: true });
    for (const [url, out] of [
      [c.url, file],
      [c.url.replace(/[^/]+$/, "OFL.txt"), path.join(dir, "OFL.txt")],
    ]) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`control font download failed: ${url} ${res.status}`);
      await writeFile(out, new Uint8Array(await res.arrayBuffer()));
    }
    return new Uint8Array(await readFile(file));
  }
}

const JOINERS = /[\u200c\u200d]/g;
const ARTIFACTS = path.join(WORK, "render-accuracy");

const TESS_LANG: Record<ScriptId, string> = {
  devanagari: "hin",
  gurmukhi: "pan",
  tamil: "tam",
  bengali: "ben",
  urdu: "urd",
};

type Arm = "shaped" | "unshaped" | "shaped-plain" | "unshaped-plain";
const ARMS: Arm[] = ["shaped", "unshaped", "shaped-plain", "unshaped-plain"];

interface Phrase {
  id: string;
  script: ScriptId;
  lang: string;
  text: string;
  meaning: string;
  conjuncts: string[];
}

interface Item {
  id: string;
  script: ScriptId;
  arm: Arm;
  font: string;
  text: string;
  lines: number;
  notdef: number;
  /** Unshaped arms: glyph run identical to the shaped run (shaping changed nothing). */
  identicalToShaped?: boolean;
  ocrRaw: string;
  ocr: string;
  exact: boolean;
  /** Exact after also removing ZWJ/ZWNJ from both sides. */
  exactIgnoringJoiners: boolean;
  cer: number;
  confidence: number;
}

/** Glyph ids + positions of a shaped run, for comparing arms. */
function signature(glyphs: ShapedGlyph[]): string {
  return glyphs.map((g) => `${g.glyphId}@${g.xAdvance},${g.xOffset},${g.yOffset}`).join(" ");
}

/** The unshaped baseline: nominal glyph per code point, left to right. */
function unshapedSvg(fontBytes: Uint8Array, text: string): { svg: string; notdef: number; glyphs: ShapedGlyph[] } {
  const font = getShaperFont(fontBytes);
  const glyphs: ShapedGlyph[] = [];
  let i = 0;
  for (const ch of text) {
    const gid = font.nominalGlyph(ch.codePointAt(0)!);
    glyphs.push({ glyphId: gid, cluster: i, xAdvance: font.hAdvance(gid), yAdvance: 0, xOffset: 0, yOffset: 0 });
    i += ch.length;
  }
  const { placed } = placeRun(font, glyphs);
  const box = runBox(placed);
  let paths = "";
  if (box) {
    const fill = SIZE_FILL.medium;
    const w = box.maxX - box.minX;
    const h = box.maxY - box.minY;
    const s = Math.min((fill * SAFE_AREA.width) / w, (fill * SAFE_AREA.height) / h);
    const tx = (CANVAS_WIDTH - w * s) / 2 - box.minX * s;
    const ty = (CANVAS_HEIGHT - h * s) / 2 + box.maxY * s;
    paths = placed
      .filter((g) => g.commands.length)
      .map((g) => `<path d="${commandsToPath(g.commands, g.x, g.y, s, tx, ty)}"/>`)
      .join("");
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}">` +
    `<g fill="#000">${paths}</g></svg>`;
  return { svg, notdef: glyphs.filter((g) => g.glyphId === 0).length, glyphs };
}

function shapedGlyphs(fontBytes: Uint8Array, text: string, script: ScriptId): ShapedGlyph[] {
  const entry = SCRIPT_CATALOG[script];
  return getShaperFont(fontBytes).shape(text, {
    script: entry.hbScript,
    language: entry.defaultLanguage,
    direction: entry.direction,
  });
}

function rasterise(svg: string): Uint8Array {
  return new Uint8Array(new Resvg(svg, { background: "#ffffff", fitTo: { mode: "width", value: CANVAS_WIDTH } }).render().asPng());
}

const workers = new Map<string, Worker>();
async function ocr(lang: string, png: Uint8Array, lines: number): Promise<{ text: string; confidence: number }> {
  let worker = workers.get(lang);
  if (!worker) {
    worker = await createWorker(lang, OEM.LSTM_ONLY, {
      cachePath: TESSDATA,
      workerPath: path.join(HERE, "tesseract-worker.cjs"),
    });
    workers.set(lang, worker);
  }
  await worker.setParameters({
    tessedit_pageseg_mode: lines > 1 ? PSM.SINGLE_BLOCK : PSM.SINGLE_LINE,
    preserve_interword_spaces: "1",
  });
  const { data } = await worker.recognize(Buffer.from(png));
  return { text: data.text, confidence: data.confidence };
}

const round = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d;

async function main() {
  await mkdir(TESSDATA, { recursive: true });
  for (const arm of ARMS) await mkdir(path.join(ARTIFACTS, arm), { recursive: true });
  const { phrases } = JSON.parse(await readFile(path.join(HERE, "phrases.json"), "utf8")) as { phrases: Phrase[] };
  await initShaper();

  const items: Item[] = [];
  for (const p of phrases) {
    const text = canonicalText(p.text);
    const control = await loadControlFont(p.script);
    const fonts = {
      main: fontFor(p.script, "kalam").id as string,
      plain: (CONTROL_FONT[p.script]?.id ?? SCRIPT_CATALOG[p.script].plainFont) as string,
    };
    for (const arm of ARMS) {
      const plain = arm.endsWith("plain");
      const fontId = plain ? fonts.plain : fonts.main;
      const bytes = plain && control ? control : await loadFontBytesNode(fontId as FontId);
      let svg: string;
      let notdef: number;
      let lines = 1;
      let identicalToShaped: boolean | undefined;
      if (arm.startsWith("shaped")) {
        const ref = await renderReference({ text, script: p.script, style: "kalam", size: "medium", fontBytes: bytes, fontId });
        if (!ref.checks.ok) throw new Error(`${p.id} ${arm}: reference failed validation ${JSON.stringify(ref.checks.issues)}`);
        svg = ref.svg;
        notdef = ref.notdefCount;
        lines = ref.lines.length;
      } else {
        const base = unshapedSvg(bytes, text);
        svg = base.svg;
        notdef = base.notdef;
        identicalToShaped = signature(base.glyphs) === signature(shapedGlyphs(bytes, text, p.script));
      }
      const png = rasterise(svg);
      await writeFile(path.join(ARTIFACTS, arm, `${p.id}.svg`), svg);
      await writeFile(path.join(ARTIFACTS, arm, `${p.id}.png`), png);
      const result = await ocr(TESS_LANG[p.script], png, lines);
      const read = canonicalText(result.text);
      const item: Item = {
        id: p.id,
        script: p.script,
        arm,
        font: fontId,
        text,
        lines,
        notdef,
        identicalToShaped,
        ocrRaw: result.text,
        ocr: read,
        exact: read === text,
        exactIgnoringJoiners: read.replace(JOINERS, "") === text.replace(JOINERS, ""),
        cer: round(characterErrorRate(text, read)),
        confidence: round(result.confidence, 1),
      };
      items.push(item);
      console.log(`${item.exact ? "EXACT" : "     "} ${arm.padEnd(14)} ${p.id} cer=${item.cer.toFixed(2)} ${text} → ${read}`);
    }
  }
  for (const w of workers.values()) await w.terminate();

  // Summaries.
  const scripts = [...new Set(phrases.map((p) => p.script))];
  const summary = scripts.map((script) => ({
    script,
    font: fontFor(script, "kalam").id,
    plainFont: CONTROL_FONT[script]?.id ?? SCRIPT_CATALOG[script].plainFont,
    arms: Object.fromEntries(
      ARMS.map((arm) => {
        const xs = items.filter((i) => i.script === script && i.arm === arm);
        return [
          arm,
          {
            n: xs.length,
            exact: xs.filter((i) => i.exact).length,
            exactIgnoringJoiners: xs.filter((i) => i.exactIgnoringJoiners).length,
            meanCer: round(xs.reduce((a, i) => a + i.cer, 0) / xs.length),
            notdef: xs.reduce((a, i) => a + i.notdef, 0),
            identicalToShaped: arm.startsWith("unshaped") ? xs.filter((i) => i.identicalToShaped).length : undefined,
          },
        ];
      }),
    ),
  }));
  const totals = Object.fromEntries(
    ARMS.map((arm) => {
      const xs = items.filter((i) => i.arm === arm);
      return [arm, { n: xs.length, exact: xs.filter((i) => i.exact).length, exactIgnoringJoiners: xs.filter((i) => i.exactIgnoringJoiners).length, meanCer: round(xs.reduce((a, i) => a + i.cer, 0) / xs.length) }];
    }),
  );

  const tesseractVersion = JSON.parse(await readFile(path.join(ROOT, "node_modules/tesseract.js/package.json"), "utf8")).version;
  const results = {
    measuredAt: new Date().toISOString(),
    method: {
      phrases: "evals/render-accuracy/phrases.json (50; 10 per script)",
      arms: {
        shaped: "Sulekh renderReference (HarfBuzz shaping), script's kalam-style font, size medium",
        unshaped: "unshaped baseline: nominal glyph per code point, left to right, no shaping (same font/layout); not an image model",
        "shaped-plain": "as shaped, with the script's plainest catalog font (OCR control); Urdu uses Noto Naskh Arabic from the work cache (not shipped)",
        "unshaped-plain": "as unshaped, with the plainest font",
      },
      raster: "resvg, white background, 1500×1000",
      ocr: `tesseract.js ${tesseractVersion} (SIMD LSTM core; see tesseract-worker.cjs), OEM LSTM_ONLY, tessdata 4.0.0_best_int, PSM 7 (single line) or 6 (two lines)`,
      ocrLanguages: TESS_LANG,
      score: "exact = NFC + whitespace-normalised equality; exactIgnoringJoiners = same after deleting U+200C/U+200D; CER = code-point Levenshtein / reference length",
      harfbuzz: harfbuzzVersion(),
      artifacts: path.relative(ROOT, ARTIFACTS),
    },
    totals,
    summary,
    items,
  };
  await writeFile(path.join(HERE, "results.json"), JSON.stringify(results, null, 2) + "\n");
  await writeFile(path.join(HERE, "results.md"), renderMarkdown(results));
  console.log(JSON.stringify(totals, null, 2));
}

interface ArmStats {
  n: number;
  exact: number;
  exactIgnoringJoiners: number;
  meanCer: number;
  notdef?: number;
  identicalToShaped?: number;
}

function renderMarkdown(r: {
  measuredAt: string;
  method: Record<string, unknown>;
  totals: Record<string, ArmStats>;
  summary: Array<{ script: ScriptId; font: string; plainFont: string; arms: Record<string, ArmStats> }>;
  items: Item[];
}): string {
  const m = r.method as { ocr: string; harfbuzz: string; raster: string; artifacts: string };
  const out: string[] = [];
  const cell = (a: ArmStats) => `${a.exact}/${a.n}`;
  out.push("# Indic render accuracy");
  out.push("");
  out.push(`Measured ${r.measuredAt}. Generated by \`evals/render-accuracy/run.ts\`; raw data (every OCR reading) in \`results.json\`.`);
  out.push("");
  out.push("Question: when a reference is rendered and then read back by OCR, does it spell the requested phrase exactly?");
  out.push("");
  out.push("## Arms");
  out.push("");
  out.push(`- **shaped**: the Sulekh provider render (HarfBuzz ${m.harfbuzz} shaping), the script's kalam-style font, size medium.`);
  out.push("- **unshaped baseline**: the same font and layout, but each code point's nominal glyph is drawn left to right with no shaping. It reproduces the failure class (broken conjuncts, matras in logical instead of visual order, unjoined Arabic letters drawn left to right). It is a deterministic baseline, **not an image model**.");
  out.push("- **shaped-plain / unshaped-plain**: the same two arms with the script's plainest font, as an OCR control for calligraphic fonts. For Urdu the catalog has only Noto Nastaliq Urdu, so the control is Noto Naskh Arabic (OFL), fetched into the work cache for this measurement and not shipped with the app.");
  out.push("");
  out.push(`Raster: ${m.raster}. OCR: ${m.ocr}. Score: exact NFC match after whitespace normalisation, plus character error rate (CER). The secondary \"exact ignoring joiners\" count also deletes U+200C/U+200D from both strings: Tesseract appends an invisible ZWNJ after word-final viramas (e.g. \"வணக்கம்\\u200c\"), which fails the strict match without any visible difference.`);
  out.push("");
  out.push("## Totals (50 phrases per arm)");
  out.push("");
  out.push("| Arm | Exact | Exact ignoring joiners | Mean CER |");
  out.push("|---|---|---|---|");
  for (const [arm, t] of Object.entries(r.totals)) out.push(`| ${arm} | ${t.exact}/${t.n} | ${t.exactIgnoringJoiners}/${t.n} | ${t.meanCer.toFixed(3)} |`);
  out.push("");
  out.push("## Per script: script's kalam-style font");
  out.push("");
  out.push("| Script | Font | Shaped exact | Unshaped exact | Shaped exact (ign. joiners) | Unshaped exact (ign. joiners) | Shaped CER | Unshaped CER | Unshaped run identical to shaped |");
  out.push("|---|---|---|---|---|---|---|---|---|");
  for (const s of r.summary) {
    const a = s.arms.shaped;
    const b = s.arms.unshaped;
    out.push(`| ${s.script} | ${s.font} | ${cell(a)} | ${cell(b)} | ${a.exactIgnoringJoiners}/${a.n} | ${b.exactIgnoringJoiners}/${b.n} | ${a.meanCer.toFixed(3)} | ${b.meanCer.toFixed(3)} | ${b.identicalToShaped}/${b.n} |`);
  }
  out.push("");
  out.push("## Per script: plainest font (OCR control)");
  out.push("");
  out.push("| Script | Font | Shaped exact | Unshaped exact | Shaped exact (ign. joiners) | Unshaped exact (ign. joiners) | Shaped CER | Unshaped CER | Unshaped run identical to shaped |");
  out.push("|---|---|---|---|---|---|---|---|---|");
  for (const s of r.summary) {
    const a = s.arms["shaped-plain"];
    const b = s.arms["unshaped-plain"];
    out.push(`| ${s.script} | ${s.plainFont} | ${cell(a)} | ${cell(b)} | ${a.exactIgnoringJoiners}/${a.n} | ${b.exactIgnoringJoiners}/${b.n} | ${a.meanCer.toFixed(3)} | ${b.meanCer.toFixed(3)} | ${b.identicalToShaped}/${b.n} |`);
  }
  out.push("");
  out.push("\"Unshaped run identical to shaped\" counts phrases where the HarfBuzz output (glyph ids and positions) equals the naive per-code-point run, so both arms draw the same picture and any OCR difference between them is noise.");
  out.push("");
  out.push("## Notes on OCR limits (read before quoting numbers)");
  out.push("");
  out.push("- OCR is a proxy for \"a reader sees the right text\", and a weak one for calligraphic Indic fonts. Every shaped render passed `validateReference` before OCR (no .notdef, no dotted circle, NFC text identical to the request), so a miss in a shaped arm is an OCR misreading of a correct render, not a wrong render.");
  out.push("- Calligraphic fonts (Kalam, Baloo Paaji 2, Meera Inimai, Galada, Noto Nastaliq) are far from Tesseract's training fonts. Compare the two per-script tables to see how much of a miss is font style.");
  out.push("- Tesseract's `urd` model reads Naskh-style print far better than Nastaliq; the Nastaliq rows mostly measure that limit. The unshaped Urdu baseline draws isolated letters left to right, which `urd` mostly reads as nothing.");
  out.push("- The unshaped baseline is sometimes read *correctly*: Tesseract's language model can repair visible halants or a matra drawn after its consonant into the intended spelling. That makes the baseline numbers an upper bound on how readable naive rendering is, not a measure of how it looks to a person.");
  out.push("- Exact match is strict: one wrong code point (nukta, anusvara vs chandrabindu, a dropped space) fails the phrase. CER shows how close the reading was.");
  out.push("- The phrases were fixed before the first run and not changed afterwards. No OCR post-correction beyond NFC, whitespace and (secondary metric only) joiner removal.");
  out.push(`- Every SVG and PNG is kept in \`${m.artifacts}\`.`);
  out.push("");
  out.push("## Misses");
  out.push("");
  out.push("| Arm | Id | Font | Text | OCR | CER |");
  out.push("|---|---|---|---|---|---|");
  for (const i of r.items.filter((i) => !i.exact)) {
    const ocr = (i.ocr || "(empty)").replace(/\|/g, "\\|").replace(/[\u200c\u200d]/g, (c) => (c === "\u200c" ? "[ZWNJ]" : "[ZWJ]"));
    out.push(`| ${i.arm} | ${i.id} | ${i.font} | ${i.text} | ${ocr} | ${i.cer.toFixed(2)} |`);
  }
  out.push("");
  return out.join("\n");
}

await main();
