/**
 * Script / style / font catalog, script detection and phrase suggestions.
 * Pure data + string logic: safe in Node, Workers and the browser.
 */

export type ScriptId = "devanagari" | "gurmukhi" | "tamil" | "bengali" | "urdu";
export type StyleId = "kalam" | "brush" | "modern";
export type LanguageHint = "hi" | "mr" | "sa" | "pa" | "ta" | "bn" | "ur";
export type SizeId = "small" | "medium" | "large";

export const SCRIPT_IDS: readonly ScriptId[] = [
  "devanagari",
  "gurmukhi",
  "tamil",
  "bengali",
  "urdu",
];
export const STYLE_IDS: readonly StyleId[] = ["kalam", "brush", "modern"];
export const SIZE_IDS: readonly SizeId[] = ["small", "medium", "large"];

export type FontId =
  | "kalam-bold"
  | "amita-bold"
  | "yatra-one"
  | "tiro-devanagari-hindi"
  | "rozha-one"
  | "baloo-paaji-2"
  | "mukta-mahee"
  | "catamaran"
  | "meera-inimai"
  | "galada"
  | "baloo-da-2"
  | "noto-nastaliq-urdu";

export interface FontEntry {
  id: FontId;
  family: string;
  /** Path relative to public/fonts (served at /fonts/<file>). */
  file: string;
  licence: "OFL-1.1";
  scripts: ScriptId[];
  /** Variable fonts are used at their default instance (glyf outlines). */
  variable: boolean;
  bytes: number;
}

export const FONT_CATALOG: Record<FontId, FontEntry> = {
  "kalam-bold": { id: "kalam-bold", family: "Kalam", file: "kalam/Kalam-Bold.ttf", licence: "OFL-1.1", scripts: ["devanagari"], variable: false, bytes: 460896 },
  "amita-bold": { id: "amita-bold", family: "Amita", file: "amita/Amita-Bold.ttf", licence: "OFL-1.1", scripts: ["devanagari"], variable: false, bytes: 221116 },
  "yatra-one": { id: "yatra-one", family: "Yatra One", file: "yatraone/YatraOne-Regular.ttf", licence: "OFL-1.1", scripts: ["devanagari"], variable: false, bytes: 276324 },
  "tiro-devanagari-hindi": { id: "tiro-devanagari-hindi", family: "Tiro Devanagari Hindi", file: "tirodevanagarihindi/TiroDevanagariHindi-Regular.ttf", licence: "OFL-1.1", scripts: ["devanagari"], variable: false, bytes: 423224 },
  "rozha-one": { id: "rozha-one", family: "Rozha One", file: "rozhaone/RozhaOne-Regular.ttf", licence: "OFL-1.1", scripts: ["devanagari"], variable: false, bytes: 322828 },
  "baloo-paaji-2": { id: "baloo-paaji-2", family: "Baloo Paaji 2", file: "baloopaaji2/BalooPaaji2-wght.ttf", licence: "OFL-1.1", scripts: ["gurmukhi"], variable: true, bytes: 243180 },
  "mukta-mahee": { id: "mukta-mahee", family: "Mukta Mahee", file: "muktamahee/MuktaMahee-Regular.ttf", licence: "OFL-1.1", scripts: ["gurmukhi"], variable: false, bytes: 211124 },
  catamaran: { id: "catamaran", family: "Catamaran", file: "catamaran/Catamaran-SemiBold.ttf", licence: "OFL-1.1", scripts: ["tamil"], variable: false, bytes: 53068 },
  "meera-inimai": { id: "meera-inimai", family: "Meera Inimai", file: "meerainimai/MeeraInimai-Regular.ttf", licence: "OFL-1.1", scripts: ["tamil"], variable: false, bytes: 72260 },
  galada: { id: "galada", family: "Galada", file: "galada/Galada-Regular.ttf", licence: "OFL-1.1", scripts: ["bengali"], variable: false, bytes: 187776 },
  "baloo-da-2": { id: "baloo-da-2", family: "Baloo Da 2", file: "balooda2/BalooDa2-wght.ttf", licence: "OFL-1.1", scripts: ["bengali"], variable: true, bytes: 451504 },
  "noto-nastaliq-urdu": { id: "noto-nastaliq-urdu", family: "Noto Nastaliq Urdu", file: "notonastaliqurdu/NotoNastaliqUrdu-wght.ttf", licence: "OFL-1.1", scripts: ["urdu"], variable: true, bytes: 690304 },
};

