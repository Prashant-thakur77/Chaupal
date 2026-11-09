/**
 * Sulekh engine, Node entry (Node, Vite SSR, vitest, tsx scripts): the
 * Worker-safe core plus Node loaders. Importing it registers the wasm loader,
 * so renderReference() initialises HarfBuzz on first use.
 *
 *   import { fontFor, loadFontBytesNode, renderReference } from "@/engines/sulekh";
 *   const font = fontFor("devanagari", "kalam");
 *   const ref = await renderReference({
 *     text: "शुभ दीपावली", script: "devanagari", style: "kalam", size: "medium",
 *     fontBytes: await loadFontBytesNode(font.id), fontId: font.id,
 *   });
 *
 * In a Cloudflare Worker import "@/engines/sulekh/core" instead (see core.ts).
 */

export * from "./core";
export { loadFontBytesNode, loadHarfBuzzWasmNode } from "./node";
