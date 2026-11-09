// Netlify background function (runs up to 15 minutes): the framework's
// release migrations, for when no machine that can reach the database is
// available to run `pnpm migrate:production`. Operator secret required.
import { closeDbExec, withMigrationExecutionRuntime, withMigrationRuntime } from "@agent-native/core/db";
import { runFrameworkReleaseMigrations } from "@agent-native/core/server";

export default async (request) => {
  if (!process.env.A2A_SECRET || request.headers.get("x-chaupal-ops") !== process.env.A2A_SECRET) {
    return new Response("Not found", { status: 404 });
  }
  const started = Date.now();
  try {
    await withMigrationExecutionRuntime(() => withMigrationRuntime(() => runFrameworkReleaseMigrations(null)));
    console.log(`[chaupal] release migrations done in ${Date.now() - started} ms`);
  } catch (error) {
    console.error("[chaupal] release migrations failed", error);
  } finally {
    await closeDbExec().catch(() => {});
  }
  return new Response("ok");
};