export interface ScriptEntry {
  id: ScriptId;
  /** ISO 15924 tag passed to HarfBuzz. */
  hbScript: string;
  direction: "ltr" | "rtl";
  nameEn: string;
  nameHi: string;
  nameNative: string;
  languages: LanguageHint[];
  defaultLanguage: LanguageHint;
  /** Font per style; first entry is the default, the rest are alternates. */
  fonts: Record<StyleId, FontId[]>;
  /** Plainest font (used as the OCR control in the render-accuracy eval). */
  plainFont: FontId;
}

export const SCRIPT_CATALOG: Record<ScriptId, ScriptEntry> = {
  devanagari: {
    id: "devanagari",
    hbScript: "Deva",
    direction: "ltr",
    nameEn: "Devanagari",
    nameHi: "देवनागरी",
    nameNative: "देवनागरी",
    languages: ["hi", "mr", "sa"],
    defaultLanguage: "hi",
    fonts: {
      kalam: ["kalam-bold"],
      brush: ["amita-bold", "yatra-one"],
      modern: ["tiro-devanagari-hindi", "rozha-one"],
    },
    plainFont: "tiro-devanagari-hindi",
  },
  gurmukhi: {
    id: "gurmukhi",
    hbScript: "Guru",
    direction: "ltr",
    nameEn: "Gurmukhi",
    nameHi: "गुरमुखी",
    nameNative: "ਗੁਰਮੁਖੀ",
    languages: ["pa"],
    defaultLanguage: "pa",
    fonts: {
      kalam: ["baloo-paaji-2"],
      brush: ["baloo-paaji-2"],
      modern: ["mukta-mahee"],
    },
    plainFont: "mukta-mahee",
  },
  tamil: {
    id: "tamil",
    hbScript: "Taml",
    direction: "ltr",
    nameEn: "Tamil",
    nameHi: "तमिल",
    nameNative: "தமிழ்",
    languages: ["ta"],
    defaultLanguage: "ta",
    fonts: {
      kalam: ["meera-inimai"],
      brush: ["catamaran"],
      modern: ["catamaran"],
    },
    plainFont: "catamaran",
  },
  bengali: {
    id: "bengali",
    hbScript: "Beng",
    direction: "ltr",
    nameEn: "Bengali",
    nameHi: "बांग्ला",
    nameNative: "বাংলা",
    languages: ["bn"],
    defaultLanguage: "bn",
    fonts: {
      kalam: ["galada"],
      brush: ["galada"],
      modern: ["baloo-da-2"],
    },
    plainFont: "baloo-da-2",
  },
  urdu: {
    id: "urdu",
    hbScript: "Arab",
    direction: "rtl",
    nameEn: "Urdu Nastaliq",
    nameHi: "उर्दू नस्तालीक़",
    nameNative: "اردو نستعلیق",
    languages: ["ur"],
    defaultLanguage: "ur",
    fonts: {
      kalam: ["noto-nastaliq-urdu"],
      brush: ["noto-nastaliq-urdu"],
      modern: ["noto-nastaliq-urdu"],
    },
    plainFont: "noto-nastaliq-urdu",
  },
};

export const STYLE_NAMES: Record<StyleId, { en: string; hi: string }> = {
  kalam: { en: "kalam", hi: "कलम" },
  brush: { en: "brush", hi: "ब्रश" },
  modern: { en: "modern", hi: "आधुनिक" },
};

