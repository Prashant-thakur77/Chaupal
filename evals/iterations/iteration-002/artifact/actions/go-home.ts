import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";

import { ChaupalResult, sessionChange, mutationOptions, respond, sessionOf } from "../server/chaupal/kit.js";
import { mutate } from "../server/chaupal/state.js";

export default defineAction({
  description:
    "Return her screen to the home view with the diya. Her saved works stay in the album; only do this when she asks to stop or go back.",
  schema: z.object({
    personConfirmed: z.boolean().describe("true only when she asked to go back home"),
  }),
  outputSchema: ChaupalResult,
  changeResource: sessionChange,
  mcpTool: true,
  run: async ({ personConfirmed }, ctx) => {
    const who = await sessionOf(ctx);
    const { session } = who;
    if (!personConfirmed) {
      fail("She has not asked to leave this activity.", { errorCode: "PERSON_CONFIRMATION_REQUIRED" });
    }
    const { state } = await mutate(
      mutationOptions(ctx, who, "go-home"),
      async () => ({
        patch: { scene: "home", inputMode: "none", pending: null, presence: "ready", caption: null, conflict: null },
        result: null,
      }),
    );
    return respond(state, {});
  },
});
