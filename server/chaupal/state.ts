import { fail } from "@agent-native/core/action";
import { saveConflict, saveIfCurrent } from "@agent-native/core/save-conflict/server";
import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { getDb, schema } from "../db/index.js";
import { validNextActions } from "./valid-actions.js";

export type Scene = "home" | "sulekh" | "rangoli" | "kolam" | "shatranj";
export const SCENES: Scene[] = ["home", "sulekh", "rangoli", "kolam", "shatranj"];
export type Presence =
  | "ready"
  | "listening"
  | "receiving"
  | "creating"
  | "speaking"
  | "awaiting";
export type InputMode =
  | "none"
  | "touch"
  | "air-requested"
  | "air"
  | "air-denied";
export type Actor = "elder" | "agent" | "family" | "system";

export type ActivityRow = typeof schema.activityState.$inferSelect;
type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;

export const DEV_OWNER = "dev@local.test";

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function parseJson<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/** Who is calling, as recorded in the event log. */
export function callerOf(ctx?: { caller?: unknown; networkProtocol?: string }):
  | "ui"
  | "agent"
  | "mcp"
  | "http"
  | "family"
  | "cli" {
  if (ctx?.networkProtocol === "mcp") return "mcp";
  const caller = typeof ctx?.caller === "string" ? ctx.caller : "";
  if (caller.includes("agent")) return "agent";
  if (caller.includes("frontend") || caller.includes("ui")) return "ui";
  if (caller.includes("cli")) return "cli";
  if (caller.includes("mcp")) return "mcp";
  return "http";
}

/**
 * Every household has one Chaupal session. The elder's signed-in identity
 * owns it; family members reach it only through a share token.
 */
export async function ensureSession(ownerEmail: string) {
  const db = getDb();
  const existing = await db
    .select()
    .from(schema.sessions)
    .where(eq(schema.sessions.ownerEmail, ownerEmail))
    .orderBy(desc(schema.sessions.createdAt))
    .limit(1);
  if (existing[0]) {
    const state = await readActivity(db, existing[0].id);
    if (state) return { session: existing[0], state };
  }
  const id = existing[0]?.id ?? newId("ses");
  if (!existing[0]) {
    await db.insert(schema.sessions).values({ id, ownerEmail });
  }
  await db
    .insert(schema.activityState)
    .values({ sessionId: id, ownerEmail })
    .onConflictDoNothing();
  const session = (
    await db.select().from(schema.sessions).where(eq(schema.sessions.id, id))
  )[0]!;
  const state = (await readActivity(db, id))!;
  return { session, state };
}

export async function readActivity(db: DbOrTx, sessionId: string) {
  const rows = await db
    .select()
    .from(schema.activityState)
    .where(eq(schema.activityState.sessionId, sessionId))
    .limit(1);
  return rows[0] ?? null;
}

export async function sessionForOwner(ownerEmail: string | undefined) {
  return ensureSession(ownerEmail || DEV_OWNER);
}

export interface MutationOptions {
  sessionId: string;
  ownerEmail: string;
  actor: Actor;
  caller: string;
  type: string;
  /** The revision the caller last read. Omit for direct person input. */
  expectedRevision?: number | undefined;
  /** Do not bump the revision (read-like changes such as language). */
  quiet?: boolean;
}

export type StatePatch = Partial<
  Omit<ActivityRow, "sessionId" | "ownerEmail" | "revision" | "updatedAt">
>;

/**
 * The one write path. It reads the session row, checks the caller's revision
 * through the framework's saveIfCurrent (compare-and-set on `revision`), runs
 * the mutation in the same transaction, bumps the revision and logs the event.
 * A stale caller gets the framework's typed `save_conflict` with the current
 * state, and nothing is written.
 */
