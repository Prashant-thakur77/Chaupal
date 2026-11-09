import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { ChaupalResult, respond, sessionOf } from "../server/chaupal/kit.js";

export default defineAction({
  description:
    "Read the elder's live Chaupal session: which activity is open (sulekh calligraphy, rangoli, kolam, shatranj chess or home), the current calligraphy text, rangoli regions and colours, her stroke counts, the chess position and whose turn it is, family members linked, any pending choice or approval, the revision, and validNextActions. Read this before acting when you are unsure what is on her screen.",
  schema: z.object({}),
  outputSchema: ChaupalResult,
  http: { method: "GET" },
  mcpTool: true,
  readOnly: true,
  run: async (_args, ctx) => {
    const { state } = await sessionOf(ctx);
    return respond(state, {});
  },
});
