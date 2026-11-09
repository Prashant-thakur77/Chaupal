import type { ActionRunContext } from "@agent-native/core/action";
import { z } from "zod";

import { agentView, buildSnapshot } from "./snapshot.js";
import { callerOf, DEV_OWNER, ensureSession, type MutationOptions } from "./state.js";

/** Every Chaupal result carries the live revision and what can happen next. */
export const ChaupalResult = z.looseObject({
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

export function ownerOf(ctx?: ActionRunContext): string {
  return ctx?.userEmail || DEV_OWNER;
}

export async function sessionOf(ctx?: ActionRunContext) {
  return ensureSession(ownerOf(ctx));
}

export function mutationOptions(
  ctx: ActionRunContext | undefined,
  sessionId: string,
  type: string,
  extra: Partial<MutationOptions> = {},
): MutationOptions {
  const caller = callerOf(ctx);
  return {
    sessionId,
    ownerEmail: ownerOf(ctx),
    actor: caller === "ui" ? "elder" : "agent",
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
  return { ...view, ...extra, revision: snap.revision, scene: snap.scene, validNextActions: snap.validNextActions };
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
