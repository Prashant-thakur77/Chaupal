/**
 * Position state for the Shatranj layer. chess.js owns every rule; this file
 * only reads from it and adds Hindi/English descriptions.
 */
import { Chess, type Color, type Move, type PieceSymbol, type Square, validateFen } from "chess.js";

import { COLOR_HI, PIECES, TURN_HI, discLabel, pieceEn, pieceHi } from "./pieces";

export interface LegalMove {
  from: Square;
  to: Square;
  san: string;
  /** Long algebraic / UCI, e.g. "e2e4", "e7e8q". */
  uci: string;
  piece: PieceSymbol;
  pieceHi: string;
  color: Color;
  captured?: PieceSymbol;
  capturedHi?: string;
  promotion?: PieceSymbol;
  /** chess.js flags: n normal, b big pawn, e en passant, c capture, p promotion, k/q castling. */
  flags: string;
  isCheck: boolean;
  isCheckmate: boolean;
  descriptionHi: string;
  descriptionEn: string;
}

export interface HistoryEntry {
  ply: number;
  san: string;
  from: Square;
  to: Square;
  by: Color;
}

export interface BoardPiece {
  square: Square;
  color: Color;
  type: PieceSymbol;
  labelHi: string;
  labelShort: string;
  labelEn: string;
}

export interface ChessState {
  fen: string;
  pgn: string;
  turn: Color;
  turnHi: string;
  moveNumber: number;
  inCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  isGameOver: boolean;
  statusHi: string;
  statusEn: string;
  legalMoves: LegalMove[];
  history: HistoryEntry[];
  pieces: BoardPiece[];
}

export class PositionError extends Error {
  readonly code = "INVALID_POSITION" as const;
  constructor(message: string) {
    super(message);
    this.name = "PositionError";
  }
}

/** True when the string is a valid FEN (as opposed to PGN). */
export function isFen(position: string): boolean {
  return validateFen(position.trim()).ok;
}

/**
 * Load a FEN or PGN string into a fresh chess.js instance.
 * Throws PositionError on garbage input.
 */
export function loadGame(position?: string | null): Chess {
  const chess = new Chess();
  const p = (position ?? "").trim();
  if (!p || p === "start" || p === "startpos") return chess;
  if (isFen(p)) {
    chess.load(p);
    return chess;
  }
  try {
    chess.loadPgn(p);
  } catch (err) {
    throw new PositionError(`Not a valid FEN or PGN: ${(err as Error).message}`);
  }
  return chess;
}

function castleSideHi(san: string): { hi: string; en: string } | null {
  if (san.startsWith("O-O-O")) return { hi: "किलाबंदी वज़ीर की तरफ़ (बड़ी)", en: "Castle queenside (long)" };
  if (san.startsWith("O-O")) return { hi: "किलाबंदी राजा की तरफ़ (छोटी)", en: "Castle kingside (short)" };
  return null;
}

export function describeMove(m: Move): LegalMove {
  const isCheckmate = m.san.endsWith("#");
  const isCheck = isCheckmate || m.san.endsWith("+");
  const castle = castleSideHi(m.san);
  let hi: string;
  let en: string;
  if (castle) {
    hi = castle.hi;
    en = castle.en;
  } else {
    hi = `${pieceHi(m.piece)} ${m.from} से ${m.to}`;
    const enName = pieceEn(m.piece);
    en = `${enName.charAt(0).toUpperCase()}${enName.slice(1)} ${m.from} to ${m.to}`;
    if (m.captured) {
      hi += ` (${pieceHi(m.captured)} मारकर)`;
      en += ` (takes ${pieceEn(m.captured)})`;
    }
    if (m.flags.includes("e")) {
      hi += " — आँ पासाँ";
      en += " en passant";
    }
    if (m.promotion) {
      hi += ` — ${pieceHi(m.promotion)} बनेगा`;
      en += `, becomes a ${pieceEn(m.promotion)}`;
    }
  }
  if (isCheckmate) {
    hi += " — शह और मात!";
    en += " — checkmate!";
  } else if (isCheck) {
    hi += " — शह!";
    en += " — check!";
  }
  const lm: LegalMove = {
    from: m.from,
    to: m.to,
    san: m.san,
    uci: `${m.from}${m.to}${m.promotion ?? ""}`,
    piece: m.piece,
    pieceHi: pieceHi(m.piece),
    color: m.color,
    flags: m.flags,
    isCheck,
    isCheckmate,
    descriptionHi: hi,
    descriptionEn: en,
  };
  if (m.captured) {
    lm.captured = m.captured;
    lm.capturedHi = pieceHi(m.captured);
  }
  if (m.promotion) lm.promotion = m.promotion;
  return lm;
}

export function legalMovesOf(chess: Chess): LegalMove[] {
  return chess.moves({ verbose: true }).map(describeMove);
}

export function boardPieces(chess: Chess): BoardPiece[] {
  const out: BoardPiece[] = [];
  for (const row of chess.board()) {
    for (const cell of row) {
      if (!cell) continue;
      const lbl = discLabel(cell.type);
      out.push({
        square: cell.square,
        color: cell.color,
        type: cell.type,
        labelHi: lbl.full,
        labelShort: lbl.short,
        labelEn: PIECES[cell.type].en,
      });
    }
  }
  return out;
}

function statusOf(chess: Chess): { hi: string; en: string } {
  const turn = chess.turn();
  if (chess.isCheckmate()) {
    const winner: Color = turn === "w" ? "b" : "w";
    return { hi: `शह और मात! ${COLOR_HI[winner]} जीता।`, en: `Checkmate. ${winner === "w" ? "White" : "Black"} wins.` };
  }
  if (chess.isStalemate()) return { hi: "बाज़ी बराबर — चलने को कोई चाल नहीं (स्टेलमेट)।", en: "Draw by stalemate." };
  if (chess.isDraw()) return { hi: "बाज़ी बराबर रही।", en: "Draw." };
  if (chess.inCheck()) return { hi: `${TURN_HI[turn]} — राजा पर शह है!`, en: `${turn === "w" ? "White" : "Black"} to move — in check!` };
  return { hi: TURN_HI[turn], en: `${turn === "w" ? "White" : "Black"} to move` };
}

/** Full state from a FEN or PGN string. History is only available from PGN. */
export function getChessState(position?: string | null): ChessState {
  const chess = loadGame(position);
  return stateOf(chess);
}

export function stateOf(chess: Chess): ChessState {
  const turn = chess.turn();
  const status = statusOf(chess);
  const history: HistoryEntry[] = chess.history({ verbose: true }).map((m, idx) => ({
    ply: idx + 1,
    san: m.san,
    from: m.from,
    to: m.to,
    by: m.color,
  }));
  return {
    fen: chess.fen(),
    pgn: chess.pgn(),
    turn,
    turnHi: TURN_HI[turn],
    moveNumber: chess.moveNumber(),
    inCheck: chess.inCheck(),
    isCheckmate: chess.isCheckmate(),
    isStalemate: chess.isStalemate(),
    isDraw: chess.isDraw(),
    isGameOver: chess.isGameOver(),
    statusHi: status.hi,
    statusEn: status.en,
    legalMoves: legalMovesOf(chess),
    history,
    pieces: boardPieces(chess),
  };
}
