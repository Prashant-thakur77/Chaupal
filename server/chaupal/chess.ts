import { fail, type ActionRunContext } from "@agent-native/core/action";
import { Chess, type Move } from "chess.js";
import { and, desc, eq, gt } from "drizzle-orm";

import { PIECES } from "../../app/engines/shatranj/pieces.js";
import { getChessState } from "../../app/engines/shatranj/state.js";
import { getDb, schema } from "../db/index.js";
import { mutationOptions, respond, sleep, type Who } from "./kit.js";
import { loadGame, turnOwner } from "./snapshot.js";
import { mutate, newId, nowIso, readActivity } from "./state.js";

export type MoveActor = "elder" | "agent" | "family";

export function pieceHi(t: string) {
  return PIECES[t as keyof typeof PIECES]?.hi ?? t;
}

export async function requireGame(who: Who) {
  const state = await readActivity(getDb(), who.session.id);
  if (!state || state.scene !== "shatranj" || !state.chessGameId) {
    fail("Shatranj is not open. Open it first with open-activity.", { errorCode: "CHESS_NOT_OPEN" });
  }
  const game = await loadGame(state!.chessGameId);
  if (!game) fail("No game in progress.", { errorCode: "CHESS_NOT_OPEN" });
  return { state: state!, game: game! };
}

/** A compact, Hindi-aware view of the position for agents. */
export function chessView(game: { fen: string; elderColor: string; opponent: string; opponentName: string | null }) {
  const s = getChessState(game.fen);
  const owner = turnOwner(game);
  return {
    fen: s.fen,
    turn: s.turn,
    turnOwner: owner,
    elderColor: game.elderColor,
    opponent: game.opponent,
    opponentName: game.opponentName,
    inCheck: s.inCheck,
    isCheckmate: s.isCheckmate,
    isStalemate: s.isStalemate,
    isDraw: s.isDraw,
    legalMoves: s.legalMoves.map((m) => ({
      from: m.from,
      to: m.to,
      san: m.san,
      piece: m.piece,
      pieceHi: m.pieceHi,
      captured: m.captured ?? null,
      descriptionHi: m.descriptionHi,
    })),
    pieces: s.pieces,
    perspective:
      "Squares are algebraic (a1..h8). White starts on ranks 1-2. Left/right/forward are from the moving side's own seat: for white, left is the a-file and forward is up the ranks; for black, left is the h-file and forward is down the ranks.",
  };
}

function statusOf(chess: Chess) {
  if (chess.isCheckmate()) return "checkmate";
  if (chess.isStalemate()) return "stalemate";
  if (chess.isDraw()) return "draw";
  return "playing";
}

const ILLEGAL_REASON_HI: Record<string, string> = {
  r: "हाथी सिर्फ़ सीधा चलता है, तिरछा नहीं।",
  b: "ऊँट सिर्फ़ तिरछा चलता है।",
  n: "घोड़ा ढाई घर चलता है।",
  k: "राजा एक ही घर चलता है।",
  p: "प्यादा सीधा आगे चलता है और तिरछा सिर्फ़ मारते समय।",
  q: "वज़ीर सीधा या तिरछा चलता है, पर रास्ता खाली होना चाहिए।",
};

/**
 * Apply one move through chess.js inside the session's revision-checked write.
 * The board, the move record and the revision change together or not at all.
 */
