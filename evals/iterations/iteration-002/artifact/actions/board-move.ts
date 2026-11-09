import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { playMove } from "../server/chaupal/chess.js";
import { recordConflict } from "../server/chaupal/conflict.js";
import { ChaupalResult, respond, sessionChange, sessionOf } from "../server/chaupal/kit.js";

export default defineAction({
  description: "Her move made directly on the board by hand (drag or tap).",
  schema: z.object({
    from: z.string().regex(/^[a-h][1-8]$/),
    to: z.string().regex(/^[a-h][1-8]$/),
    via: z.enum(["drag", "tap"]),
    promotion: z.enum(["q", "r", "b", "n"]).optional(),
    expectedRevision: z.number().int().optional(),
  }),
  outputSchema: ChaupalResult,
  changeResource: sessionChange,
  agentTool: false,
  run: async (args, ctx) => {
    const who = await sessionOf(ctx);
    const actor = "elder" as const;
    try {
      const out = await playMove({
        ctx,
        who,
        from: args.from,
        to: args.to,
        promotion: args.promotion,
        actor,
        via: args.via,
        expectedRevision: args.expectedRevision,
      });
      return respond(out.state, { moved: out.move, ply: out.ply, gameStatus: out.status });
    } catch (error) {
      await recordConflict(who, error, actor);
      throw error;
    }
  },
});
