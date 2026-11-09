import { defineAction } from "@agent-native/core/action";
import { embedRoute } from "@agent-native/core";
import { z } from "zod";

import { ChaupalResult, respond, sessionOf } from "../server/chaupal/kit.js";

export default defineAction({
  description:
    "Show the household's live Chaupal activity (the shatranj board, the Sulekh reference or the rangoli) as an inline card inside the chat host (an MCP App). It updates live as moves and strokes happen. Read-only.",
  schema: z.object({}),
  outputSchema: ChaupalResult,
  http: { method: "GET" },
  mcpTool: true,
  readOnly: true,
  ...embedRoute({
    title: "Chaupal · live",
    openLabel: "Open Chaupal",
    description: "The live board or artwork from her Chaupal session.",
    path: () => "/embed/live",
    height: 620,
  }),
  run: async (_args, ctx) => {
    const who = await sessionOf(ctx, { allowFamily: true });
    return respond(who.state, { cardPath: "/embed/live" });
  },
});