export async function playMove(opts: {
  ctx: ActionRunContext | undefined;
  who: Who;
  from: string;
  to: string;
  promotion?: string | undefined;
  actor: MoveActor;
  via: "voice" | "drag" | "tap" | "agent" | "family";
  spoken?: string | undefined;
  expectedRevision?: number | undefined;
}) {
  const { ctx, who } = opts;
  const { result, state } = await mutate(
    {
      ...mutationOptions(ctx, who, opts.actor === "family" ? "family-move" : "move-chess-piece", {
        expectedRevision: opts.expectedRevision,
      }),
      actor: opts.actor,
    },
    async (tx, st) => {
      if (st.scene !== "shatranj" || !st.chessGameId) {
        fail("Shatranj is not open.", { errorCode: "CHESS_NOT_OPEN" });
      }
      const game = (await tx.select().from(schema.chessGames).where(eq(schema.chessGames.id, st.chessGameId!)).limit(1))[0];
      if (!game) fail("No game in progress.", { errorCode: "CHESS_NOT_OPEN" });
      if (game!.status !== "playing") {
        fail("This game has finished.", { errorCode: "CHESS_GAME_FINISHED" });
      }
      const owner = turnOwner(game!);
      if (owner !== opts.actor) {
        fail(
          owner === "elder"
            ? "It is her turn now, not yours."
            : owner === "family"
              ? `It is ${game!.opponentName ?? "the family member"}'s turn.`
              : "It is the agent's turn.",
          { errorCode: "CHESS_NOT_YOUR_TURN", details: { turnOwner: owner, actor: opts.actor } },
        );
      }
      const chess = new Chess(game!.fen);
      const piece = chess.get(opts.from as never);
      let mv: Move | null = null;
      try {
        mv = chess.move({ from: opts.from, to: opts.to, promotion: opts.promotion ?? "q" });
      } catch {
        mv = null;
      }
      if (!mv) {
        const legalForPiece = new Chess(game!.fen)
          .moves({ square: opts.from as never, verbose: true })
          .map((m) => m.to);
        fail(
          piece
            ? `That move is not allowed: ${pieceHi(piece.type)} cannot go from ${opts.from} to ${opts.to}. ${ILLEGAL_REASON_HI[piece.type] ?? ""}`.trim()
            : `There is no piece on ${opts.from}.`,
          {
            errorCode: "CHESS_ILLEGAL_MOVE",
            details: {
              from: opts.from,
              to: opts.to,
              reasonHi: piece ? ILLEGAL_REASON_HI[piece.type] ?? "यह चाल नियम के ख़िलाफ़ है।" : "उस घर में कोई मोहरा नहीं है।",
              boardUnchanged: true,
              legalTargetsForThisPiece: legalForPiece,
            },
          },
        );
      }
      const ply = (await tx.select({ ply: schema.chessMoves.ply }).from(schema.chessMoves).where(eq(schema.chessMoves.gameId, game!.id)).orderBy(desc(schema.chessMoves.ply)).limit(1))[0]?.ply ?? 0;
      const fenAfter = chess.fen();
      await tx.insert(schema.chessMoves).values({
        id: newId("mv"),
        gameId: game!.id,
        sessionId: st.sessionId,
        ownerEmail: st.ownerEmail,
        ply: ply + 1,
        san: mv!.san,
        fromSq: mv!.from,
        toSq: mv!.to,
        piece: mv!.piece,
        captured: mv!.captured ?? null,
        actor: opts.actor,
        via: opts.via,
        spoken: opts.spoken?.slice(0, 200) ?? null,
        fenAfter,
      });
      await tx
        .update(schema.chessGames)
        .set({ fen: fenAfter, status: statusOf(chess), preview: null, updatedAt: nowIso() })
        .where(eq(schema.chessGames.id, game!.id));
      return {
        patch: { conflict: null, presence: opts.actor === "agent" ? "speaking" : "ready" },
        result: {
          ply: ply + 1,
          move: {
            from: mv!.from,
            to: mv!.to,
            san: mv!.san,
            piece: mv!.piece,
            pieceHi: pieceHi(mv!.piece),
            captured: mv!.captured ?? null,
            capturedHi: mv!.captured ? pieceHi(mv!.captured) : null,
            actor: opts.actor,
          },
          status: statusOf(chess),
          gameId: game!.id,
        },
        payload: { from: mv!.from, to: mv!.to, san: mv!.san, actor: opts.actor },
      };
    },
  );
  const visible = await waitForBoardAck(who.session.id, result.gameId, result.ply);
  return { state, ...result, visibleOnHerScreen: visible };
}

/**
 * The base repo held a move until the board finished animating. Here the
 * elder's board confirms the ply it has finished drawing; we wait briefly for
 * that, and report honestly if no board confirmed it (no screen open).
 */
export async function waitForBoardAck(sessionId: string, gameId: string, ply: number, timeoutMs = 4500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const rows = await getDb()
      .select({ payload: schema.events.payload })
      .from(schema.events)
      .where(and(eq(schema.events.sessionId, sessionId), eq(schema.events.type, "board-animated")))
      .orderBy(desc(schema.events.createdAt))
      .limit(5);
    if (rows.some((r) => {
      try {
        const p = JSON.parse(r.payload ?? "{}");
        return p.gameId === gameId && Number(p.ply) >= ply;
      } catch {
        return false;
      }
    })) return true;
    await sleep(250);
  }
  return false;
}

/** Hold until the person (elder) makes a move on the board, or time out. */
export async function waitForPersonMove(who: Who, timeoutMs = 45_000) {
  const { game } = await requireGame(who);
  const owner = turnOwner(game);
  if (owner !== "elder") {
    fail("It is not her turn, so there is no move of hers to wait for.", {
      errorCode: "CHESS_PERSON_TURN_NOT_ACTIVE",
      details: { turnOwner: owner },
    });
  }
  const startPly =
    (await getDb().select({ ply: schema.chessMoves.ply }).from(schema.chessMoves).where(eq(schema.chessMoves.gameId, game.id)).orderBy(desc(schema.chessMoves.ply)).limit(1))[0]?.ply ?? 0;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const next = (
      await getDb()
        .select()
        .from(schema.chessMoves)
        .where(and(eq(schema.chessMoves.gameId, game.id), gt(schema.chessMoves.ply, startPly)))
        .orderBy(schema.chessMoves.ply)
        .limit(1)
    )[0];
    if (next) {
      await waitForBoardAck(who.session.id, game.id, next.ply, 2500);
      const fresh = (await loadGame(game.id))!;
      return {
        personMoved: true,
        move: {
          from: next.fromSq,
          to: next.toSq,
          san: next.san,
          piece: next.piece,
          pieceHi: pieceHi(next.piece),
          captured: next.captured,
          actor: next.actor,
          via: next.via,
        },
        shouldAgentReply: turnOwner(fresh) === "agent" && fresh.status === "playing",
        position: chessView(fresh),
      };
    }
    await sleep(500);
  }
  return {
    personMoved: false,
    timedOut: true,
    note: "She has not moved yet. Do not move for her; wait for her to speak or move.",
  };
}

export { respond };
