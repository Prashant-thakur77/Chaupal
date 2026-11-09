import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";

import { ChaupalResult, sessionChange, mutationOptions, respond, sessionOf } from "../server/chaupal/kit.js";
import { mutate } from "../server/chaupal/state.js";

export default defineAction({
  description:
    "Get her canvas ready for drawing with a finger or mouse (mode touch), with no camera at all. Placing a Sulekh reference, rangoli or kolam already does this (inputMode touch, camera never asked), so it is not needed right after those; use it when inputMode is none or air-writing is on and she wants to draw by hand or says the camera feels uncomfortable (it turns air-writing off). Mode none hides the drawing tools.",
  schema: z.object({
    mode: z.enum(["touch", "none"]).describe("touch (direct finger drawing, no camera) | none"),
  }),
  outputSchema: ChaupalResult,
  changeResource: sessionChange,
  mcpTool: true,
  run: async ({ mode }, ctx) => {
    const who = await sessionOf(ctx);
    const { session } = who;
    const { state } = await mutate(mutationOptions(ctx, who, "set-input-mode"), async (_tx, st) => {
      if (!["sulekh", "rangoli", "kolam"].includes(st.scene)) {
        fail("Open Sulekh, rangoli or kolam first.", { errorCode: "CANVAS_NOT_OPEN" });
      }
      return { patch: { inputMode: mode }, result: null, payload: { mode } };
    });
    return respond(state, {
      inputMode: mode,
      cameraUsed: false,
      drawingInputReady: mode === "touch",
    });
  },
});
