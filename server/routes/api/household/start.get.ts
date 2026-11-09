import { defineEventHandler, getQuery, sendRedirect } from "h3";

import { elderGuestEmail, guestSession, setGuestCookie } from "../../../lib/guest.js";

/** Start a household without an account: one tap from the welcome page. */
export default defineEventHandler(async (event) => {
  const existing = await guestSession(event);
  if (!existing || existing.email.startsWith("family-")) {
    setGuestCookie(event, elderGuestEmail(crypto.randomUUID().replace(/-/g, "").slice(0, 12)));
  }
  const lang = String(getQuery(event).lang ?? "");
  return sendRedirect(event, lang === "en" ? "/chaupal?lang=en" : "/chaupal", 302);
});
