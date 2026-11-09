"use client";

import { Hand, PenLine } from "lucide-react";
import { useMemo } from "react";

import {
  AirPreview,
  airCopy,
  StartAirButton,
  StopAirButton,
  useAirWriting,
} from "./air-writing";
import { StrokeLayer } from "./StrokeLayer";
import { svgDataUrl } from "./svg-utils";
import {
  STAGE,
  type CanvasLanguage,
  type InputMode,
  type InputModeReport,
  type Stroke,
  type StrokeInput,
  type SulekhReferenceView,
} from "./types";

export interface SulekhCanvasProps {
  reference: SulekhReferenceView | null;
  strokes: Stroke[];
  inputMode: InputMode;
  onStroke: (points: number[][], input: StrokeInput) => void;
  /** The browser's camera outcome. */
  onInputModeReport: (mode: InputModeReport) => void;
  language: CanvasLanguage;
  className?: string;
  /** Her ink colour (default marigold). */
  inkColor?: string;
}

/** Warm chalk the reference is recoloured to, shown faint beneath her ink. */
const REFERENCE_TINT = "#F6DDB4";

export function drawingAllowed(inputMode: InputMode) {
  return inputMode === "touch" || inputMode === "air-denied" || inputMode === "air";
}

/**
 * Sulekh tracing stage: a 3:2 slate with the calligraphy reference faint
 * beneath and her own ink above, on a separate layer.
 */
export function SulekhCanvas({
  reference,
  strokes,
  inputMode,
  onStroke,
  onInputModeReport,
  language,
  className,
  inkColor = STAGE.marigold,
}: SulekhCanvasProps) {
  const air = useAirWriting({ inputMode, onInputModeReport });
  const enabled = drawingAllowed(inputMode);
  const text = reference ? reference.text.normalize("NFC") : "";
  const maskUrl = useMemo(
    () => (reference?.svg ? `url("${svgDataUrl(reference.svg)}")` : undefined),
    [reference?.svg],
  );
  const cameraLive = air.status === "running" || air.status === "starting";
  const showStartOverlay = inputMode === "air-requested" && air.status !== "running";
  const showStartBar = inputMode === "air" && !cameraLive;
  const showStop = cameraLive && (inputMode === "air" || inputMode === "air-requested");
  const deniedNote =
    inputMode === "air-denied" || air.status === "denied" || air.status === "failed";
  const hi = language === "hi";

  return (
    <section
      data-testid="sulekh-canvas"
      data-input-mode={inputMode}
      data-drawing-enabled={enabled ? "true" : "false"}
      data-my-strokes={strokes.length}
      data-air-status={air.status}
      lang={language}
      className={`relative w-full ${className ?? ""}`}
    >
      <div
        className="relative isolate aspect-[3/2] w-full overflow-hidden rounded-[clamp(18px,3vw,32px)] border"
        style={{
          borderColor: "rgba(182,95,73,0.55)",
          background: `radial-gradient(120% 95% at 50% 38%, ${STAGE.indigo} 0%, #191635 55%, ${STAGE.night} 100%)`,
          boxShadow:
            "inset 0 0 0 1px rgba(244,239,230,0.04), inset 0 -40px 80px rgba(0,0,0,0.35), 0 24px 60px rgba(0,0,0,0.35)",
        }}
      >
        {/* Safe-margin guide: faint chalk corners at the reference's 8% margin. */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 1500 1000"
          preserveAspectRatio="none"
        >
          <g stroke={STAGE.chalk} strokeOpacity="0.16" strokeWidth="3" fill="none" strokeLinecap="round">
            <path d="M120 170V80h90M1380 170V80h-90M120 830v90h90M1380 830v90h-90" />
          </g>
        </svg>

        {reference ? (
          <div
            data-testid="sulekh-reference"
            data-reference-text={text}
            data-reference-script={reference.script}
            data-reference-style={reference.style}
            role="img"
            aria-label={hi ? reference.altHi : reference.altEn}
            className="pointer-events-none absolute inset-0"
          >
            <div
              className="absolute inset-0"
              style={{
                backgroundColor: REFERENCE_TINT,
                opacity: 0.38,
                maskImage: maskUrl,
                WebkitMaskImage: maskUrl,
                maskSize: "100% 100%",
                WebkitMaskSize: "100% 100%",
                maskRepeat: "no-repeat",
                WebkitMaskRepeat: "no-repeat",
                maskPosition: "center",
                WebkitMaskPosition: "center",
              }}
            />
          </div>
        ) : (
          <div className="pointer-events-none absolute inset-0 grid place-items-center p-8 text-center">
            <p className="max-w-md text-lg leading-relaxed sm:text-2xl" style={{ color: "rgba(244,239,230,0.55)" }}>
              {hi ? "अभी कोई अक्षर नहीं चुना गया" : "No reference chosen yet"}
            </p>
          </div>
        )}

        <StrokeLayer
          strokes={strokes}
          enabled={enabled}
          onStroke={onStroke}
          inkColor={inkColor}
          inkWidth={0.0115}
          aspect={1.5}
          penSource={air.penSource}
          ariaLabel={
            hi
              ? `आपकी लकीरें: ${strokes.length}`
              : `Your strokes: ${strokes.length}`
          }
        />

        {/* Gentle hints, never blocking her drawing. */}
        {enabled && strokes.length === 0 && !cameraLive && reference ? (
          <p
            className="pointer-events-none absolute inset-x-0 bottom-[5%] mx-auto flex w-fit max-w-[90%] items-center gap-2 rounded-full px-4 py-2 text-sm font-medium sm:text-base"
            style={{ backgroundColor: "rgba(20,18,43,0.72)", color: STAGE.chalk }}
          >
            <PenLine aria-hidden="true" className="size-5 shrink-0" style={{ color: STAGE.marigold }} />
            {hi ? "अक्षरों के ऊपर उंगली से लिखिए" : "Trace over the letters with your finger"}
          </p>
        ) : null}

        {deniedNote && !cameraLive ? (
          <p
            role="status"
            className="pointer-events-none absolute top-[4%] left-[4%] flex max-w-[80%] items-center gap-2 rounded-full px-4 py-2 text-sm font-medium sm:text-base"
            style={{ backgroundColor: "rgba(20,18,43,0.82)", color: STAGE.chalk }}
          >
            <Hand aria-hidden="true" className="size-5 shrink-0" style={{ color: STAGE.marigold }} />
            {air.status === "failed" ? airCopy("failed", language) : airCopy("denied", language)}
          </p>
        ) : null}

        {showStartOverlay ? (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 p-4 text-center"
            style={{ backgroundColor: "rgba(20,18,43,0.55)" }}
          >
            <StartAirButton
              language={language}
              onStart={air.start}
              busy={air.status === "starting"}
            />
            <p className="max-w-sm text-sm font-medium sm:text-base" style={{ color: STAGE.chalk }}>
              {airCopy("privacy", language)}
            </p>
          </div>
        ) : null}

        {showStartBar ? (
          <div className="absolute inset-x-0 bottom-[4%] z-10 flex justify-center px-4">
            <StartAirButton language={language} onStart={air.start} busy={false} />
          </div>
        ) : null}

        {showStop ? (
          <div className="absolute top-[3.5%] right-[3%] z-10">
            <StopAirButton language={language} onStop={air.stop} />
          </div>
        ) : null}

        <div className="absolute bottom-[3.5%] left-[3%] z-10">
          <AirPreview language={language} previewRef={air.previewRef} status={air.status} />
        </div>
      </div>
    </section>
  );
}
