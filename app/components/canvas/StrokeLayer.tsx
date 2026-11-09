"use client";

import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { createInkBrush, type InkBrush } from "./ink-brush";
import {
  samplesToPoints,
  simplifyPoints,
  strokeShape,
  type RawSample,
} from "./stroke-geometry";
import { STAGE, type PenSource, type Stroke, type StrokeInput } from "./types";

export interface StrokeLayerProps {
  /** Committed strokes on her layer. */
  strokes: Stroke[];
  /** Drawing allowed (pointer and air pen). */
  enabled: boolean;
  /** Called once per finished stroke with points normalized to the box. */
  onStroke: (points: number[][], input: StrokeInput) => void;
  /** Ink colour of her strokes. */
  inkColor?: string;
  /** Per-author ink, e.g. a grandchild drawing on the same layer. */
  authorColors?: Record<string, string>;
  /** Full-load line width as a fraction of the box width. */
  inkWidth?: number;
  /** Width / height of the drawing box before it has been measured. */
  aspect?: number;
  /** A dark halo under each stroke so ink reads over bright fills. */
  halo?: boolean;
  /** Air-writing pen (hand tracker). */
  penSource?: PenSource | null;
  /** Prefer the WebGPU brush for the live stroke (default true). */
  gpuInk?: boolean;
  className?: string;
  ariaLabel?: string;
}

const VIEW_WIDTH = 1000;

interface Pending {
  key: string;
  points: number[][];
  input: StrokeInput;
}

