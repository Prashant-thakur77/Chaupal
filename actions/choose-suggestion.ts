import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";

import { ChaupalResult, sessionChange, mutationOptions, respond, sessionOf } from "../server/chaupal/kit.js";
import { mutate, parseJson } from "../server/chaupal/state.js";

export default defineAction({
  description: "Her tap on one of the phrase or design choices shown on screen.",
  schema: z.object({ text: z.string().min(1).max(60) }),
  outputSchema: ChaupalResult,
  changeResource: sessionChange,
  agentTool: false,
  run: async ({ text }, ctx) => {
    const who = await sessionOf(ctx);
    const { session } = who;
    const { state } = await mutate(
      { ...mutationOptions(ctx, who, "choose-suggestion"), actor: "elder" },
      async (_tx, st) => {
        const pending = parseJson<{ options?: { text: string }[] } & Record<string, unknown>>(st.pending);
        if (!pending?.options?.some((o) => o.text === text)) {
          fail("That choice is not on screen any more.", { errorCode: "CHOICE_NOT_AVAILABLE" });
        }
        return {
          patch: { pending: JSON.stringify({ ...pending, chosen: text }), presence: "creating" },
          result: null,
          payload: { chosen: text },
        };
      },
    );
    return respond(state, { chosen: text });
  },
});
