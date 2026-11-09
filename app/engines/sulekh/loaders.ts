/**
 * Fetch-based font loader: works in Workers, browsers and Node. The engine
 * core never loads anything itself; callers pass `fontBytes`.
 */

import { FONT_CATALOG, type FontId } from "./scripts";

const cache = new Map<string, Promise<Uint8Array>>();

/**
 * Fetch a catalog font from a deployed origin, e.g.
 * `loadFontBytesFetch("kalam-bold", "https://chaupal.example")` →
 * GET https://chaupal.example/fonts/kalam/Kalam-Bold.ttf.
 * In a Worker with static assets pass a fetcher, e.g.
 * `(url) => env.ASSETS.fetch(url)`. Cached per URL.
 */
export function loadFontBytesFetch(
  fontId: FontId,
  baseUrl: string,
  fetcher: (url: string) => Promise<Response> = (url) => fetch(url),
): Promise<Uint8Array> {
  const entry = FONT_CATALOG[fontId];
  if (!entry) return Promise.reject(new Error(`SULEKH_UNKNOWN_FONT:${fontId}`));
  const url = new URL(`fonts/${entry.file}`, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
  let p = cache.get(url);
  if (!p) {
    p = (async () => {
      const res = await fetcher(url);
      if (!res.ok) throw new Error(`SULEKH_FONT_FETCH_FAILED:${res.status}:${url}`);
      return new Uint8Array(await res.arrayBuffer());
    })();
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}
