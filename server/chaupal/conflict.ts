import { desc, eq } from "drizzle-orm";

import { getDb, schema } from "../db/index.js";
import type { Who } from "./kit.js";
import { nowIso } from "./state.js";

/**
 * When two people act on the same board at once, the slower write loses the
 * framework's compare-and-set (save_conflict) or finds the turn already
 * taken. Nothing is overwritten; the elder sees a friendly card naming who
 * moved first.
 */
export async function recordConflict(who: Who, error: unknown, actor: string) {
  const code = (error as { errorCode?: string })?.errorCode;
  if (code !== "save_conflict" && code !== "CHESS_NOT_YOUR_TURN") return;
  const db = getDb();
  const state = (await db.select().from(schema.activityState).where(eq(schema.activityState.sessionId, who.session.id)).limit(1))[0];
  if (!state?.chessGameId) return;
  const last = (
    await db
      .select()
      .from(schema.chessMoves)
      .where(eq(schema.chessMoves.gameId, state.chessGameId))
      .orderBy(desc(schema.chessMoves.ply))
      .limit(1)
  )[0];
  if (!last || last.actor === actor) return;
  // A plain "not your turn" only becomes a card when a rival on the same side
  // (agent vs family) got there first; a stale revision always does.
  if (code === "CHESS_NOT_YOUR_TURN" && last.actor === "elder") return;
  const game = (await db.select().from(schema.chessGames).where(eq(schema.chessGames.id, state.chessGameId)).limit(1))[0];
  const name = last.actor === "family" ? (game?.opponentName ?? "परिवार") : last.actor === "elder" ? "आप" : "एजेंट";
  const nameEn = last.actor === "family" ? (game?.opponentName ?? "Family") : last.actor === "elder" ? "You" : "The agent";
  const card = {
    kind: "moved-first",
    by: last.actor,
    name,
    messageHi: last.actor === "elder" ? "आपने पहले चाल चल दी" : `${name} ने पहले चाल चल दी`,
    messageEn: `${nameEn} moved first`,
    move: { from: last.fromSq, to: last.toSq, san: last.san },
    blockedActor: actor,
    at: nowIso(),
  };
  await db
    .update(schema.activityState)
    .set({ conflict: JSON.stringify(card), updatedAt: nowIso() })
    .where(eq(schema.activityState.sessionId, who.session.id));
}
