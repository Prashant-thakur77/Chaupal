"use client";

import { Camera, CameraOff, Hand } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  CameraUnavailableError,
  createPendingCameraRequest,
} from "@/features/calligraphy/runtime/camera-source";

import { startAirTracker, type AirTracker } from "./air-tracker";
import { FOCUS_RING } from "./svg-utils";
import type {
  CanvasLanguage,
  InputMode,
  InputModeReport,
  PenSample,
  PenSource,
} from "./types";

export type AirStatus = "idle" | "starting" | "running" | "denied" | "failed";

/**
 * Owns the camera for one canvas. `start` must be called synchronously from a
 * click on a visible button: it is the only place getUserMedia is reached.
 */
export function useAirWriting({
  inputMode,
  onInputModeReport,
}: {
  inputMode: InputMode;
  onInputModeReport: (mode: InputModeReport) => void;
}) {
  const [status, setStatus] = useState<AirStatus>("idle");
  const trackerRef = useRef<AirTracker | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef(onInputModeReport);
  reportRef.current = onInputModeReport;
  const listeners = useRef(new Set<(sample: PenSample) => void>());

  const penSource = useMemo<PenSource>(
    () => ({
      subscribe(listener) {
        listeners.current.add(listener);
        return () => listeners.current.delete(listener);
      },
    }),
    [],
  );

  const release = useCallback(() => {
    const tracker = trackerRef.current;
    trackerRef.current = null;
    tracker?.stop();
    const host = previewRef.current;
    if (host) host.replaceChildren();
  }, []);

  const start = useCallback(() => {
    if (trackerRef.current) return;
    // Called inside the click handler: getUserMedia runs in this gesture.
    const request = createPendingCameraRequest();
    const tracker = startAirTracker(request, {
      onPen: (sample) => {
        for (const listener of listeners.current) listener(sample);
      },
      onFailure: (error) => {
        console.error(error);
        if (trackerRef.current !== tracker) return;
        release();
        setStatus("failed");
        reportRef.current("air-denied");
      },
    });
    trackerRef.current = tracker;
    setStatus("starting");
    void tracker.video.then((video) => {
      if (trackerRef.current !== tracker) return;
      const host = previewRef.current;
      if (!host) return;
      video.setAttribute("aria-hidden", "true");
      video.className = "h-full w-full object-cover -scale-x-100";
      host.replaceChildren(video);
      void video.play().catch(() => undefined);
    }, () => undefined);
    tracker.ready.then(
      () => {
        if (trackerRef.current !== tracker) return;
        setStatus("running");
        reportRef.current("air");
      },
      (error: unknown) => {
        if (trackerRef.current !== tracker) return;
        release();
        const denied =
          error instanceof CameraUnavailableError && error.reason === "denied";
        if (!denied) console.error(error);
        setStatus(denied ? "denied" : "failed");
        reportRef.current("air-denied");
      },
    );
  }, [release]);

  const stop = useCallback(() => {
    release();
    setStatus("idle");
    reportRef.current("touch");
  }, [release]);

  // The session moved away from air-writing: close the camera quietly.
  useEffect(() => {
    if (inputMode === "air" || inputMode === "air-requested") return;
    if (trackerRef.current) {
      release();
      setStatus("idle");
    }
  }, [inputMode, release]);

  useEffect(() => release, [release]);

  return { status, start, stop, penSource, previewRef };
}

