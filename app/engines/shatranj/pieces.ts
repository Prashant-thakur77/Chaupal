/**
 * Shatranj piece names: Hindi (Devanagari + Latin), English, and short disc
 * labels for the board renderer.
 *
 * Piece symbols follow chess.js: k q r b n p.
 */
import type { Color, PieceSymbol } from "chess.js";

export type { Color, PieceSymbol };

export interface PieceInfo {
  symbol: PieceSymbol;
  /** English name. */
  en: string;
  /** Hindi name in Devanagari (the one shown to the elder). */
  hi: string;
  /** Hindi name in Latin script. */
  hiLatin: string;
  /** Other Hindi names this piece goes by (Devanagari). */
  hiAliases: readonly string[];
  /** Full word for a board disc (Devanagari). */
  discLabel: string;
  /** Short disc label: one akshara (1-2 visible characters). */
  discShort: string;
  /** Short Latin disc label (1-2 characters). */
  discShortLatin: string;
  /** Plain-Hindi sentence on how the piece moves. */
  moveRuleHi: string;
  /** Same rule in English. */
  moveRuleEn: string;
  /** Material value used by the gentle opponent. */
  value: number;
}

export const PIECES: Readonly<Record<PieceSymbol, PieceInfo>> = {
  k: {
    symbol: "k",
    en: "king",
    hi: "राजा",
    hiLatin: "raja",
    hiAliases: ["बादशाह", "शाह"],
    discLabel: "राजा",
    discShort: "रा",
    discShortLatin: "Ra",
    moveRuleHi: "राजा हर तरफ़ सिर्फ़ एक घर चलता है।",
    moveRuleEn: "The king moves one square in any direction.",
    value: 100,
  },
  q: {
    symbol: "q",
    en: "queen",
    hi: "वज़ीर",
    hiLatin: "wazir",
    hiAliases: ["रानी", "वजीर"],
    discLabel: "वज़ीर",
    discShort: "व",
    discShortLatin: "Wa",
    moveRuleHi: "वज़ीर सीधा और तिरछा, दोनों तरह कितने भी घर चलता है।",
    moveRuleEn: "The queen moves any number of squares straight or diagonally.",
    value: 9,
  },
  r: {
    symbol: "r",
    en: "rook",
    hi: "हाथी",
    hiLatin: "haathi",
    hiAliases: ["किश्ती"],
    discLabel: "हाथी",
    discShort: "हा",
    discShortLatin: "Ha",
    moveRuleHi: "हाथी सिर्फ़ सीधा चलता है: आगे, पीछे, दाएँ या बाएँ। तिरछा नहीं चलता।",
    moveRuleEn: "The rook moves only straight: forward, back, left or right. Never diagonally.",
    value: 5,
  },
  b: {
    symbol: "b",
    en: "bishop",
    hi: "ऊँट",
    hiLatin: "oont",
    hiAliases: ["ऊंट"],
    discLabel: "ऊँट",
    discShort: "ऊँ",
    discShortLatin: "Oo",
    moveRuleHi: "ऊँट सिर्फ़ तिरछा चलता है। सीधा नहीं चलता।",
    moveRuleEn: "The bishop moves only diagonally. Never straight.",
    value: 3,
  },
  n: {
    symbol: "n",
    en: "knight",
    hi: "घोड़ा",
    hiLatin: "ghoda",
    hiAliases: ["घोडा"],
    discLabel: "घोड़ा",
    discShort: "घो",
    discShortLatin: "Gh",
    moveRuleHi: "घोड़ा ढाई घर चलता है (L के आकार में), और बीच के मोहरों के ऊपर से कूद सकता है।",
    moveRuleEn: "The knight moves in an L shape (two and a half squares) and can jump over pieces.",
    value: 3,
  },
  p: {
    symbol: "p",
    en: "pawn",
    hi: "प्यादा",
    hiLatin: "pyada",
    hiAliases: ["सिपाही", "प्यादे"],
    discLabel: "प्यादा",
    discShort: "प्या",
    discShortLatin: "Py",
    moveRuleHi:
      "प्यादा सिर्फ़ आगे चलता है: सीधा एक घर (पहली चाल में दो घर भी), और मारते समय तिरछा एक घर। पीछे नहीं जाता।",
    moveRuleEn:
      "The pawn moves only forward: one square straight (two on its first move), and captures one square diagonally. It never goes back.",
    value: 1,
  },
};

export const COLOR_HI: Readonly<Record<Color, string>> = { w: "सफ़ेद", b: "काला" };
export const COLOR_EN: Readonly<Record<Color, string>> = { w: "White", b: "Black" };
export const TURN_HI: Readonly<Record<Color, string>> = {
  w: "सफ़ेद की चाल",
  b: "काले की चाल",
};

export function pieceHi(type: PieceSymbol): string {
  return PIECES[type].hi;
}

export function pieceEn(type: PieceSymbol): string {
  return PIECES[type].en;
}

/** Disc label for the renderer, e.g. { full: "घोड़ा", short: "घो" }. */
export function discLabel(type: PieceSymbol): { full: string; short: string; shortLatin: string } {
  const p = PIECES[type];
  return { full: p.discLabel, short: p.discShort, shortLatin: p.discShortLatin };
}

export const PIECE_SYMBOLS: readonly PieceSymbol[] = ["k", "q", "r", "b", "n", "p"];

export function isPieceSymbol(v: unknown): v is PieceSymbol {
  return typeof v === "string" && (PIECE_SYMBOLS as readonly string[]).includes(v);
}
