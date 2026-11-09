/**
 * Ground spoken intent to exactly one legal chess.js move, or say why not.
 *
 * Perspective convention (used everywhere in this file):
 *   Directions and left/right are taken from the seat of the side to move,
 *   looking across the board at the opponent.
 *   - White sits at rank 1. Forward = towards rank 8. Left = towards the
 *     a-file, right = towards the h-file.
 *   - Black sits at rank 8, facing White. Forward = towards rank 1.
 *     Black's LEFT hand points to the h-file and RIGHT to the a-file.
 *     So Black's "left knight" at the start is g8, "left rook" is h8, and
 *     Black's left knight going "forward towards the centre" is g8-f6.
 *
 * The resolver never invents or substitutes a move. "illegal" carries a
 * reason and, as information only, the selected piece's legal moves.
 */
import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";

import {
  type Direction,
  isTamilInstrSuffix,
  isTamilObjectSuffix,
  pieceFromWord,
  type TaggedToken,
  tagPhrase,
} from "./lexicon";
import { PIECES, isPieceSymbol, pieceEn, pieceHi } from "./pieces";
import { type LegalMove, describeMove, legalMovesOf, loadGame } from "./state";

export type { Direction };

export type Which =
  | "left"
  | "right"
  | "kingside"
  | "queenside"
  | "center"
  | "in-front-of-king"
  | "in-front-of-queen"
  | Square;

/** A piece symbol ("n") or any lexicon word for it ("ghoda", "knight", "குதிரை"). */
export type PieceRef = PieceSymbol | string;

export interface MoveIntent {
  piece?: PieceRef;
  which?: Which;
  from?: Square;
  to?: Square;
  /** One direction, or several that must all hold ("forward" + "towards-center"). */
  direction?: Direction | Direction[];
  /** Squares moved, counted as the larger of file and rank steps. */
  distance?: number;
  /** Capture this kind of piece ("any" = any capture). */
  capture?: PieceRef | "any";
  castle?: "kingside" | "queenside" | "any";
  promotion?: PieceRef;
  /** Standard algebraic notation, e.g. "Nf3", "exd5", "O-O". */
  san?: string;
}

/** Carry-over from a previous turn of the conversation. */
export interface ResolveContext {
  /** Piece the elder was talking about ("haathi" in the previous phrase). */
  piece?: PieceSymbol;
  /** Squares of the pieces being discussed (e.g. the previewed knight). */
  squares?: Square[];
  /** Target squares that were shown in a preview. */
  targets?: Square[];
}

export type IllegalCode =
  | "GAME_OVER"
  | "NO_SUCH_PIECE"
  | "NO_PIECE_ON_SQUARE"
  | "NOT_YOUR_PIECE"
  | "WRONG_PIECE_ON_SQUARE"
  | "WRONG_GEOMETRY"
  | "BLOCKED"
  | "IN_CHECK"
  | "NOT_REACHABLE"
  | "NO_CAPTURE"
  | "CASTLE_UNAVAILABLE"
  | "ILLEGAL_SAN";

export type ResolveResult =
  | { status: "resolved"; move: LegalMove }
  | { status: "ambiguous"; candidates: LegalMove[]; questionHi: string; questionEn: string }
  | {
      status: "illegal";
      code: IllegalCode;
      reasonHi: string;
      reasonEn: string;
      /** Information only: legal moves of the piece(s) in question. Never auto-played. */
      closestLegal: LegalMove[];
    }
  | { status: "no-match"; reasonHi: string; reasonEn: string };

// ---------------------------------------------------------------------------
// Geometry helpers (player frame)

const FILES = "abcdefgh";

export function fileOf(sq: Square): number {
  return FILES.indexOf(sq.charAt(0));
}
export function rankOf(sq: Square): number {
  return Number(sq.charAt(1)) - 1;
}

function fwdSign(c: Color): number {
  return c === "w" ? 1 : -1;
}
/** White's right is +file; Black's right is -file. */
function rightSign(c: Color): number {
  return c === "w" ? 1 : -1;
}
/** 0 = the player's leftmost file. */
function playerFile(sq: Square, c: Color): number {
  return c === "w" ? fileOf(sq) : 7 - fileOf(sq);
}

function relVec(from: Square, to: Square, c: Color): { dF: number; dR: number } {
  return {
    dF: (fileOf(to) - fileOf(from)) * rightSign(c),
    dR: (rankOf(to) - rankOf(from)) * fwdSign(c),
  };
}

function vecMatches(dir: Direction, dF: number, dR: number): boolean {
  const diag = dF !== 0 && Math.abs(dF) === Math.abs(dR);
  switch (dir) {
    case "forward":
      return dR > 0;
    case "back":
      return dR < 0;
    case "left":
      return dF < 0;
    case "right":
      return dF > 0;
    case "diagonal":
      return diag;
    case "diagonal-left":
      return diag && dF < 0;
    case "diagonal-right":
      return diag && dF > 0;
    case "straight":
      return (dF === 0) !== (dR === 0);
    case "towards-center":
      return true; // position dependent, handled separately
  }
}

function centerDist2(sq: Square): number {
  const f = fileOf(sq) - 3.5;
  const r = rankOf(sq) - 3.5;
  return f * f + r * r;
}

function towardsCenter(from: Square, to: Square): boolean {
  const ff = Math.abs(fileOf(from) - 3.5);
  const tf = Math.abs(fileOf(to) - 3.5);
  const fr = Math.abs(rankOf(from) - 3.5);
  const tr = Math.abs(rankOf(to) - 3.5);
  return tf <= ff && tr <= fr && centerDist2(to) < centerDist2(from);
}

