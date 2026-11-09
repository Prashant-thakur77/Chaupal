import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { playMove } from "../server/chaupal/chess.js";
import { recordConflict } from "../server/chaupal/conflict.js";
import { ChaupalResult, ExpectedRevision, respond, sessionChange, sessionOf } from "../server/chaupal/kit.js";

export default defineAction({
  description:
    "The invited family member plays their own side of the shared board (from their phone link). Only callable by that family member; the elder's agent never moves for them.",
  schema: z.object({
    from: z.string().regex(/^[a-h][1-8]$/).describe("From square, e.g. e7"),
    to: z.string().regex(/^[a-h][1-8]$/).describe("To square, e.g. e5"),
    promotion: z.enum(["q", "r", "b", "n"]).optional(),
    expectedRevision: ExpectedRevision,
  }),
  outputSchema: ChaupalResult,
  changeResource: sessionChange,
  mcpTool: true,
  run: async (args, ctx) => {
    const who = await sessionOf(ctx, { allowFamily: true });
    if (who.role !== "family") {
      const { fail } = await import("@agent-native/core/action");
      fail("Only the invited family member plays this side.", { errorCode: "FAMILY_ONLY", statusCode: 403 });
    }
    try {
      const out = await playMove({
        ctx,
        who,
        from: args.from,
        to: args.to,
        promotion: args.promotion,
        actor: "family",
        via: "family",
        expectedRevision: args.expectedRevision,
      });
      return respond(out.state, { moved: out.move, ply: out.ply, gameStatus: out.status });
    } catch (error) {
      await recordConflict(who, error, "family");
      throw error;
    }
  },
});
