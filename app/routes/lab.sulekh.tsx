import { useCallback, useEffect, useState } from "react";
import { Link, useLoaderData } from "react-router";

import { SulekhCanvas } from "@/components/canvas/SulekhCanvas";
import type {
  InputMode,
  Stroke,
  StrokeInput,
  SulekhReferenceView,
} from "@/components/canvas/types";

export function meta() {
  return [{ title: "Sulekh lab — Chaupal" }];
}

const PHRASES = ["शुभ दीपावली", "शांति", "ॐ", "सत्यमेव जयते"];
const MODES: InputMode[] = ["none", "touch", "air-requested", "air", "air-denied"];

const PLACEHOLDER_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 1000"><g fill="#000">' +
  '<path d="M300 380h900v34H300z"/>' +
  '<path d="M520 414c-60 20-120 90-110 180 10 92 96 150 186 120 40-14 58-40 54-70-30 26-70 34-110 20-56-20-76-80-60-134 14-46 50-80 92-96z"/>' +
  '<path d="M760 414h40v330h-40zM980 414c40 60 60 140 40 210-16 56-60 104-120 120l-10-34c44-16 74-50 84-94 14-60-2-130-34-190z"/>' +
  "</g></svg>";

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const text = (url.searchParams.get("text") || PHRASES[0]!).normalize("NFC");
  const style = url.searchParams.get("style") || "kalam";
  try {
    const sulekh = await import("@/engines/sulekh");
    const script = sulekh.detectScript(text).script ?? "devanagari";
    const font = sulekh.fontFor(script, style as Parameters<typeof sulekh.fontFor>[1]);
    const ref = await sulekh.renderReference({
      text,
      script,
      style: style as Parameters<typeof sulekh.fontFor>[1],
      size: "medium",
      fontBytes: await sulekh.loadFontBytesNode(font.id),
      fontId: font.id,
    });
    const reference: SulekhReferenceView = {
      text: ref.textNFC,
      svg: ref.svg,
      altHi: ref.altHi,
      altEn: ref.altEn,
      script: ref.script,
      style: ref.style,
    };
    return { reference, source: "engine" as const };
  } catch (error) {
    console.error("lab.sulekh: engine render failed, using placeholder", error);
    const reference: SulekhReferenceView = {
      text,
      svg: PLACEHOLDER_SVG,
      altHi: `संदर्भ: ${text}`,
      altEn: `Reference: ${text}`,
      script: "devanagari",
      style,
    };
    return { reference, source: "placeholder" as const };
  }
}

const CHALK = "#F4EFE6";

export default function SulekhLabRoute() {
  const { reference, source } = useLoaderData<typeof loader>();
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [inputMode, setInputMode] = useState<InputMode>("touch");
  const [language, setLanguage] = useState<"hi" | "en">("hi");
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    if (mode && (MODES as string[]).includes(mode)) setInputMode(mode as InputMode);
    const lang = params.get("lang");
    if (lang === "en" || lang === "hi") setLanguage(lang);
  }, []);

  const onStroke = useCallback((points: number[][], input: StrokeInput) => {
    setStrokes((list) => [
      ...list,
      { id: `s${list.length + 1}-${Date.now().toString(36)}`, points, author: "elder", input },
    ]);
    setLog((l) => [`stroke ${input} · ${points.length} pts`, ...l].slice(0, 6));
  }, []);

  const onInputModeReport = useCallback((mode: "air" | "air-denied" | "touch") => {
    setInputMode(mode);
    setLog((l) => [`camera → ${mode}`, ...l].slice(0, 6));
  }, []);

  const chip = (active: boolean) =>
    `min-h-12 rounded-full border-2 px-4 text-base font-semibold outline-none focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#F4EFE6] ${
      active ? "border-[#F2A93B] bg-[#F2A93B] text-[#14122B]" : "border-[#F4EFE6]/30 text-[#F4EFE6]"
    }`;

  return (
    <main
      className="min-h-full w-full overflow-y-auto px-4 py-6 sm:px-8"
      style={{ background: "#14122B", color: CHALK }}
    >
      <div className="mx-auto flex w-full max-w-[min(72rem,calc((100dvh-15rem)*1.5))] min-w-0 flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold tracking-wide text-[#F2A93B] uppercase">Lab · {source}</p>
            <h1 className="text-2xl font-semibold sm:text-3xl">सुलेख · Sulekh</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {PHRASES.map((p) => (
              <Link key={p} to={`?text=${encodeURIComponent(p)}`} reloadDocument className={chip(p === reference.text)}>
                <span className="inline-flex h-full items-center">{p}</span>
              </Link>
            ))}
          </div>
        </header>

        <SulekhCanvas
          reference={reference}
          strokes={strokes}
          inputMode={inputMode}
          onStroke={onStroke}
          onInputModeReport={onInputModeReport}
          language={language}
        />

        <div className="flex flex-wrap items-center gap-2">
          {MODES.map((m) => (
            <button key={m} type="button" className={chip(m === inputMode)} onClick={() => setInputMode(m)}>
              {m}
            </button>
          ))}
          <button type="button" className={chip(false)} onClick={() => setLanguage(language === "hi" ? "en" : "hi")}>
            {language === "hi" ? "English" : "हिंदी"}
          </button>
          <button
            type="button"
            data-testid="lab-clear"
            className={chip(false)}
            onClick={() => setStrokes([])}
          >
            {language === "hi" ? "मेरी लकीरें मिटाएँ" : "Erase my lines"}
          </button>
        </div>
        <ul className="text-sm opacity-70" data-testid="lab-log">
          {log.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>
    </main>
  );
}
