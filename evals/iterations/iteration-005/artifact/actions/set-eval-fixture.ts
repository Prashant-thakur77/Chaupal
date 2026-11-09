import { defineAction, fail } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { sessionOf } from "../server/chaupal/kit.js";
import { getDb, schema } from "../server/db/index.js";

export default defineAction({
  description: "Evaluation harness only: arm a one-time faulty render to test repair, or reset the household. Disabled unless CHAUPAL_EVAL=1.",
  schema: z.object({
    sulekh: z.enum(["broken-shaping", "opaque", "wrong-ratio"]).nullable().optional(),
    reset: z.boolean().optional(),
  }),
  outputSchema: z.object({ ok: z.boolean() }),
  agentTool: false,
  mcpTool: false,
  run: async ({ sulekh, reset }, ctx) => {
    if (process.env.CHAUPAL_EVAL !== "1") fail("Not available.", { errorCode: "NOT_AVAILABLE", statusCode: 404 });
    const who = await sessionOf(ctx);
    if (reset) {
      await getDb()
        .update(schema.activityState)
        .set({
          scene: "home",
          presence: "ready",
          caption: null,
          inputMode: "none",
          pending: null,
          historyOpen: 0,
          calligraphyRefId: null,
          kolamRefId: null,
          chessGameId: null,
          conflict: null,
          approval: null,
          fixture: null,
        })
        .where(eq(schema.activityState.sessionId, who.session.id));
      await getDb().update(schema.sessions).set({ language: "hi" }).where(eq(schema.sessions.id, who.session.id));
    }
    if (sulekh !== undefined) {
      await getDb()
        .update(schema.activityState)
        .set({ fixture: sulekh ? JSON.stringify({ sulekh, remaining: 1 }) : null })
        .where(eq(schema.activityState.sessionId, who.session.id));
    }
    return { ok: true };
  },
});
