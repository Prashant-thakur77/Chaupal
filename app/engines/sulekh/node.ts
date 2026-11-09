/**
 * Node-only helpers (Node, Vite SSR, vitest, tsx scripts). Importing this
 * module registers the node_modules wasm loader, so initShaper() and
 * renderReference() work without arguments. Never import it from a Worker.
 */

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

import { FONT_CATALOG, type FontId } from "./scripts";
import { setDefaultWasmLoader } from "./shape";

/** Read harfbuzz.wasm from the installed harfbuzzjs package. */
export async function loadHarfBuzzWasmNode(): Promise<Uint8Array> {
  const bases = [
    typeof import.meta.url === "string" && import.meta.url.startsWith("file:") ? import.meta.url : null,
    path.join(process.cwd(), "package.json"),
  ].filter((b): b is string => !!b);
  let lastError: unknown;
  for (const base of bases) {
    try {
      const wasmPath = createRequire(base).resolve("harfbuzzjs/dist/harfbuzz.wasm");
      return new Uint8Array(await readFile(wasmPath));
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

setDefaultWasmLoader(loadHarfBuzzWasmNode);

const cache = new Map<string, Promise<Uint8Array>>();

/**
 * Read a catalog font from `public/fonts` (default: `<cwd>/public/fonts`, the
 * app root). Cached: the same Uint8Array comes back each time.
 */
export function loadFontBytesNode(
  fontId: FontId,
  options: { fontsDir?: string } = {},
): Promise<Uint8Array> {
  const entry = FONT_CATALOG[fontId];
  if (!entry) return Promise.reject(new Error(`SULEKH_UNKNOWN_FONT:${fontId}`));
  const dir = options.fontsDir ?? path.resolve(process.cwd(), "public/fonts");
  const file = path.join(dir, entry.file);
  let p = cache.get(file);
  if (!p) {
    p = readFile(file).then((b) => new Uint8Array(b));
    p.catch(() => cache.delete(file));
    cache.set(file, p);
  }
  return p;
}
