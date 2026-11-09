/**
 * HarfBuzz shaping for Sulekh, with no DOM, no Node APIs and no runtime
 * wasm compilation.
 *
 * We instantiate `harfbuzzjs/dist/harfbuzz.wasm` ourselves and call the raw
 * `hb_*` exports. The package's own `index.mjs` is not used at runtime: it
 * runs a top-level `await createHarfBuzz()` that locates the wasm through
 * `import.meta.url`, and its glyph-drawing helper registers JS callbacks with
 * Emscripten's `addFunction`, which compiles a wasm stub at runtime. Both
 * fail inside a Cloudflare Worker. Shaping needs no callbacks, and glyph
 * outlines are read from the font's `glyf` table (see sfnt.ts).
 *
 * Initialisation
 * - Node / Vite SSR / vitest: import from `app/engines/sulekh` (index.ts);
 *   it pulls in `./node`, which registers a loader that reads the wasm from
 *   node_modules, so the first render initialises itself.
 * - Cloudflare Worker: import from `app/engines/sulekh/core` (no Node APIs)
 *   and pass the wasm module in once:
 *
 *     import hbWasm from "harfbuzzjs/dist/harfbuzz.wasm"; // WebAssembly.Module
 *     import { initShaper } from "@/engines/sulekh/core";
 *     await initShaper(hbWasm);
 *
 *   Wrangler turns `*.wasm` imports into precompiled `WebAssembly.Module`s
 *   (CompiledWasm rule, on by default), and `WebAssembly.instantiate(module,
 *   imports)` is allowed in Workers. Raw bytes (Uint8Array/ArrayBuffer) are
 *   also accepted where runtime compilation is allowed (Node, browsers).
 */

import { SfntFont, type OutlineCommand } from "./sfnt";

export type WasmSource = WebAssembly.Module | Uint8Array | ArrayBuffer;

interface HbExports {
  memory: WebAssembly.Memory;
  __wasm_call_ctors(): void;
  malloc(size: number): number;
  free(ptr: number): void;
  hb_blob_create(data: number, length: number, mode: number, userData: number, destroy: number): number;
  hb_blob_destroy(blob: number): void;
  hb_face_create(blob: number, index: number): number;
  hb_face_destroy(face: number): void;
  hb_face_get_upem(face: number): number;
  hb_font_create(face: number): number;
  hb_font_destroy(font: number): void;
  hb_font_get_nominal_glyph(font: number, unicode: number, glyphPtr: number): number;
  hb_font_get_glyph_h_advance(font: number, glyph: number): number;
  hb_buffer_create(): number;
  hb_buffer_destroy(buffer: number): void;
  hb_buffer_add_utf16(buffer: number, text: number, textLength: number, itemOffset: number, itemLength: number): void;
  hb_buffer_guess_segment_properties(buffer: number): void;
  hb_buffer_set_direction(buffer: number, direction: number): void;
  hb_buffer_set_script(buffer: number, script: number): void;
  hb_buffer_set_language(buffer: number, language: number): void;
  hb_buffer_set_cluster_level(buffer: number, level: number): void;
  hb_buffer_get_length(buffer: number): number;
  hb_buffer_get_glyph_infos(buffer: number, lengthPtr: number): number;
  hb_buffer_get_glyph_positions(buffer: number, lengthPtr: number): number;
  hb_language_from_string(str: number, len: number): number;
  hb_script_from_string(str: number, len: number): number;
  hb_shape(font: number, buffer: number, features: number, numFeatures: number): void;
  hb_version_string(): number;
}

const HB_DIRECTION_LTR = 4;
const HB_DIRECTION_RTL = 5;
const HB_MEMORY_MODE_READONLY = 1;

let hb: HbExports | null = null;
let hbInit: Promise<HbExports> | null = null;

