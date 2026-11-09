import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { ChaupalResult, mutationOptions, respond, sessionChange, sessionOf } from "../server/chaupal/kit.js";
import { mutate } from "../server/chaupal/state.js";

export default defineAction({
  description: "Close the friendly 'moved first' card.",
  schema: z.object({}),
  outputSchema: ChaupalResult,
  changeResource: sessionChange,
  agentTool: false,
  run: async (_args, ctx) => {
    const who = await sessionOf(ctx);
    const { state } = await mutate(
      { ...mutationOptions(ctx, who, "dismiss-conflict"), quiet: true, actor: "elder" },
      async () => ({ patch: { conflict: null }, result: null }),
    );
    return respond(state, {});
  },
});
