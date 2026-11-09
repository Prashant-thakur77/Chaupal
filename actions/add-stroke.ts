import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";

import { ChaupalResult, sessionChange, mutationOptions, respond, sessionOf } from "../server/chaupal/kit.js";
import { mutate, newId } from "../server/chaupal/state.js";
import { schema } from "../server/db/index.js";

export default defineAction({
  description: "Save one stroke she drew on her own layer (touch or air). Agents never draw her strokes.",
  schema: z.object({
    layer: z.enum(["sulekh", "rangoli"]),
    points: z.array(z.array(z.number()).min(2).max(3)).min(2).max(2000),
    input: z.enum(["touch", "air"]).default("touch"),
  }),
  outputSchema: ChaupalResult,
  changeResource: sessionChange,
  agentTool: false,
  run: async ({ layer, points, input }, ctx) => {
    const who = await sessionOf(ctx);
    const { session } = who;
    const { state } = await mutate(
      { ...mutationOptions(ctx, who, "add-stroke"), actor: "elder" },
      async (tx, st) => {
        const refId = layer === "sulekh" ? st.calligraphyRefId : st.kolamRefId;
        if (!refId) fail("Nothing to trace yet.", { errorCode: "REFERENCE_NOT_READY" });
        const rounded = points.map((p) => p.map((v) => Math.round(v * 10000) / 10000));
        await tx.insert(schema.strokes).values({
          id: newId("stk"),
          sessionId: st.sessionId,
          ownerEmail: st.ownerEmail,
          layer,
          refId,
          points: JSON.stringify(rounded),
          author: "elder",
          input,
        });
        return { result: null, payload: { layer, n: points.length, input } };
      },
    );
    return respond(state, { strokeSaved: true });
  },
});
