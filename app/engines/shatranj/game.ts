/**
 * Game helpers: apply a move with typed errors, preview a piece's moves, and
 * a deterministic, deliberately weak "gentle" opponent.
 */
import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";

import { PIECES } from "./pieces";
import { type PieceRef, type PreviewResult, type ResolveResult, type Which, previewIntent } from "./resolve";
import { type ChessState, type LegalMove, PositionError, describeMove, legalMovesOf, loadGame, stateOf } from "./state";

export type ApplyErrorCode = "ILLEGAL_MOVE" | "NOT_YOUR_TURN" | "STALE_POSITION" | "INVALID_POSITION";

export interface ApplyOk {
  ok: true;
  fen: string;
  pgn: string;
  move: LegalMove;
  state: ChessState;
}
export interface ApplyError {
  ok: false;
  code: ApplyErrorCode;
  messageHi: string;
  messageEn: string;
  /** The position is untouched on error. */
  fen: string | null;
}
export type ApplyResult = ApplyOk | ApplyError;

export type MoveInput = string | { from: Square; to: Square; promotion?: PieceSymbol };

export interface ApplyOptions {
  /** Who is trying to move. If it is not their turn, NOT_YOUR_TURN. */
  player?: Color;
}

/** Placement, turn, castling and en-passant fields, normalized through chess.js. */
function positionKey(position: string): string | null {
  try {
    return loadGame(position).fen().split(" ").slice(0, 4).join(" ");
  } catch {
    return null;
  }
}

function err(code: ApplyErrorCode, messageHi: string, messageEn: string, fen: string | null): ApplyError {
  return { ok: false, code, messageHi, messageEn, fen };
}

/**
 * Apply one move to a FEN or PGN position. Never mutates the input.
 * `expectedFen` guards against a client acting on an out-of-date board.
 */
export function applyMove(position: string, move: MoveInput, expectedFen?: string | null, opts: ApplyOptions = {}): ApplyResult {
  let chess: Chess;
  try {
    chess = loadGame(position);
  } catch (e) {
    const msg = e instanceof PositionError ? e.message : String(e);
    return err("INVALID_POSITION", "बोर्ड की स्थिति समझ नहीं आई।", msg, null);
  }
  const fen = chess.fen();
  if (expectedFen) {
    const want = positionKey(expectedFen);
    const have = positionKey(position);
    if (!want || want !== have) {
      return err(
        "STALE_POSITION",
        "बोर्ड बदल चुका है — पहले नई स्थिति देख लीजिए, फिर चाल चलिए।",
        "The board has changed since this move was chosen; refresh and try again.",
        fen,
      );
    }
  }
  const turn = chess.turn();
  if (opts.player && opts.player !== turn) {
    return err("NOT_YOUR_TURN", "अभी आपकी बारी नहीं है।", "It is not your turn.", fen);
  }

  let input: string | { from: string; to: string; promotion?: string };
  if (typeof move === "string") {
    const uci = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(move.trim().toLowerCase());
    input = uci
      ? { from: uci[1] as string, to: uci[2] as string, ...(uci[3] ? { promotion: uci[3] } : {}) }
      : move.trim();
  } else {
    input = move.promotion ? { from: move.from, to: move.to, promotion: move.promotion } : { from: move.from, to: move.to };
  }
  if (typeof input !== "string") {
    const cell = chess.get(input.from as Square);
    if (cell && cell.color !== turn) {
      return err(
        "NOT_YOUR_TURN",
        `${input.from} का मोहरा सामने वाले का है — अभी ${turn === "w" ? "सफ़ेद" : "काले"} की बारी है।`,
        `The piece on ${input.from} is not the side to move's.`,
        fen,
      );
    }
  }
  try {
    const m = chess.move(input);
    return { ok: true, fen: chess.fen(), pgn: chess.pgn(), move: describeMove(m), state: stateOf(chess) };
  } catch {
    return err("ILLEGAL_MOVE", "यह चाल नियम से नहीं हो सकती।", "That move is not legal.", fen);
  }
}

/** Legal destinations for a square ("b1") or a piece ("ghoda", "n"), optionally narrowed by `which`. */
export function previewMoves(position: string, target: Square | PieceRef, which?: Which): PreviewResult | ResolveResult {
  const isSq = /^[a-h][1-8]$/.test(target);
  const intent = isSq ? { from: target as Square } : which ? { piece: target, which } : { piece: target };
  return previewIntent(position, intent);
}

// ---------------------------------------------------------------------------
// Gentle opponent

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface AgentReply {
  move: LegalMove;
  reasonHi: string;
  reasonEn: string;
}

/**
 * A kind, weak, deterministic opponent (one ply, no search).
 * - Likes taking a piece nobody defends.
 * - Mildly avoids leaving the moved piece hanging.
 * - Small random jitter seeded by the FEN, so the same position always
 *   gets the same reply.
 * It does not look for checkmate. The in-app agent may choose among legal
 * moves itself; this is the fallback and the source of truth for legality.
 */
export function pickAgentReply(position: string, level: "gentle" = "gentle"): AgentReply | null {
  const chess = loadGame(position);
  if (chess.isGameOver()) return null;
  const me = chess.turn();
  const enemy: Color = me === "w" ? "b" : "w";
  const moves = legalMovesOf(chess);
  if (!moves.length) return null;
  const rng = mulberry32(fnv1a(`${level}|${chess.fen()}`));
  let best: { m: LegalMove; s: number; why: "capture" | "safe" | "any" } | null = null;
  for (const m of moves) {
    let s = rng() * 2;
    let why: "capture" | "safe" | "any" = "any";
    if (m.captured) {
      const defended = chess.isAttacked(m.to, enemy);
      if (!defended) {
        s += PIECES[m.captured].value;
        why = "capture";
      } else if (PIECES[m.captured].value > PIECES[m.piece].value) {
        s += 1;
      }
    }
    const probe = new Chess(chess.fen());
    probe.move(m.san);
    if (probe.isAttacked(m.to, enemy) && !probe.isAttacked(m.to, me) && m.piece !== "k") {
      s -= PIECES[m.piece].value * 0.5;
    } else if (why === "any") {
      why = "safe";
    }
    if (m.flags.includes("k") || m.flags.includes("q")) s += 0.5;
    else if (m.piece === "k") s -= 0.5;
    if (!best || s > best.s) best = { m, s, why };
  }
  if (!best) return null;
  const { m, why } = best;
  const reasonHi =
    why === "capture"
      ? `मैंने ${m.descriptionHi} चला — वह ${m.capturedHi} अकेला खड़ा था।`
      : `मैंने ${m.descriptionHi} चला।`;
  const reasonEn = why === "capture" ? `I played ${m.descriptionEn}; that piece was undefended.` : `I played ${m.descriptionEn}.`;
  return { move: m, reasonHi, reasonEn };
}
