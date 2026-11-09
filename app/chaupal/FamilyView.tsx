import { Suspense, lazy } from "react";

import { LivingDiya } from "@/components/diya/LivingDiya";

import { useLiveSession } from "./live";
import { ConflictCard } from "./Overlays";
import { speechLang } from "./strings";

const ShatranjScene = lazy(() => import("./scenes/ShatranjScene"));

/**
 * The family member's phone. It shows the elder's live activity as it is (the
 * diya's phase, the reference, the design and colours, the board) and lets
 * them play their side. It never shows her camera, audio or conversation.
 */
export function FamilyView() {
  const { data, lang, t, query } = useLiveSession();
  if (query.isError) {
    return (
      <main className="ch-root ch-stage ch-family-view" data-testid="family-view" data-state="expired">
        <p className="ch-lead">{t.linkExpired}</p>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="ch-root ch-stage ch-family-view" data-testid="family-view" aria-busy="true">
        <LivingDiya phase="ready" size={96} />
      </main>
    );
  }
  const myName = data.viewer.name ?? t.family;
  return (
    <main
      className="ch-root ch-stage ch-grain ch-family-view"
      data-testid="family-view"
      data-scene={data.scene}
      data-revision={data.revision}
      lang={speechLang(lang).slice(0, 2)}
    >
      <header className="ch-topbar">
        <div className="ch-brand">
          <LivingDiya phase={(data.presence as "ready") ?? "ready"} size={48} language={lang === "en" ? "en" : "hi"} />
          <span className="ch-wordmark">{t.appName}</span>
        </div>
        <span className="ch-pill" data-testid="family-watching">
          <span className="ch-dot" aria-hidden /> {t.watching}
        </span>
      </header>
      <p className="ch-family-hint">{t.familyHint(lang === "en" ? "the elder" : "बड़ों")} · {myName}</p>
      <section className="ch-scene" data-testid={`family-scene-${data.scene}`}>
        {data.scene === "shatranj" ? (
          <Suspense fallback={null}>
            <ShatranjScene data={data} t={t} lang={lang} viewer="family" />
          </Suspense>
        ) : data.scene === "sulekh" && data.calligraphy ? (
          <figure className="ch-family-art" data-testid="family-sulekh" data-reference-text={data.calligraphy.text}>
            <div className="ch-family-svg ch-family-svg-ink" dangerouslySetInnerHTML={{ __html: data.calligraphy.svg }} />
            <svg className="ch-family-strokes" viewBox="0 0 1 0.6667" preserveAspectRatio="none" aria-hidden>
              {data.strokes.sulekh.map((s) => (
                <polyline key={s.id} points={s.points.map((p) => `${p[0]},${p[1] * 0.6667}`).join(" ")} />
              ))}
            </svg>
            <figcaption lang="hi">{data.calligraphy.text}</figcaption>
          </figure>
        ) : (data.scene === "rangoli" || data.scene === "kolam") && data.kolam ? (
          <figure className="ch-family-art" data-testid="family-rangoli">
            <div
              className="ch-family-svg"
              dangerouslySetInnerHTML={{ __html: applyFills(data.kolam.svg, data.kolam.fills) }}
            />
          </figure>
        ) : (
          <p className="ch-lead" data-testid="family-idle">{t.noActivity}</p>
        )}
      </section>
      {data.conflict ? <ConflictCard conflict={data.conflict} lang={lang} t={t} onClose={() => {}} /> : null}
    </main>
  );
}

const HEX: Record<string, string> = {
  laal: "#e0473b", peela: "#f6c33b", hara: "#43a95e", neela: "#4f7fe0",
  gulabi: "#e66ca7", kesariya: "#f28a2e", safed: "#f7f1e6", baingani: "#9b6bd3",
};

/** Paint the elder's chosen colours onto the design's regions. */
function applyFills(svg: string, fills: Record<string, { colour: string }>) {
  return svg.replace(/<path([^>]*?)data-region-id="([^"]+)"([^>]*?)\/?>/g, (whole, a, id, b) => {
    const f = fills[id];
    if (!f) return whole;
    const hex = HEX[f.colour] ?? f.colour;
    const attrs = `${a}data-region-id="${id}"${b}`.replace(/\sfill="[^"]*"/, "").replace(/\sdata-fill="[^"]*"/, "");
    return `<path${attrs} fill="${hex}" data-fill="${f.colour}"/>`;
  });
}
