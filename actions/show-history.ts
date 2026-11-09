import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { ChaupalResult, mutationOptions, respond, sessionOf } from "../server/chaupal/kit.js";
import { mutate } from "../server/chaupal/state.js";

export default defineAction({
  description:
    "Open or close the visible history panel beside the activity: past chess moves (who moved, in Hindi piece names) and recent works. It does not change the activity.",
  schema: z.object({
    open: z.boolean().default(true).describe("true opens the history panel, false closes it; defaults to true"),
  }),
  outputSchema: ChaupalResult,
  mcpTool: true,
  run: async ({ open }, ctx) => {
    const { session } = await sessionOf(ctx);
    const { state } = await mutate(
      mutationOptions(ctx, session.id, "show-history"),
      async () => ({ patch: { historyOpen: open ? 1 : 0 }, result: null }),
    );
    return respond(state, { historyOpen: open });
  },
});
