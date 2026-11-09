import { createToolkitAuthPlugin } from "@agent-native/toolkit/app/auth/server";

import { clearGuestCookie, guestSession } from "../lib/guest.js";

const publicPaths = ["/api/household/start", "/api/family/join", "/welcome", "/proof", "/fonts"];

/**
 * Chaupal needs no accounts: a household starts with one tap and a family
 * member joins from a link, both as signed guest sessions. On Cloudflare
 * Workers (CHAUPAL_GUEST_AUTH_ONLY=1) those guest sessions are the only
 * identity provider, which keeps account tables out of Worker start-up.
 * Elsewhere they sit alongside the framework's normal sign-in.
 */
export default createToolkitAuthPlugin(
  process.env.CHAUPAL_GUEST_AUTH_ONLY === "1"
    ? {
        workspaceAppPublicPaths: ["/"],
        rootAuth: false,
        marketing: false,
        publicPaths,
        getSession: guestSession,
        getBrowserSession: guestSession,
      }
    : {
        workspaceAppPublicPaths: ["/"],
        rootAuth: false,
        marketing: false,
        publicPaths,
        getAdditionalSession: guestSession,
        getAdditionalBrowserSession: guestSession,
        clearAdditionalSession: clearGuestCookie,
      },
);
