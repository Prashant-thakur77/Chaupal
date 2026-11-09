import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";

import { ChaupalResult, ExpectedRevision, mutationOptions, respond, sessionChange, sessionOf } from "../server/chaupal/kit.js";
import { planFills } from "../server/chaupal/kolam.js";
import { mutate, newId, parseJson } from "../server/chaupal/state.js";
import { schema } from "../server/db/index.js";
import { eq } from "drizzle-orm";

export default defineAction({
  description:
    "Colour parts of her rangoli or kolam, or change colours. Pass her own words as `phrase` (e.g. \"beech mein peela, bahar laal\" = yellow in the middle, red outside; Hindi, Hinglish, Tamil, Punjabi) and Chaupal maps them to exact regions, or pass fills by zone (center, ring-1…, outer, border, petal) or region id. Only those regions change; her traced lines and every other region stay. Parts it cannot place come back as unresolved: ask her, do not guess.",
  schema: z.object({
    phrase: z.string().max(200).optional().describe("Her words about colours"),
    fills: z
      .array(z.object({ zone: z.string().optional(), regionId: z.string().optional(), colour: z.string().describe("laal | peela | hara | neela | gulabi | kesariya | safed | jamuni | bhura") }))
      .max(40)
      .optional(),
    by: z.enum(["agent", "elder-voice", "elder-tap"]).default("agent").describe("Who asked: agent (on her spoken request) by default"),
    expectedRevision: ExpectedRevision,
  }),
  outputSchema: ChaupalResult,
  changeResource: sessionChange,
  mcpTool: true,
  run: async (args, ctx) => {
    if (!args.phrase && !args.fills?.length) fail("Say which part and which colour.", { errorCode: "FILL_REQUIRED" });
    const who = await sessionOf(ctx);
    const { state, result } = await mutate(mutationOptions(ctx, who, "fill-region", { expectedRevision: args.expectedRevision }), async (tx, st) => {
      if (!st.kolamRefId) fail("Open a rangoli or kolam first.", { errorCode: "DESIGN_NOT_READY" });
      const ref = (await tx.select().from(schema.kolamRefs).where(eq(schema.kolamRefs.id, st.kolamRefId!)).limit(1))[0]!;
      const params = parseJson(ref.params)!;
      const plan = planFills(params as never, { phrase: args.phrase, fills: args.fills });
      if (!plan.fills.length) {
        fail("Chaupal could not place that colour on this design.", {
          errorCode: "FILL_UNRESOLVED",
          details: { unresolved: plan.unresolved },
        });
      }
      for (const f of plan.fills) {
        await tx.insert(schema.fills).values({
          id: newId("fil"),
          sessionId: st.sessionId,
          ownerEmail: st.ownerEmail,
          kolamRefId: ref.id,
          regionId: f.regionId,
          colour: f.colour,
          by: args.by,
        });
      }
      return {
        result: { filled: plan.fills, changedRegions: plan.changed, unresolved: plan.unresolved },
        payload: { n: plan.fills.length, by: args.by },
      };
    });
    return respond(state, { ...result, herStrokesPreserved: true, otherRegionsUnchanged: true });
  },
});
