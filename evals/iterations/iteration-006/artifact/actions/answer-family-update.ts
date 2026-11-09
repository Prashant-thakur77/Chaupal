import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";

import { currentApproval, deliverApproved } from "../server/chaupal/family-update.js";
import { ChaupalResult, mutationOptions, respond, sessionChange, sessionOf } from "../server/chaupal/kit.js";
import { mutate, nowIso, readActivity } from "../server/chaupal/state.js";
import { getDb } from "../server/db/index.js";

export default defineAction({
  description: "Her own answer on the family-update card: approve (send) or decline (send nothing).",
  schema: z.object({ id: z.string(), decision: z.enum(["approve", "decline"]) }),
  outputSchema: ChaupalResult,
  changeResource: sessionChange,
  uiOnly: true,
  run: async ({ id, decision }, ctx) => {
    const who = await sessionOf(ctx);
    const a = await currentApproval(who.session.id);
    if (!a || a.id !== id) fail("That update is no longer waiting.", { errorCode: "NO_FAMILY_UPDATE" });
    if (a!.status !== "pending") {
      const st = (await readActivity(getDb(), who.session.id))!;
      return respond(st, { status: a!.status });
    }
    await mutate({ ...mutationOptions(ctx, who, "answer-family-update"), actor: "elder" }, async () => ({
      patch: {
        approval: JSON.stringify({ ...a!, status: decision === "approve" ? "approved" : "declined", decidedAt: nowIso() }),
        presence: decision === "approve" ? "creating" : "ready",
      },
      result: null,
      payload: { id, decision },
    }));
    const final = decision === "approve" ? await deliverApproved(who.session.id) : null;
    const st = (await readActivity(getDb(), who.session.id))!;
    return respond(st, { status: final?.status ?? "declined" });
  },
});