/** Every displacement a piece type can ever make, in the player frame. */
function pieceVectors(type: PieceSymbol): { dF: number; dR: number }[] {
  const v: { dF: number; dR: number }[] = [];
  const line = (dirs: [number, number][]) => {
    for (const [a, b] of dirs) for (let k = 1; k <= 7; k++) v.push({ dF: a * k, dR: b * k });
  };
  const ortho: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const diag: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  switch (type) {
    case "p":
      return [{ dF: 0, dR: 1 }, { dF: 0, dR: 2 }, { dF: -1, dR: 1 }, { dF: 1, dR: 1 }];
    case "n":
      for (const [a, b] of [[1, 2], [2, 1]] as const)
        for (const sa of [1, -1]) for (const sb of [1, -1]) v.push({ dF: a * sa, dR: b * sb });
      return v;
    case "b":
      line(diag);
      return v;
    case "r":
      line(ortho);
      return v;
    case "q":
      line(ortho);
      line(diag);
      return v;
    case "k":
      for (const [a, b] of [...ortho, ...diag]) v.push({ dF: a, dR: b });
      v.push({ dF: 2, dR: 0 }, { dF: -2, dR: 0 });
      return v;
  }
}

function chebyshev(dF: number, dR: number): number {
  return Math.max(Math.abs(dF), Math.abs(dR));
}

function geometricallyPossible(type: PieceSymbol, dirs: Direction[], distance: number | undefined): boolean {
  return pieceVectors(type).some(
    ({ dF, dR }) =>
      dirs.every((d) => vecMatches(d, dF, dR)) && (distance === undefined || chebyshev(dF, dR) === distance),
  );
}

// ---------------------------------------------------------------------------
// Hindi text helpers

const NUM_HI = ["शून्य", "एक", "दो", "तीन", "चार", "पाँच", "छह", "सात", "आठ"];
const DIR_HI: Record<Direction, string> = {
  forward: "आगे",
  back: "पीछे",
  left: "बाएँ",
  right: "दाएँ",
  diagonal: "तिरछा",
  "diagonal-left": "बाएँ तिरछा",
  "diagonal-right": "दाएँ तिरछा",
  straight: "सीधा",
  "towards-center": "बीच की तरफ़",
};
const DIR_EN: Record<Direction, string> = {
  forward: "forward",
  back: "back",
  left: "left",
  right: "right",
  diagonal: "diagonally",
  "diagonal-left": "diagonally left",
  "diagonal-right": "diagonally right",
  straight: "straight",
  "towards-center": "towards the centre",
};
const DIR_ORDER: Direction[] = [
  "straight",
  "diagonal",
  "diagonal-left",
  "diagonal-right",
  "left",
  "right",
  "forward",
  "back",
  "towards-center",
];

function dirPhrase(dirs: Direction[], distance: number | undefined): { hi: string; en: string } {
  const sorted = DIR_ORDER.filter((d) => dirs.includes(d));
  const hi = sorted.map((d) => DIR_HI[d]);
  const en = sorted.map((d) => DIR_EN[d]);
  if (distance !== undefined) {
    hi.push(`${NUM_HI[distance] ?? distance} घर`);
    en.push(`${distance} square${distance === 1 ? "" : "s"}`);
  }
  return { hi: hi.join(" "), en: en.join(" ") };
}

