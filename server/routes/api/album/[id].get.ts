import { getSession } from "@agent-native/core/server";
import { and, eq } from "drizzle-orm";
import { createError, defineEventHandler, getRouterParam, setResponseHeader } from "h3";

import { getDb, schema } from "../../../db/index.js";
import { familyLinkIdOf, isFamilyGuest } from "../../../lib/guest.js";

/** One album picture as SVG, for the household that owns it (and its family link). */
export default defineEventHandler(async (event) => {
  const raw = String(getRouterParam(event, "id") ?? "").replace(/\.svg$/, "");
  const session = await getSession(event);
  if (!session?.email) throw createError({ statusCode: 401 });
  const row = (await getDb().select().from(schema.album).where(eq(schema.album.id, raw)).limit(1))[0];
  if (!row) throw createError({ statusCode: 404 });
  let allowed = row.ownerEmail === session.email;
  if (!allowed && isFamilyGuest(session.email)) {
    const link = (
      await getDb()
        .select()
        .from(schema.familyLinks)
        .where(and(eq(schema.familyLinks.id, familyLinkIdOf(session.email)), eq(schema.familyLinks.sessionId, row.sessionId)))
        .limit(1)
    )[0];
    allowed = Boolean(link && !link.revokedAt);
  }
  if (!allowed) throw createError({ statusCode: 404 });
  setResponseHeader(event, "content-type", "image/svg+xml; charset=utf-8");
  setResponseHeader(event, "cache-control", "private, max-age=3600");
  return row.svg;
});