export async function mutate<T>(
  opts: MutationOptions,
  fn: (
    tx: Tx,
    state: ActivityRow,
  ) => Promise<{ patch?: StatePatch; result: T; payload?: unknown }>,
): Promise<{ revision: number; result: T; state: ActivityRow }> {
  const db = getDb();
  try {
    return await db.transaction(async (tx) => {
      const before = await readActivity(tx, opts.sessionId);
      if (!before) fail("Session not found", { errorCode: "SESSION_NOT_FOUND" });
      // A caller acting on an old read is refused before anything else runs.
      if (opts.expectedRevision !== undefined && opts.expectedRevision !== before!.revision) {
        throw saveConflict("chaupal_activity_state", publicState(before!), String(before!.revision));
      }
      const { result, patch, payload } = await fn(tx, before!);
      const nextRevision = opts.quiet ? before!.revision : before!.revision + 1;
      const { current } = await saveIfCurrent({
        record: "chaupal_activity_state",
        expectedRevision:
          opts.expectedRevision === undefined
            ? String(before!.revision)
            : String(opts.expectedRevision),
        isSameSave: () => false,
        read: async () => {
          const row = await readActivity(tx, opts.sessionId);
          return {
            value: row!,
            revision: row ? String(row.revision) : null,
          };
        },
        write: async (cur) =>
          tx
            .update(schema.activityState)
            .set({ ...(patch ?? {}), revision: nextRevision, updatedAt: nowIso() })
            .where(
              and(
                eq(schema.activityState.sessionId, opts.sessionId),
                eq(schema.activityState.revision, Number(cur.revision)),
              ),
            )
            .returning({ revision: schema.activityState.revision }),
      });
      void current;
      await tx.insert(schema.events).values({
        id: newId("evt"),
        sessionId: opts.sessionId,
        ownerEmail: opts.ownerEmail,
        type: opts.type,
        actor: opts.actor,
        caller: opts.caller,
        revisionBefore: before!.revision,
        revisionAfter: nextRevision,
        ok: 1,
        payload: payload === undefined ? null : JSON.stringify(payload).slice(0, 4000),
      });
      const after = (await readActivity(tx, opts.sessionId))!;
      return { revision: nextRevision, result, state: after };
    });
  } catch (error) {
    await logFailure(opts, error);
    throw error;
  }
}

function publicState(row: ActivityRow) {
  return {
    revision: row.revision,
    scene: row.scene,
    inputMode: row.inputMode,
    historyOpen: row.historyOpen === 1,
    hasCalligraphyReference: Boolean(row.calligraphyRefId),
    hasDesign: Boolean(row.kolamRefId),
    chessGameId: row.chessGameId,
  };
}

/** Failed attempts are evidence too (rejections, conflicts, illegal moves). */
export async function logFailure(opts: MutationOptions, error: unknown) {
  try {
    const db = getDb();
    const state = await readActivity(db, opts.sessionId);
    const code =
      (error as { errorCode?: string })?.errorCode ??
      (error as { code?: string })?.code ??
      "ERROR";
    await db.insert(schema.events).values({
      id: newId("evt"),
      sessionId: opts.sessionId,
      ownerEmail: opts.ownerEmail,
      type: opts.type,
      actor: opts.actor,
      caller: opts.caller,
      revisionBefore: state?.revision ?? null,
      revisionAfter: state?.revision ?? null,
      ok: 0,
      errorCode: String(code).slice(0, 120),
      payload: JSON.stringify({
        message: error instanceof Error ? error.message.slice(0, 400) : String(error),
      }),
    });
  } catch {
    // Logging must never mask the original failure.
  }
}

export async function recentEvents(sessionId: string, limit = 30) {
  return getDb()
    .select()
    .from(schema.events)
    .where(eq(schema.events.sessionId, sessionId))
    .orderBy(desc(schema.events.createdAt))
    .limit(limit);
}

export async function activeStrokes(sessionId: string, layer: string) {
  return getDb()
    .select()
    .from(schema.strokes)
    .where(
      and(
        eq(schema.strokes.sessionId, sessionId),
        eq(schema.strokes.layer, layer),
        isNull(schema.strokes.clearedAt),
      ),
    )
    .orderBy(schema.strokes.createdAt)
    .limit(400);
}

export async function strokeCounts(sessionId: string) {
  const rows = await getDb()
    .select({ layer: schema.strokes.layer, n: sql<number>`count(*)::int` })
    .from(schema.strokes)
    .where(
      and(eq(schema.strokes.sessionId, sessionId), isNull(schema.strokes.clearedAt)),
    )
    .groupBy(schema.strokes.layer);
  const out: Record<string, number> = { sulekh: 0, rangoli: 0 };
  for (const r of rows) out[r.layer] = Number(r.n);
  return out;
}

export { validNextActions };
