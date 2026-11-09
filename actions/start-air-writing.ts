import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";

import { ChaupalResult, mutationOptions, respond, sessionOf } from "../server/chaupal/kit.js";
import { mutate } from "../server/chaupal/state.js";

export default defineAction({
  description:
    "Turn on air-writing (tracing in the air with her hand, seen by the camera) only after she explicitly asked to write in the air. Her screen then shows a large button she taps herself to start the camera; her browser asks her for permission, which only she can grant. If she declines or the camera fails, touch drawing stays available. Never claim the camera is on or permitted.",
  schema: z.object({
    personExplicitlyAsked: z.boolean().describe("true only if she asked to write in the air / with the camera"),
  }),
  outputSchema: ChaupalResult,
  mcpTool: true,
  run: async ({ personExplicitlyAsked }, ctx) => {
    if (!personExplicitlyAsked) {
      fail("Air-writing needs her explicit request.", { errorCode: "EXPLICIT_REQUEST_REQUIRED" });
    }
    const { session } = await sessionOf(ctx);
    const { state } = await mutate(mutationOptions(ctx, session.id, "start-air-writing"), async (_tx, st) => {
      if (!["sulekh", "rangoli", "kolam"].includes(st.scene)) {
        fail("Open Sulekh, rangoli or kolam first.", { errorCode: "CANVAS_NOT_OPEN" });
      }
      if (st.scene === "sulekh" && !st.calligraphyRefId) {
        fail("Place a calligraphy reference first.", { errorCode: "REFERENCE_NOT_READY" });
      }
      return { patch: { inputMode: "air-requested" }, result: null };
    });
    return respond(state, {
      inputMode: "air-requested",
      cameraStartsOnlyAfterHerTap: true,
      browserPermissionRemainsHers: true,
      denialFallsBackToTouch: true,
    });
  },
});
