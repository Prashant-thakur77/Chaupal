import { getBrowserTabId } from "@agent-native/core/client/hooks";

// A tab id only means something in a browser. On the server (and in a
// Cloudflare Worker, where random values are not allowed at module load)
// a constant stands in.
export const TAB_ID = typeof window === "undefined" ? "server" : getBrowserTabId();
