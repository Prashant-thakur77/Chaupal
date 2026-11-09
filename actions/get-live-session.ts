import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { sessionOf } from "../server/chaupal/kit.js";
import { buildSnapshot } from "../server/chaupal/snapshot.js";

export default defineAction({
  description: "Everything the screen draws: references, designs, strokes, fills, board, family and recent events.",
  schema: z.object({}),
  outputSchema: z.looseObject({ sessionId: z.string(), revision: z.number() }),
  http: { method: "GET" },
  agentTool: false,
  readOnly: true,
  run: async (_args, ctx) => {
    const who = await sessionOf(ctx, { allowFamily: true });
    const snap = await buildSnapshot(who.state);
    // Join links are the elder's to hand out; a family phone never sees them.
    const family =
      who.role === "family" ? snap.family.map(({ joinPath: _omit, ...f }) => f) : snap.family;
    return {
      ...snap,
      family,
      viewer: {
        role: who.role,
        name: who.role === "family" ? who.link!.name : null,
        familyRole: who.role === "family" ? who.link!.role : null,
      },
      language: who.session.language,
    };
  },
});
