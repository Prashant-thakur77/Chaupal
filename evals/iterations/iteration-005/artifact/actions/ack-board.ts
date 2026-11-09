import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { sessionOf } from "../server/chaupal/kit.js";
import { newId } from "../server/chaupal/state.js";
import { getDb, schema } from "../server/db/index.js";

export default defineAction({
  description: "Her board reports that it finished drawing a move, so a waiting move call can return.",
  schema: z.object({ gameId: z.string(), ply: z.number().int().min(1) }),
  outputSchema: z.object({ ok: z.boolean() }),
  agentTool: false,
  changeEvents: false,
  run: async ({ gameId, ply }, ctx) => {
    const who = await sessionOf(ctx);
    await getDb().insert(schema.events).values({
      id: newId("evt"),
      sessionId: who.session.id,
      ownerEmail: who.session.ownerEmail,
      type: "board-animated",
      actor: "elder",
      caller: "ui",
      payload: JSON.stringify({ gameId, ply }),
    });
    return { ok: true };
  },
});
