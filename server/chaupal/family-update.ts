import { fail } from "@agent-native/core/action";
import { eq } from "drizzle-orm";

import { getDb, schema } from "../db/index.js";
import type { Who } from "./kit.js";
import { buildSnapshot } from "./snapshot.js";
import { composeArtwork } from "./compose.js";
import { newId, nowIso, parseJson, readActivity } from "./state.js";
import { sendTelegramPhoto } from "./telegram.js";

export interface Approval {
  id: string;
  status: "pending" | "approved" | "declined" | "sent" | "failed";
  captionHi: string;
  captionEn: string;
  kind: string;
  albumId: string;
  imagePath: string;
  to: string;
  reason?: string;
  telegramMessageId?: number;
  decidedAt?: string;
}

export async function currentApproval(sessionId: string): Promise<Approval | null> {
  const st = await readActivity(getDb(), sessionId);
  return parseJson<Approval>(st?.approval);
}

/** Save what is on her screen to the album and return the album row id. */
export async function saveCurrentArtwork(who: Who) {
  const st = (await readActivity(getDb(), who.session.id))!;
  const snap = await buildSnapshot(st);
  const art = composeArtwork(snap);
  if (!art) fail("There is nothing on her screen to save yet.", { errorCode: "NOTHING_TO_SAVE" });
  const id = newId("alb");
  await getDb().insert(schema.album).values({
    id,
    sessionId: who.session.id,
    ownerEmail: who.session.ownerEmail,
    kind: art!.kind,
    title: art!.title,
    svg: art!.svg,
    refId: st.calligraphyRefId ?? st.kolamRefId ?? st.chessGameId,
  });
  return { id, kind: art!.kind, title: art!.title };
}

/**
 * Carry out an approved update. Only reachable after her own approval (her
 * card or voice in her UI), or the framework's approval gate on the agent's
 * send. A declined or failed update is never sent.
 */
export async function deliverApproved(sessionId: string): Promise<Approval> {
  const a = await currentApproval(sessionId);
  if (!a) fail("There is no family update waiting.", { errorCode: "NO_FAMILY_UPDATE" });
  if (a!.status === "sent") return a!;
  if (a!.status !== "approved") {
    fail("She has not approved this update.", { errorCode: "NOT_APPROVED", details: { status: a!.status } });
  }
  const art = (await getDb().select().from(schema.album).where(eq(schema.album.id, a!.albumId)).limit(1))[0];
  const result = art ? await sendTelegramPhoto(art.svg, a!.captionHi) : { ok: false as const, reason: "artwork_missing" };
  const next: Approval = result.ok
    ? { ...a!, status: "sent", telegramMessageId: result.messageId, decidedAt: nowIso() }
    : { ...a!, status: "failed", reason: result.reason, decidedAt: nowIso() };
  await getDb()
    .update(schema.activityState)
    .set({ approval: JSON.stringify(next), presence: "ready", updatedAt: nowIso() })
    .where(eq(schema.activityState.sessionId, sessionId));
  if (result.ok && art) {
    await getDb().update(schema.album).set({ sharedAt: nowIso() }).where(eq(schema.album.id, art.id));
  }
  await getDb().insert(schema.events).values({
    id: newId("evt"),
    sessionId,
    ownerEmail: art?.ownerEmail ?? "",
    type: result.ok ? "family-update-sent" : "family-update-failed",
    actor: "system",
    caller: "telegram",
    ok: result.ok ? 1 : 0,
    errorCode: result.ok ? null : result.reason,
    payload: JSON.stringify({ approvalId: a!.id, to: a!.to }),
  });
  return next;
}
