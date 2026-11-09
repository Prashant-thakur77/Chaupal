import type { DiyaReaction } from "./diya-model";
import { DiyaMotion, type FlameFrame } from "./diya-motion";

/** What LivingDiya talks to, whichever renderer is behind it. */
export interface DiyaRenderer {
  readonly ready: Promise<void>;
  setVitality(value: number): void;
  setBehavior(value: number): void;
  react(kind: DiyaReaction): void;
  dispose(): void;
}

export interface DiyaLoopOptions {
  canvas: HTMLCanvasElement;
  vitality: number;
  behavior: number;
  /** Receives the device-pixel size whenever the canvas is resized. */
  resize(width: number, height: number, dpr: number): void;
  draw(frame: FlameFrame): void;
  /** Called with the light reaching the clay, at most once per frame. */
  onLight?: (light: number) => void;
}

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * The render loop shared by both renderers: one RAF loop, paused while the tab is hidden or the canvas is
 * offscreen, DPR capped at 2, and in reduced motion (or under an ancestor
 * with data-motion="paused") it only draws while the brightness settles.
 */
export function createDiyaLoop(options: DiyaLoopOptions) {
  const { canvas } = options;
  const media = window.matchMedia(REDUCED_QUERY);
  // Reduced motion, or the app's "pause motion" switch on any ancestor.
  const isStill = () =>
    media.matches || canvas.closest('[data-motion="paused"]') !== null;
  const motion = new DiyaMotion(options.vitality, options.behavior, isStill());
  let raf = 0;
  let disposed = false;
  let visible = true;
  let started = false;
  let lastLight = -1;
  let lastSize = "";

  const render = (now: number) => {
    const frame = motion.step(now);
    options.draw(frame);
    if (options.onLight && Math.abs(frame.light - lastLight) > 0.004) {
      lastLight = frame.light;
      options.onLight(frame.light);
    }
  };

  const tick = (now: number) => {
    raf = 0;
    if (disposed || !visible || document.hidden) return;
    const still = isStill();
    motion.setReduced(still);
    render(now);
    if (!still || !motion.settled) raf = requestAnimationFrame(tick);
  };

  const request = () => {
    if (!started || disposed || raf || !visible || document.hidden) return;
    raf = requestAnimationFrame(tick);
  };

  const stop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  const resize = () => {
    if (disposed) return;
    const width = canvas.clientWidth || canvas.offsetWidth;
    const height = canvas.clientHeight || canvas.offsetHeight;
    if (width <= 0 || height <= 0) return;
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    const w = Math.max(1, Math.round(width * dpr));
    const h = Math.max(1, Math.round(height * dpr));
    const key = `${w}x${h}`;
    if (key === lastSize) return;
    lastSize = key;
    options.resize(w, h, dpr);
    if (started) {
      // Redraw immediately so a resize never shows an empty frame.
      render(performance.now());
      request();
    }
  };

  const resizeObserver = new ResizeObserver(resize);
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? false;
    if (visible) request();
    else stop();
  });
  const onVisibility = () => {
    if (document.hidden) stop();
    else request();
  };
  const onReducedChange = () => {
    motion.setReduced(isStill());
    request();
  };
  const pauseObserver = new MutationObserver(onReducedChange);
  const onWindowResize = () => resize();

  return {
    start() {
      if (disposed) return;
      started = true;
      resizeObserver.observe(canvas);
      intersection.observe(canvas);
      document.addEventListener("visibilitychange", onVisibility);
      media.addEventListener("change", onReducedChange);
      pauseObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-motion"],
        subtree: true,
      });
      window.addEventListener("resize", onWindowResize, { passive: true });
      resize();
      render(performance.now());
      request();
    },
    setVitality(value: number) {
      motion.setVitality(value);
      request();
    },
    setBehavior(value: number) {
      motion.setBehavior(Math.round(Math.min(5, Math.max(0, value))), performance.now());
      request();
    },
    react(kind: DiyaReaction) {
      motion.react(kind, performance.now());
      request();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      media.removeEventListener("change", onReducedChange);
      pauseObserver.disconnect();
      window.removeEventListener("resize", onWindowResize);
    },
  };
}

export type DiyaLoop = ReturnType<typeof createDiyaLoop>;