const COPY = {
  start: { hi: "कैमरा चालू करें, हवा में लिखें", en: "Start camera to write in the air" },
  stop: { hi: "कैमरा बंद करें", en: "Turn camera off" },
  starting: { hi: "कैमरा खुल रहा है… हाथ कैमरे को दिखाइए", en: "Opening the camera… show your hand to it" },
  running: {
    hi: "मुट्ठी बंद करें तो लिखेगा, हाथ खोलें तो रुकेगा",
    en: "Close your hand to write, open it to lift the pen",
  },
  denied: {
    hi: "कोई बात नहीं, उंगली से स्क्रीन पर लिखिए",
    en: "That's fine. Write on the screen with your finger",
  },
  failed: {
    hi: "कैमरा से हाथ नहीं पहचान पाए, उंगली से लिखिए",
    en: "Couldn't follow your hand. Write with your finger instead",
  },
  privacy: {
    hi: "वीडियो इसी फ़ोन में रहता है, कहीं भेजा नहीं जाता",
    en: "Video stays on this device. Nothing is sent",
  },
} as const;

export function airCopy(key: keyof typeof COPY, language: CanvasLanguage) {
  return COPY[key][language];
}

/** The big start button shown when she asked to write in the air. */
export function StartAirButton({
  language,
  onStart,
  busy,
}: {
  language: CanvasLanguage;
  onStart: () => void;
  busy: boolean;
}) {
  return (
    <button
      type="button"
      data-testid="start-air-camera"
      onClick={onStart}
      disabled={busy}
      aria-busy={busy}
      className={`${FOCUS_RING} inline-flex min-h-16 max-w-full items-center justify-center gap-3 rounded-full px-7 py-3 text-lg font-semibold shadow-[0_18px_40px_rgba(0,0,0,0.45)] transition-[transform,background-color] hover:brightness-105 active:scale-[0.98] disabled:cursor-wait disabled:opacity-80 motion-reduce:transition-none sm:text-xl`}
      style={{ backgroundColor: "#F2A93B", color: "#14122B" }}
    >
      <Camera aria-hidden="true" className="size-7 shrink-0" strokeWidth={2.2} />
      <span className="text-balance text-left leading-snug">
        {busy ? airCopy("starting", language) : airCopy("start", language)}
      </span>
    </button>
  );
}

export function StopAirButton({
  language,
  onStop,
}: {
  language: CanvasLanguage;
  onStop: () => void;
}) {
  return (
    <button
      type="button"
      data-testid="stop-air-camera"
      onClick={onStop}
      className={`${FOCUS_RING} inline-flex min-h-14 items-center justify-center gap-2.5 rounded-full border-2 px-5 py-2 text-base font-semibold transition-colors hover:bg-white/10 motion-reduce:transition-none sm:text-lg`}
      style={{ borderColor: "#F4EFE6", color: "#F4EFE6", backgroundColor: "rgba(20,18,43,0.72)" }}
    >
      <CameraOff aria-hidden="true" className="size-6 shrink-0" />
      {airCopy("stop", language)}
    </button>
  );
}

/** Small mirrored camera preview with the gesture hint, in air mode. */
export function AirPreview({
  language,
  previewRef,
  status,
}: {
  language: CanvasLanguage;
  previewRef: React.RefObject<HTMLDivElement | null>;
  status: AirStatus;
}) {
  const live = status === "running" || status === "starting";
  return (
    <div
      className={`pointer-events-none flex items-end gap-3 ${live ? "" : "hidden"}`}
      data-testid="air-preview"
    >
      <div
        className="relative aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-2xl border-2 bg-black/60 sm:w-32"
        style={{ borderColor: "#F2A93B" }}
      >
        <div ref={previewRef} className="absolute inset-0" />
        <Hand
          aria-hidden="true"
          className="absolute right-1.5 bottom-1.5 size-5"
          style={{ color: "#F2A93B" }}
        />
      </div>
      <p
        className="max-w-[16rem] rounded-2xl px-3 py-2 text-sm leading-snug font-medium sm:text-base"
        style={{ backgroundColor: "rgba(20,18,43,0.82)", color: "#F4EFE6" }}
      >
        {status === "starting" ? airCopy("starting", language) : airCopy("running", language)}
        <span className="mt-1 block text-xs opacity-75 sm:text-sm">
          {airCopy("privacy", language)}
        </span>
      </p>
    </div>
  );
}
