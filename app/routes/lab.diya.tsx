import { useEffect, useState } from "react";

import {
  DIYA_PHASES,
  DIYA_PHASE_LABELS,
  LivingDiya,
  type DiyaPhase,
} from "@/components/diya/LivingDiya";

export function meta() {
  return [{ title: "Diya lab — Chaupal" }];
}

const CHALK = "#F4EFE6";

export default function DiyaLabRoute() {
  const [phase, setPhase] = useState<DiyaPhase>("ready");
  const [language, setLanguage] = useState<"hi" | "en">("hi");
  const [reaction, setReaction] = useState<"celebrate" | "recoil" | null>(null);
  const [showCaption, setShowCaption] = useState(true);
  // ?solo shows only the hero diya (handy for GPU profiling).
  const [solo, setSolo] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initial = params.get("phase");
    if (initial && (DIYA_PHASES as readonly string[]).includes(initial)) {
      setPhase(initial as DiyaPhase);
    }
    const lang = params.get("lang");
    if (lang === "en" || lang === "hi") setLanguage(lang);
    setSolo(params.has("solo"));
  }, []);

  useEffect(() => {
    if (!reaction) return;
    const timer = window.setTimeout(() => setReaction(null), 1400);
    return () => window.clearTimeout(timer);
  }, [reaction]);

  const labels = DIYA_PHASE_LABELS[language];

  return (
    <main
      className="min-h-full w-full overflow-x-hidden"
      style={{
        background:
          "radial-gradient(120% 80% at 50% 30%, #1E1A3A 0%, #14122B 70%)",
        color: CHALK,
      }}
    >
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 px-4 py-8 sm:py-12">
        <header className="flex w-full items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {solo ? null : (
              <LivingDiya phase={phase} size={64} language={language} caption={null} />
            )}
            <div>
              <h1 className="text-lg font-semibold leading-tight">Diya lab</h1>
              <p className="text-sm opacity-70">
                {language === "hi" ? "दीया की हर अवस्था" : "Every phase of the diya"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLanguage(language === "hi" ? "en" : "hi")}
            className="rounded-full border px-3 py-1.5 text-sm"
            style={{ borderColor: "rgb(244 239 230 / 0.3)" }}
            data-testid="diya-lang"
          >
            {language === "hi" ? "English" : "हिन्दी"}
          </button>
        </header>

        <section
          className="flex w-full flex-col items-center"
          data-testid="diya-hero"
        >
          <LivingDiya
            phase={phase}
            size={280}
            language={language}
            reaction={reaction}
            caption={showCaption ? labels[phase] : null}
          />
        </section>

        <div
          className="flex flex-wrap justify-center gap-2"
          role="group"
          aria-label="Phase"
        >
          {DIYA_PHASES.map((p) => (
            <button
              key={p}
              type="button"
              data-testid={`diya-phase-${p}`}
              aria-pressed={phase === p}
              onClick={() => setPhase(p)}
              className="rounded-full border px-3.5 py-2 text-sm transition-colors"
              style={{
                borderColor:
                  phase === p ? "#F2A93B" : "rgb(244 239 230 / 0.22)",
                background: phase === p ? "rgb(242 169 59 / 0.16)" : "transparent",
                color: phase === p ? "#F9D08A" : CHALK,
              }}
            >
              {labels[p]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap justify-center gap-2 text-sm">
          <button
            type="button"
            data-testid="diya-react-celebrate"
            onClick={() => setReaction("celebrate")}
            className="rounded-full border px-3 py-1.5"
            style={{ borderColor: "rgb(244 239 230 / 0.22)" }}
          >
            {language === "hi" ? "खुशी" : "Celebrate"}
          </button>
          <button
            type="button"
            data-testid="diya-react-recoil"
            onClick={() => setReaction("recoil")}
            className="rounded-full border px-3 py-1.5"
            style={{ borderColor: "rgb(244 239 230 / 0.22)" }}
          >
            {language === "hi" ? "झटका" : "Recoil"}
          </button>
          <button
            type="button"
            onClick={() => setShowCaption((v) => !v)}
            className="rounded-full border px-3 py-1.5"
            style={{ borderColor: "rgb(244 239 230 / 0.22)" }}
          >
            {showCaption
              ? language === "hi"
                ? "कैप्शन छिपाएँ"
                : "Hide caption"
              : language === "hi"
                ? "कैप्शन दिखाएँ"
                : "Show caption"}
          </button>
        </div>

        {solo ? null : (
        <section className="w-full" data-testid="diya-sizes">
          <h2 className="mb-3 text-sm uppercase tracking-wider opacity-60">
            {language === "hi" ? "आकार" : "Sizes"}
          </h2>
          <div className="flex flex-wrap items-end justify-center gap-6">
            {[40, 64, 120, 180].map((s) => (
              <div key={s} className="flex flex-col items-center gap-1">
                <LivingDiya phase={phase} size={s} language={language} />
                <span className="text-xs opacity-60">{s}px</span>
              </div>
            ))}
            <div className="flex flex-col items-center gap-1">
              <div
                className="h-40 w-56 rounded-2xl border"
                style={{ borderColor: "rgb(244 239 230 / 0.15)" }}
              >
                <LivingDiya phase={phase} size="fill" language={language} />
              </div>
              <span className="text-xs opacity-60">fill</span>
            </div>
          </div>
        </section>
        )}
      </div>
    </main>
  );
}
