/**
 * Verify every Sulekh font: OFL licence text present and coverage of the
 * catalog + eval phrases for its script (no .notdef, no dotted circles).
 *
 *   pnpm exec tsx scripts/sulekh/verify-fonts.ts
 *
 * Prints a Markdown table (pasted into app/engines/sulekh/FONTS.md) and exits
 * non-zero if any font fails.
 */

import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import {
  FONT_CATALOG,
  getShaperFont,
  initShaper,
  loadFontBytesNode,
  PHRASES,
  SCRIPT_CATALOG,
  STYLE_IDS,
  type FontId,
} from "../../app/engines/sulekh";

const root = process.cwd();
const evalPhrases = JSON.parse(
  await readFile(path.join(root, "evals/render-accuracy/phrases.json"), "utf8"),
).phrases as Array<{ script: string; text: string }>;

await initShaper();
let failed = 0;
const rows: string[] = [];
for (const font of Object.values(FONT_CATALOG)) {
  const dir = path.dirname(path.join(root, "public/fonts", font.file));
  const licence = await readFile(path.join(dir, "OFL.txt"), "utf8");
  const isOfl = /SIL OPEN FONT LICENSE Version 1\.1/i.test(licence);
  const size = (await stat(path.join(root, "public/fonts", font.file))).size;
  const bytes = await loadFontBytesNode(font.id as FontId);
  const shaper = getShaperFont(bytes);
  const dotted = shaper.nominalGlyph(0x25cc);
  const results: string[] = [];
  let tested = 0;
  for (const script of font.scripts) {
    const entry = SCRIPT_CATALOG[script];
    const texts = [
      ...PHRASES.filter((p) => p.script === script).map((p) => p.text),
      ...evalPhrases.filter((p) => p.script === script).map((p) => p.text),
    ];
    for (const text of texts) {
      tested++;
      const glyphs = shaper.shape(text.normalize("NFC"), {
        script: entry.hbScript,
        language: entry.defaultLanguage,
        direction: entry.direction,
      });
      const notdef = glyphs.filter((g) => g.glyphId === 0).length;
      const broken = dotted ? glyphs.filter((g) => g.glyphId === dotted).length : 0;
      if (notdef || broken) results.push(`${text} (notdef ${notdef}, dotted ${broken})`);
    }
  }
  const styles = font.scripts.flatMap((s) =>
    STYLE_IDS.filter((st) => SCRIPT_CATALOG[s].fonts[st].includes(font.id)).map(
      (st) => `${st}${SCRIPT_CATALOG[s].fonts[st][0] === font.id ? "" : " (alt)"}`,
    ),
  );
  const ok = isOfl && results.length === 0 && size === font.bytes;
  if (!ok) failed++;
  rows.push(
    `| ${font.family} | \`${font.id}\` | \`public/fonts/${font.file}\` | ${(size / 1024).toFixed(0)} KB | ${isOfl ? "OFL 1.1" : "NOT OFL"} | ${font.scripts.join(", ")} | ${styles.join(", ")} | ${results.length ? `FAIL: ${results.join("; ")}` : `pass (${tested} phrases, 0 notdef)`} |`,
  );
  if (size !== font.bytes) console.error(`size mismatch for ${font.id}: catalog ${font.bytes}, file ${size}`);
}
console.log("| Family | Font id | File | Size | Licence | Scripts | Styles | Coverage |");
console.log("|---|---|---|---|---|---|---|---|");
for (const r of rows) console.log(r);
process.exitCode = failed ? 1 : 0;