async function instantiate(source: WasmSource): Promise<HbExports> {
  let memoryRef: WebAssembly.Memory | null = null;
  const imports = {
    env: {
      _emscripten_runtime_keepalive_clear: () => {},
      _abort_js: () => {
        throw new Error("SULEKH_HARFBUZZ_ABORT");
      },
      _setitimer_js: () => 0,
      emscripten_resize_heap: (requested: number) => {
        const mem = memoryRef!;
        const current = mem.buffer.byteLength;
        requested >>>= 0;
        if (requested <= current) return 1;
        const target = Math.max(requested, Math.ceil(current * 1.25));
        const pages = Math.ceil((target - current) / 65536);
        try {
          mem.grow(pages);
          return 1;
        } catch {
          return 0;
        }
      },
    },
    wasi_snapshot_preview1: {
      proc_exit: (code: number) => {
        throw new Error(`SULEKH_HARFBUZZ_EXIT:${code}`);
      },
    },
  };
  let instance: WebAssembly.Instance;
  if (source instanceof WebAssembly.Module) {
    instance = await WebAssembly.instantiate(source, imports);
  } else {
    const bytes = source instanceof Uint8Array ? source : new Uint8Array(source);
    const result = await WebAssembly.instantiate(bytes as BufferSource, imports);
    instance = result.instance;
  }
  const exports = instance.exports as unknown as HbExports;
  memoryRef = exports.memory;
  exports.__wasm_call_ctors();
  return exports;
}

let defaultLoader: (() => Promise<WasmSource>) | null = null;

/**
 * Register how initShaper() finds the wasm when called without a source.
 * `./node` registers the node_modules loader on import; Worker code never
 * imports `./node` and passes the module to initShaper() instead.
 */
export function setDefaultWasmLoader(loader: () => Promise<WasmSource>): void {
  defaultLoader = loader;
}

/**
 * Initialise HarfBuzz from a precompiled module or wasm bytes. Idempotent:
 * later calls (with or without a source) reuse the first instance.
 */
export function initShaper(source?: WasmSource): Promise<void> {
  if (hb) return Promise.resolve();
  if (!hbInit) {
    hbInit = (async () => {
      let src = source;
      if (!src) {
        if (!defaultLoader) {
          throw new Error(
            "SULEKH_SHAPER_NOT_INITIALISED: call initShaper(wasmModule) first (see shape.ts), or import the Node entry",
          );
        }
        src = await defaultLoader();
      }
      const exports = await instantiate(src);
      hb = exports;
      return exports;
    })();
    hbInit.catch(() => {
      hbInit = null;
    });
  }
  return hbInit.then(() => undefined);
}

export function isShaperReady(): boolean {
  return hb !== null;
}

function api(): HbExports {
  if (!hb) {
    throw new Error("SULEKH_SHAPER_NOT_INITIALISED: await initShaper() first");
  }
  return hb;
}

export function harfbuzzVersion(): string {
  const h = api();
  const ptr = h.hb_version_string();
  const heap = new Uint8Array(h.memory.buffer);
  let end = ptr;
  while (heap[end] !== 0) end++;
  return new TextDecoder().decode(heap.subarray(ptr, end));
}

function withAscii<T>(text: string, fn: (ptr: number) => T): T {
  const h = api();
  const ptr = h.malloc(text.length + 1);
  const heap = new Uint8Array(h.memory.buffer);
  for (let i = 0; i < text.length; i++) heap[ptr + i] = text.charCodeAt(i) & 0x7f;
  heap[ptr + text.length] = 0;
  try {
    return fn(ptr);
  } finally {
    h.free(ptr);
  }
}

export interface ShapedGlyph {
  glyphId: number;
  cluster: number;
  xAdvance: number;
  yAdvance: number;
  xOffset: number;
  yOffset: number;
}

export interface ShapeOptions {
  /** ISO 15924 tag, e.g. "Deva", "Guru", "Taml", "Beng", "Arab". */
  script?: string;
  /** BCP 47 language, e.g. "hi", "mr", "sa", "pa", "ta", "bn", "ur". */
  language?: string;
  direction?: "ltr" | "rtl";
}

/** A font loaded into HarfBuzz plus its parsed sfnt tables. */
export class ShaperFont {
  readonly sfnt: SfntFont;
  readonly upem: number;
  private readonly dataPtr: number;
  private readonly blob: number;
  private readonly face: number;
  private readonly font: number;
  private destroyed = false;

  get isDestroyed(): boolean {
    return this.destroyed;
  }

