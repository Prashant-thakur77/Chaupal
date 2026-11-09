import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { suggestDesigns } from "../server/chaupal/kolam-suggest.js";
import { ChaupalResult, mutationOptions, respond, sessionChange, sessionOf } from "../server/chaupal/kit.js";
import { mutate } from "../server/chaupal/state.js";

export default defineAction({
  description:
    "Show her 2–3 rangoli or kolam choices on screen (only when she asks for ideas). Pass festival only if she named it; never assume one. Returns the options with their parameters; wait for her choice, then call set-kolam-reference or set-rangoli-reference with that option's parameters.",
  schema: z.object({
    festival: z.enum(["diwali", "pongal", "onam", "lohri", "navratri"]).optional(),
    small: z.boolean().optional().describe("true for a small design (e.g. for the doorstep)"),
  }),
  outputSchema: ChaupalResult,
  changeResource: sessionChange,
  mcpTool: true,
  run: async ({ festival, small }, ctx) => {
    const who = await sessionOf(ctx);
    const options = suggestDesigns({ festival, small });
    const { state } = await mutate(mutationOptions(ctx, who, "suggest-designs"), async () => ({
      patch: {
        scene: options[0]?.params.kind === "pulli" && !festival ? "kolam" : "rangoli",
        pending: JSON.stringify({
          kind: "design-choice",
          options: options.map((o) => ({ text: o.labelHi, meaningEn: o.labelEn })),
        }),
        presence: "awaiting",
      },
      result: null,
      payload: { n: options.length, festival: festival ?? null },
    }));
    return respond(state, {
      options: options.map((o) => ({ labelHi: o.labelHi, labelEn: o.labelEn, params: o.params })),
      choicesShown: true,
      nextStep: "Wait for her choice, then set the design she chose.",
    });
  },
});
