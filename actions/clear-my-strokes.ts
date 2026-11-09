import { defineAction, fail } from "@agent-native/core/action";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { ChaupalResult, ExpectedRevision, mutationOptions, respond, sessionOf } from "../server/chaupal/kit.js";
import { mutate, nowIso } from "../server/chaupal/state.js";
import { schema } from "../server/db/index.js";

export default defineAction({
  description:
    "Erase only her own drawn lines on the open canvas (\"sirf meri lakeerein mitao\"). The calligraphy reference, rangoli design and colours stay exactly as they are. Use only when she asks to erase her lines.",
  schema: z.object({
    personConfirmed: z.boolean().describe("true only when she asked to erase her own lines"),
    expectedRevision: ExpectedRevision,
  }),
  outputSchema: ChaupalResult,
  mcpTool: true,
  run: async ({ personConfirmed, expectedRevision }, ctx) => {
    if (!personConfirmed) fail("She has not asked to erase her lines.", { errorCode: "PERSON_CONFIRMATION_REQUIRED" });
    const { session } = await sessionOf(ctx);
    const { state, result } = await mutate(
      mutationOptions(ctx, session.id, "clear-my-strokes", { expectedRevision }),
      async (tx, st) => {
        const layer = st.scene === "sulekh" ? "sulekh" : st.scene === "rangoli" || st.scene === "kolam" ? "rangoli" : null;
        if (!layer) fail("No canvas is open.", { errorCode: "CANVAS_NOT_OPEN" });
        const cleared = await tx
          .update(schema.strokes)
          .set({ clearedAt: nowIso() })
          .where(and(eq(schema.strokes.sessionId, st.sessionId), eq(schema.strokes.layer, layer!), isNull(schema.strokes.clearedAt)))
          .returning({ id: schema.strokes.id });
        return { result: { layer, clearedStrokes: cleared.length }, payload: { layer, cleared: cleared.length } };
      },
    );
    return respond(state, {
      ...result,
      humanStrokeLayerCleared: true,
      referenceLayerPreserved: true,
      designAndColoursPreserved: true,
    });
  },
});
