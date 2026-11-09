"use client";

import { Check, PaintBucket, PenLine } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { COLOURS } from "@/engines/kolam/palette";

import {
  AirPreview,
  airCopy,
  StartAirButton,
  StopAirButton,
  useAirWriting,
} from "./air-writing";
import { StrokeLayer } from "./StrokeLayer";
import { FOCUS_RING, sanitizeSvg, svgAspect } from "./svg-utils";
import {
  STAGE,
  type CanvasLanguage,
  type InputMode,
  type InputModeReport,
  type PaletteColour,
  type RangoliDesignView,
  type Stroke,
  type StrokeInput,
} from "./types";

/** Engine outlines are chalk-white (made for a dark floor); on the light floor they draw in warm brown. */
const CHALKS = new Set(["#f4efe6", "#fbf8f1", "#f7f1e6", "#ffffff", "white"]);
function lineOn(orig: string | null | undefined) {
  return !orig || CHALKS.has(orig.toLowerCase()) ? STAGE.line : orig;
}


export type RangoliMode = "fill" | "trace";

export interface RangoliCanvasProps {
  design: RangoliDesignView | null;
  strokes: Stroke[];
  inputMode: InputMode;
  onStroke: (points: number[][], input: StrokeInput) => void;
  onInputModeReport: (mode: InputModeReport) => void;
  onFillRegion: (regionId: string, colour: string) => void;
  palette: PaletteColour[];
  selectedColour?: string;
  language: CanvasLanguage;
  className?: string;
  /** Starting tool; switches to trace on its own when air-writing begins. */
  initialMode?: RangoliMode;
  inkColor?: string;
}

const ZONE_WORDS: Record<string, { hi: string; en: string }> = {
  center: { hi: "बीच", en: "centre" },
  centre: { hi: "बीच", en: "centre" },
  border: { hi: "किनारा", en: "border" },
  outer: { hi: "बाहर", en: "outside" },
  inner: { hi: "अंदर", en: "inside" },
  petal: { hi: "पंखुड़ी", en: "petal" },
  loop: { hi: "रेखा", en: "line" },
  dots: { hi: "बिंदु", en: "dots" },
  cell: { hi: "खाना", en: "cell" },
};

function zoneLabel(zone: string, language: CanvasLanguage) {
  const ring = /^ring-(\d+)$/.exec(zone);
  if (ring) return language === "hi" ? `घेरा ${ring[1]}` : `ring ${ring[1]}`;
  const base = zone.replace(/-\d+$/, "");
  const word = ZONE_WORDS[base]?.[language] ?? base;
  const n = /-(\d+)$/.exec(zone)?.[1];
  return n ? `${word} ${n}` : word;
}

function drawingAllowed(inputMode: InputMode) {
  return inputMode === "touch" || inputMode === "air-denied" || inputMode === "air";
}

/**
 * Rangoli / kolam stage: the provider's design (chalk outlines with fillable
 * regions), a palette of named colours, and her own tracing layer on top.
 */