function shapeMarkup(
  points: readonly number[][],
  viewHeight: number,
  baseWidth: number,
  color: string,
  halo: boolean,
): string {
  const shape = strokeShape(points, VIEW_WIDTH, viewHeight, baseWidth);
  if (!shape) return "";
  if (shape.dot) {
    const { cx, cy, r } = shape.dot;
    return (
      (halo ? `<circle cx="${cx}" cy="${cy}" r="${r + baseWidth * 0.22}" fill="${STAGE.halo}" fill-opacity="0.75"/>` : "") +
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>`
    );
  }
  let out = "";
  if (halo) {
    out += `<path d="${shape.spine}" fill="none" stroke="${STAGE.halo}" stroke-opacity="0.75" stroke-width="${(shape.maxWidth + baseWidth * 0.45).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  for (const run of shape.runs) {
    out += `<path d="${run.d}" fill="none" stroke="${color}" stroke-width="${run.width.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  return out;
}

const StrokeInk = memo(function StrokeInk({
  points,
  viewHeight,
  baseWidth,
  color,
  halo,
}: {
  points: number[][];
  viewHeight: number;
  baseWidth: number;
  color: string;
  halo: boolean;
}) {
  const shape = useMemo(
    () => strokeShape(points, VIEW_WIDTH, viewHeight, baseWidth),
    [points, viewHeight, baseWidth],
  );
  if (!shape) return null;
  if (shape.dot) {
    const { cx, cy, r } = shape.dot;
    return (
      <>
        {halo ? (
          <circle cx={cx} cy={cy} r={r + baseWidth * 0.22} fill={STAGE.halo} fillOpacity={0.75} />
        ) : null}
        <circle cx={cx} cy={cy} r={r} fill={color} />
      </>
    );
  }
  return (
    <>
      {halo ? (
        <path
          d={shape.spine}
          fill="none"
          stroke={STAGE.halo}
          strokeOpacity={0.75}
          strokeWidth={shape.maxWidth + baseWidth * 0.45}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {shape.runs.map((run, i) => (
        <path
          key={i}
          d={run.d}
          fill="none"
          stroke={color}
          strokeWidth={run.width}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </>
  );
});

/**
 * Her own layer: committed strokes as smooth variable-width SVG ink, and the
 * stroke being drawn right now as live WebGPU ink (SVG when WebGPU is absent).
 */
export function StrokeLayer({
  strokes,
  enabled,
  onStroke,
  inkColor = STAGE.ink,
  authorColors,
  inkWidth = 0.012,
  aspect: aspectHint = 1.5,
  halo = false,
  penSource,
  gpuInk = true,
  className,
  ariaLabel,
}: StrokeLayerProps) {
  const filterId = `chalk-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<SVGGElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const brushRef = useRef<InkBrush | undefined>(undefined);
  const [gpuReady, setGpuReady] = useState(false);
  const gpuReadyRef = useRef(false);
  const [aspect, setAspect] = useState(aspectHint);
  const [pending, setPending] = useState<Pending[]>([]);
  const activeRef = useRef<{
    pointerId: number | "air";
    samples: RawSample[];
  } | null>(null);
  const liveFrameRef = useRef(0);
  const sizeRef = useRef({ width: 1, height: 1 });
  const propsRef = useRef({ enabled, onStroke, inkColor, inkWidth, halo });
  propsRef.current = { enabled, onStroke, inkColor, inkWidth, halo };

  const viewHeight = VIEW_WIDTH / aspect;
  const baseWidth = inkWidth * VIEW_WIDTH;

  // Measure the box: the viewBox follows its aspect so ink is never stretched.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => {
      const rect = box.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        sizeRef.current = { width: rect.width, height: rect.height };
        const next = rect.width / rect.height;
        setAspect((prev) => (Math.abs(prev - next) > 0.002 ? next : prev));
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  // Live WebGPU ink with the calligraphy brush.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gpuInk) return;
    let alive = true;
    const brush = createInkBrush(canvas, {
      color: propsRef.current.inkColor,
      widthFraction: propsRef.current.inkWidth,
    });
    brushRef.current = brush;
    brush.ready.then(
      () => {
        if (!alive) return;
        gpuReadyRef.current = true;
        setGpuReady(true);
      },
      () => {
        if (!alive) return;
        gpuReadyRef.current = false;
        brushRef.current = undefined;
        brush.dispose();
        setGpuReady(false);
      },
    );
    return () => {
      alive = false;
      gpuReadyRef.current = false;
      brushRef.current = undefined;
      brush.dispose();
    };
  }, [gpuInk]);

  useEffect(() => {
    brushRef.current?.setColor(inkColor);
  }, [inkColor]);
  useEffect(() => {
    brushRef.current?.setWidth(inkWidth);
  }, [inkWidth]);

  // A committed stroke stays visible until the parent's list catches up.
  useEffect(() => {
    setPending([]);
  }, [strokes]);
  useEffect(() => {
    if (!pending.length) return;
    const timer = window.setTimeout(() => setPending([]), 8000);
    return () => window.clearTimeout(timer);
  }, [pending]);

  const drawLive = useCallback(() => {
    liveFrameRef.current = 0;
    const live = liveRef.current;
    if (!live) return;
    const active = activeRef.current;
    if (!active || gpuReadyRef.current) {
      live.innerHTML = "";
      return;
    }
    const { width, height } = sizeRef.current;
    const pts = samplesToPoints(active.samples, width, height);
    const { inkColor: color, inkWidth: w, halo: h } = propsRef.current;
    live.innerHTML = shapeMarkup(pts, VIEW_WIDTH / (width / height), w * VIEW_WIDTH, color, h);
  }, []);

  const requestLive = useCallback(() => {
    if (!liveFrameRef.current) liveFrameRef.current = requestAnimationFrame(drawLive);
  }, [drawLive]);

  useEffect(
    () => () => {
      if (liveFrameRef.current) cancelAnimationFrame(liveFrameRef.current);
    },
    [],
  );

  const beginStroke = useCallback(
    (pointerId: number | "air", sample: RawSample) => {
      activeRef.current = { pointerId, samples: [sample] };
      brushRef.current?.begin({ x: sample.x, y: sample.y, load: 0.75 });
      requestLive();
    },
    [requestLive],
  );

  const extendStroke = useCallback(
    (sample: RawSample) => {
      const active = activeRef.current;
      if (!active) return;
      const prev = active.samples[active.samples.length - 1]!;
      if (prev.x === sample.x && prev.y === sample.y) return;
      active.samples.push(sample);
      const { width, height } = sizeRef.current;
      const tail = samplesToPoints(active.samples.slice(-6), width, height);
      const load = tail[tail.length - 1]?.[2] ?? 0.75;
      brushRef.current?.move({ x: sample.x, y: sample.y, load });
      requestLive();
    },
    [requestLive],
  );

  const finishStroke = useCallback(
    (input: StrokeInput) => {
      const active = activeRef.current;
      activeRef.current = null;
      brushRef.current?.end();
      if (!active) return;
      const { width, height } = sizeRef.current;
      const points = simplifyPoints(
        samplesToPoints(active.samples, width, height),
        width / height,
      );
      if (points.length) {
        setPending((list) => [
          ...list,
          { key: `${Date.now()}-${list.length}`, points, input },
        ]);
        propsRef.current.onStroke(points, input);
      }
      // The SVG copy renders in the same frame; then the live mask is cleared.
      requestAnimationFrame(() => {
        if (!activeRef.current) brushRef.current?.clear();
      });
      requestLive();
    },
    [requestLive],
  );

  // If drawing is switched off mid-stroke, finish what she drew.
  useEffect(() => {
    if (!enabled && activeRef.current) {
      finishStroke(activeRef.current.pointerId === "air" ? "air" : "touch");
    }
  }, [enabled, finishStroke]);

  // Air pen.
  useEffect(() => {
    if (!penSource) return;
    const cursor = cursorRef.current;
    const unsubscribe = penSource.subscribe((sample) => {
      if (cursor) {
        cursor.style.opacity = sample.tracking ? "1" : "0";
        cursor.style.left = `${sample.x * 100}%`;
        cursor.style.top = `${sample.y * 100}%`;
        cursor.dataset.down = sample.down ? "true" : "false";
      }
      const allowed = propsRef.current.enabled;
      const active = activeRef.current;
      const raw: RawSample = {
        x: sample.x,
        y: sample.y,
        t: performance.now(),
        pressure: undefined,
      };
      if (sample.down && allowed) {
        if (!active) beginStroke("air", raw);
        else if (active.pointerId === "air") extendStroke(raw);
      } else if (active?.pointerId === "air") {
        finishStroke("air");
      }
    });
    return () => {
      unsubscribe();
      if (cursor) cursor.style.opacity = "0";
      if (activeRef.current?.pointerId === "air") finishStroke("air");
    };
  }, [penSource, beginStroke, extendStroke, finishStroke]);

  const toSample = (
    event: { clientX: number; clientY: number; pressure: number; pointerType: string; timeStamp: number },
    rect: DOMRect,
  ): RawSample => ({
    x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    t: event.timeStamp,
    pressure: event.pointerType === "pen" ? event.pressure : undefined,
  });

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!enabled || activeRef.current) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    sizeRef.current = { width: rect.width, height: rect.height };
    beginStroke(event.pointerId, toSample(event, rect));
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const active = activeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const native = event.nativeEvent;
    const events =
      typeof native.getCoalescedEvents === "function" ? native.getCoalescedEvents() : [];
    if (events.length) for (const e of events) extendStroke(toSample(e, rect));
    else extendStroke(toSample(event, rect));
  };

  const onPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const active = activeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    finishStroke("touch");
  };

  return (
    <div
      ref={boxRef}
      className={`absolute inset-0 select-none ${className ?? ""}`}
      style={{
        touchAction: enabled ? "none" : "auto",
        pointerEvents: enabled ? "auto" : "none",
        cursor: enabled ? "crosshair" : "default",
      }}
      data-testid="stroke-layer"
      data-drawing-enabled={enabled ? "true" : "false"}
      data-live-ink={gpuReady ? "webgpu" : "svg"}
      role="img"
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onLostPointerCapture={onPointerEnd}
    >
      <svg
        className="absolute inset-0 h-full w-full overflow-visible"
        viewBox={`0 0 ${VIEW_WIDTH} ${viewHeight.toFixed(2)}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <filter id={filterId} x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
            <feColorMatrix
              in="noise"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.1 1.42"
              result="tooth"
            />
            <feComposite in="SourceGraphic" in2="tooth" operator="in" />
          </filter>
        </defs>
        <g data-layer="her-strokes" filter={`url(#${filterId})`}>
          {strokes.map((stroke) => (
            <g
              key={stroke.id}
              data-stroke-id={stroke.id}
              data-author={stroke.author}
              data-input={stroke.input}
            >
              <StrokeInk
                points={stroke.points}
                viewHeight={viewHeight}
                baseWidth={baseWidth}
                color={authorColors?.[stroke.author] ?? inkColor}
                halo={halo}
              />
            </g>
          ))}
          {pending.map((stroke) => (
            <g key={stroke.key} data-pending-stroke="true" data-input={stroke.input}>
              <StrokeInk
                points={stroke.points}
                viewHeight={viewHeight}
                baseWidth={baseWidth}
                color={inkColor}
                halo={halo}
              />
            </g>
          ))}
          <g ref={liveRef} data-live-stroke="true" />
        </g>
      </svg>
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      />
      <div
        ref={cursorRef}
        aria-hidden="true"
        data-down="false"
        className="pointer-events-none absolute size-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] opacity-0 transition-opacity motion-reduce:transition-none data-[down=true]:size-5 data-[down=true]:border-0"
        style={{
          borderColor: inkColor,
          backgroundColor: "transparent",
          boxShadow: `0 0 0 3px ${STAGE.halo}cc`,
        }}
      >
        <span
          className="absolute inset-0 rounded-full"
          style={{ backgroundColor: inkColor, opacity: 0.9, transform: "scale(0.35)" }}
        />
      </div>
    </div>
  );
}
