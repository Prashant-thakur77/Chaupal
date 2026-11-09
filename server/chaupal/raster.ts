/**
 * SVG → PNG for family updates (Telegram needs a raster image). On Node this
 * uses the native resvg build; on Cloudflare Workers the wasm build, whose
 * module the Worker entry provides pre-compiled.
 */
let wasmReady: Promise<void> | null = null;
const fontCache: Uint8Array[] = [];

async function fonts(): Promise<Uint8Array[]> {
  if (fontCache.length) return fontCache;
  const files = ["tirodevanagarihindi/TiroDevanagariHindi-Regular.ttf", "muktamahee/MuktaMahee-Regular.ttf"];
  for (const f of files) {
    try {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      fontCache.push(new Uint8Array(await fs.readFile(path.join(process.cwd(), "public", "fonts", f))));
    } catch {
      const origin = process.env.CHAUPAL_PUBLIC_URL || process.env.BETTER_AUTH_URL;
      if (origin) {
        const res = await fetch(`${origin.replace(/\/$/, "")}/fonts/${f}`);
        if (res.ok) fontCache.push(new Uint8Array(await res.arrayBuffer()));
      }
    }
  }
  return fontCache;
}

export async function svgToPng(svg: string, width = 1200): Promise<Uint8Array> {
  const fontBuffers = await fonts();
  const opts = {
    fitTo: { mode: "width" as const, value: width },
    font: { fontBuffers, loadSystemFonts: false, defaultFontFamily: "Tiro Devanagari Hindi" },
  };
  try {
    const { Resvg } = await import("@resvg/resvg-js");
    return new Uint8Array(new Resvg(svg, opts).render().asPng());
  } catch {
    // No native build in this runtime: use the wasm build from the site's assets.
    const resvg = await import("@resvg/resvg-wasm");
    if (!wasmReady) {
      const { fetchPublicBytes } = await import("./sulekh-runtime.js");
      wasmReady = resvg.initWasm(await fetchPublicBytes("/wasm/resvg.wasm"));
    }
    await wasmReady;
    return new resvg.Resvg(svg, opts).render().asPng();
  }
}
