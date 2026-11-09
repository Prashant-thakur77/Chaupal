import { initShaper, isShaperReady } from "../../app/engines/sulekh/core.js";

/**
 * Starts HarfBuzz once per process. On Node (local dev, eval, long-lived
 * hosts) the wasm and fonts are read from disk; on Cloudflare Workers the
 * wasm arrives as a pre-compiled module and fonts are fetched from the
 * deployment's own static assets.
 */
let starting: Promise<void> | null = null;

export async function ensureShaper() {
  if (isShaperReady()) return;
  if (!starting) {
    starting = (async () => {
      const mod = (globalThis as { __CHAUPAL_HB_WASM__?: WebAssembly.Module }).__CHAUPAL_HB_WASM__;
      if (mod) return initShaper(mod);
      const node = await import("../../app/engines/sulekh/node.js");
      return initShaper(await node.loadHarfBuzzWasmNode());
    })();
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