export const LANGUAGE_SCRIPT: Record<LanguageHint, ScriptId> = {
  hi: "devanagari",
  mr: "devanagari",
  sa: "devanagari",
  pa: "gurmukhi",
  ta: "tamil",
  bn: "bengali",
  ur: "urdu",
};

/** Default font for a script + style. */
export function fontFor(script: ScriptId, style: StyleId): FontEntry {
  return FONT_CATALOG[SCRIPT_CATALOG[script].fonts[style][0]];
}

// ---------------------------------------------------------------------------
// Script detection
// ---------------------------------------------------------------------------

const RANGES: Array<[ScriptId, number, number]> = [
  ["devanagari", 0x0900, 0x097f],
  ["devanagari", 0xa8e0, 0xa8ff], // Devanagari Extended
  ["devanagari", 0x1cd0, 0x1cff], // Vedic Extensions
  ["bengali", 0x0980, 0x09ff],
  ["gurmukhi", 0x0a00, 0x0a7f],
  ["tamil", 0x0b80, 0x0bff],
  ["tamil", 0x11fc0, 0x11fff], // Tamil Supplement
  ["urdu", 0x0600, 0x06ff],
  ["urdu", 0x0750, 0x077f],
  ["urdu", 0x08a0, 0x08ff],
  ["urdu", 0xfb50, 0xfdff],
  ["urdu", 0xfe70, 0xfeff],
];

/** Characters that belong to no single script (spaces, danda, ZWJ/ZWNJ, digits, punctuation). */
function isCommon(cp: number): boolean {
  return (
    cp <= 0x40 ||
    (cp >= 0x5b && cp <= 0x60) ||
    (cp >= 0x7b && cp <= 0xbf) ||
    cp === 0x0964 || // danda
    cp === 0x0965 || // double danda
    cp === 0x200c ||
    cp === 0x200d ||
    (cp >= 0x2000 && cp <= 0x206f)
  );
}

export interface ScriptDetection {
  /** Dominant script, or null when the text has no supported script letters. */
  script: ScriptId | null;
  /** Every supported script seen. More than one means mixed text. */
  scripts: ScriptId[];
  /** Code points from no supported script (e.g. Latin letters). */
  unsupported: string[];
}

export function detectScript(text: string): ScriptDetection {
  const counts = new Map<ScriptId, number>();
  const unsupported = new Set<string>();
  for (const ch of text.normalize("NFC")) {
    const cp = ch.codePointAt(0)!;
    const hit = RANGES.find(([, lo, hi]) => cp >= lo && cp <= hi);
    if (hit) counts.set(hit[0], (counts.get(hit[0]) ?? 0) + 1);
    else if (!isCommon(cp)) unsupported.add(ch);
  }
  let best: ScriptId | null = null;
  let bestCount = 0;
  for (const [s, c] of counts) {
    if (c > bestCount) {
      best = s;
      bestCount = c;
    }
  }
  return { script: best, scripts: [...counts.keys()], unsupported: [...unsupported] };
}

// ---------------------------------------------------------------------------
// Phrase suggestions
// ---------------------------------------------------------------------------

export type MoodId =
  | "calm"
  | "joy"
  | "love"
  | "courage"
  | "gratitude"
  | "welcome"
  | "blessing"
  | "diwali"
  | "holi"
  | "new-year"
  | "eid"
  | "spiritual";

export interface PhraseSuggestion {
  text: string;
  script: ScriptId;
  language: LanguageHint;
  romanised: string;
  meaningEn: string;
  meaningHi: string;
  moods: MoodId[];
  /** Religious/devotional phrases are offered only when explicitly asked for. */
  religious: boolean;
}

