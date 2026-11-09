import { Chess } from "chess.js";

export type Color = "w" | "b";
export type PieceKind = "k" | "q" | "r" | "b" | "n" | "p";
export type PieceCode = `${Color}${Uppercase<PieceKind>}`;
export type Language = "hi" | "en";
export type Orientation = Color;

export type Actor = "elder" | "agent" | "family";

export type Move = {
  from: string;
  to: string;
  san?: string;
  piece?: string;
  captured?: string | null;
  ply?: number;
  actor?: Actor;
};

export type LegalMove = { from: string; to: string; san: string };

export type BoardPiece = { square: string; color: Color; kind: PieceKind };

export const FILES = "abcdefgh";
export const KINDS: readonly PieceKind[] = ["k", "q", "b", "n", "r", "p"];

export const PIECE_NAMES: Record<Language, Record<PieceKind, string>> = {
  hi: {
    k: "राजा",
    q: "वज़ीर",
    b: "ऊँट",
    n: "घोड़ा",
    r: "हाथी",
    p: "प्यादा",
  },
  en: {
    k: "King",
    q: "Queen",
    b: "Bishop",
    n: "Knight",
    r: "Rook",
    p: "Pawn",
  },
};

export const COLOR_NAMES: Record<Language, Record<Color, string>> = {
  hi: { w: "सफ़ेद", b: "काला" },
  en: { w: "White", b: "Black" },
};

/** Side names in the possessive ("सफ़ेद की चाल", "काले की चाल"). */
export const TURN_NAMES: Record<Language, Record<Color, string>> = {
  hi: { w: "सफ़ेद", b: "काले" },
  en: { w: "White", b: "Black" },
};

/**
 * Per-label size factor, so every label fits inside the disc's inner ring.
 * Devanagari labels stay large (they are the primary reading); the longer
 * English words shrink a little.
 */
export const LABEL_SCALE: Record<Language, Record<PieceKind, number>> = {
  hi: { k: 1, q: 0.92, b: 1.02, n: 0.95, r: 0.95, p: 0.87 },
  en: { k: 0.8, q: 0.66, b: 0.62, n: 0.62, r: 0.78, p: 0.74 },
};

export function pieceCode(color: Color, kind: PieceKind): PieceCode {
  return `${color}${kind.toUpperCase()}` as PieceCode;
}

export function parseCode(code: string): { color: Color; kind: PieceKind } {
  return {
    color: code[0] as Color,
    kind: code[1].toLowerCase() as PieceKind,
  };
}

export function squareToCoords(square: string) {
  return {
    file: FILES.indexOf(square[0]),
    rank: Number(square[1]) - 1,
  };
}

export function coordsToSquare(file: number, rank: number) {
  return `${FILES[file]}${rank + 1}`;
}

/** Display column/row (0 = left/top) of a square for the given orientation. */
export function squareToDisplay(square: string, orientation: Orientation) {
  const { file, rank } = squareToCoords(square);
  return orientation === "w"
    ? { col: file, row: 7 - rank }
    : { col: 7 - file, row: rank };
}

export function displayToSquare(
  col: number,
  row: number,
  orientation: Orientation,
) {
  return orientation === "w"
    ? coordsToSquare(col, 7 - row)
    : coordsToSquare(7 - col, row);
}

/** Centre of a square in board units (0..8, origin at the top-left). */
export function squareCenter(square: string, orientation: Orientation) {
  const { col, row } = squareToDisplay(square, orientation);
  return { x: col + 0.5, y: row + 0.5 };
}

export function isDarkSquare(square: string) {
  const { file, rank } = squareToCoords(square);
  return (file + rank) % 2 === 0;
}

export function pieceAriaLabel(
  code: string,
  square: string,
  language: Language,
) {
  const { color, kind } = parseCode(code);
  return `${COLOR_NAMES[language][color]} ${PIECE_NAMES[language][kind]} ${square}`;
}

export type ParsedPosition = {
  pieces: BoardPiece[];
  turn: Color;
  fullmove: number;
  inCheck: boolean;
  checkSquare: string | null;
  valid: boolean;
};

const EMPTY_POSITION: ParsedPosition = {
  pieces: [],
  turn: "w",
  fullmove: 1,
  inCheck: false,
  checkSquare: null,
  valid: false,
};

