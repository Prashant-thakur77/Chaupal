import { createToolkitAuthPlugin } from "@agent-native/toolkit/app/auth/server";

import { clearGuestCookie, guestSession } from "../lib/guest.js";

export default createToolkitAuthPlugin({
  workspaceAppPublicPaths: ["/"],
  rootAuth: false,
  marketing: false,
  publicPaths: ["/api/household/start", "/api/family/join", "/welcome", "/proof", "/fonts"],
  getAdditionalSession: guestSession,
  getAdditionalBrowserSession: guestSession,
  clearAdditionalSession: clearGuestCookie,
});
