import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";

import { playMove } from "../server/chaupal/chess.js";
import { ChaupalResult, ExpectedRevision, respond, sessionChange, sessionOf } from "../server/chaupal/kit.js";
import { recordConflict } from "../server/chaupal/conflict.js";

export default defineAction({
  description:
    "Make one chess move on her live board. actor \"elder\" plays HER move exactly as she asked (submit what she said even if it looks illegal; Chaupal rejects illegal moves with a reason and leaves the board unchanged, and you must not substitute another move). actor \"agent\" plays your own reply only when it is your turn and she asked you to play. The board animates on her screen before this returns. Use squares from get-chess-state.",
  schema: z.object({
    from: z.string().regex(/^[a-h][1-8]$/).describe("From square, e.g. e2"),
    to: z.string().regex(/^[a-h][1-8]$/).describe("To square, e.g. e4"),
    actor: z.enum(["elder", "agent"]).describe('"elder" for her own move, "agent" for your reply'),
    spokenMove: z.string().max(200).optional().describe("Her words for this move, as she said them"),
    promotion: z.enum(["q", "r", "b", "n"]).optional().describe("Promotion piece if a pawn reaches the last rank; defaults to q"),
    personConfirmed: z.boolean().describe("true when she asked for this move (required for actor elder)"),
    expectedRevision: ExpectedRevision,
  }),
  outputSchema: ChaupalResult,
  changeResource: sessionChange,
  mcpTool: true,
  run: async (args, ctx) => {
    if (args.actor === "elder" && !args.personConfirmed) {
      fail("Only move her pieces when she asked for that move.", { errorCode: "PERSON_CONFIRMATION_REQUIRED" });
    }
    const who = await sessionOf(ctx);
    try {
      const out = await playMove({
        ctx,
        who,
        from: args.from,
        to: args.to,
        promotion: args.promotion,
        actor: args.actor,
        via: args.actor === "elder" ? "voice" : "agent",
        spoken: args.spokenMove,
        expectedRevision: args.expectedRevision,
      });
      return respond(out.state, {
        moved: out.move,
        ply: out.ply,
        gameStatus: out.status,
        visibleOnHerScreen: out.visibleOnHerScreen,
        rulesValidated: true,
      });
    } catch (error) {
      await recordConflict(who, error, args.actor);
      throw error;
    }
  },
});