export function RangoliCanvas({
  design,
  strokes,
  inputMode,
  onStroke,
  onInputModeReport,
  onFillRegion,
  palette,
  selectedColour,
  language,
  className,
  initialMode = "fill",
  inkColor = STAGE.ink,
}: RangoliCanvasProps) {
  const air = useAirWriting({ inputMode, onInputModeReport });
  const hi = language === "hi";
  const hostRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<RangoliMode>(initialMode);
  const [colour, setColour] = useState<string | undefined>(selectedColour ?? palette[0]?.id);

  useEffect(() => {
    if (selectedColour) setColour(selectedColour);
  }, [selectedColour]);
  useEffect(() => {
    if (!colour && palette[0]) setColour(palette[0].id);
  }, [colour, palette]);
  // Writing in the air means tracing.
  useEffect(() => {
    if (inputMode === "air" || inputMode === "air-requested") setMode("trace");
  }, [inputMode]);

  const svg = useMemo(() => (design ? sanitizeSvg(design.svg) : ""), [design?.svg]);
  const aspect = useMemo(() => svgAspect(svg, 1), [svg]);
  const markup = useMemo(() => ({ __html: svg }), [svg]);

  const hexFor = useCallback(
    (id: string | undefined): string | undefined => {
      if (!id) return undefined;
      if (id.startsWith("#")) return id;
      return (
        palette.find((p) => p.id === id)?.hex ??
        (COLOURS as Record<string, { hex: string } | undefined>)[id]?.hex
      );
    },
    [palette],
  );
  const nameFor = useCallback(
    (id: string | undefined) => {
      if (!id) return hi ? "खाली" : "empty";
      const p = palette.find((c) => c.id === id);
      return p ? (hi ? p.hi : p.en) : id;
    },
    [hi, palette],
  );

  // Apply fills to the inlined design: the fills map is authoritative.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !design) return;
    const fills = design.fills ?? {};
    // Decorative lines drawn over a region (a motif, a ring outline) must not
    // swallow her tap: only regions, and what is inside them, take pointer input.
    host.querySelectorAll<SVGElement>("svg *").forEach((el) => {
      if (!el.closest("[data-region-id]")) el.style.pointerEvents = "none";
    });
    host.querySelectorAll<SVGElement>("[data-region-id]").forEach((el) => {
      const id = el.getAttribute("data-region-id") ?? "";
      if (!el.hasAttribute("data-orig-fill")) {
        el.setAttribute("data-orig-fill", el.getAttribute("fill") ?? "");
        el.setAttribute("data-orig-stroke", el.getAttribute("stroke") ?? "");
      }
      const origFill = el.getAttribute("data-orig-fill") ?? "";
      const origStroke = el.getAttribute("data-orig-stroke") ?? "";
      const colourId = fills[id]?.colour;
      const hex = hexFor(colourId);
      const isGroup = el.tagName.toLowerCase() === "g";
      const isLine =
        !isGroup &&
        (el.closest('[data-layer="lines"]') !== null || el.getAttribute("data-zone") === "loop");
      el.setAttribute("data-fill", hex && colourId ? colourId : "none");
      el.setAttribute("data-role", isGroup ? "dots" : isLine ? "line" : "area");
      if (isGroup) {
        el.setAttribute("fill", hex ?? lineOn(origFill));
      } else if (isLine) {
        el.setAttribute("stroke", hex ?? lineOn(origStroke));
      } else {
        el.setAttribute("fill", hex ?? "none");
        el.setAttribute("stroke", lineOn(origStroke));
      }
      const label = `${zoneLabel(el.getAttribute("data-zone") ?? "", language)}: ${nameFor(hex ? colourId : undefined)}`;
      el.setAttribute("aria-label", label);
      el.setAttribute("role", "button");
      el.setAttribute("tabindex", mode === "fill" ? "0" : "-1");
    });
  }, [design, svg, hexFor, nameFor, language, mode]);

  const fillTarget = (target: EventTarget | null) => {
    if (mode !== "fill" || !colour) return;
    const el = (target as Element | null)?.closest?.("[data-region-id]");
    const id = el?.getAttribute("data-region-id");
    if (!el || !id) return;
    onFillRegion(id, colour);
    el.setAttribute("data-flash", "true");
    window.setTimeout(() => el.removeAttribute("data-flash"), 420);
  };

  const traceEnabled = mode === "trace" && drawingAllowed(inputMode);
  const cameraLive = air.status === "running" || air.status === "starting";
  const showStartOverlay = mode === "trace" && inputMode === "air-requested" && air.status !== "running";
  const showStartBar = mode === "trace" && inputMode === "air" && !cameraLive;
  const showStop = cameraLive && (inputMode === "air" || inputMode === "air-requested");
  const deniedNote =
    mode === "trace" &&
    (inputMode === "air-denied" || air.status === "denied" || air.status === "failed");
  const regionCount = design?.regions.length ?? 0;
  const hostId = "rangoli-design";

  return (
    <section
      data-testid="rangoli-canvas"
      data-kind={design?.kind ?? "none"}
      data-my-strokes={strokes.length}
      data-region-count={regionCount}
      data-canvas-mode={mode}
      data-input-mode={inputMode}
      data-drawing-enabled={traceEnabled ? "true" : "false"}
      data-air-status={air.status}
      lang={language}
      className={`flex w-full flex-col items-center gap-5 lg:flex-row lg:items-start lg:justify-center lg:gap-8 ${className ?? ""}`}
    >
      <style>{`
        [data-rangoli-host] svg { width: 100%; height: 100%; display: block; overflow: visible; }
        [data-rangoli-host] [data-region-id] { pointer-events: none; transition: fill .25s ease, stroke .25s ease; }
        [data-rangoli-host][data-mode="fill"] [data-region-id][data-role="area"] { pointer-events: all; cursor: pointer; }
        [data-rangoli-host][data-mode="fill"] [data-region-id][data-role="line"] { pointer-events: stroke; cursor: pointer; }
        [data-rangoli-host][data-mode="fill"] [data-region-id][data-role="dots"] { pointer-events: painted; cursor: pointer; }
        [data-rangoli-host][data-mode="fill"] [data-region-id]:hover { filter: brightness(1.18); }
        [data-rangoli-host] [data-region-id]:focus { outline: none; }
        [data-rangoli-host] [data-region-id]:focus-visible { stroke: ${STAGE.teal}; stroke-width: 7px; paint-order: stroke; }
        [data-rangoli-host] [data-region-id][data-flash="true"] { filter: brightness(1.45) drop-shadow(0 0 10px rgba(242,169,59,.8)); }
        @media (prefers-reduced-motion: reduce) {
          [data-rangoli-host] [data-region-id] { transition: none; }
          [data-rangoli-host] [data-region-id][data-flash="true"] { filter: none; }
        }
      `}</style>

      <div
        className="relative isolate aspect-square w-full max-w-[min(100%,calc(100dvh-16rem))] min-w-0 overflow-hidden rounded-[clamp(18px,3vw,32px)] border lg:max-w-[min(100%,calc(100dvh-7rem))]"
        style={{
          borderColor: "rgba(138,75,46,0.22)",
          background: "radial-gradient(85% 85% at 50% 50%, #FFFCF6 0%, #F8EFE2 55%, #EFE2CF 100%)",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.7), 0 2px 6px rgba(70,50,30,0.05), 0 18px 44px rgba(70,50,30,0.10)",
        }}
      >
        <div className="absolute inset-[4%]">
          {design ? (
            <div
              id={hostId}
              ref={hostRef}
              data-rangoli-host=""
              data-mode={mode}
              role="group"
              aria-label={hi ? design.altHi : design.altEn}
              className="absolute inset-0"
              style={{ aspectRatio: String(aspect) }}
              dangerouslySetInnerHTML={markup}
              onClick={(event) => fillTarget(event.target)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  fillTarget(event.target);
                }
              }}
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-center">
              <p className="max-w-xs text-lg sm:text-2xl" style={{ color: STAGE.textSoft }}>
                {hi ? "अभी कोई रंगोली नहीं बनी" : "No design yet"}
              </p>
            </div>
          )}
          <StrokeLayer
            strokes={strokes}
            enabled={traceEnabled}
            onStroke={onStroke}
            inkColor={inkColor}
            inkWidth={0.011}
            aspect={aspect}
            halo
            penSource={air.penSource}
            ariaLabel={hi ? `आपकी लकीरें: ${strokes.length}` : `Your strokes: ${strokes.length}`}
          />
        </div>

        {deniedNote && !cameraLive ? (
          <p
            role="status"
            className="pointer-events-none absolute top-[3%] left-1/2 z-10 w-max max-w-[90%] -translate-x-1/2 rounded-full px-4 py-2 text-center text-sm font-medium sm:text-base"
            style={{ backgroundColor: "rgba(255,253,249,0.94)", color: STAGE.text, boxShadow: "0 4px 14px rgba(70,50,30,0.12)" }}
          >
            {air.status === "failed" ? airCopy("failed", language) : airCopy("denied", language)}
          </p>
        ) : null}

        {showStartOverlay ? (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 p-4 text-center"
            style={{ backgroundColor: "rgba(250,246,239,0.82)" }}
          >
            <StartAirButton language={language} onStart={air.start} busy={air.status === "starting"} />
            <p className="max-w-sm text-sm font-medium sm:text-base" style={{ color: STAGE.text }}>
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
          <div className="absolute top-[3%] right-[3%] z-10">
            <StopAirButton language={language} onStop={air.stop} />
          </div>
        ) : null}
        <div className="absolute bottom-[3%] left-[3%] z-10">
          <AirPreview language={language} previewRef={air.previewRef} status={air.status} />
        </div>
      </div>

      <div className="flex w-full max-w-xl flex-col gap-5 lg:w-[22rem] lg:max-w-none lg:pt-2">
        <div
          role="group"
          aria-label={hi ? "क्या करना है" : "Tool"}
          className="grid grid-cols-2 gap-3"
        >
          {(
            [
              { id: "fill", hi: "रंग भरें", en: "Fill", Icon: PaintBucket },
              { id: "trace", hi: "रेखा खींचें", en: "Trace", Icon: PenLine },
            ] as const
          ).map(({ id, hi: hiLabel, en, Icon }) => {
            const active = mode === id;
            return (
              <button
                key={id}
                type="button"
                data-testid={`rangoli-mode-${id}`}
                aria-pressed={active}
                onClick={() => setMode(id)}
                className={`${FOCUS_RING} flex min-h-16 items-center justify-center gap-2.5 rounded-2xl border-2 px-3 text-lg font-semibold transition-colors motion-reduce:transition-none sm:text-xl`}
                style={
                  active
                    ? { backgroundColor: STAGE.teal, borderColor: STAGE.teal, color: STAGE.paper }
                    : { backgroundColor: "#FFFDF9", borderColor: "rgba(45,38,32,0.16)", color: STAGE.text }
                }
              >
                <Icon aria-hidden="true" className="size-6 shrink-0" />
                <span className="flex flex-col items-start leading-tight">
                  <span>{hi ? hiLabel : en}</span>
                  <span className="text-xs font-medium opacity-75 sm:text-sm">{hi ? en : hiLabel}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div role="group" aria-label={hi ? "रंग चुनें" : "Choose a colour"}>
          <p className="mb-2 text-base font-semibold sm:text-lg" style={{ color: STAGE.text }}>
            {hi ? "रंग चुनें" : "Choose a colour"}
          </p>
          <div className="flex flex-wrap justify-center gap-x-2 gap-y-3 sm:justify-start lg:grid lg:grid-cols-4">
            {palette.map((p) => {
              const active = p.id === colour;
              return (
                <button
                  key={p.id}
                  type="button"
                  data-testid={`colour-${p.id}`}
                  aria-pressed={active}
                  aria-label={hi ? `${p.hi} (${p.en})` : `${p.en} (${p.hi})`}
                  onClick={() => {
                    setColour(p.id);
                    setMode("fill");
                  }}
                  className={`${FOCUS_RING} flex w-[4.75rem] flex-col items-center gap-1.5 rounded-2xl px-1 py-1.5 transition-colors motion-reduce:transition-none`}
                  style={{ backgroundColor: active ? "rgba(43,107,108,0.09)" : "transparent" }}
                >
                  <span
                    aria-hidden="true"
                    className="relative grid size-14 place-items-center rounded-full"
                    style={{
                      backgroundColor: p.hex,
                      boxShadow: active
                        ? `0 0 0 3px ${STAGE.paper}, 0 0 0 6px ${STAGE.teal}`
                        : "inset 0 0 0 2px rgba(0,0,0,0.10), 0 0 0 1px rgba(45,38,32,0.16)",
                    }}
                  >
                    {active ? (
                      <Check
                        className="size-7"
                        strokeWidth={3}
                        style={{ color: p.id === "safed" || p.id === "peela" ? STAGE.text : "#FFFFFF" }}
                      />
                    ) : null}
                  </span>
                  <span className="text-base leading-none font-semibold" style={{ color: STAGE.text }}>
                    {hi ? p.hi : p.en}
                  </span>
                  <span className="text-xs leading-none opacity-70" style={{ color: STAGE.text }}>
                    {hi ? p.en : p.hi}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <p className="text-sm leading-snug sm:text-base" style={{ color: STAGE.textSoft }}>
          {mode === "fill"
            ? hi
              ? `रंग चुनिए, फिर डिज़ाइन के किसी हिस्से को छुइए। अभी: ${nameFor(colour)}`
              : `Pick a colour, then touch a part of the design. Now: ${nameFor(colour)}`
            : hi
              ? "उंगली से चॉक की रेखाओं के ऊपर खींचिए"
              : "Draw over the chalk lines with your finger"}
        </p>
      </div>
    </section>
  );
}
