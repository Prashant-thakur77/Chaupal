import {
  signShortLivedToken,
  verifyShortLivedToken,
} from "@agent-native/core/server/short-lived-token";
import type { H3Event } from "h3";
import { deleteCookie, getCookie, setCookie } from "h3";

/**
 * Chaupal lets an elder start without an account and lets a grandson join
 * from a link. Both get a signed, httpOnly guest cookie that the framework's
 * auth turns into a real session, so live sync, actions and access rules all
 * work normally. Guest identities live on a reserved .invalid domain.
 */
export const GUEST_COOKIE = "chaupal_guest";
const AUDIENCE = "chaupal-guest";
export const GUEST_DOMAIN = "guest.chaupal.invalid";
const TTL_SECONDS = 30 * 24 * 3600;

export function elderGuestEmail(id: string) {
  return `elder-${id}@${GUEST_DOMAIN}`;
}
export function familyGuestEmail(linkId: string) {
  return `family-${linkId}@${GUEST_DOMAIN}`;
}
export function isGuestEmail(email?: string | null) {
  return Boolean(email && email.toLowerCase().endsWith(`@${GUEST_DOMAIN}`));
}
export function isFamilyGuest(email?: string | null) {
  return Boolean(email && isGuestEmail(email) && email.startsWith("family-"));
}
export function familyLinkIdOf(email: string) {
  return email.slice("family-".length, email.indexOf("@"));
}

export function setGuestCookie(event: H3Event, email: string) {
  const token = signShortLivedToken({
    resourceId: AUDIENCE,
    viewerEmail: email,
    ttlSeconds: TTL_SECONDS,
  });
  const secure = (event.req.headers.get("x-forwarded-proto") ?? new URL(event.req.url).protocol).startsWith("https");
  setCookie(event, GUEST_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export async function guestSession(event: H3Event) {
  const token = getCookie(event, GUEST_COOKIE);
  if (!token) return null;
  const verified = verifyShortLivedToken(token, AUDIENCE);
  if (!verified.ok || !verified.viewerEmail) return null;
  const email = verified.viewerEmail;
  return {
    email,
    name: isFamilyGuest(email) ? "Family" : "Chaupal guest",
  };
}

export function clearGuestCookie(event: H3Event) {
  deleteCookie(event, GUEST_COOKIE, { path: "/" });
}
