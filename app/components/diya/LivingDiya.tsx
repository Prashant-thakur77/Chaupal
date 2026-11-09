import { useEffect, useRef, useState, type CSSProperties } from "react";

import { DiyaLamp } from "./DiyaLamp";
import { DIYA_LAYOUT_COMPACT, DIYA_LAYOUT_FULL } from "./diya-geometry";
import type { DiyaRenderer } from "./diya-loop";
import {
  DIYA_PHASE_LABELS,
  PRESENCE_BEHAVIOR,
  PRESENCE_VITALITY,
  diyaAriaLabel,
  type DiyaLanguage,
  type DiyaPhase,
  type DiyaReaction,
} from "./diya-model";
import "./living-diya.css";

export type { DiyaPhase, DiyaLanguage, DiyaReaction } from "./diya-model";
export {
  DIYA_PHASES,
  DIYA_PHASE_LABELS,
  PRESENCE_BEHAVIOR,
  PRESENCE_VITALITY,
} from "./diya-model";

export interface LivingDiyaProps {
  phase: DiyaPhase;
  /** Pixel size of the square stage, or "fill" to fit the parent. */
  size?: number | "fill";
  /** Visible caption under the lamp. The live region falls back to the phase label. */
  caption?: string | null;
  language?: "hi" | "en";
  className?: string;
  reaction?: "celebrate" | "recoil" | null;
}

type RendererMode = "pending" | "webgpu" | "fallback";

const rendererModules =
  typeof window === "undefined"
    ? null
    : {
        webgpu: () => import("./webgpu-renderer"),
        canvas: () => import("./canvas-renderer"),
      };

function forcedRenderer(): "webgpu" | "fallback" | null {
  try {
    const value = new URLSearchParams(window.location.search).get("renderer");
    return value === "fallback" || value === "webgpu" ? value : null;
  } catch {
    return null;
  }
}

const REACTION_KEYFRAMES: Record<DiyaReaction, Keyframe[]> = {
  celebrate: [
    { offset: 0, transform: "translate3d(0,0,0) scale(1)" },
    { offset: 0.18, transform: "translate3d(0,-2.5%,0) scale(1.035)" },
    { offset: 0.36, transform: "translate3d(0,0.6%,0) scale(0.99)" },
    { offset: 0.56, transform: "translate3d(0,-1.2%,0) scale(1.015)" },
    { offset: 1, transform: "translate3d(0,0,0) scale(1)" },
  ],
  recoil: [
    { offset: 0, transform: "translate3d(0,0,0)" },
    { offset: 0.12, transform: "translate3d(-1.6%,0.4%,0)" },
    { offset: 0.26, transform: "translate3d(1.3%,0,0)" },
    { offset: 0.4, transform: "translate3d(-0.9%,0.2%,0)" },
    { offset: 0.56, transform: "translate3d(0.6%,0,0)" },
    { offset: 0.74, transform: "translate3d(-0.25%,0,0)" },
    { offset: 1, transform: "translate3d(0,0,0)" },
  ],
};

/**
 * The living diya: a clay oil lamp whose flame shows the agent's phase.
 * WebGPU draws a procedural flame when it can; otherwise a Canvas2D flame
 * with the same phases runs (`data-renderer` says which). Reduced motion
 * keeps a still, gently glowing flame whose brightness changes slowly.
 */
