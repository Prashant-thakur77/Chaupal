import { useCallback, useEffect, useState } from "react";
import { Link, useLoaderData } from "react-router";

import { RangoliCanvas } from "@/components/canvas/RangoliCanvas";
import type {
  InputMode,
  PaletteColour,
  RangoliDesignView,
  Stroke,
  StrokeInput,
} from "@/components/canvas/types";

export function meta() {
  return [{ title: "Rangoli lab — Chaupal" }];
}

const MODES: InputMode[] = ["none", "touch", "air-requested", "air", "air-denied"];
const KINDS = ["rangoli", "pulli", "pookalam"] as const;
type Kind = (typeof KINDS)[number];

const PALETTE: PaletteColour[] = [
  { id: "laal", hex: "#E5483B", hi: "लाल", en: "laal" },
  { id: "peela", hex: "#F7C948", hi: "पीला", en: "peela" },
  { id: "hara", hex: "#4DB36B", hi: "हरा", en: "hara" },
  { id: "neela", hex: "#4C8FE6", hi: "नीला", en: "neela" },
  { id: "gulabi", hex: "#F27BB0", hi: "गुलाबी", en: "gulabi" },
  { id: "kesariya", hex: "#F78B2D", hi: "केसरिया", en: "kesariya" },
  { id: "safed", hex: "#FBF8F1", hi: "सफ़ेद", en: "safed" },
];

/** Three concentric rings, for when the design engine is unavailable. */
function placeholderDesign(): RangoliDesignView {
  const ring = (r1: number, r2: number) =>
    `M${500 - r2} 500a${r2} ${r2} 0 1 0 ${2 * r2} 0a${r2} ${r2} 0 1 0 ${-2 * r2} 0Z` +
    `M${500 - r1} 500a${r1} ${r1} 0 1 1 ${2 * r1} 0a${r1} ${r1} 0 1 1 ${-2 * r1} 0Z`;
  const regions = [
    { id: "center", zone: "center", d: `M380 500a120 120 0 1 0 240 0a120 120 0 1 0 -240 0Z` },
    { id: "ring-1", zone: "ring-1", d: ring(120, 260) },
    { id: "ring-2", zone: "ring-2", d: ring(260, 420) },
  ];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000" data-kind="rangoli">` +
    `<g data-layer="areas" stroke-linejoin="round">` +
    regions
      .map(
        (r) =>
          `<path data-region-id="${r.id}" data-zone="${r.zone}" data-fill="none" fill="none" fill-rule="evenodd" stroke="#F4EFE6" stroke-width="4" pointer-events="all" d="${r.d}"/>`,
      )
      .join("") +
    `</g></svg>`;
  return {
    kind: "rangoli",
    svg,
    regions: regions.map(({ id, zone }) => ({ id, zone })),
    fills: {},
    altHi: "तीन घेरों वाली रंगोली",
    altEn: "A rangoli of three rings",
  };
}

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const kindParam = url.searchParams.get("kind");
  const kind: Kind = (KINDS as readonly string[]).includes(kindParam ?? "")
    ? (kindParam as Kind)
    : "rangoli";
  try {
    const kolam = await import("@/engines/kolam");
    const params =
      kind === "pulli"
        ? ({ kind: "pulli", grid: 5, symmetry: "4-fold", loops: "single", seed: 3 } as const)
        : kind === "pookalam"
          ? ({ kind: "pookalam", rings: 5 } as const)
          : ({
              kind: "rangoli",
              template: "radial",
              rings: 3,
              petals: 8,
              motifs: ["lotus", "diya", "geometric"],
            } as const);
    const d = kolam.generateDesign(
      structuredClone(params) as Parameters<typeof kolam.generateDesign>[0],
    );
    const fills: RangoliDesignView["fills"] = {};
    for (const r of d.regions) if (r.fill !== "none") fills[r.id] = { colour: r.fill };
    const design: RangoliDesignView = {
      kind: d.kind,
      svg: d.svg,
      regions: d.regions.map((r) => ({ id: r.id, zone: r.zone })),
      fills,
      altHi: d.altHi,
      altEn: d.altEn,
    };
    return { design, source: "engine" as const };
  } catch (error) {
    console.error("lab.rangoli: design engine unavailable, using placeholder", error);
    return { design: placeholderDesign(), source: "placeholder" as const };
  }
}

const CHALK = "#F4EFE6";

export default function RangoliLabRoute() {
  const loaded = useLoaderData<typeof loader>();
  const [design, setDesign] = useState<RangoliDesignView>(loaded.design);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [inputMode, setInputMode] = useState<InputMode>("touch");
  const [language, setLanguage] = useState<"hi" | "en">("hi");
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => setDesign(loaded.design), [loaded.design]);
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

  const onFillRegion = useCallback((regionId: string, colour: string) => {
    setDesign((d) => ({ ...d, fills: { ...d.fills, [regionId]: { colour } } }));
    setLog((l) => [`fill ${regionId} → ${colour}`, ...l].slice(0, 6));
  }, []);

  const onInputModeReport = useCallback((mode: "air" | "air-denied" | "touch") => {
    setInputMode(mode);
    setLog((l) => [`camera → ${mode}`, ...l].slice(0, 6));
  }, []);

  const chip = (active: boolean) =>
    `inline-flex min-h-12 items-center rounded-full border-2 px-4 text-base font-semibold outline-none focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#F4EFE6] ${
      active ? "border-[#F2A93B] bg-[#F2A93B] text-[#14122B]" : "border-[#F4EFE6]/30 text-[#F4EFE6]"
    }`;

  return (
    <main
      className="min-h-full w-full overflow-y-auto px-4 py-6 sm:px-8"
      style={{ background: "#14122B", color: CHALK }}
    >
      <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold tracking-wide text-[#F2A93B] uppercase">Lab · {loaded.source}</p>
            <h1 className="text-2xl font-semibold sm:text-3xl">रंगोली · Rangoli</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <Link key={k} to={`?kind=${k}`} reloadDocument className={chip(k === design.kind)}>
                {k}
              </Link>
            ))}
          </div>
        </header>

        <RangoliCanvas
          design={design}
          strokes={strokes}
          inputMode={inputMode}
          onStroke={onStroke}
          onInputModeReport={onInputModeReport}
          onFillRegion={onFillRegion}
          palette={PALETTE}
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
          <button type="button" data-testid="lab-clear" className={chip(false)} onClick={() => setStrokes([])}>
            {language === "hi" ? "मेरी लकीरें मिटाएँ" : "Erase my lines"}
          </button>
          <button
            type="button"
            className={chip(false)}
            onClick={() => setDesign((d) => ({ ...d, fills: {} }))}
          >
            {language === "hi" ? "रंग हटाएँ" : "Clear colours"}
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