export function parseFen(fen: string): ParsedPosition {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return EMPTY_POSITION;
  }
  const pieces: BoardPiece[] = [];
  for (const row of chess.board()) {
    for (const cell of row) {
      if (cell) {
        pieces.push({
          square: cell.square,
          color: cell.color,
          kind: cell.type as PieceKind,
        });
      }
    }
  }
  const turn = chess.turn();
  const inCheck = chess.inCheck();
  const checkSquare = inCheck
    ? (pieces.find((piece) => piece.kind === "k" && piece.color === turn)
        ?.square ?? null)
    : null;
  const fullmove = Number(fen.trim().split(/\s+/)[5] ?? 1) || 1;
  return { pieces, turn, fullmove, inCheck, checkSquare, valid: true };
}

/** Plies played, derived from the FEN fullmove counter and side to move. */
export function plyFromFen(position: ParsedPosition) {
  return (position.fullmove - 1) * 2 + (position.turn === "b" ? 1 : 0);
}

// ---------------------------------------------------------------------------
// Stable disc identities across positions.

export type Disc = { id: string; code: PieceCode; square: string };

export type PositionDiff = {
  discs: Disc[];
  /** Discs that travelled between squares during the last move. */
  movers: { id: string; code: PieceCode; from: string; to: string }[];
  /** Discs that left the board (captured). */
  captured: { id: string; code: PieceCode; square: string }[];
  /** True when the change matched the reported last move. */
  matched: boolean;
};

let discCounter = 0;
function nextDiscId() {
  discCounter += 1;
  return `disc-${discCounter}`;
}

export function initialDiscs(position: ParsedPosition): Disc[] {
  return position.pieces.map((piece) => ({
    id: nextDiscId(),
    code: pieceCode(piece.color, piece.kind),
    square: piece.square,
  }));
}

function squareDistance(a: string, b: string) {
  const first = squareToCoords(a);
  const second = squareToCoords(b);
  return Math.hypot(first.file - second.file, first.rank - second.rank);
}

/**
 * Carries disc identities from the previous position to the next one and
 * works out which discs moved and which were captured. The reported last
 * move anchors the main mover; any remaining same-coloured relocation (the
 * rook in castling) is matched to its nearest vacated square.
 */
export function diffPositions(
  previous: Disc[],
  next: ParsedPosition,
  lastMove: Move | null | undefined,
): PositionDiff {
  const before = new Map(previous.map((disc) => [disc.square, disc]));
  const after = new Map(
    next.pieces.map((piece) => [
      piece.square,
      pieceCode(piece.color, piece.kind),
    ]),
  );

  const discs: Disc[] = [];
  const removed = new Map<string, Disc>();
  const added = new Map<string, PieceCode>();

  for (const [square, disc] of before) {
    if (after.get(square) !== disc.code) removed.set(square, disc);
  }
  for (const [square, code] of after) {
    const existing = before.get(square);
    if (existing && existing.code === code) discs.push(existing);
    else added.set(square, code);
  }

  const movers: PositionDiff["movers"] = [];
  const matched = Boolean(
    lastMove && removed.has(lastMove.from) && added.has(lastMove.to),
  );

  if (lastMove && matched) {
    const moverDisc = removed.get(lastMove.from)!;
    const landedCode = added.get(lastMove.to)!;
    removed.delete(lastMove.from);
    added.delete(lastMove.to);
    discs.push({ id: moverDisc.id, code: landedCode, square: lastMove.to });
    movers.push({
      id: moverDisc.id,
      code: moverDisc.code,
      from: lastMove.from,
      to: lastMove.to,
    });
  }

  // Secondary relocations (castling rook): same code, nearest vacated square.
  for (const [square, code] of [...added]) {
    let best: Disc | null = null;
    let bestDistance = Infinity;
    for (const disc of removed.values()) {
      if (disc.code !== code) continue;
      const distance = squareDistance(disc.square, square);
      if (distance < bestDistance) {
        best = disc;
        bestDistance = distance;
      }
    }
    if (best && matched) {
      removed.delete(best.square);
      added.delete(square);
      discs.push({ id: best.id, code, square });
      movers.push({ id: best.id, code, from: best.square, to: square });
    }
  }

  for (const [square, code] of added) {
    discs.push({ id: nextDiscId(), code, square });
  }

  const captured = matched
    ? [...removed.values()].map((disc) => ({
        id: disc.id,
        code: disc.code,
        square: disc.square,
      }))
    : [];

  return { discs, movers, captured, matched };
}
