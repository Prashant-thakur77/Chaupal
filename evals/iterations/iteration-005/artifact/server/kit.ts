import { fail, type ActionRunContext } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../db/index.js";
import { familyLinkIdOf, isFamilyGuest } from "../lib/guest.js";
import { agentView, buildSnapshot } from "./snapshot.js";
import {
  callerOf,
  DEV_OWNER,
  ensureSession,
  type MutationOptions,
  readActivity,
} from "./state.js";

/** Every Chaupal result carries the live revision and what can happen next. */
export const ChaupalResult = z.looseObject({
  sessionId: z.string(),
  revision: z.number(),
  scene: z.string(),
  validNextActions: z.array(z.string()),
});

export const ExpectedRevision = z
  .number()
  .int()
  .optional()
  .describe(
    "The `revision` from your last read (any Chaupal result). If someone else changed the session since, the call fails with errorCode save_conflict and nothing changes: re-read with get-session-state and decide again.",
  );

/** Tells every device that can see this household that it changed. */
export const sessionChange = (_input: unknown, result: { sessionId?: string } | undefined) =>
  result?.sessionId ? { resourceType: "chaupal-session", resourceId: result.sessionId } : null;

export type Who = Awaited<ReturnType<typeof sessionOf>>;

/**
 * Resolve the household for this caller. The elder (and her agent, MCP or
 * WebMCP callers acting as her) own their session; a family guest reaches
 * only the one session their link was made for, and only through actions
 * that allow family.
 */
export async function sessionOf(
  ctx?: ActionRunContext,
  opts: { allowFamily?: boolean } = {},
) {
  const email = ctx?.userEmail || DEV_OWNER;
  if (isFamilyGuest(email)) {
    if (!opts.allowFamily) {
      fail("Family members can watch and play their side; this needs the elder herself.", {
        errorCode: "FAMILY_NOT_ALLOWED",
        statusCode: 403,
      });
    }
    const linkId = familyLinkIdOf(email);
    const link = (
      await getDb().select().from(schema.familyLinks).where(eq(schema.familyLinks.id, linkId)).limit(1)
    )[0];
    if (!link || link.revokedAt) {
      fail("This family link is no longer active.", { errorCode: "FAMILY_LINK_REVOKED", statusCode: 403 });
    }
    const session = (
      await getDb().select().from(schema.sessions).where(eq(schema.sessions.id, link!.sessionId)).limit(1)
    )[0]!;
    const state = (await readActivity(getDb(), session.id))!;
    return { session, state, role: "family" as const, link: link!, email };
  }
  const { session, state } = await ensureSession(email);
  return { session, state, role: "elder" as const, link: null, email };
}

export function mutationOptions(
  ctx: ActionRunContext | undefined,
  who: Who,
  type: string,
  extra: Partial<MutationOptions> = {},
): MutationOptions {
  const caller = who.role === "family" ? "family" : callerOf(ctx);
  return {
    sessionId: who.session.id,
    ownerEmail: who.session.ownerEmail,
    actor: who.role === "family" ? "family" : caller === "ui" ? "elder" : "agent",
    caller,
    type,
    ...extra,
  };
}

/** Compact, agent-facing view of the current session plus extras. */
export async function respond<T extends Record<string, unknown>>(
  state: Parameters<typeof buildSnapshot>[0],
  extra: T,
) {
  const snap = await buildSnapshot(state);
  const view = agentView(snap);
  return {
    ...view,
    ...extra,
    sessionId: snap.sessionId,
    revision: snap.revision,
    scene: snap.scene,
    validNextActions: snap.validNextActions,
  };
}

/**
 * Longest a single call may hold while waiting for her (a tap, a move, an
 * answer). Hosts with short request limits set CHAUPAL_MAX_WAIT_MS; the
 * caller then simply asks again.
 */
export function maxWaitMs(wanted: number) {
  const cap = Number(process.env.CHAUPAL_MAX_WAIT_MS || 0);
  return cap > 0 ? Math.min(wanted, cap) : wanted;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { DEV_OWNER };
