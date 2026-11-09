import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { ChaupalResult, mutationOptions, respond, sessionOf } from "../server/chaupal/kit.js";
import { getDb, schema } from "../server/db/index.js";
import { mutate, nowIso } from "../server/chaupal/state.js";
import { eq } from "drizzle-orm";

export const LANGUAGES = ["hi", "en", "pa", "ta", "mr", "bn"] as const;

export default defineAction({
  description:
    "Switch the screen language: hi (Hindi), en (English), pa (Punjabi), ta (Tamil), mr (Marathi) or bn (Bengali). It never changes her calligraphy text, rangoli or board.",
  schema: z.object({
    language: z.enum(LANGUAGES).describe("hi | en | pa | ta | mr | bn"),
  }),
  outputSchema: ChaupalResult,
  mcpTool: true,
  run: async ({ language }, ctx) => {
    const { session } = await sessionOf(ctx);
    await getDb()
      .update(schema.sessions)
      .set({ language, updatedAt: nowIso() })
      .where(eq(schema.sessions.id, session.id));
    const { state } = await mutate(
      mutationOptions(ctx, session.id, "set-language"),
      async () => ({ result: null, payload: { language } }),
    );
    return respond(state, { language, boardUnchanged: true });
  },
});
