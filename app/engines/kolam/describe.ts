/** Short Hindi + English alt text for a design. */
import { COLOURS } from "./palette";
import type { ColourName, Design, MotifName } from "./types";

const MOTIF_HI: Record<MotifName, string> = {
  lotus: "कमल",
  diya: "दीया",
  "peacock-feather": "मोरपंख",
  "mango-leaf": "आम के पत्ते",
  geometric: "ज्यामितीय",
};
const MOTIF_EN: Record<MotifName, string> = {
  lotus: "lotus",
  diya: "diya",
  "peacock-feather": "peacock feather",
  "mango-leaf": "mango leaf",
  geometric: "geometric",
};

function joinHi(xs: string[]): string {
  return xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} और ${xs[xs.length - 1]}`;
}
function joinEn(xs: string[]): string {
  return xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

function foldNum(s: string): string {
  return s.replace("-fold", "");
}

/** Structural description (does not change when fills change). */
export function describeDesign(design: Pick<Design, "params" | "meta">): { hi: string; en: string } {
  const p = design.params;
  if (p.kind === "pulli") {
    const loops = design.meta.loopCount ?? 1;
    const k = foldNum(p.symmetry);
    const lineHi = loops === 1 ? "एक ही रेखा" : `${loops} रेखाएँ`;
    const lineEn = loops === 1 ? "single line" : `${loops} loops`;
    return {
      hi: `${p.grid}×${p.grid} बिंदुओं का पुल्ली कोलम, ${lineHi}, ${k}-गुना समरूपता`,
      en: `${p.grid}×${p.grid} pulli kolam, ${lineEn}, ${k}-fold symmetry`,
    };
  }
  if (p.kind === "rangoli") {
    const motifs = design.meta.motifs ?? [...new Set(p.motifs)];
    return {
      hi: `${p.rings} घेरों वाली गोल रंगोली, ${p.petals} पंखुड़ियाँ, ${joinHi(motifs.map((m) => MOTIF_HI[m]))} के नमूने`,
      en: `Radial rangoli with ${p.rings} rings, ${p.petals} petals, ${joinEn(motifs.map((m) => MOTIF_EN[m]))} motifs`,
    };
  }
  return {
    hi: `${p.rings} घेरों का पूकलम (फूलों की रंगोली), ${foldNum(design.meta.symmetry)}-गुना समरूपता`,
    en: `Pookalam with ${p.rings} flower rings, ${foldNum(design.meta.symmetry)}-fold symmetry`,
  };
}

/** Colours currently used, for spoken summaries ("रंग: पीला, लाल"). */
export function describeFills(design: Pick<Design, "regions">): { hi: string; en: string } {
  const used: ColourName[] = [];
  for (const r of design.regions) if (r.fill !== "none" && !used.includes(r.fill)) used.push(r.fill);
  if (!used.length) return { hi: "अभी कोई रंग नहीं भरा", en: "no colours filled yet" };
  return {
    hi: `रंग: ${used.map((c) => COLOURS[c].hi).join(", ")}`,
    en: `colours: ${used.map((c) => COLOURS[c].en).join(", ")}`,
  };
}
