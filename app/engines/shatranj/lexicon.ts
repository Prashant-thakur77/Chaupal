/**
 * Lexicon loader and deterministic tokenizer/tagger for Shatranj phrases.
 *
 * Text is normalized (NFC, Latin lowercased, Indic digits to ASCII), split
 * into tokens at whitespace, punctuation and script boundaries, and each
 * token gets a matching key:
 *   - Devanagari / Gurmukhi: nukta, ZWJ/ZWNJ and Gurmukhi addak removed,
 *     chandrabindu folded to anusvara, tippi folded to bindi.
 *   - Latin: diacritics dropped, then a spelling skeleton (ee->i, oo->u,
 *     w->v, z->j, q->k, ph->f, doubled letters collapsed), so "aage",
 *     "agge" and "age" share a key, as do "wazir" and "vazeer".
 *   - Tamil: matched exactly, or by prefix for content words so case
 *     suffixes (-ஐ object, -ஆல் instrument) still match the stem.
 * Multi-word lexicon entries ("maar do", "beech ki taraf") are matched
 * greedily, longest first.
 */
import type { PieceSymbol } from "chess.js";

import raw from "./lexicon.json";

export type Direction =
  | "forward"
  | "back"
  | "left"
  | "right"
  | "diagonal-left"
  | "diagonal-right"
  | "diagonal"
  | "straight"
  | "towards-center";

export const LANGS = ["hi", "hiLatin", "pa", "paLatin", "ta", "taLatin", "en"] as const;
export type Lang = (typeof LANGS)[number];
type LangLists = Record<Lang, string[]>;

export interface LexiconData {
  version: number;
  languages: Record<Lang, string>;
  pieces: Record<PieceSymbol, LangLists>;
  directions: Record<"forward" | "back" | "left" | "right" | "diagonal" | "straight" | "towards-center", LangLists>;
  center: LangLists;
  numbers: Record<string, LangLists>;
  units: LangLists;
  capture: LangLists;
  castle: LangLists;
  castleKingside: LangLists;
  castleQueenside: LangLists;
  protectKing: LangLists;
  preview: LangLists;
  own: LangLists;
  opponent: LangLists;
  wala: LangLists;
  postposition: LangLists;
  front: LangLists;
  taraf: LangLists;
  instrumental: LangLists;
  toMarker: LangLists;
  object: LangLists;
  negation: LangLists;
  moveVerbs: LangLists;
  fillers: LangLists;
}

export const LEXICON: LexiconData = raw as unknown as LexiconData;

export type Tag =
  | { kind: "piece"; piece: PieceSymbol }
  | { kind: "dir"; dir: Direction }
  | { kind: "center" }
  | { kind: "num"; n: number }
  | { kind: "unit" }
  | { kind: "capture" }
  | { kind: "castle" }
  | { kind: "castleSide"; side: "kingside" | "queenside" }
  | { kind: "protectKing" }
  | { kind: "preview" }
  | { kind: "own" }
  | { kind: "opponent" }
  | { kind: "wala" }
  | { kind: "postp" }
  | { kind: "front" }
  | { kind: "taraf" }
  | { kind: "instr" }
  | { kind: "toMarker" }
  | { kind: "object" }
  | { kind: "neg" }
  | { kind: "verb" }
  | { kind: "filler" };

export type TagKind = Tag["kind"];

interface Entry {
  keys: string[];
  tag: Tag;
  lang: Lang;
  source: string;
  /** Tamil content words may match by prefix (case suffixes). */
  prefixOk: boolean;
}

// ---------------------------------------------------------------------------
// Normalization

const DEVANAGARI = /[ऀ-ॿ]/;
const GURMUKHI = /[਀-੿]/;
const TAMIL = /[஀-௿]/;

type Script = "latin" | "deva" | "guru" | "taml" | "other";

function scriptOf(ch: string): Script {
  if (DEVANAGARI.test(ch)) return "deva";
  if (GURMUKHI.test(ch)) return "guru";
  if (TAMIL.test(ch)) return "taml";
  if (/[a-z0-9À-ɏ]/i.test(ch)) return "latin";
  return "other";
}

function indicDigitsToAscii(s: string): string {
  return s.replace(/[०-९੦-੯௦-௯]/g, (d) => {
    const c = d.charCodeAt(0);
    if (c >= 0x0be6) return String(c - 0x0be6);
    if (c >= 0x0a66) return String(c - 0x0a66);
    return String(c - 0x0966);
  });
}