export function LivingDiya({
  phase,
  size = 280,
  caption,
  language = "hi",
  className,
  reaction = null,
}: LivingDiyaProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lampRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<DiyaRenderer | null>(null);
  const phaseRef = useRef(phase);
  const [mode, setMode] = useState<RendererMode>("pending");
  const [live, setLive] = useState(false);

  phaseRef.current = phase;

  const fill = size === "fill";
  const px = fill ? null : Math.max(32, size);
  const compact = px !== null && px < 128;
  const layout = compact ? DIYA_LAYOUT_COMPACT : DIYA_LAYOUT_FULL;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  // Pick a renderer once, falling back to Canvas2D when WebGPU is missing or
  // fails to start. The canvas is keyed by mode, so the fallback always gets
  // a fresh canvas that never held a WebGPU context.
  useEffect(() => {
    if (mode !== "pending") return;
    const forced = forcedRenderer();
    const hasGpu = typeof navigator !== "undefined" && "gpu" in navigator;
    setMode(forced === "fallback" || !hasGpu ? "fallback" : "webgpu");
  }, [mode]);

  useEffect(() => {
    if (mode === "pending" || !rendererModules) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let renderer: DiyaRenderer | null = null;
    const onLight = (light: number) => {
      rootRef.current?.style.setProperty("--diya-light", light.toFixed(3));
    };

    const start = async () => {
      try {
        const current = phaseRef.current;
        const options = {
          canvas,
          vitality: PRESENCE_VITALITY[current],
          behavior: PRESENCE_BEHAVIOR[current],
          onLight,
          layout: () => layoutRef.current,
        };
        if (mode === "webgpu") {
          const { createWebGpuFlameRenderer } = await rendererModules.webgpu();
          if (cancelled) return;
          renderer = createWebGpuFlameRenderer({
            ...options,
            onFail: (error) => {
              if (cancelled) return;
              console.warn("Living diya: WebGPU flame lost, using fallback.", error);
              setMode("fallback");
            },
          });
        } else {
          const { createCanvasFlameRenderer } = await rendererModules.canvas();
          if (cancelled) return;
          renderer = createCanvasFlameRenderer(options);
        }
        rendererRef.current = renderer;
        await renderer.ready;
        if (cancelled) return;
        // Catch up with any phase change that happened while starting.
        renderer.setVitality(PRESENCE_VITALITY[phaseRef.current]);
        renderer.setBehavior(PRESENCE_BEHAVIOR[phaseRef.current]);
        setLive(true);
      } catch (error) {
        if (cancelled) return;
        renderer?.dispose();
        rendererRef.current = null;
        if (mode === "webgpu") {
          console.warn("Living diya: WebGPU flame unavailable, using fallback.", error);
          setMode("fallback");
        } else {
          console.warn("Living diya: no canvas flame, keeping the static flame.", error);
        }
      }
    };
    void start();

    return () => {
      cancelled = true;
      renderer?.dispose();
      if (rendererRef.current === renderer) rendererRef.current = null;
      setLive(false);
    };
  }, [mode]);

  useEffect(() => {
    rendererRef.current?.setVitality(PRESENCE_VITALITY[phase]);
    rendererRef.current?.setBehavior(PRESENCE_BEHAVIOR[phase]);
  }, [phase, live]);

  // Reactions play when the prop turns to a kind; null re-arms them.
  const lastReaction = useRef<DiyaReaction | null>(null);
  useEffect(() => {
    if (!reaction) {
      lastReaction.current = null;
      return;
    }
    if (lastReaction.current === reaction) return;
    lastReaction.current = reaction;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    rendererRef.current?.react(reaction);
    const duration = reaction === "recoil" ? 920 : 1220;
    const animations = [canvasRef.current, lampRef.current]
      .filter((el): el is HTMLCanvasElement | HTMLDivElement => !!el)
      .map((el) =>
        el.animate(REACTION_KEYFRAMES[reaction], {
          duration,
          easing: "cubic-bezier(.22,.7,.2,1)",
        }),
      );
    return () => {
      for (const animation of animations) animation.cancel();
    };
  }, [reaction]);

  const label = diyaAriaLabel(phase, language);
  const liveText = caption ?? DIYA_PHASE_LABELS[language][phase];
  const rootStyle: CSSProperties = fill ? {} : { width: px! };
  const renderer = mode === "webgpu" && live ? "webgpu" : "fallback";

  return (
    <>
      <div
        ref={rootRef}
        data-testid="living-diya"
        data-presence={phase}
        data-renderer={renderer}
        data-live={live ? "true" : "false"}
        data-size={fill ? "fill" : "fixed"}
        role="img"
        aria-label={label}
        lang={language}
        className={className ? `living-diya ${className}` : "living-diya"}
        style={rootStyle}
      >
        <div className="living-diya__frame" style={fill ? undefined : { width: px! }}>
          <div
            className="living-diya__stage"
            style={
              {
                "--diya-wick-x": layout.wick.x,
                "--diya-wick-y": layout.wick.y,
                "--diya-unit": layout.unit,
              } as CSSProperties
            }
          >
            <div ref={lampRef} className="living-diya__lamp">
              <DiyaLamp compact={compact} pixelSize={px} />
            </div>
            <div className="living-diya__static" aria-hidden="true" />
            <canvas
              key={mode}
              ref={canvasRef}
              className="living-diya__flame"
              aria-hidden="true"
            />
          </div>
        </div>
        {caption ? (
          <p className="living-diya__caption" aria-hidden="true">
            {caption}
          </p>
        ) : null}
      </div>
      <span className="living-diya__live" aria-live="polite" lang={language}>
        {liveText}
      </span>
    </>
  );
}

type AgentRunDetail = {
  isRunning?: boolean;
  phase?: "working" | "responding" | "idle";
};

/**
 * Maps the agent's run state to a diya phase. Listens to the window event
 * "agentNative.chatRunning" ({ isRunning, phase? }). Precedence: awaiting →
 * listening → speaking (or a responding agent) → creating (a working agent)
 * → ready.
 */
export function useDiyaPhaseFromAgent(opts: {
  awaiting: boolean;
  speaking: boolean;
  listening: boolean;
}): DiyaPhase {
  const [run, setRun] = useState<AgentRunDetail>({ isRunning: false });

  useEffect(() => {
    const onRun = (event: Event) => {
      const detail = (event as CustomEvent<AgentRunDetail | undefined>).detail;
      setRun({
        isRunning: Boolean(detail?.isRunning),
        phase: detail?.phase,
      });
    };
    window.addEventListener("agentNative.chatRunning", onRun);
    return () => window.removeEventListener("agentNative.chatRunning", onRun);
  }, []);

  if (opts.awaiting) return "awaiting";
  if (opts.listening) return "listening";
  const agentPhase = run.phase ?? (run.isRunning ? "working" : "idle");
  if (opts.speaking || agentPhase === "responding") return "speaking";
  if (agentPhase === "working") return "creating";
  return "ready";
}
