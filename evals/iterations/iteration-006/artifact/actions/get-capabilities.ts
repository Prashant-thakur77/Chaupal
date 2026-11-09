import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { ChaupalResult, respond, sessionOf } from "../server/chaupal/kit.js";
import { CAPABILITIES } from "../server/chaupal/capabilities.js";

export default defineAction({
  description:
    "Describe what Chaupal can do and its rules (activities, scripts and styles, rangoli colours, chess conventions, family sharing and privacy boundaries). Use only for capability questions or an unfamiliar request, not before a request that already matches an action.",
  schema: z.object({}),
  outputSchema: ChaupalResult,
  http: { method: "GET" },
  mcpTool: true,
  readOnly: true,
  run: async (_args, ctx) => {
    const { state } = await sessionOf(ctx);
    return respond(state, { capabilities: CAPABILITIES });
  },
});