/** NFC, lowercase Latin, Indic digits to ASCII, punctuation to spaces, split scripts. */
export function normalizeText(text: string): string {
  let s = indicDigitsToAscii(text.normalize("NFC")).toLowerCase();
  s = s.replace(/['’‘`]/g, "");
  s = s.replace(/[.,!?;:।॥"“”()[\]{}…—–\-/\\|*_~]+/g, " ");
  // Split at script boundaries ("e2से" -> "e2 से").
  let out = "";
  let prev: Script = "other";
  for (const ch of s) {
    const sc = scriptOf(ch);
    if (out && sc !== "other" && prev !== "other" && sc !== prev) out += " ";
    out += ch;
    if (/\s/.test(ch)) prev = "other";
    else if (sc !== "other") prev = sc;
  }
  return out.replace(/\s+/g, " ").trim();
}

export function tokenize(text: string): string[] {
  const n = normalizeText(text);
  return n ? n.split(" ") : [];
}

function latinSkeleton(tok: string): string {
  let s = tok.normalize("NFD").replace(/[̀-ͯ]/g, "");
  s = s.replace(/ee/g, "i").replace(/oo/g, "u").replace(/ph/g, "f");
  s = s.replace(/w/g, "v").replace(/z/g, "j").replace(/q/g, "k");
  s = s.replace(/(.)\1+/g, "$1");
  return s;
}

function indicKey(tok: string): string {
  return tok
    .normalize("NFC")
    .replace(/[़਼‌‍ੱ]/g, "")
    .replace(/ँ/g, "ं")
    .replace(/ੰ/g, "ਂ");
}

/** Matching key for one normalized token. */
export function tokenKey(tok: string): string {
  if (DEVANAGARI.test(tok) || GURMUKHI.test(tok)) return indicKey(tok);
  if (TAMIL.test(tok)) return tok;
  return latinSkeleton(tok);
}

function isTamil(tok: string): boolean {
  return TAMIL.test(tok);
}

// ---------------------------------------------------------------------------
// Index

const PREFIX_KINDS: ReadonlySet<TagKind> = new Set<TagKind>([
  "piece",
  "dir",
  "center",
  "capture",
  "preview",
  "unit",
]);

function buildEntries(): Entry[] {
  const entries: Entry[] = [];
  const add = (lists: LangLists, tag: Tag) => {
    for (const lang of LANGS) {
      for (const phrase of lists[lang] ?? []) {
        const keys = tokenize(phrase).map(tokenKey);
        if (keys.length === 0) continue;
        entries.push({
          keys,
          tag,
          lang,
          source: phrase,
          prefixOk: PREFIX_KINDS.has(tag.kind) && keys.length === 1 && isTamil(phrase),
        });
      }
    }
  };
  const L = LEXICON;
  for (const p of Object.keys(L.pieces) as PieceSymbol[]) add(L.pieces[p], { kind: "piece", piece: p });
  for (const d of Object.keys(L.directions) as (keyof LexiconData["directions"])[]) {
    add(L.directions[d], { kind: "dir", dir: d });
  }
  add(L.center, { kind: "center" });
  for (const n of Object.keys(L.numbers)) add(L.numbers[n] as LangLists, { kind: "num", n: Number(n) });
  add(L.units, { kind: "unit" });
  add(L.capture, { kind: "capture" });
  add(L.castle, { kind: "castle" });
  add(L.castleKingside, { kind: "castleSide", side: "kingside" });
  add(L.castleQueenside, { kind: "castleSide", side: "queenside" });
  add(L.protectKing, { kind: "protectKing" });
  add(L.preview, { kind: "preview" });
  add(L.own, { kind: "own" });
  add(L.opponent, { kind: "opponent" });
  add(L.wala, { kind: "wala" });
  add(L.postposition, { kind: "postp" });
  add(L.front, { kind: "front" });
  add(L.taraf, { kind: "taraf" });
  add(L.instrumental, { kind: "instr" });
  add(L.toMarker, { kind: "toMarker" });
  add(L.object, { kind: "object" });
  add(L.negation, { kind: "neg" });
  add(L.moveVerbs, { kind: "verb" });
  add(L.fillers, { kind: "filler" });
  return entries;
}

const ENTRIES = buildEntries();
const BY_FIRST = new Map<string, Entry[]>();
const PREFIX_ENTRIES: Entry[] = [];
for (const e of ENTRIES) {
  const k = e.keys[0] as string;
  const list = BY_FIRST.get(k) ?? [];
  list.push(e);
  BY_FIRST.set(k, list);
  if (e.prefixOk) PREFIX_ENTRIES.push(e);
}
for (const list of BY_FIRST.values()) list.sort((a, b) => b.keys.length - a.keys.length);
PREFIX_ENTRIES.sort((a, b) => (b.keys[0] as string).length - (a.keys[0] as string).length);

function tagSig(t: Tag): string {
  return JSON.stringify(t);
}

/** Keys that map to more than one meaning (should be empty; tested). */
export function lexiconCollisions(): { key: string; tags: string[] }[] {
  const byKey = new Map<string, Set<string>>();
  for (const e of ENTRIES) {
    const k = e.keys.join(" ");
    const s = byKey.get(k) ?? new Set<string>();
    s.add(tagSig(e.tag));
    byKey.set(k, s);
  }
  return [...byKey.entries()]
    .filter(([, s]) => s.size > 1)
    .map(([key, s]) => ({ key, tags: [...s] }));
}

/** Count of lexicon phrases per category and language. */
export function lexiconCoverage(): Record<string, Record<Lang, number>> {
  const out: Record<string, Record<Lang, number>> = {};
  for (const e of ENTRIES) {
    const cat = e.tag.kind === "piece" ? `piece:${e.tag.piece}` : e.tag.kind === "dir" ? `dir:${e.tag.dir}` : e.tag.kind;
    const row = (out[cat] ??= { hi: 0, hiLatin: 0, pa: 0, paLatin: 0, ta: 0, taLatin: 0, en: 0 });
    row[e.lang] += 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Tagging

export interface TaggedToken {
  tag: Tag | { kind: "square"; square: string } | { kind: "unknown" };
  /** Normalized source text of the matched token(s). */
  text: string;
  start: number;
  end: number;
  /** Tamil case suffix left over after a prefix match. */
  suffix?: string;
}

const SQUARE_RE = /^[a-h][1-8]$/;

/** Tag a phrase. Squares ("e4") and digit counts are recognized directly. */
export function tagPhrase(text: string): TaggedToken[] {
  const toks = tokenize(text);
  const keys = toks.map(tokenKey);
  const out: TaggedToken[] = [];
  let i = 0;
  while (i < toks.length) {
    const tok = toks[i] as string;
    if (SQUARE_RE.test(tok)) {
      out.push({ tag: { kind: "square", square: tok }, text: tok, start: i, end: i + 1 });
      i += 1;
      continue;
    }
    const uci = /^([a-h][1-8])([a-h][1-8])$/.exec(tok);
    if (uci) {
      // "e2e4" reads as "e2 se e4".
      out.push({ tag: { kind: "square", square: uci[1] as string }, text: uci[1] as string, start: i, end: i + 1 });
      out.push({ tag: { kind: "instr" }, text: "", start: i, end: i + 1 });
      out.push({ tag: { kind: "square", square: uci[2] as string }, text: uci[2] as string, start: i, end: i + 1 });
      i += 1;
      continue;
    }
    if (/^[1-8]$/.test(tok)) {
      out.push({ tag: { kind: "num", n: Number(tok) }, text: tok, start: i, end: i + 1 });
      i += 1;
      continue;
    }
    let matched: { entry: Entry; len: number; suffix?: string } | null = null;
    for (const e of BY_FIRST.get(keys[i] as string) ?? []) {
      const len = e.keys.length;
      if (i + len > toks.length) continue;
      let ok = true;
      for (let j = 1; j < len; j++) if (keys[i + j] !== e.keys[j]) ok = false;
      if (ok) {
        matched = { entry: e, len };
        break;
      }
    }
    if (!matched && isTamil(tok)) {
      for (const e of PREFIX_ENTRIES) {
        const k = e.keys[0] as string;
        if (k.length >= 3 && tok.startsWith(k)) {
          matched = { entry: e, len: 1, suffix: tok.slice(k.length) };
          break;
        }
      }
    }
    if (matched) {
      const t: TaggedToken = {
        tag: matched.entry.tag,
        text: toks.slice(i, i + matched.len).join(" "),
        start: i,
        end: i + matched.len,
      };
      if (matched.suffix) t.suffix = matched.suffix;
      out.push(t);
      i += matched.len;
    } else {
      out.push({ tag: { kind: "unknown" }, text: tok, start: i, end: i + 1 });
      i += 1;
    }
  }
  return out;
}

/** Tamil object suffix (-ஐ: "குதிரையை"). */
export function isTamilObjectSuffix(s: string | undefined): boolean {
  return !!s && /(ை|ஐ)$/.test(s);
}

/** Tamil instrumental suffix (-ஆல்: "குதிரையால்"). */
export function isTamilInstrSuffix(s: string | undefined): boolean {
  return !!s && /(ால்|ஆல்)$/.test(s);
}

/** Resolve a free-form piece reference ("ghoda", "knight", "n", "घोड़ा") to a symbol. */
export function pieceFromWord(word: string): PieceSymbol | null {
  const w = word.trim();
  if (/^[kqrbnp]$/i.test(w)) return w.toLowerCase() as PieceSymbol;
  const tags = tagPhrase(w);
  const first = tags[0];
  if (tags.length === 1 && first && first.tag.kind === "piece") return first.tag.piece;
  return null;
}