function joinHi(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} या ${items[items.length - 1]}`;
}
function joinEn(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;
}
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const WHICH_HI: Record<string, string> = {
  left: "बाएँ वाला",
  right: "दाएँ वाला",
  kingside: "राजा की तरफ़ वाला",
  queenside: "वज़ीर की तरफ़ वाला",
  center: "बीच वाला",
  "in-front-of-king": "राजा के सामने वाला",
  "in-front-of-queen": "वज़ीर के सामने वाला",
};
const WHICH_EN: Record<string, string> = {
  left: "left",
  right: "right",
  kingside: "kingside",
  queenside: "queenside",
  center: "centre",
  "in-front-of-king": "in front of the king",
  "in-front-of-queen": "in front of the queen",
};

// ---------------------------------------------------------------------------
// Core resolver

function toPiece(ref: PieceRef | undefined): PieceSymbol | undefined {
  if (ref === undefined) return undefined;
  if (isPieceSymbol(ref)) return ref;
  return pieceFromWord(ref) ?? undefined;
}

function isSquare(s: unknown): s is Square {
  return typeof s === "string" && /^[a-h][1-8]$/.test(s);
}

function directionsOf(intent: MoveIntent): Direction[] {
  const d = intent.direction;
  if (d === undefined) return [];
  return [...new Set(Array.isArray(d) ? d : [d])];
}

function illegal(code: IllegalCode, reasonHi: string, reasonEn: string, closestLegal: LegalMove[] = []): ResolveResult {
  return { status: "illegal", code, reasonHi, reasonEn, closestLegal: closestLegal.slice(0, 12) };
}

function ownPieces(chess: Chess, color: Color, type?: PieceSymbol): Square[] {
  const out: Square[] = [];
  for (const row of chess.board())
    for (const cell of row) if (cell && cell.color === color && (!type || cell.type === type)) out.push(cell.square);
  return out;
}

/** Apply a "which" selector to the side-to-move's pieces. */
function selectWhich(chess: Chess, squares: Square[], which: Exclude<Which, Square>, color: Color): Square[] {
  if (squares.length === 0) return [];
  switch (which) {
    case "left":
    case "right": {
      const pf = squares.map((s) => playerFile(s, color));
      const target = which === "left" ? Math.min(...pf) : Math.max(...pf);
      return squares.filter((s) => playerFile(s, color) === target);
    }
    case "kingside":
      return squares.filter((s) => fileOf(s) >= 4);
    case "queenside":
      return squares.filter((s) => fileOf(s) <= 3);
    case "center": {
      const mid = squares.filter((s) => fileOf(s) === 3 || fileOf(s) === 4);
      return mid.length ? mid : squares.filter((s) => fileOf(s) >= 2 && fileOf(s) <= 5);
    }
    case "in-front-of-king":
    case "in-front-of-queen": {
      const anchorType: PieceSymbol = which === "in-front-of-king" ? "k" : "q";
      const anchor = ownPieces(chess, color, anchorType)[0];
      if (!anchor) return [];
      const ahead = squares
        .filter((s) => s !== anchor && fileOf(s) === fileOf(anchor) && (rankOf(s) - rankOf(anchor)) * fwdSign(color) > 0)
        .sort((a, b) => Math.abs(rankOf(a) - rankOf(anchor)) - Math.abs(rankOf(b) - rankOf(anchor)));
      return ahead.slice(0, 1);
    }
  }
}

function sameSet<T>(xs: T[]): boolean {
  return xs.every((x) => x === xs[0]);
}

function buildQuestion(chess: Chess, cands: LegalMove[]): { hi: string; en: string } {
  const color = chess.turn();
  const froms = [...new Set(cands.map((m) => m.from))];
  const tos = [...new Set(cands.map((m) => m.to))];
  const allCastle = cands.every((m) => m.flags.includes("k") || m.flags.includes("q"));
  if (allCastle && cands.length === 2) {
    return {
      hi: "किस तरफ़ किलाबंदी करें — राजा की तरफ़ (छोटी) या वज़ीर की तरफ़ (बड़ी)?",
      en: "Which side should we castle — kingside (short) or queenside (long)?",
    };
  }
  if (froms.length === 1 && tos.length === 1 && cands.every((m) => m.promotion)) {
    const opts = cands.map((m) => m.promotion as PieceSymbol);
    return {
      hi: `प्यादा किस मोहरे में बदले — ${joinHi(opts.map(pieceHi))}?`,
      en: `What should the pawn become — ${joinEn(opts.map(pieceEn))}?`,
    };
  }
  const types = [...new Set(cands.map((m) => m.piece))];
  if (froms.length === 1 && types.length === 1) {
    const p = types[0] as PieceSymbol;
    const shown = tos.slice(0, 8);
    return {
      hi: `${pieceHi(p)} (${froms[0]}) कहाँ जाए — ${joinHi(shown)}?`,
      en: `Where should the ${pieceEn(p)} on ${froms[0]} go — ${joinEn(shown)}?`,
    };
  }
  if (types.length === 1 && froms.length === 2) {
    const p = types[0] as PieceSymbol;
    const [a, b] = [...froms].sort((x, y) => playerFile(x, color) - playerFile(y, color)) as [Square, Square];
    const sideKnown = playerFile(a, color) !== playerFile(b, color);
    const destsA = [...new Set(cands.filter((m) => m.from === a).map((m) => m.to))];
    const destsB = [...new Set(cands.filter((m) => m.from === b).map((m) => m.to))];
    const tail = (d: string[]) => (d.length === 1 ? ` → ${d[0]}` : "");
    if (sideKnown) {
      return {
        hi: `कौन सा ${pieceHi(p)} — बाएँ वाला (${a}${tail(destsA)}) या दाएँ वाला (${b}${tail(destsB)})?`,
        en: `Which ${pieceEn(p)} — the left one (${a}${tail(destsA)}) or the right one (${b}${tail(destsB)})?`,
      };
    }
    return {
      hi: `कौन सा ${pieceHi(p)} — ${a} वाला या ${b} वाला?`,
      en: `Which ${pieceEn(p)} — the one on ${a} or on ${b}?`,
    };
  }
  if (types.length === 1 && froms.length > 2) {
    const p = types[0] as PieceSymbol;
    return {
      hi: `कौन सा ${pieceHi(p)} — ${joinHi(froms.map((f) => `${f} वाला`))}?`,
      en: `Which ${pieceEn(p)} — ${joinEn(froms.map((f) => `the one on ${f}`))}?`,
    };
  }
  const shown = cands.slice(0, 6);
  const more = cands.length > shown.length ? ` (कुल ${cands.length} चालें)` : "";
  const moreEn = cands.length > shown.length ? ` (${cands.length} moves in all)` : "";
  return {
    hi: `कौन सी चाल — ${joinHi(shown.map((m) => m.descriptionHi))}?${more}`,
    en: `Which move — ${joinEn(shown.map((m) => m.descriptionEn))}?${moreEn}`,
  };
}

function finish(chess: Chess, cands: LegalMove[]): ResolveResult {
  if (cands.length === 1) return { status: "resolved", move: cands[0] as LegalMove };
  const q = buildQuestion(chess, cands);
  return { status: "ambiguous", candidates: cands, questionHi: q.hi, questionEn: q.en };
}

interface CoreExtras {
  /** Restrict the moving pieces to these squares (from context). */
  fromSquares?: Square[];
  /** Restrict destinations to these squares (from a preview). */
  targets?: Square[];
}

/** Which own pieces the intent is about. Returns squares or an illegal result. */
export function selectPieces(
  chess: Chess,
  intent: MoveIntent,
  extras: CoreExtras = {},
): { squares: Square[]; type?: PieceSymbol } | ResolveResult {
  const color = chess.turn();
  let type = toPiece(intent.piece);
  if (intent.piece !== undefined && !type) {
    return { status: "no-match", reasonHi: `"${intent.piece}" कौन सा मोहरा है, समझ नहीं आया।`, reasonEn: `Unknown piece "${intent.piece}".` };
  }
  const fromSq = intent.from ?? (isSquare(intent.which) ? intent.which : undefined);
  if (fromSq) {
    const cell = chess.get(fromSq);
    if (!cell) {
      return illegal("NO_PIECE_ON_SQUARE", `${fromSq} पर कोई मोहरा नहीं है।`, `There is no piece on ${fromSq}.`);
    }
    if (cell.color !== color) {
      return illegal(
        "NOT_YOUR_PIECE",
        `${fromSq} पर सामने वाले का ${pieceHi(cell.type)} है, आपका नहीं।`,
        `The ${pieceEn(cell.type)} on ${fromSq} belongs to the opponent.`,
      );
    }
    if (type && cell.type !== type) {
      return illegal(
        "WRONG_PIECE_ON_SQUARE",
        `${fromSq} पर ${pieceHi(type)} नहीं, ${pieceHi(cell.type)} है।`,
        `The piece on ${fromSq} is a ${pieceEn(cell.type)}, not a ${pieceEn(type)}.`,
      );
    }
    return { squares: [fromSq], type: cell.type };
  }
  if (intent.castle) type = "k";
  let squares = ownPieces(chess, color, type);
  if (type && squares.length === 0) {
    return illegal("NO_SUCH_PIECE", `आपके पास अब कोई ${pieceHi(type)} नहीं बचा।`, `You have no ${pieceEn(type)} left.`);
  }
  if (extras.fromSquares && extras.fromSquares.length) {
    const ctx = squares.filter((s) => extras.fromSquares?.includes(s));
    if (ctx.length) squares = ctx;
  }
  if (intent.which && !isSquare(intent.which)) {
    const sel = selectWhich(chess, squares, intent.which, color);
    if (sel.length === 0) {
      const name = type ? pieceHi(type) : "मोहरा";
      return illegal(
        "NO_SUCH_PIECE",
        `${WHICH_HI[intent.which]} ${name} नहीं मिला।`,
        `No ${type ? pieceEn(type) : "piece"} ${WHICH_EN[intent.which]} was found.`,
      );
    }
    squares = sel;
  }
  return type ? { squares, type } : { squares };
}

function isCastle(m: LegalMove): boolean {
  return m.flags.includes("k") || m.flags.includes("q");
}

function resolveCore(chess: Chess, intent: MoveIntent, extras: CoreExtras = {}): ResolveResult {
  const color = chess.turn();
  if (chess.isGameOver()) {
    return illegal("GAME_OVER", "खेल ख़त्म हो चुका है, अब कोई चाल नहीं चल सकती।", "The game is over; no more moves.");
  }
  const all = legalMovesOf(chess);

  if (intent.san) {
    const probe = new Chess(chess.fen());
    try {
      const m = probe.move(intent.san);
      return { status: "resolved", move: describeMove(m) };
    } catch {
      return illegal("ILLEGAL_SAN", `"${intent.san}" चाल अभी नियम से नहीं हो सकती।`, `"${intent.san}" is not a legal move here.`);
    }
  }

  if (intent.castle) {
    const castles = all.filter(
      (m) =>
        isCastle(m) &&
        (intent.castle === "any" ||
          (intent.castle === "kingside" && m.flags.includes("k")) ||
          (intent.castle === "queenside" && m.flags.includes("q"))),
    );
    if (castles.length) return finish(chess, castles);
    const rights = chess.getCastlingRights(color);
    const wantK = intent.castle !== "queenside";
    const wantQ = intent.castle !== "kingside";
    const noRights = (!wantK || !rights.k) && (!wantQ || !rights.q);
    const kingMoves = all.filter((m) => m.piece === "k");
    if (noRights) {
      return illegal(
        "CASTLE_UNAVAILABLE",
        "अब किलाबंदी नहीं हो सकती — राजा या उस तरफ़ का हाथी पहले चल चुका है।",
        "Castling is no longer possible: the king or that rook has already moved.",
        kingMoves,
      );
    }
    if (chess.inCheck()) {
      return illegal("CASTLE_UNAVAILABLE", "राजा पर शह है — शह में किलाबंदी नहीं होती।", "You cannot castle while in check.", kingMoves);
    }
    return illegal(
      "CASTLE_UNAVAILABLE",
      "अभी किलाबंदी नहीं हो सकती — राजा और हाथी के बीच के घर ख़ाली नहीं हैं, या राजा रास्ते में शह से गुज़रेगा।",
      "Castling is not possible yet: the squares between king and rook are not empty, or the king would pass through check.",
      kingMoves,
    );
  }

  const sel = selectPieces(chess, intent, extras);
  if ("status" in sel) return sel;
  const { squares, type } = sel;
  const dirs = directionsOf(intent);
  const distance = intent.distance;
  const name = type ? pieceHi(type) : "मोहरा";
  const nameEn = type ? pieceEn(type) : "piece";

  // Position-independent geometry first: "haathi tircha" is wrong whatever the board.
  if (type && (dirs.length || distance !== undefined)) {
    const geoDirs = dirs.filter((d) => d !== "towards-center");
    if (!geometricallyPossible(type, geoDirs, distance)) {
      const dp = dirPhrase(geoDirs, distance);
      return illegal(
        "WRONG_GEOMETRY",
        `${name} ${dp.hi} नहीं चल सकता। ${PIECES[type].moveRuleHi}`,
        `A ${nameEn} cannot move ${dp.en}. ${PIECES[type].moveRuleEn}`,
        all.filter((m) => squares.includes(m.from)),
      );
    }
  }

  const pieceMoves = all.filter((m) => squares.includes(m.from) && (!type || m.piece === type));
  if (pieceMoves.length === 0) {
    if (chess.inCheck()) {
      return illegal(
        "IN_CHECK",
        `राजा पर शह है — अभी ${name} नहीं चल सकता, पहले राजा को बचाना होगा।`,
        `Your king is in check; the ${nameEn} cannot move until the king is safe.`,
      );
    }
    return illegal(
      "BLOCKED",
      `${name} अभी चल नहीं सकता — उसका रास्ता बंद है।`,
      `The ${nameEn} cannot move right now; its way is blocked.`,
    );
  }

  let cands = pieceMoves;
  if (intent.to) {
    const to = intent.to;
    cands = cands.filter((m) => m.to === to);
    if (!cands.length) {
      const occ = chess.get(to);
      const own = occ && occ.color === color;
      return illegal(
        "NOT_REACHABLE",
        own
          ? `${name} ${to} पर नहीं जा सकता — वहाँ आपका अपना ${pieceHi(occ.type)} है।`
          : `${name} अभी ${to} पर नहीं जा सकता।`,
        own ? `The ${nameEn} cannot go to ${to}: your own ${pieceEn(occ.type)} is there.` : `The ${nameEn} cannot go to ${to} now.`,
        pieceMoves,
      );
    }
  }

  if (extras.targets && extras.targets.length) {
    const t = cands.filter((m) => extras.targets?.includes(m.to));
    if (t.length) cands = t;
  }

  if (intent.capture !== undefined) {
    const capType = intent.capture === "any" ? undefined : toPiece(intent.capture);
    cands = cands.filter((m) => m.captured && (!capType || m.captured === capType));
    if (!cands.length) {
      const enemy: Color = color === "w" ? "b" : "w";
      if (capType && ownPieces(chess, enemy, capType).length === 0) {
        return illegal(
          "NO_CAPTURE",
          `सामने वाले के पास कोई ${pieceHi(capType)} बचा ही नहीं।`,
          `The opponent has no ${pieceEn(capType)} left.`,
          pieceMoves,
        );
      }
      const victim = capType ? pieceHi(capType) : "कोई मोहरा";
      const victimEn = capType ? pieceEn(capType) : "anything";
      return illegal(
        "NO_CAPTURE",
        type ? `${name} से अभी ${victim} नहीं मारा जा सकता।` : `अभी कोई भी मोहरा ${victim} नहीं मार सकता।`,
        type ? `The ${nameEn} cannot capture ${victimEn} right now.` : `Nothing can capture ${victimEn} right now.`,
        pieceMoves,
      );
    }
  }

  if (intent.promotion !== undefined) {
    const promo = toPiece(intent.promotion);
    const p = cands.filter((m) => m.promotion && m.promotion === promo);
    if (p.length) cands = p;
  }

  if (dirs.length || distance !== undefined) {
    const before = cands;
    cands = cands.filter((m) => {
      const { dF, dR } = relVec(m.from, m.to, color);
      if (!dirs.every((d) => vecMatches(d, dF, dR))) return false;
      if (dirs.includes("towards-center") && !towardsCenter(m.from, m.to)) return false;
      if (distance !== undefined && chebyshev(dF, dR) !== distance) return false;
      return true;
    });
    if (!cands.length) {
      const dp = dirPhrase(dirs, distance);
      return illegal(
        "NOT_REACHABLE",
        `${name} अभी ${dp.hi} नहीं जा सकता — रास्ता बंद है या वह घर ख़ाली नहीं है।`,
        `The ${nameEn} cannot go ${dp.en} right now: the way is blocked or the square is taken.`,
        before,
      );
    }
    if (dirs.includes("towards-center") && cands.length > 1) {
      const best = Math.min(...cands.map((m) => centerDist2(m.to)));
      cands = cands.filter((m) => centerDist2(m.to) === best);
    }
  }

  return finish(chess, cands);
}

/**
 * Resolve a structured intent against a position (FEN or PGN).
 * Pure: never mutates anything, never plays a move.
 */
export function resolveIntent(position: string, intent: MoveIntent, context?: ResolveContext): ResolveResult {
  const chess = loadGame(position);
  const extras: CoreExtras = {};
  const noOwnSubject = !intent.piece && !intent.from && !isSquare(intent.which) && !intent.castle && !intent.san;
  const merged: MoveIntent = { ...intent };
  if (context && noOwnSubject) {
    if (context.piece) merged.piece = context.piece;
    if (context.squares?.length) extras.fromSquares = context.squares;
    if (context.targets?.length && !intent.to) extras.targets = context.targets;
  }
  const grounded =
    merged.piece || merged.from || merged.to || merged.which || merged.castle || merged.san || merged.capture || extras.fromSquares;
  if (!grounded) {
    return {
      status: "no-match",
      reasonHi: "कौन सा मोहरा चलाना है, यह समझ नहीं आया।",
      reasonEn: "Could not tell which piece to move.",
    };
  }
  return resolveCore(chess, merged, extras);
}

// ---------------------------------------------------------------------------
// Phrase parser

export interface PreviewResult {
  status: "preview";
  pieces: { square: Square; type: PieceSymbol; labelHi: string }[];
  /** Squares of the previewed pieces. */
  squares: Square[];
  /** Every square those pieces can legally reach. */
  targets: Square[];
  moves: LegalMove[];
  messageHi: string;
  messageEn: string;
}

export type PhraseResult = (ResolveResult | PreviewResult) & {
  /** The structured intent the phrase was mapped to (absent for no-match). */
  intent?: MoveIntent;
  /** Pass this back as `context` with the elder's next phrase. */
  context: ResolveContext;
};

type T = TaggedToken;
const kind = (t: T | undefined) => t?.tag.kind;

const SAN_STRICT = /^(?:[KQRBN][a-h]?[1-8]?x?[a-h][1-8](?:=?[QRBN])?|[a-h]x[a-h][1-8](?:=?[QRBN])?|[a-h][18]=?[QRBN]|O-O(?:-O)?|0-0(?:-0)?)[+#!?]*$/;
const SAN_LOWER_PIECE = /^[nbrqk]x?[a-h][1-8][+#]?$/;

function findSan(chess: Chess, text: string): { san: string } | { castle: "kingside" | "queenside" } | { badSan: string } | null {
  const rawToks = text.normalize("NFC").split(/[\s,;।]+/).filter(Boolean);
  for (const tok of rawToks) {
    const t = tok.replace(/[.!?]+$/, "");
    if (/^(?:O-O-O|0-0-0|o-o-o)[+#]?$/.test(t)) return { castle: "queenside" };
    if (/^(?:O-O|0-0|o-o)[+#]?$/.test(t)) return { castle: "kingside" };
    const tries: string[] = [];
    if (SAN_STRICT.test(t)) tries.push(t);
    else if (SAN_LOWER_PIECE.test(t)) tries.push(t, t.charAt(0).toUpperCase() + t.slice(1));
    if (!tries.length) continue;
    for (const s of tries) {
      try {
        const m = new Chess(chess.fen()).move(s);
        return { san: m.san };
      } catch {
        /* try next */
      }
    }
    if (/^[KQRBN]/.test(t) || /^[a-h]x/.test(t)) return { badSan: t };
  }
  return null;
}

interface Parsed {
  intent: MoveIntent;
  preview: boolean;
  protectKingOnly: boolean;
  understood: boolean;
}

function parseTags(tags: T[]): Parsed {
  const consumed = new Set<number>();
  const intent: MoveIntent = {};
  let which: Which | undefined;
  let sideRef: "kingside" | "queenside" | undefined;
  const at = (i: number) => tags[i];
  const isPiece = (i: number, ...types: PieceSymbol[]) => {
    const t = at(i)?.tag;
    return t?.kind === "piece" && (types.length === 0 || types.includes(t.piece));
  };

  // 0. "ghoda nahi, oont" / "aage nahi, peeche": a word followed by a negation is dropped.
  for (let i = 1; i < tags.length; i++) {
    if (kind(at(i)) === "neg") {
      consumed.add(i);
      const pk = kind(at(i - 1));
      if (pk === "piece" || pk === "dir" || pk === "square" || pk === "center" || pk === "capture") consumed.add(i - 1);
    }
  }

  // 1. Squares and their roles.
  const sqIdx = tags.map((t, i) => (t.tag.kind === "square" && !consumed.has(i) ? i : -1)).filter((i) => i >= 0);
  const fromSq: Square[] = [];
  const toSq: Square[] = [];
  const unassigned: Square[] = [];
  for (const i of sqIdx) {
    const sq = (at(i)?.tag as { square: Square }).square;
    const next = kind(at(i + 1));
    const prevText = at(i - 1)?.text;
    if (next === "instr") {
      fromSq.push(sq);
      consumed.add(i + 1);
    } else if (next === "wala" || next === "postp") {
      which = sq;
      consumed.add(i + 1);
    } else if (prevText === "from") {
      fromSq.push(sq);
    } else if (next === "toMarker" || kind(at(i - 1)) === "toMarker") {
      toSq.push(sq);
    } else {
      unassigned.push(sq);
    }
    consumed.add(i);
  }
  if (unassigned.length >= 2 && !fromSq.length && !toSq.length) {
    fromSq.push(unassigned[0] as Square);
    toSq.push(unassigned[1] as Square);
  } else if (unassigned.length === 1) {
    if (toSq.length && !fromSq.length) fromSq.push(unassigned[0] as Square);
    else toSq.push(unassigned[0] as Square);
  }
  if (fromSq[0]) intent.from = fromSq[0];
  if (toSq[0]) intent.to = toSq[0];

  // 2. "raja ke saamne (waala)" / "wazir ke aage waala" / "in front of the king".
  for (let i = 0; i < tags.length; i++) {
    if (consumed.has(i) || !isPiece(i, "k", "q")) continue;
    let j = i + 1;
    if (kind(at(j)) === "postp") j++;
    const t = at(j)?.tag;
    if (t && (t.kind === "front" || (t.kind === "dir" && t.dir === "forward" && kind(at(j + 1)) === "wala"))) {
      which = (at(i)?.tag as { piece: PieceSymbol }).piece === "k" ? "in-front-of-king" : "in-front-of-queen";
      for (let x = i; x <= j; x++) consumed.add(x);
      if (kind(at(j + 1)) === "wala") consumed.add(j + 1);
    } else if (t && t.kind === "taraf") {
      sideRef = (at(i)?.tag as { piece: PieceSymbol }).piece === "k" ? "kingside" : "queenside";
      for (let x = i; x <= j; x++) consumed.add(x);
      if (kind(at(j + 1)) === "wala") consumed.add(j + 1);
    } else if (j === i + 2 && t && t.kind === "piece" && !consumed.has(j)) {
      // "raja ka ghoda" = the king's knight (kingside); "wazir ka haathi" = queenside.
      sideRef = (at(i)?.tag as { piece: PieceSymbol }).piece === "k" ? "kingside" : "queenside";
      consumed.add(i);
      consumed.add(i + 1);
    }
  }
  for (let i = 0; i < tags.length; i++) {
    if (consumed.has(i) || kind(at(i)) !== "front") continue;
    let j = i + 1;
    if (kind(at(j)) === "postp") j++;
    if (isPiece(j, "k", "q")) {
      which = (at(j)?.tag as { piece: PieceSymbol }).piece === "k" ? "in-front-of-king" : "in-front-of-queen";
      for (let x = i; x <= j; x++) consumed.add(x);
    }
  }

  // 3. "baayein waala ghoda", "ghoda baayein waala", "beech waala pyada".
  for (let i = 0; i < tags.length; i++) {
    if (consumed.has(i)) continue;
    const t = at(i)?.tag;
    const lr = t?.kind === "dir" && (t.dir === "left" || t.dir === "right") ? t.dir : undefined;
    const ctr = t?.kind === "center";
    if (!lr && !ctr) continue;
    // "baayein (waala)", "daayein taraf waala", "beech ka" ... then the piece.
    let j = i + 1;
    while (j < i + 4 && ["wala", "postp", "taraf"].includes(kind(at(j)) ?? "")) j++;
    if (isPiece(j) && !consumed.has(j)) {
      which = lr ?? "center";
      for (let x = i; x < j; x++) consumed.add(x);
      continue;
    }
    const noPieceNamed = !tags.some((x, k) => x.tag.kind === "piece" && !consumed.has(k));
    if ((lr || ctr) && kind(at(i + 1)) === "wala" && (isPiece(i - 1) || (lr && noPieceNamed))) {
      // "ghoda baayein waala", or a bare "baayein waala" answering "which knight?".
      // A bare "beech waala ghar" stays a direction (towards the centre).
      if (lr || isPiece(i - 1)) {
        which = lr ?? "center";
        consumed.add(i);
        consumed.add(i + 1);
      }
    }
  }
  if (sideRef && !tags.some((t) => t.tag.kind === "castle")) which ??= sideRef;

  // 4. Piece mentions.
  interface Mention {
    piece: PieceSymbol;
    i: number;
    opp: boolean;
    own: boolean;
    instr: boolean;
    obj: boolean;
  }
  const mentions: Mention[] = [];
  for (let i = 0; i < tags.length; i++) {
    const tk = at(i) as T;
    if (consumed.has(i) || tk.tag.kind !== "piece") continue;
    const prev = kind(at(i - 1));
    const prev2 = kind(at(i - 2));
    const next = kind(at(i + 1));
    mentions.push({
      piece: tk.tag.piece,
      i,
      opp: prev === "opponent" || (prev === "postp" && prev2 === "opponent"),
      own: prev === "own",
      instr: next === "instr" || isTamilInstrSuffix(tk.suffix) || at(i - 1)?.text === "with",
      obj: next === "object" || isTamilObjectSuffix(tk.suffix),
    });
  }
  const hasCapture = tags.some((t, i) => t.tag.kind === "capture" && !consumed.has(i));
  if (hasCapture) {
    let mover = mentions.find((m) => m.instr) ?? mentions.find((m) => m.own);
    let victim = mentions.find((m) => m.opp && m !== mover) ?? mentions.find((m) => m.obj && m !== mover && !m.instr);
    const rest = mentions.filter((m) => m !== mover && m !== victim);
    if (!mover && victim) mover = rest[0];
    else if (mover && !victim) victim = rest[0];
    else if (!mover && !victim) {
      if (rest.length >= 2) {
        mover = rest[0];
        victim = rest[1];
      } else victim = rest[0];
    }
    if (intent.to && mentions.length === 1 && !mentions[0]?.opp && !mentions[0]?.obj) {
      // "oont f7 pe maar do": the named piece does the capturing on f7.
      mover = mentions[0];
      victim = undefined;
    }
    if (mover) intent.piece = mover.piece;
    intent.capture = victim ? victim.piece : "any";
  } else {
    const mover = mentions.find((m) => !m.opp);
    if (mover) intent.piece = mover.piece;
  }

  // 5. Castling ("raja ko bachao" counts only next to castling / kila).
  const hasCastle = tags.some((t) => t.tag.kind === "castle");
  const protectKing = tags.some((t) => t.tag.kind === "protectKing");
  if (hasCastle) {
    const sideTag = tags.find((t) => t.tag.kind === "castleSide")?.tag as { side: "kingside" | "queenside" } | undefined;
    intent.castle = sideTag?.side ?? sideRef ?? "any";
    delete intent.piece;
  }

  // 6. Directions and distance.
  const dirs: Direction[] = [];
  for (let i = 0; i < tags.length; i++) {
    if (consumed.has(i)) continue;
    const t = at(i)?.tag;
    if (t?.kind === "dir") dirs.push(t.dir);
    else if (t?.kind === "center") dirs.push("towards-center");
  }
  for (let i = 0; i < tags.length; i++) {
    const t = at(i)?.tag;
    if (t?.kind !== "num") continue;
    const next = kind(at(i + 1));
    if (next === "unit" || next === "dir") {
      intent.distance = t.n;
      break;
    }
  }
  if (dirs.length === 1) intent.direction = dirs[0] as Direction;
  else if (dirs.length > 1) intent.direction = [...new Set(dirs)];
  if (which) intent.which = which;

  const preview = tags.some((t) => t.tag.kind === "preview");
  const understood = tags.some((t) => !["unknown", "filler", "verb", "neg"].includes(t.tag.kind));
  return { intent, preview, protectKingOnly: protectKing && !hasCastle, understood };
}

function contextFrom(result: ResolveResult, intent: MoveIntent, squares?: Square[]): ResolveContext {
  const piece = toPiece(intent.piece);
  const ctx: ResolveContext = {};
  if (result.status === "ambiguous") {
    const types = [...new Set(result.candidates.map((m) => m.piece))];
    if (types.length === 1) ctx.piece = types[0] as PieceSymbol;
    ctx.squares = [...new Set(result.candidates.map((m) => m.from))];
    ctx.targets = [...new Set(result.candidates.map((m) => m.to))];
    return ctx;
  }
  if (result.status === "resolved") {
    ctx.piece = result.move.piece;
    ctx.squares = [result.move.from];
    return ctx;
  }
  if (piece) ctx.piece = piece;
  if (squares && (intent.which || intent.from)) ctx.squares = squares;
  return ctx;
}

/** Preview the legal destinations of the pieces an intent points at. */
export function previewIntent(position: string, intent: MoveIntent, context?: ResolveContext): PreviewResult | ResolveResult {
  const chess = loadGame(position);
  const extras: CoreExtras = {};
  const merged: MoveIntent = { ...intent };
  if (context && !intent.piece && !intent.from && !isSquare(intent.which)) {
    if (context.piece) merged.piece = context.piece;
    if (context.squares?.length) extras.fromSquares = context.squares;
  }
  if (!merged.piece && !merged.from && !isSquare(merged.which) && !extras.fromSquares) {
    return { status: "no-match", reasonHi: "किस मोहरे की चालें दिखाऊँ, यह समझ नहीं आया।", reasonEn: "Could not tell which piece to preview." };
  }
  const sel = selectPieces(chess, merged, extras);
  if ("status" in sel) return sel;
  const moves = legalMovesOf(chess).filter((m) => sel.squares.includes(m.from) && (!sel.type || m.piece === sel.type));
  const targets = [...new Set(moves.map((m) => m.to))];
  const pieces = sel.squares.map((square) => {
    const cell = chess.get(square);
    const type = (cell?.type ?? sel.type ?? "p") as PieceSymbol;
    return { square, type, labelHi: pieceHi(type) };
  });
  const name = sel.type ? pieceHi(sel.type) : "मोहरा";
  const nameEn = sel.type ? pieceEn(sel.type) : "piece";
  const where = sel.squares.join(", ");
  return {
    status: "preview",
    pieces,
    squares: sel.squares,
    targets,
    moves,
    messageHi: targets.length
      ? `${name} (${where}) इन घरों में जा सकता है: ${targets.join(", ")}। अभी चाल नहीं चली गई।`
      : `${name} (${where}) अभी कहीं नहीं जा सकता।`,
    messageEn: targets.length
      ? `${cap(nameEn)} (${where}) can go to: ${targets.join(", ")}. No move has been made.`
      : `${cap(nameEn)} (${where}) cannot move right now.`,
  };
}

/**
 * Deterministic phrase resolver. Normalizes and tags the text with the
 * lexicon, builds a MoveIntent and resolves it. Preview phrases ("pehle
 * dikhao", "abhi chalna nahi") return a preview and never a move.
 */
export function resolvePhrase(position: string, text: string, context?: ResolveContext): PhraseResult {
  const chess = loadGame(position);
  // Fillers ("theek", "the", "please") carry no meaning and would only break adjacency patterns.
  const tags = tagPhrase(text).filter((t) => t.tag.kind !== "filler");
  const parsed = parseTags(tags);

  if (parsed.preview) {
    if (!parsed.intent.piece && !parsed.intent.from) {
      // "Nf3 dikhao": preview the piece that SAN names.
      const s = findSan(chess, text);
      if (s && "san" in s) parsed.intent.from = new Chess(chess.fen()).move(s.san).from;
    }
    const r = previewIntent(position, parsed.intent, context);
    if (r.status === "preview") {
      const ctx: ResolveContext = { squares: r.squares, targets: r.targets };
      const p = r.pieces[0]?.type;
      if (p && r.pieces.every((x) => x.type === p)) ctx.piece = p;
      return { ...r, intent: parsed.intent, context: ctx };
    }
    return { ...r, intent: parsed.intent, context: context ?? {} };
  }

  const san = findSan(chess, text);
  if (san) {
    let intent: MoveIntent;
    if ("san" in san) intent = { san: san.san };
    else if ("castle" in san) intent = { castle: san.castle };
    else intent = { san: san.badSan };
    const r = resolveIntent(position, intent);
    return { ...r, intent, context: r.status === "resolved" ? contextFrom(r, intent) : context ?? {} };
  }

  if (parsed.protectKingOnly && !parsed.intent.piece && !parsed.intent.to) {
    return {
      status: "no-match",
      reasonHi: "राजा को कैसे बचाना है — किलाबंदी करनी है या कोई और चाल? साफ़ बताइए।",
      reasonEn: "How should the king be protected — castling or another move? Please say which.",
      intent: parsed.intent,
      context: context ?? {},
    };
  }

  if (!parsed.understood) {
    return {
      status: "no-match",
      reasonHi: "माफ़ कीजिए, यह चाल समझ नहीं आई। मोहरे का नाम और दिशा बताइए, जैसे 'घोड़ा आगे'।",
      reasonEn: "Sorry, I could not understand that move. Name the piece and a direction, e.g. 'knight forward'.",
      context: context ?? {},
    };
  }

  const r = resolveIntent(position, parsed.intent, context);
  const usedCtx = !parsed.intent.piece && !parsed.intent.from && !isSquare(parsed.intent.which) && !parsed.intent.castle;
  let squares: Square[] | undefined;
  if (r.status === "illegal" || r.status === "no-match") {
    const sel = selectPieces(chess, usedCtx && context?.piece ? { ...parsed.intent, piece: context.piece } : parsed.intent);
    if (!("status" in sel)) squares = sel.squares;
  }
  const intentOut: MoveIntent = { ...parsed.intent };
  if (usedCtx && context?.piece && !intentOut.piece) intentOut.piece = context.piece;
  return { ...r, intent: intentOut, context: contextFrom(r, intentOut, squares) };
}
