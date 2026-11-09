/**
 * Deployment-level settings owned by this app (not any user's credentials).
 * They are read in one place so every read carries its reason.
 */
export const config = {
  /** Public address of this deployment: family links, fonts and wasm for functions. */
  publicUrl: (): string =>
    (
      process.env.CHAUPAL_PUBLIC_URL || // guard:allow-env-credential — public URL of this deployment, not a secret
      process.env.BETTER_AUTH_URL ||
      process.env.URL || // guard:allow-env-credential — Netlify's own site URL, not a secret
      ""
    ).replace(/\/$/, ""),
  /** Longest a call may hold while waiting for her, on hosts with short request limits. */
  maxWaitMs: (): number => Number(process.env.CHAUPAL_MAX_WAIT_MS || 0), // guard:allow-env-credential — timing setting, not a secret
  /** Evaluation harness switch for the one-time faulty-render fixture. */
  evalMode: (): boolean => process.env.CHAUPAL_EVAL === "1", // guard:allow-env-credential — test-harness switch, not a secret
  /** Guest sessions as the only identity provider (hosts without account tables at start-up). */
  guestAuthOnly: (): boolean => process.env.CHAUPAL_GUEST_AUTH_ONLY === "1", // guard:allow-env-credential — auth mode switch, not a secret
  /** The family's Telegram chat for this deployment; sends happen only after her approval. */
  telegram: () => ({
    token: process.env.CHAUPAL_TELEGRAM_BOT_TOKEN, // guard:allow-env-credential — deployment-owned bot of this app, set by its operator
    chatId: process.env.CHAUPAL_TELEGRAM_CHAT_ID, // guard:allow-env-credential — deployment-owned family chat id
  }),
};
