import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { ChaupalResult, sessionChange, mutationOptions, respond, sessionOf } from "../server/chaupal/kit.js";
import { mutate } from "../server/chaupal/state.js";

export default defineAction({
  description: "The page reports what her browser decided about the camera (her own gesture and permission).",
  schema: z.object({ mode: z.enum(["air", "air-denied", "touch", "none"]) }),
  outputSchema: ChaupalResult,
  changeResource: sessionChange,
  agentTool: false,
  run: async ({ mode }, ctx) => {
    const who = await sessionOf(ctx);
    const { session } = who;
    const { state } = await mutate(
      { ...mutationOptions(ctx, who, "report-input-mode"), actor: "elder" },
      async () => ({ patch: { inputMode: mode }, result: null, payload: { mode } }),
    );
    return respond(state, { inputMode: mode });
  },
});
