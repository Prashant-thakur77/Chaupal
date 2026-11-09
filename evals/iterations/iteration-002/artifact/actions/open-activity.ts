import { defineAction } from "@agent-native/core/action";
import { Chess } from "chess.js";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { ChaupalResult, sessionChange, ExpectedRevision, mutationOptions, respond, sessionOf } from "../server/chaupal/kit.js";
import { mutate, newId } from "../server/chaupal/state.js";
import { schema } from "../server/db/index.js";

export default defineAction({
  description:
    "Open an activity on her screen: sulekh (calligraphy to trace), rangoli (radial rangoli or pookalam to trace and colour), kolam (pulli kolam on a dot grid) or shatranj (chess with Hindi piece names). Opening shatranj starts a fresh board unless a game is already in progress (pass newGame:true to restart only if she asked). Open first, then act inside it. Her saved works are kept.",
  schema: z.object({
    activity: z.enum(["sulekh", "rangoli", "kolam", "shatranj"]).describe("sulekh | rangoli | kolam | shatranj"),
    elderColor: z
      .enum(["w", "b"])
      .optional()
      .describe('Shatranj only: the side she plays, "w" (safed/white, moves first) or "b" (kaala/black). Defaults to "w".'),
    newGame: z.boolean().optional().describe("Shatranj only: true to start a new game even if one is in progress"),
    caption: z.string().max(180).optional().describe("Optional short line under the diya, in her language"),
    expectedRevision: ExpectedRevision,
  }),
  outputSchema: ChaupalResult,
  changeResource: sessionChange,
  mcpTool: true,
  run: async ({ activity, elderColor, newGame, caption, expectedRevision }, ctx) => {
    const who = await sessionOf(ctx);
    const { session } = who;
    const { state, result } = await mutate(
      mutationOptions(ctx, who, "open-activity", { expectedRevision }),
      async (tx, st) => {
        const patch: Record<string, unknown> = {
          scene: activity,
          pending: null,
          presence: "ready",
          caption: caption ?? null,
          conflict: null,
          historyOpen: 0,
          ...(isSettled(st.approval) ? { approval: null } : {}),
        };
        let startedGame = false;
        if (activity === "shatranj") {
          let keep = false;
          if (st.chessGameId && !newGame) {
            const game = (await tx.select().from(schema.chessGames).where(eqId(st.chessGameId)).limit(1))[0];
            keep = Boolean(game && game.status === "playing" && (!elderColor || elderColor === game.elderColor));
          }
          if (!keep) {
            const id = newId("game");
            await tx.insert(schema.chessGames).values({
              id,
              sessionId: st.sessionId,
              ownerEmail: st.ownerEmail,
              fen: new Chess().fen(),
              elderColor: elderColor ?? "w",
            });
            patch.chessGameId = id;
            startedGame = true;
          }
        }
        if (activity === "sulekh" || activity === "rangoli" || activity === "kolam") {
          patch.inputMode = "none";
        }
        return { patch, result: { startedGame }, payload: { activity } };
      },
    );
    return respond(state, { opened: activity, ...result });
  },
});

/** A finished family update (sent, declined, failed) need not stay on screen. */
function isSettled(approval: string | null) {
  if (!approval) return false;
  try {
    return JSON.parse(approval).status !== "pending";
  } catch {
    return true;
  }
}

function eqId(id: string) {
  return eq(schema.chessGames.id, id);
}