const P = (
  text: string,
  script: ScriptId,
  language: LanguageHint,
  romanised: string,
  meaningEn: string,
  meaningHi: string,
  moods: MoodId[],
  religious = false,
): PhraseSuggestion => ({
  text: text.normalize("NFC"),
  script,
  language,
  romanised,
  meaningEn,
  meaningHi,
  moods,
  religious,
});

/** Secular phrases first within each script; religious ones are flagged. */
export const PHRASES: PhraseSuggestion[] = [
  // Devanagari (Hindi / Marathi / Sanskrit)
  P("शांति", "devanagari", "hi", "shanti", "peace", "शांति", ["calm"]),
  P("धैर्य", "devanagari", "hi", "dhairya", "patience", "धैर्य", ["calm", "courage"]),
  P("सुकून", "devanagari", "hi", "sukoon", "inner ease", "सुकून", ["calm"]),
  P("आनंद", "devanagari", "hi", "anand", "joy", "आनंद", ["joy"]),
  P("प्रेम", "devanagari", "hi", "prem", "love", "प्रेम", ["love"]),
  P("हिम्मत", "devanagari", "hi", "himmat", "courage", "हिम्मत", ["courage"]),
  P("धन्यवाद", "devanagari", "hi", "dhanyavaad", "thank you", "धन्यवाद", ["gratitude"]),
  P("स्वागत", "devanagari", "hi", "swagat", "welcome", "स्वागत", ["welcome"]),
  P("शुभकामनाएँ", "devanagari", "hi", "shubhkamnayein", "best wishes", "शुभकामनाएँ", ["blessing", "joy"]),
  P("सदा सुखी रहो", "devanagari", "hi", "sada sukhi raho", "may you always be happy", "सदा सुखी रहो", ["blessing"]),
  P("शुभ दीपावली", "devanagari", "hi", "shubh deepavali", "happy Diwali", "शुभ दीपावली", ["diwali"]),
  P("होली मुबारक", "devanagari", "hi", "holi mubarak", "happy Holi", "होली मुबारक", ["holi"]),
  P("नया साल मुबारक", "devanagari", "hi", "naya saal mubarak", "happy new year", "नया साल मुबारक", ["new-year"]),
  P("मनःशांती", "devanagari", "mr", "manahshanti", "peace of mind (Marathi)", "मन की शांति (मराठी)", ["calm"]),
  P("सत्यमेव जयते", "devanagari", "sa", "satyameva jayate", "truth alone triumphs", "सत्य की ही जीत होती है", ["courage"]),
  P("ॐ", "devanagari", "sa", "om", "Om", "ॐ", ["spiritual"], true),
  P("ॐ शान्तिः", "devanagari", "sa", "om shantih", "Om, peace", "ॐ शान्ति", ["spiritual", "calm"], true),
  P("श्री गणेशाय नमः", "devanagari", "sa", "shri ganeshaya namah", "salutation to Ganesha", "श्री गणेश को नमन", ["spiritual", "blessing"], true),
  // Gurmukhi (Punjabi)
  P("ਸਤ ਸ੍ਰੀ ਅਕਾਲ", "gurmukhi", "pa", "sat sri akal", "Punjabi greeting", "सत श्री अकाल (पंजाबी अभिवादन)", ["welcome"]),
  P("ਚੜ੍ਹਦੀ ਕਲਾ", "gurmukhi", "pa", "chardi kala", "ever-rising spirit", "चढ़दी कला (सदा ऊँचा हौसला)", ["courage", "blessing"]),
  P("ਪਿਆਰ", "gurmukhi", "pa", "pyaar", "love", "प्यार", ["love"]),
  P("ਸ਼ਾਂਤੀ", "gurmukhi", "pa", "shanti", "peace", "शांति", ["calm"]),
  P("ਜੀ ਆਇਆਂ ਨੂੰ", "gurmukhi", "pa", "ji aaiyan nu", "welcome", "स्वागत है", ["welcome"]),
  P("ਵਾਹਿਗੁਰੂ", "gurmukhi", "pa", "waheguru", "Waheguru", "वाहेगुरु", ["spiritual"], true),
  // Tamil
  P("வணக்கம்", "tamil", "ta", "vanakkam", "greetings", "नमस्कार", ["welcome"]),
  P("அன்பு", "tamil", "ta", "anbu", "love", "प्रेम", ["love"]),
  P("அமைதி", "tamil", "ta", "amaidhi", "peace", "शांति", ["calm"]),
  P("நன்றி", "tamil", "ta", "nandri", "thank you", "धन्यवाद", ["gratitude"]),
  P("மகிழ்ச்சி", "tamil", "ta", "magizhchi", "happiness", "खुशी", ["joy"]),
  P("இனிய தீபாவளி", "tamil", "ta", "iniya deepavali", "happy Deepavali", "शुभ दीपावली", ["diwali"]),
  P("ஓம்", "tamil", "ta", "om", "Om", "ॐ", ["spiritual"], true),
  // Bengali
  P("শুভ বিজয়া", "bengali", "bn", "shubho bijoya", "Bijoya greetings", "शुभ विजया", ["blessing", "joy"]),
  P("ভালোবাসা", "bengali", "bn", "bhalobasha", "love", "प्रेम", ["love"]),
  P("শান্তি", "bengali", "bn", "shanti", "peace", "शांति", ["calm"]),
  P("ধন্যবাদ", "bengali", "bn", "dhonnobad", "thank you", "धन्यवाद", ["gratitude"]),
  P("শুভ নববর্ষ", "bengali", "bn", "shubho noboborsho", "happy new year", "नया साल मुबारक", ["new-year"]),
  P("আনন্দ", "bengali", "bn", "anondo", "joy", "आनंद", ["joy"]),
  P("জয় মা দুর্গা", "bengali", "bn", "joy ma durga", "victory to Mother Durga", "जय माँ दुर्गा", ["spiritual"], true),
  // Urdu
  P("محبت", "urdu", "ur", "mohabbat", "love", "मोहब्बत", ["love"]),
  P("سکون", "urdu", "ur", "sukoon", "inner ease", "सुकून", ["calm"]),
  P("شکریہ", "urdu", "ur", "shukriya", "thank you", "शुक्रिया", ["gratitude"]),
  P("خوش آمدید", "urdu", "ur", "khush amdeed", "welcome", "ख़ुश आमदीद", ["welcome"]),
  P("امن", "urdu", "ur", "aman", "peace", "अमन", ["calm"]),
  P("عید مبارک", "urdu", "ur", "eid mubarak", "happy Eid", "ईद मुबारक", ["eid"]),
  P("بسم اللہ", "urdu", "ur", "bismillah", "in the name of God", "बिस्मिल्लाह", ["spiritual", "blessing"], true),
];

export interface SuggestOptions {
  mood?: MoodId;
  script?: ScriptId;
  language?: LanguageHint;
  /** Only when the person asked for devotional text. Default false. */
  includeReligious?: boolean;
  limit?: number;
}

/** Up to `limit` (default 3) suggestions, secular first. */
export function suggestPhrases(options: SuggestOptions = {}): PhraseSuggestion[] {
  const { mood, script, language, includeReligious = false, limit = 3 } = options;
  const pool = PHRASES.filter(
    (p) =>
      (includeReligious || !p.religious) &&
      (!mood || p.moods.includes(mood)) &&
      (!script || p.script === script) &&
      (!language || p.language === language || LANGUAGE_SCRIPT[language] === p.script),
  );
  // Stable sort: secular before religious, unless only religious was asked for.
  const wantsSpiritual = mood === "spiritual";
  pool.sort((a, b) =>
    wantsSpiritual
      ? Number(b.religious) - Number(a.religious)
      : Number(a.religious) - Number(b.religious),
  );
  return pool.slice(0, limit);
}
