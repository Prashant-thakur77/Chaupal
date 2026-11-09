import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { ChaupalResult, mutationOptions, respond, sessionOf } from "../server/chaupal/kit.js";
import { mutate } from "../server/chaupal/state.js";

export default defineAction({
  description:
    "Set the living diya's phase on her screen: ready, listening, creating, speaking or awaiting (waiting for her). The page never receives audio or transcripts, only this coarse phase and an optional short caption.",
  schema: z.object({
    phase: z
      .enum(["ready", "listening", "receiving", "creating", "speaking", "awaiting"])
      .describe("Diya phase: ready | listening | receiving | creating | speaking | awaiting"),
    caption: z.string().max(180).optional().describe("Optional short line shown under the diya, in her language"),
  }),
  outputSchema: ChaupalResult,
  mcpTool: true,
  run: async ({ phase, caption }, ctx) => {
    const { session } = await sessionOf(ctx);
    const { state } = await mutate(
      mutationOptions(ctx, session.id, "project-presence", { quiet: true }),
      async () => ({
        patch: { presence: phase, ...(caption !== undefined ? { caption } : {}) },
        result: null,
        payload: { phase },
      }),
    );
    return respond(state, { phase });
  },
});
