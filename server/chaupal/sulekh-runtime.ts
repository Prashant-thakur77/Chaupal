import { initShaper, isShaperReady } from "../../app/engines/sulekh/core.js";

/**
 * Starts HarfBuzz once per process. Locally the wasm and fonts are read from
 * disk; in serverless functions, where the repo is not on disk, they are
 * fetched from the deployment's own static assets (/wasm, /fonts).
 */
let starting: Promise<void> | null = null;

export function publicOrigin() {
  return (process.env.CHAUPAL_PUBLIC_URL || process.env.BETTER_AUTH_URL || process.env.URL || "").replace(/\/$/, "");
}

export async function fetchPublicBytes(path: string): Promise<Uint8Array> {
  const origin = publicOrigin();
  if (!origin) throw new Error("PUBLIC_ORIGIN_UNKNOWN");
  const res = await fetch(`${origin}${path}`);
  if (!res.ok) throw new Error(`ASSET_FETCH_FAILED ${path} ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function ensureShaper() {
  if (isShaperReady()) return;
  if (!starting) {
    starting = (async () => {
      const mod = (globalThis as { __CHAUPAL_HB_WASM__?: WebAssembly.Module }).__CHAUPAL_HB_WASM__;
      if (mod) return initShaper(mod);
      try {
        const node = await import("../../app/engines/sulekh/node.js");
        return await initShaper(await node.loadHarfBuzzWasmNode());
      } catch {
        return initShaper(await fetchPublicBytes("/wasm/harfbuzz.wasm"));
      }
    })().catch((error) => {
      starting = null;
      throw error;
    });
  }
  return starting;
}

export async function loadFontBytesNodeIfAvailable(fontId: string): Promise<Uint8Array | null> {
  if ((globalThis as { __CHAUPAL_HB_WASM__?: unknown }).__CHAUPAL_HB_WASM__) return null;
  try {
    const node = await import("../../app/engines/sulekh/node.js");
    return await node.loadFontBytesNode(fontId as never);
  } catch {
    return null;
  }
}
