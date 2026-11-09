import { withMigrationExecutionRuntime, withMigrationRuntime } from "@agent-native/core/db";
import { runAppReleaseMigrations, runFrameworkReleaseMigrations } from "@agent-native/core/server";
import { createError, defineEventHandler, getRequestHeader } from "h3";

/**
 * Operations only: runs the same release migrations as `pnpm migrate:production`
 * from inside the deployment, for networks that cannot reach the database
 * directly. Requires the deployment's own A2A_SECRET; it changes schema only.
 */
export default defineEventHandler(async (event) => {
  const secret = process.env.A2A_SECRET;
  if (!secret || getRequestHeader(event, "x-chaupal-ops") !== secret) {
    throw createError({ statusCode: 404 });
  }
  const started = Date.now();
  try {
    await withMigrationExecutionRuntime(() =>
      withMigrationRuntime(async () => {
        await runFrameworkReleaseMigrations(null);
        await runAppReleaseMigrations();
      }),
    );
  } catch (error) {
    // Only the deployment's operator reaches this branch.
    return { ok: false, error: error instanceof Error ? `${error.message}\n${error.stack ?? ""}`.slice(0, 2000) : String(error) };
  }
  return { ok: true, ms: Date.now() - started };
});
