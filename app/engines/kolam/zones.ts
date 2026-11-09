/**
 * Zones and fill phrases.
 *
 * Zone tags on regions: "center", "ring-1".."ring-n" (inner → outer),
 * "outer" (outermost ring), "border" (edge band), "petal", "petal-k",
 * "motif-<name>", "accent", "band", "loop", "dots", "cell".
 *
 * parseFillPhrase is a deterministic lexicon parser for Hindi / Hinglish /
 * English / Tamil / Punjabi fill commands. It never guesses: anything it
 * cannot pair into (zone, colour) comes back in `unresolved`.
 */
import { colourAliasTable, normalizeWord } from "./palette";
import type { ColourName, Design, ParseResult, ParsedFill, UnresolvedPart } from "./types";

type Item =
  | { t: "zone"; zone: string }
  | { t: "colour"; colour: ColourName }
  | { t: "ordinal"; n: number }
  | { t: "number"; n: number }
  | { t: "ringword" }
  | { t: "petalword" }
  | { t: "stop" }
  | { t: "and" }
  | { t: "comma" };

const LEX = new Map<string, Item>();

function put(words: string[], item: Item): void {
  for (const w of words) LEX.set(w.split(/\s+/).map(normalizeWord).join(" "), item);
}

// ---- zones ----
put(
  [
    "beech", "bich", "beach", "beecho", "bichon", "beechon", "beech wala", "middle", "center", "centre",
    "central", "madhya", "andar", "andar ka", "andar wala", "andar wali", "andar wale", "andhar", "inner",
    "inside", "innermost", "bindu beech", "बीच", "बीचों", "बीचो", "मध्य", "अंदर", "अन्दर", "भीतर",
    "केंद्र", "केन्द्र", "kendra", "நடுவில்", "நடு", "நடுவே", "மையத்தில்", "மையம்", "உள்ளே", "naduvil",
    "nadu", "maiyam", "ulle", "ਵਿਚਕਾਰ", "ਅੰਦਰ", "ਵਿਚਾਲੇ", "vichkar", "vichkaar", "vichale",
  ],
  { t: "zone", zone: "center" },
);
put(
  [
    "bahar", "baahar", "bahr", "bahar wala", "bahar wali", "bahar wale", "bahari", "baahari", "outer",
    "outside", "outermost", "बाहर", "बाहरी", "बाहर वाला", "வெளியே", "வெளியில்", "வெளி", "veliye",
    "veliyil", "ਬਾਹਰ", "ਬਾਹਰਲਾ", "ਬਾਹਰੀ",
  ],
  { t: "zone", zone: "outer" },
);
put(
  [
    "kinara", "kinare", "kinaare", "kinaara", "border", "edge", "edges", "rim", "boundary", "किनारा",
    "किनारे", "किनारी", "सरहद", "ஓரம்", "ஓரத்தில்", "விளிம்பு", "விளிம்பில்", "oram", "orathil",
    "ਕਿਨਾਰਾ", "ਕਿਨਾਰੇ",
  ],
  { t: "zone", zone: "border" },
);
put(["sab", "sabko", "sab kuch", "sab jagah", "poora", "pura", "puri", "all", "everything", "whole", "सब", "सबको", "पूरा", "पूरी", "எல்லாம்", "ellam", "ਸਭ", "ਸਾਰਾ"], {
  t: "zone",
  zone: "all",
});
put(["bindu", "bindi", "bindiyan", "bindiyon", "dots", "dot", "pulli", "pullis", "बिंदु", "बिंदी", "बिंदियाँ", "बिंदियां", "புள்ளி", "புள்ளிகள்", "ਬਿੰਦੂ"], {
  t: "zone",
  zone: "dots",
});
put(["rekha", "rekhaa", "lakeer", "lakir", "line", "lines", "loop", "kolam line", "रेखा", "लकीर", "கோடு", "கோடுகள்", "kodu", "ਲਕੀਰ"], {
  t: "zone",
  zone: "loop",
});
put(["diya", "diye", "deeya", "deeye", "diyas", "lamp", "lamps", "दीया", "दीये", "दिया", "दिये", "விளக்கு", "vilakku", "ਦੀਵਾ", "ਦੀਵੇ"], {
  t: "zone",
  zone: "motif-diya",
});
put(["lau", "jyot", "jyoti", "flame", "flames", "लौ", "ज्योत", "சுடர்", "ਲਾਟ"], { t: "zone", zone: "flame" });
put(["kamal", "kamal ke", "lotus", "lotuses", "कमल", "தாமரை", "thamarai", "ਕਮਲ"], { t: "zone", zone: "motif-lotus" });
put(["mor pankh", "morpankh", "mor pankhi", "peacock", "peacock feather", "peacock feathers", "मोरपंख", "मोर पंख", "மயிலிறகு", "ਮੋਰ ਖੰਭ"], {
  t: "zone",
  zone: "motif-peacock-feather",
});
put(["aam ka patta", "aam ke patte", "aam patta", "patta", "patte", "leaf", "leaves", "mango leaf", "mango leaves", "पत्ता", "पत्ते", "आम के पत्ते", "மாவிலை", "maavilai", "ਪੱਤਾ", "ਪੱਤੇ"], {
  t: "zone",
  zone: "motif-mango-leaf",
});
put(["diamond", "diamonds", "jyamiti", "geometric", "चौकोर", "ज्यामिति"], { t: "zone", zone: "motif-geometric" });
put(["pankhudi", "pankhudiyan", "pankhudiya", "pankhuri", "petal", "petals", "pattiyan", "पंखुड़ी", "पंखुड़ियाँ", "पंखुड़ियां", "இதழ்", "இதழ்கள்", "ਪੱਤੀਆਂ", "ਪੰਖੜੀ"], {
  t: "petalword",
});
put(["ghera", "ghere", "gheraa", "daira", "dayra", "chakkar", "chakra", "gola", "ring", "rings", "circle", "circles", "round", "valay", "घेरा", "घेरे", "दायरा", "चक्र", "गोला", "वलय", "வட்டம்", "வளையம்", "vattam", "ਘੇਰਾ", "ਚੱਕਰ"], {
  t: "ringword",
});

