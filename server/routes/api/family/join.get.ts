import { and, eq, isNull } from "drizzle-orm";
import { createError, defineEventHandler, getQuery, sendRedirect } from "h3";

import { getDb, schema } from "../../../db/index.js";
import { familyGuestEmail, setGuestCookie } from "../../../lib/guest.js";

/**
 * The family share link. It checks the invite, gives this phone a guest
 * session tied to that one invite, and opens the live family view.
 */
export default defineEventHandler(async (event) => {
  const token = String(getQuery(event).t ?? "");
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) {
    throw createError({ statusCode: 404, statusMessage: "This link is not valid." });
  }
  const link = (
    await getDb()
      .select()
      .from(schema.familyLinks)
      .where(and(eq(schema.familyLinks.token, token), isNull(schema.familyLinks.revokedAt)))
      .limit(1)
  )[0];
  if (!link) throw createError({ statusCode: 404, statusMessage: "This link has expired." });
  setGuestCookie(event, familyGuestEmail(link.id));
  await getDb()
    .update(schema.familyLinks)
    .set({ lastSeenAt: new Date().toISOString() })
    .where(eq(schema.familyLinks.id, link.id));
  return sendRedirect(event, "/family", 302);
});
