import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { currentApproval } from "../server/chaupal/family-update.js";
import { ChaupalResult, mutationOptions, respond, sessionChange, sessionOf } from "../server/chaupal/kit.js";
import { mutate, nowIso, readActivity } from "../server/chaupal/state.js";
import { getDb } from "../server/db/index.js";

export default defineAction({
  description: "Cancel the waiting family update when she says not to send it (\"ruko, mat bhejo\"). Nothing is sent.",
  schema: z.object({}),
  outputSchema: ChaupalResult,
  changeResource: sessionChange,
  mcpTool: true,
  run: async (_args, ctx) => {
    const who = await sessionOf(ctx);
    const a = await currentApproval(who.session.id);
    if (!a || a.status !== "pending") {
      const st = (await readActivity(getDb(), who.session.id))!;
      return respond(st, { status: a?.status ?? "none", nothingSent: a?.status !== "sent" });
    }
    const { state } = await mutate(mutationOptions(ctx, who, "cancel-family-update"), async () => ({
      patch: { approval: JSON.stringify({ ...a, status: "declined", decidedAt: nowIso() }), presence: "ready" },
      result: null,
      payload: { id: a.id },
    }));
    return respond(state, { status: "declined", nothingSent: true });
  },
});