  constructor(bytes: Uint8Array) {
    const h = api();
    this.sfnt = new SfntFont(bytes);
    if (!this.sfnt.info.hasGlyf) {
      throw new Error("SULEKH_FONT_NOT_GLYF: Sulekh needs TrueType (glyf) fonts");
    }
    this.dataPtr = h.malloc(bytes.byteLength);
    new Uint8Array(h.memory.buffer).set(bytes, this.dataPtr);
    this.blob = h.hb_blob_create(this.dataPtr, bytes.byteLength, HB_MEMORY_MODE_READONLY, 0, 0);
    this.face = h.hb_face_create(this.blob, 0);
    this.font = h.hb_font_create(this.face);
    this.upem = h.hb_face_get_upem(this.face);
  }

  /** Shape text (caller passes NFC). Glyphs come back in visual order. */
  shape(text: string, options: ShapeOptions = {}): ShapedGlyph[] {
    const h = api();
    const buffer = h.hb_buffer_create();
    const textPtr = h.malloc(text.length * 2 + 2);
    try {
      const u16 = new Uint16Array(h.memory.buffer, textPtr, text.length);
      for (let i = 0; i < text.length; i++) u16[i] = text.charCodeAt(i);
      h.hb_buffer_add_utf16(buffer, textPtr, text.length, 0, text.length);
      h.hb_buffer_guess_segment_properties(buffer);
      if (options.script) {
        const script = withAscii(options.script, (p) => h.hb_script_from_string(p, -1));
        h.hb_buffer_set_script(buffer, script);
      }
      if (options.direction) {
        h.hb_buffer_set_direction(
          buffer,
          options.direction === "rtl" ? HB_DIRECTION_RTL : HB_DIRECTION_LTR,
        );
      }
      if (options.language) {
        const lang = withAscii(options.language, (p) => h.hb_language_from_string(p, -1));
        h.hb_buffer_set_language(buffer, lang);
      }
      h.hb_shape(this.font, buffer, 0, 0);
      const length = h.hb_buffer_get_length(buffer);
      const infoPtr = h.hb_buffer_get_glyph_infos(buffer, 0);
      const posPtr = h.hb_buffer_get_glyph_positions(buffer, 0);
      const infos = new Uint32Array(h.memory.buffer, infoPtr, length * 5);
      const pos = new Int32Array(h.memory.buffer, posPtr, length * 5);
      const glyphs: ShapedGlyph[] = [];
      for (let i = 0; i < length; i++) {
        glyphs.push({
          glyphId: infos[i * 5],
          cluster: infos[i * 5 + 2],
          xAdvance: pos[i * 5],
          yAdvance: pos[i * 5 + 1],
          xOffset: pos[i * 5 + 2],
          yOffset: pos[i * 5 + 3],
        });
      }
      return glyphs;
    } finally {
      h.free(textPtr);
      h.hb_buffer_destroy(buffer);
    }
  }

  /** The cmap glyph for one code point, or 0 (.notdef) when the font lacks it. */
  nominalGlyph(codePoint: number): number {
    const h = api();
    const ptr = h.malloc(4);
    try {
      const ok = h.hb_font_get_nominal_glyph(this.font, codePoint, ptr);
      return ok ? new Uint32Array(h.memory.buffer, ptr, 1)[0] : 0;
    } finally {
      h.free(ptr);
    }
  }

  hAdvance(glyphId: number): number {
    return api().hb_font_get_glyph_h_advance(this.font, glyphId);
  }

  outline(glyphId: number): OutlineCommand[] {
    return this.sfnt.outline(glyphId);
  }

  destroy(): void {
    if (this.destroyed) return;
    const h = api();
    h.hb_font_destroy(this.font);
    h.hb_face_destroy(this.face);
    h.hb_blob_destroy(this.blob);
    h.free(this.dataPtr);
    this.destroyed = true;
  }
}

const MAX_CACHED_FONTS = 16;
const byArray = new WeakMap<Uint8Array, ShaperFont>();
const byContent = new Map<string, ShaperFont>();

/** FNV-1a over the bytes plus the length: identifies a font file by content. */
function fingerprint(bytes: Uint8Array): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193);
  }
  return `${bytes.length}:${(h >>> 0).toString(16)}`;
}

/**
 * Get a shaper font for these bytes. Cached by array identity and by content
 * (so per-request copies of the same file do not leak wasm memory); at most
 * 16 distinct fonts stay loaded, oldest evicted. initShaper() must have resolved.
 */