// ---- ordinals ----
const ORD: [number, string[]][] = [
  [1, ["pehla", "pahla", "pehle", "pahle", "pehli", "pahli", "first", "1st", "पहला", "पहले", "पहली", "முதல்", "ਪਹਿਲਾ"]],
  [2, ["doosra", "dusra", "doosre", "dusre", "doosri", "dusri", "second", "2nd", "दूसरा", "दूसरे", "दूसरी", "இரண்டாவது", "ਦੂਜਾ"]],
  [3, ["teesra", "tisra", "teesre", "tisre", "teesri", "tisri", "third", "3rd", "तीसरा", "तीसरे", "तीसरी", "மூன்றாவது", "ਤੀਜਾ"]],
  [4, ["chautha", "chotha", "chauthe", "chauthi", "fourth", "4th", "चौथा", "चौथे", "चौथी", "நான்காவது", "ਚੌਥਾ"]],
  [5, ["paanchva", "panchva", "panchvan", "paanchvi", "fifth", "5th", "पाँचवाँ", "पांचवां", "पाँचवें", "पांचवें", "पाँचवीं", "ஐந்தாவது", "ਪੰਜਵਾਂ"]],
  [6, ["chhatha", "chhata", "chhathe", "chhathi", "sixth", "6th", "छठा", "छठे", "छठी", "ஆறாவது", "ਛੇਵਾਂ"]],
  [7, ["saatva", "saatvan", "satvan", "saatvi", "seventh", "7th", "सातवाँ", "सातवां", "सातवें", "सातवीं", "ஏழாவது", "ਸੱਤਵਾਂ"]],
];
for (const [n, words] of ORD) put(words, { t: "ordinal", n });

// ---- colours ----
for (const [w, colour] of Object.entries(colourAliasTable())) LEX.set(w, { t: "colour", colour });

// ---- joiners and filler words ----
put(["aur", "or", "and", "&", "phir", "fir", "then", "tatha", "और", "फिर", "तथा", "மற்றும்", "ਅਤੇ", "ਤੇ", "ate"], { t: "and" });
put(
  [
    "mein", "me", "men", "mai", "main", "par", "pe", "में", "मे", "पर", "pe", "wala", "wali", "wale", "vala", "vali", "vale",
    "वाला", "वाली", "वाले", "ko", "को", "kar", "karo", "kardo", "kar do", "kar dijiye", "kijiye", "karein", "karna",
    "करो", "कर", "कर दो", "कीजिए", "करें", "do", "दो", "de", "do na", "dena", "rang", "rango", "rangna", "rang do",
    "रंग", "रंगो", "रंग दो", "bharo", "bhar", "bhar do", "भरो", "भर", "भर दो", "colour", "color", "colours", "paint",
    "fill", "make", "it", "the", "in", "at", "on", "with", "a", "ka", "ki", "ke", "का", "की", "के", "hai", "है",
    "ho", "हो", "sabse", "सबसे", "hissa", "हिस्सा", "part", "area", "jagah", "जगह", "please", "plz", "kripya",
    "कृपया", "ji", "जी", "taraf", "तरफ", "side", "wala hissa", "region", "zone", "ab", "अब", "ye", "yeh", "यह",
    "ये", "isko", "इसको", "use", "उसे", "ਵਿੱਚ", "ਵਿਚ", "ਨੂੰ", "ਕਰੋ", "ਰੰਗ", "ਵਾਲਾ", "ਦਿਓ", "நிறம்", "வண்ணம்",
    "போடு", "போடுங்கள்", "podu", "niram", "vannam", "nirathil",
  ],
  { t: "stop" },
);

