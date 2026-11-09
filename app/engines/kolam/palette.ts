/**
 * Named colours, tuned to sit well on a dark clay / indigo floor (#1E1A2E),
 * with Hindi (Devanagari + Latin), English, Tamil and Punjabi names.
 */
import { COLOUR_NAMES, type ColourName, type FillValue } from "./types";

/** Chalk-white used for every outline. */
export const CHALK = "#F4EFE6";
/** Background used only when rendering previews (the SVG itself is transparent). */
export const PREVIEW_BG = "#1E1A2E";

export interface ColourInfo {
  name: ColourName;
  hex: string;
  hi: string;
  en: string;
  ta: string;
  pa: string;
}

export const COLOURS: Record<ColourName, ColourInfo> = {
  laal: { name: "laal", hex: "#E5483B", hi: "लाल", en: "red", ta: "சிவப்பு", pa: "ਲਾਲ" },
  peela: { name: "peela", hex: "#F7C948", hi: "पीला", en: "yellow", ta: "மஞ்சள்", pa: "ਪੀਲਾ" },
  hara: { name: "hara", hex: "#4DB36B", hi: "हरा", en: "green", ta: "பச்சை", pa: "ਹਰਾ" },
  neela: { name: "neela", hex: "#4C8FE6", hi: "नीला", en: "blue", ta: "நீலம்", pa: "ਨੀਲਾ" },
  gulabi: { name: "gulabi", hex: "#F27BB0", hi: "गुलाबी", en: "pink", ta: "இளஞ்சிவப்பு", pa: "ਗੁਲਾਬੀ" },
  kesariya: { name: "kesariya", hex: "#F78B2D", hi: "केसरिया", en: "saffron", ta: "ஆரஞ்சு", pa: "ਕੇਸਰੀ" },
  safed: { name: "safed", hex: "#FBF8F1", hi: "सफ़ेद", en: "white", ta: "வெள்ளை", pa: "ਚਿੱਟਾ" },
  jamuni: { name: "jamuni", hex: "#A06CDB", hi: "जामुनी", en: "purple", ta: "ஊதா", pa: "ਜਾਮਨੀ" },
  bhura: { name: "bhura", hex: "#B07A4F", hi: "भूरा", en: "brown", ta: "பழுப்பு", pa: "ਭੂਰਾ" },
};

/** Extra spellings / inflections → canonical colour. Keys are normalised. */
const COLOUR_ALIASES: Record<string, ColourName> = {};

function addAliases(name: ColourName, words: string[]): void {
  for (const w of words) COLOUR_ALIASES[normalizeWord(w)] = name;
}

addAliases("laal", ["laal", "lal", "laaal", "red", "लाल", "सुर्ख", "surkh", "சிவப்பு", "sivappu", "chivappu", "ਲਾਲ"]);
addAliases("peela", [
  "peela", "peeli", "peele", "pila", "pili", "pile", "peelaa", "yellow",
  "पीला", "पीली", "पीले", "மஞ்சள்", "manjal", "ਪੀਲਾ", "ਪੀਲੀ", "ਪੀਲੇ",
]);
addAliases("hara", [
  "hara", "hari", "hare", "haraa", "green", "हरा", "हरी", "हरे",
  "பச்சை", "pachai", "pacchai", "ਹਰਾ", "ਹਰੀ", "ਹਰੇ",
]);
addAliases("neela", [
  "neela", "neeli", "neele", "nila", "nili", "blue", "नीला", "नीली", "नीले",
  "நீலம்", "நீல", "neelam", "ਨੀਲਾ", "ਨੀਲੀ", "ਨੀਲੇ",
]);
addAliases("gulabi", ["gulabi", "gulaabi", "pink", "गुलाबी", "இளஞ்சிவப்பு", "ilanjivappu", "ரோஸ்", "ਗੁਲਾਬੀ"]);
addAliases("kesariya", [
  "kesariya", "kesaria", "kesari", "kesri", "saffron", "orange", "narangi", "naarangi",
  "केसरिया", "केसरी", "नारंगी", "भगवा", "ஆரஞ்சு", "காவி", "kaavi", "ਕੇਸਰੀ", "ਸੰਤਰੀ", "santri",
]);
addAliases("safed", [
  "safed", "safaid", "sufaid", "safet", "white", "सफ़ेद", "सफेद", "श्वेत",
  "வெள்ளை", "vellai", "ਚਿੱਟਾ", "ਚਿੱਟੀ", "chitta", "chitti", "ਸਫ਼ੈਦ",
]);
addAliases("jamuni", [
  "jamuni", "jaamuni", "baingani", "purple", "violet", "जामुनी", "बैंगनी",
  "ஊதா", "oodha", "ootha", "ਜਾਮਨੀ", "jamni",
]);
addAliases("bhura", ["bhura", "bhoora", "brown", "भूरा", "भूरी", "भूरे", "பழுப்பு", "pazhuppu", "ਭੂਰਾ"]);
for (const name of COLOUR_NAMES) COLOUR_ALIASES[name] = name;

/** Lowercase, NFC, and fold nukta / chandrabindu variants so spellings match. */
export function normalizeWord(word: string): string {
  return word
    .normalize("NFC")
    .toLowerCase()
    .replace(/़/g, "") // Devanagari nukta (सफ़ेद → सफेद)
    .replace(/ँ/g, "ं") // chandrabindu → anusvara
    .replace(/਼/g, "") // Gurmukhi nukta
    .trim();
}

/** Resolve a colour word in any supported language to its canonical name. */
export function resolveColour(word: string): ColourName | undefined {
  return COLOUR_ALIASES[normalizeWord(word)];
}

export function isColourName(value: string): value is ColourName {
  return (COLOUR_NAMES as readonly string[]).includes(value);
}

export function fillHex(fill: FillValue): string {
  return fill === "none" ? "none" : COLOURS[fill].hex;
}

/** Internal: alias table, exposed for the phrase lexicon. */
export function colourAliasTable(): Readonly<Record<string, ColourName>> {
  return COLOUR_ALIASES;
}
