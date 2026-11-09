/**
 * Live WebGPU ink for the stroke she is drawing right now.
 *
 * Reuses the calligraphy brush from the base repo: paint.wgsl stamps tapered,
 * fibrous capsules into a persistent coverage mask. Only the compositor is
 * ours (ink-composite.wgsl), because the evening stage is dark: it writes
 * premultiplied ink on a transparent canvas instead of ink on paper.
 *
 * The mask is sized to the canvas aspect so the brush stays round on any
 * frame. A committed stroke is handed to the SVG layer and the mask cleared.
 */

import type { Buffer, Compute, Effect, Gpu, Surface } from "vgpu";

import paintWgsl from "@/features/calligraphy/runtime/paint.wgsl";
import { resolveCalligraphyRenderSize } from "@/features/calligraphy/runtime/render-resolution";

import inkCompositeWgsl from "./ink-composite.wgsl";

export interface InkPoint {
  x: number;
  y: number;
  /** 0..1 ink load */
  load: number;
}

export interface InkBrush {
  readonly ready: Promise<void>;
  begin(point: InkPoint): void;
  move(point: InkPoint): void;
  end(): void;
  clear(): void;
  setColor(hex: string): void;
  setWidth(fraction: number): void;
  dispose(): void;
}

// 14 floats, in lockstep with BrushState in paint.wgsl.
const BRUSH_FLOATS = 14;
const BRUSH_COUNT = 2;
const BRUSH_BYTES = BRUSH_FLOATS * 4 * BRUSH_COUNT;
const MAX_MASK_WIDTH = 1280;
const MAX_DISPATCHES_PER_FRAME = 6;

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0.95, 0.66, 0.23];
  const n = parseInt(m[1]!, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function bytes(view: Float32Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(view.buffer as ArrayBuffer, view.byteOffset, view.byteLength);
}

function release(resource: unknown) {
  const r = resource as { dispose?: () => void; destroy?: () => void } | undefined;
  try {
    if (r?.dispose) r.dispose();
    else r?.destroy?.();
  } catch {}
}

export function createInkBrush(
  canvas: HTMLCanvasElement,
  options: { color: string; widthFraction: number },
): InkBrush {
  let disposed = false;
  let gpu: Gpu | undefined;
  let output: Surface | undefined;
  let paint: Compute | undefined;
  let composite: Effect | undefined;
  let mask: Buffer | undefined;
  let brushes: Buffer | undefined;
  let maskWidth = 0;
  let maskHeight = 0;
  let cssWidth = 1;
  let pixelRatio = 1;
  let observer: ResizeObserver | undefined;
  let frameHandle = 0;
  let color = hexToRgb(options.color);
  let widthFraction = options.widthFraction;
  let last: InkPoint | undefined;
  let pending: { a: InkPoint; b: InkPoint }[] = [];
  const brushScratch = new Float32Array(BRUSH_FLOATS * BRUSH_COUNT);

  const radiusFor = (load: number) =>
    Math.max(1.2, ((widthFraction * maskWidth) / 2) * (0.38 + 0.62 * Math.min(1, Math.max(0, load))));

  const requestFrame = () => {
    if (!disposed && !frameHandle) frameHandle = requestAnimationFrame(draw);
  };

  const allocateMask = (width: number, height: number) => {
    if (!gpu) return;
    if (width === maskWidth && height === maskHeight && mask) return;
    const next = gpu.device.createBuffer({
      size: width * height * 4,
      usage: ["storage", "copy_dst"],
      label: "chaupal-live-ink-mask",
    });
    if (mask) release(mask);
    mask = next;
    maskWidth = width;
    maskHeight = height;
  };

  const resize = () => {
    if (disposed || !output) return;
    const rect = canvas.getBoundingClientRect();
    if (!(rect.width > 0) || !(rect.height > 0)) return;
    cssWidth = rect.width;
    const size = resolveCalligraphyRenderSize(rect.width, rect.height, window.devicePixelRatio);
    pixelRatio = size.pixelRatio;
    output.resize([size.width, size.height]);
    const scale = Math.min(1, MAX_MASK_WIDTH / rect.width) * Math.min(1.5, window.devicePixelRatio || 1);
    const mw = Math.max(16, Math.round(Math.min(MAX_MASK_WIDTH, rect.width * scale)));
    const mh = Math.max(16, Math.round((mw * rect.height) / rect.width));
    allocateMask(mw, mh);
    requestFrame();
  };

  const dispatchSegments = (segments: { a: InkPoint; b: InkPoint }[]) => {
    if (!paint || !mask || !brushes) return;
    brushScratch.fill(0);
    segments.forEach(({ a, b }, slot) => {
      brushScratch.set(
        [a.x, a.y, b.x, b.y, 1, 1, 0, 1, 1, radiusFor(b.load), radiusFor(a.load), 0.08, 1, b.load],
        slot * BRUSH_FLOATS,
      );
    });
    brushes.write(bytes(brushScratch));
    paint.set({
      uniforms: {
        mask_size: [maskWidth, maskHeight],
        radius: radiusFor(0.75),
        feather: Math.max(1.1, maskWidth / cssWidth),
        decay: 1,
        clear_epsilon: 1 / 255,
      },
      brushes,
      mask,
    });
    paint.dispatch(Math.ceil((maskWidth * maskHeight) / 64));
  };

  const draw = () => {
    frameHandle = 0;
    if (disposed || !gpu || !output || !composite || !mask) return;
    let segments = pending;
    pending = [];
    // Bound the work per frame on a very fast hand: merge neighbours.
    while (segments.length > MAX_DISPATCHES_PER_FRAME * BRUSH_COUNT) {
      const merged: { a: InkPoint; b: InkPoint }[] = [];
      for (let i = 0; i < segments.length; i += 2) {
        const first = segments[i]!;
        const second = segments[i + 1];
        merged.push(second ? { a: first.a, b: second.b } : first);
      }
      segments = merged;
    }
    for (let i = 0; i < segments.length; i += BRUSH_COUNT) {
      dispatchSegments(segments.slice(i, i + BRUSH_COUNT));
    }
    composite.set({
      uniforms: {
        resolution: output.size,
        mask_size: [maskWidth, maskHeight],
        ink: [color[0], color[1], color[2], 1],
        grain_cell: 2.2 * pixelRatio,
        chalk: 0.22,
      },
      mask,
    });
    const { frame } = vgpuModule!;
    frame(gpu, (current) => {
      current.pass({ target: output!, clear: [0, 0, 0, 0] }, (pass) => pass.draw(composite!));
    });
  };

  let vgpuModule: typeof import("vgpu") | undefined;

  const initialize = async () => {
    if (typeof navigator === "undefined" || !("gpu" in navigator) || !navigator.gpu) {
      throw new Error("WebGPU is not available.");
    }
    vgpuModule = await import("vgpu");
    if (disposed) return;
    const { init, surface, compute, effect } = vgpuModule;
    gpu = await init();
    if (disposed) {
      gpu.dispose();
      gpu = undefined;
      return;
    }
    output = surface(gpu, canvas, { autoResize: false, clearColor: [0, 0, 0, 0] });
    paint = compute(gpu, paintWgsl, { label: "chaupal-live-ink-paint" });
    composite = effect(gpu, inkCompositeWgsl, {
      label: "chaupal-live-ink-composite",
    });
    brushes = gpu.device.createBuffer({
      size: BRUSH_BYTES,
      usage: ["storage", "copy_dst"],
      label: "chaupal-live-ink-brushes",
    });
    observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
  };

  const ready = initialize();

  return {
    ready,
    begin(point) {
      last = point;
      pending.push({ a: point, b: point });
      requestFrame();
    },
    move(point) {
      if (!last) return;
      pending.push({ a: last, b: point });
      last = point;
      requestFrame();
    },
    end() {
      last = undefined;
      requestFrame();
    },
    clear() {
      last = undefined;
      pending = [];
      if (mask && maskWidth && maskHeight) {
        mask.write(new Uint8Array(maskWidth * maskHeight * 4));
      }
      requestFrame();
    },
    setColor(hex) {
      color = hexToRgb(hex);
      requestFrame();
    },
    setWidth(fraction) {
      widthFraction = fraction;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (frameHandle) cancelAnimationFrame(frameHandle);
      observer?.disconnect();
      release(mask);
      release(brushes);
      try {
        gpu?.dispose();
      } catch {}
    },
  };
}