const DEV_DIGITS = "०१२३४५६७८९";

function tokenize(text: string): string[] {
  let s = normalizeWord(text);
  s = s.replace(/[०-९]/g, (d) => String(DEV_DIGITS.indexOf(d)));
  s = s.replace(/[,;।॥.!?\n]+/g, " , ");
  s = s.replace(/["'“”‘’()[\]{}:]/g, " ");
  return s.split(/\s+/).filter(Boolean);
}

interface Clause {
  items: Item[];
  text: string;
  unknown: string[];
  joinedByAnd: boolean;
}

function lexClauses(text: string): Clause[] {
  const toks = tokenize(text);
  const clauses: Clause[] = [];
  let cur: Clause = { items: [], text: "", unknown: [], joinedByAnd: false };
  let words: string[] = [];
  const flush = (nextJoinedByAnd: boolean) => {
    cur.text = words.join(" ");
    if (cur.items.length || cur.unknown.length) clauses.push(cur);
    cur = { items: [], text: "", unknown: [], joinedByAnd: nextJoinedByAnd };
    words = [];
  };
  let i = 0;
  while (i < toks.length) {
    let matched: Item | undefined;
    let span = 0;
    for (let w = 3; w >= 1; w--) {
      if (i + w > toks.length) continue;
      const phrase = toks.slice(i, i + w).join(" ");
      const it = LEX.get(phrase);
      if (it) {
        matched = it;
        span = w;
        break;
      }
    }
    const tok = toks[i];
    if (!matched) {
      const ringTag = tok.match(/^(?:ring|ghera|घेरा)-?(\d)$/);
      const petalTag = tok.match(/^petal-?(\d{1,2})$/);
      const ordMatch = tok.match(/^(\d)(?:st|nd|rd|th|वां|वाँ|वें|वीं|वा)$/);
      if (tok === ",") matched = { t: "comma" };
      else if (ringTag) matched = { t: "zone", zone: `ring-${ringTag[1]}` };
      else if (petalTag) matched = { t: "zone", zone: `petal-${Number(petalTag[1])}` };
      else if (/^(center|outer|border|all|dots|loop|band|accent)$/.test(tok)) matched = { t: "zone", zone: tok };
      else if (/^motif-[a-z-]+$/.test(tok)) matched = { t: "zone", zone: tok };
      else if (ordMatch) matched = { t: "ordinal", n: Number(ordMatch[1]) };
      else if (/^\d{1,2}$/.test(tok)) matched = { t: "number", n: Number(tok) };
      span = 1;
    }
    if (matched?.t === "comma") {
      flush(false);
    } else if (matched?.t === "and") {
      flush(true);
    } else {
      words.push(...toks.slice(i, i + span));
      if (!matched) cur.unknown.push(tok);
      else if (matched.t !== "stop") cur.items.push(matched);
    }
    i += span;
  }
  flush(false);
  return clauses.map(combineRings);
}

/** Fold [ordinal|number] + ringword / petalword (either order) into zone items. */
function combineRings(c: Clause): Clause {
  const out: Item[] = [];
  const it = c.items;
  for (let i = 0; i < it.length; i++) {
    const a = it[i];
    const b = it[i + 1];
    const isNum = (x: Item | undefined): x is { t: "ordinal" | "number"; n: number } =>
      !!x && (x.t === "ordinal" || x.t === "number");
    if (isNum(a) && b && (b.t === "ringword" || b.t === "petalword")) {
      out.push({ t: "zone", zone: `${b.t === "ringword" ? "ring" : "petal"}-${a.n}` });
      i++;
    } else if ((a.t === "ringword" || a.t === "petalword") && isNum(b)) {
      out.push({ t: "zone", zone: `${a.t === "ringword" ? "ring" : "petal"}-${b.n}` });
      i++;
    } else if (a.t === "petalword") {
      out.push({ t: "zone", zone: "petal" });
    } else {
      out.push(a);
    }
  }
  return { ...c, items: out };
}

/**
 * Parse a fill command into (zone, colour) pairs.
 * "beech mein peela, bahar laal" → [{center, peela}, {outer, laal}].
 */
export function parseFillPhrase(text: string): ParseResult {
  const clauses = lexClauses(text);
  const fills: ParsedFill[] = [];
  const unresolved: UnresolvedPart[] = [];
  let carry: { zones: string[]; text: string } | null = null;

  const unres = (c: Clause, reason: UnresolvedPart["reason"]) => {
    const part: UnresolvedPart = { text: c.text, reason };
    if (c.unknown.length) part.unknownWords = c.unknown;
    unresolved.push(part);
  };

  clauses.forEach((c, idx) => {
    // merge consecutive duplicate zones ("beecho beech")
    const items: Item[] = [];
    for (const it of c.items) {
      const prev = items[items.length - 1];
      if (it.t === "zone" && prev?.t === "zone" && prev.zone === it.zone) continue;
      items.push(it);
    }
    const stray = items.some((x) => x.t === "ordinal" || x.t === "number" || x.t === "ringword");
    const zones = items.filter((x): x is { t: "zone"; zone: string } => x.t === "zone").map((x) => x.zone);
    const colours = items
      .filter((x): x is { t: "colour"; colour: ColourName } => x.t === "colour")
      .map((x) => x.colour);
    const next = clauses[idx + 1];

    if (carry && !(c.joinedByAnd && zones.length >= 1 && colours.length === 1 && !stray)) {
      unresolved.push({ text: carry.text, reason: "colour-missing" });
      carry = null;
    }

    if (stray) {
      unres(c, "ambiguous");
      return;
    }
    if (!zones.length && !colours.length) {
      if (c.unknown.length) unres(c, "unknown");
      return;
    }
    if (zones.length && !colours.length) {
      if (next?.joinedByAnd) {
        carry = { zones: [...(carry?.zones ?? []), ...zones], text: carry ? `${carry.text} ${c.text}` : c.text };
      } else unres(c, "colour-missing");
      return;
    }
    if (!zones.length) {
      unres(c, "zone-missing");
      return;
    }
    if (colours.length === 1) {
      const colour = colours[0];
      if (carry) {
        for (const z of carry.zones) fills.push({ zone: z, colour, source: `${carry.text} ${c.text}`.trim() });
        carry = null;
      }
      for (const z of zones) fills.push({ zone: z, colour, source: c.text });
      return;
    }
    // Several colours: pair adjacent zone/colour items in order.
    let pz: string | null = null;
    let pc: ColourName | null = null;
    let leftovers = false;
    for (const it of items) {
      if (it.t === "zone") {
        if (pc) {
          fills.push({ zone: it.zone, colour: pc, source: c.text });
          pc = null;
        } else if (pz) {
          leftovers = true;
          pz = it.zone;
        } else pz = it.zone;
      } else if (it.t === "colour") {
        if (pz) {
          fills.push({ zone: pz, colour: it.colour, source: c.text });
          pz = null;
        } else if (pc) {
          leftovers = true;
          pc = it.colour;
        } else pc = it.colour;
      }
    }
    if (leftovers || pz || pc) unres(c, "ambiguous");
  });
  if (carry) unresolved.push({ text: (carry as { text: string }).text, reason: "colour-missing" });
  return { fills, unresolved };
}

/** Canonical zone tag for a tag or zone word ("beech" → "center"), or undefined. */
export function canonicalZone(zone: string): string | undefined {
  const z = normalizeWord(zone);
  if (/^(center|outer|border|all|dots|loop|band|accent|cell|petal|flame)$/.test(z)) return z;
  if (/^(ring|petal)-\d+$/.test(z) || /^motif-[a-z-]+$/.test(z) || /^ring-\d+-band$/.test(z)) return z;
  const zones = new Set<string>();
  for (const c of lexClauses(zone))
    for (const it of c.items) {
      if (it.t === "zone") zones.add(it.zone);
      else if (it.t !== "stop") return undefined;
    }
  return zones.size === 1 ? [...zones][0] : undefined;
}

/**
 * Region ids for a zone (tag or phrase-ish word). Accent and band regions are
 * only included when asked for directly; "border" falls back to "outer" for
 * designs without a separate border band.
 */
export function resolveZone(design: Pick<Design, "regions">, zone: string): string[] {
  const z = canonicalZone(zone);
  if (!z) return [];
  const regions = design.regions;
  if (z === "all") return regions.filter((r) => r.role === "area").map((r) => r.id);
  if (z === "dots") return regions.filter((r) => r.role === "dots").map((r) => r.id);
  if (z === "loop") return regions.filter((r) => r.role === "line").map((r) => r.id);
  const wantsSub = z === "accent" || z === "band" || z === "flame" || /-band$/.test(z);
  const pick = (tag: string) =>
    regions
      .filter((r) => r.zones.includes(tag))
      .filter((r) => wantsSub || !(r.zones.includes("accent") || r.zones.includes("band")))
      .map((r) => r.id);
  const ids = pick(z);
  if (!ids.length && z === "border") return pick("outer");
  return ids;
}
