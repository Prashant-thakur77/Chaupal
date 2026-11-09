/**
 * Render sample kolam / rangoli / pookalam designs to SVG + PNG for viewing.
 *
 *   pnpm exec tsx scripts/kolam/render-samples.ts [outDir]
 *
 * The SVGs are the engine's exact output (transparent background). The PNGs
 * are drawn on the dark clay/indigo preview floor.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { Resvg } from "@resvg/resvg-js";

import {
  PREVIEW_BG,
  applyFills,
  generateDesign,
  parseFillPhrase,
  presetParams,
  type Design,
} from "../../app/engines/kolam";

const outDir = process.argv[2] ?? path.resolve(process.cwd(), "../.chaupal-work/kolam-samples");
mkdirSync(outDir, { recursive: true });

function save(name: string, design: Design): void {
  const svg = design.svg;
  writeFileSync(path.join(outDir, `${name}.svg`), svg);
  const png = new Resvg(svg, { background: PREVIEW_BG, fitTo: { mode: "width", value: 1000 } }).render().asPng();
  writeFileSync(path.join(outDir, `${name}.png`), png);
  const failed = design.validation.checks.filter((c) => !c.ok).map((c) => `${c.id} (${c.severity})`);
  console.log(`${name}: valid=${design.validation.valid}${failed.length ? ` not-ok: ${failed.join(", ")}` : ""}`);
}

for (const grid of [3, 5, 7]) save(`pulli-${grid}x${grid}`, generateDesign({ kind: "pulli", grid, symmetry: "4-fold" }));
save("pulli-6x6-8fold", generateDesign({ kind: "pulli", grid: 6, symmetry: "8-fold" }));

const pulliFilled = generateDesign({ kind: "pulli", grid: 5, symmetry: "4-fold" });
const pf = parseFillPhrase("beech mein peela, pehla ghera gulabi, bahar hara");
save("pulli-5x5-filled", applyFills(pulliFilled, pf.fills.map((f) => ({ zone: f.zone, colour: f.colour }))).design);

save("rangoli-diwali", generateDesign(presetParams("diwali")));

const plain = generateDesign({ kind: "rangoli", template: "radial", rings: 4, motifs: ["lotus", "peacock-feather", "geometric"], petals: 8 });
save("rangoli-uncoloured", plain);
const phrase = parseFillPhrase("beech mein peela, pankhudi gulabi, doosra ghera kesariya, teesra ghera neela, bahar laal, kinara hara");
console.log("parsed:", JSON.stringify(phrase));
save("rangoli-filled", applyFills(plain, phrase.fills.map((f) => ({ zone: f.zone, colour: f.colour }))).design);

save("pookalam-onam", generateDesign(presetParams("onam")));
save("pookalam-uncoloured", generateDesign({ kind: "pookalam", rings: 5 }));

console.log(`wrote samples to ${outDir}`);
