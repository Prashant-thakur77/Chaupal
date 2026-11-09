import { defineAction } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { currentApproval, deliverApproved } from "../server/chaupal/family-update.js";
import { ChaupalResult, respond, sessionChange, sessionOf } from "../server/chaupal/kit.js";
import { DEV_OWNER, ensureSession, readActivity } from "../server/chaupal/state.js";
import { getDb, schema } from "../server/db/index.js";
import { isFamilyGuest } from "../server/lib/guest.js";

/** True once she has said yes on her own screen. */
async function approvedByHer(email: string | undefined) {
  if (isFamilyGuest(email)) return false;
  const { session } = await ensureSession(email || DEV_OWNER);
  const a = await currentApproval(session.id);
  return a?.status === "approved" || a?.status === "sent";
}

export default defineAction({
  description:
    "Send the drafted family update (from draft-family-update) to the family's Telegram chat. It needs her approval: if she has not said yes on her screen, the call pauses for approval and nothing leaves. If she declined, nothing is ever sent. Returns status.",
  schema: z.object({}),
  outputSchema: ChaupalResult,
  changeResource: sessionChange,
  mcpTool: true,
  needsApproval: async (_args, ctx) => !(await approvedByHer(ctx?.userEmail)),
  run: async (_args, ctx) => {
    const who = await sessionOf(ctx);
    const a = await currentApproval(who.session.id);
    if (a && a.status === "pending" && ctx?.approvedToolCallKey) {
      // Approved through the framework's own approval gate (her tap on Approve).
      await getDb()
        .update(schema.activityState)
        .set({ approval: JSON.stringify({ ...a, status: "approved" }) })
        .where(eq(schema.activityState.sessionId, who.session.id));
    }
    const final = await deliverApproved(who.session.id);
    const st = (await readActivity(getDb(), who.session.id))!;
    return respond(st, { status: final.status, sent: final.status === "sent", failureReason: final.reason ?? null });
  },
});