export function getShaperFont(bytes: Uint8Array): ShaperFont {
  const hit = byArray.get(bytes);
  if (hit && !hit.isDestroyed) return hit;
  const key = fingerprint(bytes);
  let f = byContent.get(key);
  if (!f) {
    f = new ShaperFont(bytes);
    byContent.set(key, f);
    if (byContent.size > MAX_CACHED_FONTS) {
      const [oldestKey, oldest] = byContent.entries().next().value as [string, ShaperFont];
      byContent.delete(oldestKey);
      oldest.destroy();
    }
  }
  byArray.set(bytes, f);
  return f;
}

// ---------------------------------------------------------------------------
// Glyph runs → positioned outlines → SVG path data
// ---------------------------------------------------------------------------

/** One glyph placed in font units (y-up), relative to the run origin. */
export interface PlacedGlyph {
  glyphId: number;
  cluster: number;
  /** Pen position + offset, font units, y-up. */
  x: number;
  y: number;
  commands: OutlineCommand[];
}

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function placeRun(font: ShaperFont, glyphs: ShapedGlyph[]): {
  placed: PlacedGlyph[];
  advance: number;
} {
  let penX = 0;
  let penY = 0;
  const placed: PlacedGlyph[] = [];
  for (const g of glyphs) {
    placed.push({
      glyphId: g.glyphId,
      cluster: g.cluster,
      x: penX + g.xOffset,
      y: penY + g.yOffset,
      commands: font.outline(g.glyphId),
    });
    penX += g.xAdvance;
    penY += g.yAdvance;
  }
  return { placed, advance: penX };
}

/** Tight bounds of a glyph outline (quadratic extrema included), y-up units. */
export function outlineBox(commands: OutlineCommand[], dx = 0, dy = 0): Box | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let cx = 0;
  let cy = 0;
  const add = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };
  for (const c of commands) {
    if (c.op === "M" || c.op === "L") {
      add(c.x + dx, c.y + dy);
      cx = c.x;
      cy = c.y;
    } else if (c.op === "Q") {
      add(c.x + dx, c.y + dy);
      for (const [p0, p1, p2, axis] of [
        [cx, c.cx, c.x, "x"],
        [cy, c.cy, c.y, "y"],
      ] as const) {
        const den = p0 - 2 * p1 + p2;
        if (den !== 0) {
          const t = (p0 - p1) / den;
          if (t > 0 && t < 1) {
            const xt = (1 - t) * (1 - t) * cx + 2 * (1 - t) * t * c.cx + t * t * c.x;
            const yt = (1 - t) * (1 - t) * cy + 2 * (1 - t) * t * c.cy + t * t * c.y;
            if (axis === "x" || axis === "y") add(xt + dx, yt + dy);
          }
        }
      }
      cx = c.x;
      cy = c.y;
    }
  }
  if (minX === Infinity) return null;
  return { minX, minY, maxX, maxY };
}

export function unionBox(a: Box | null, b: Box | null): Box | null {
  if (!a) return b;
  if (!b) return a;
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

export function runBox(placed: PlacedGlyph[]): Box | null {
  let box: Box | null = null;
  for (const g of placed) box = unionBox(box, outlineBox(g.commands, g.x, g.y));
  return box;
}

const fmt = (n: number) => {
  const r = Math.round(n * 10) / 10;
  return Object.is(r, -0) ? "0" : String(r);
};

/**
 * Convert font-unit (y-up) outline to SVG path data (y-down):
 *   X = tx + (x + gx) * scale,  Y = ty - (y + gy) * scale
 */
export function commandsToPath(
  commands: OutlineCommand[],
  gx: number,
  gy: number,
  scale: number,
  tx: number,
  ty: number,
): string {
  const X = (x: number) => fmt(tx + (x + gx) * scale);
  const Y = (y: number) => fmt(ty - (y + gy) * scale);
  let d = "";
  for (const c of commands) {
    switch (c.op) {
      case "M":
        d += `M${X(c.x)} ${Y(c.y)}`;
        break;
      case "L":
        d += `L${X(c.x)} ${Y(c.y)}`;
        break;
      case "Q":
        d += `Q${X(c.cx)} ${Y(c.cy)} ${X(c.x)} ${Y(c.y)}`;
        break;
      case "Z":
        d += "Z";
        break;
    }
  }
  return d;
}
