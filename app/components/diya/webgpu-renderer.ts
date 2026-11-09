import type { Effect, Gpu, Surface } from "vgpu";
import { effect, frame, surface } from "vgpu";

import flameShader from "./diya-flame.wgsl";
import type { DiyaLayout } from "./diya-geometry";
import { createDiyaLoop, type DiyaRenderer } from "./diya-loop";
import type { FlameFrame } from "./diya-motion";

interface RendererOptions {
  canvas: HTMLCanvasElement;
  vitality: number;
  behavior: number;
  onLight?: (light: number) => void;
  layout: () => DiyaLayout;
  /** Called once if the device is lost or the flame errors after starting. */
  onFail?: (error: unknown) => void;
}

// Every diya on a page shares one device; it is released with the last one.
let sharedGpu: Promise<Gpu> | null = null;
let sharedUsers = 0;

async function acquireGpu(): Promise<Gpu> {
  sharedUsers += 1;
  if (!sharedGpu) {
    const pending = import("vgpu").then(({ init }) => init());
    sharedGpu = pending;
    pending.then(
      (gpu) => {
        // A lost device is never reused; the next diya asks for a new one.
        void gpu.gpu.lost.then(() => {
          if (sharedGpu === pending) sharedGpu = null;
        });
      },
      () => {
        if (sharedGpu === pending) sharedGpu = null;
      },
    );
  }
  return sharedGpu;
}

function releaseGpu() {
  sharedUsers = Math.max(0, sharedUsers - 1);
  if (sharedUsers > 0 || !sharedGpu) return;
  const pending = sharedGpu;
  sharedGpu = null;
  void pending.then((gpu) => gpu.dispose()).catch(() => undefined);
}

export function createWebGpuFlameRenderer(
  options: RendererOptions,
): DiyaRenderer {
  if (typeof navigator === "undefined" || !navigator.gpu) {
    return {
      ready: Promise.reject(new Error("WebGPU is not available.")),
      setVitality() {},
      setBehavior() {},
      react() {},
      dispose() {},
    };
  }

  let disposed = false;
  let acquired = false;
  let gpu: Gpu | null = null;
  let canvasSurface: Surface | null = null;
  let flame: Effect | null = null;
  let size: [number, number] = [1, 1];
  let failed = false;
  let removeErrorListener: (() => void) | null = null;

  const fail = (error: unknown) => {
    if (failed || disposed) return;
    failed = true;
    dispose();
    options.onFail?.(error);
  };

  const loop = createDiyaLoop({
    canvas: options.canvas,
    vitality: options.vitality,
    behavior: options.behavior,
    onLight: options.onLight,
    resize(width, height) {
      size = [width, height];
      canvasSurface?.resize([width, height]);
    },
    draw(state: FlameFrame) {
      if (!gpu || !canvasSurface || !flame) return;
      const layout = options.layout();
      flame.set({
        params: {
          resolution: size,
          wick: [layout.wick.x, layout.wick.y],
          unit: layout.unit,
          time: state.time,
          height: state.height,
          width: state.width,
          lean: state.lean,
          turbulence: state.turbulence,
          flickerSpeed: state.flickerSpeed,
          core: state.core,
          glow: state.glow,
          glowRadius: state.glowRadius,
          ripple: state.ripple,
          swirl: state.swirl,
          sparks: state.sparks,
        },
      });
      const target = canvasSurface;
      const pass = flame;
      try {
        frame(gpu, (current) => {
          current.pass({ target, clear: [0, 0, 0, 0] }, (p) => p.draw(pass));
        });
      } catch (error) {
        fail(error);
      }
    },
  });

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    loop.dispose();
    removeErrorListener?.();
    removeErrorListener = null;
    canvasSurface = null;
    flame = null;
    gpu = null;
    if (acquired) {
      acquired = false;
      releaseGpu();
    }
  };

  const ready = (async () => {
    acquired = true;
    const nextGpu = await acquireGpu();
    if (disposed) return;
    gpu = nextGpu;
    removeErrorListener = nextGpu.onError((error) => fail(error));
    void nextGpu.gpu.lost.then((info) => fail(new Error(`GPU device lost: ${info.message}`)));
    canvasSurface = surface(gpu, options.canvas, {
      alphaMode: "premultiplied",
      clearColor: [0, 0, 0, 0],
      dpr: [1, 2],
    });
    flame = effect(gpu, flameShader, {
      blend: "premultiplied",
      label: "living-diya-flame",
    });
    // Compile up front so a shader or pipeline failure falls back cleanly.
    await flame.compile({ colors: [canvasSurface.format] });
    if (disposed) return;
    loop.start();
  })().catch((error: unknown) => {
    dispose();
    throw error;
  });

  return {
    ready,
    setVitality: (value) => loop.setVitality(value),
    setBehavior: (value) => loop.setBehavior(value),
    react: (kind) => loop.react(kind),
    dispose,
  };
}
