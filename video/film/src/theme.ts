import { continueRender, delayRender, staticFile } from "remotion";

/** Colours from the app's own tokens (app/styles/chaupal-tokens.css). */
export const C = {
  night950: "#0e0c20",
  night900: "#15132B",
  night850: "#1b1835",
  night800: "#221E40",
  night700: "#2E2955",
  night600: "#3A345F",
  indigo500: "#3A3A92",
  indigo300: "#9C9CF0",
  marigold: "#F4A93C",
  marigold400: "#FFC866",
  marigold300: "#FFD58C",
  flame: "#FFF4D6",
  terracotta: "#D0643A",
  terracotta600: "#9A3B1C",
  clay950: "#1A0F08",
  clay800: "#3A1A0C",
  clay700: "#5A2A17",
  clay600: "#6A2611",
  clay500: "#8E5232",
  clay300: "#D7A577",
  chalk: "#F7F1E6",
  chalk100: "#F4E8D2",
  chalkSoft: "#E3D6C0",
  muted: "#BCAA8E",
  good: "#8FD69E",
  bad: "#FF8A7A",
  laal: "#E0473B",
  peela: "#F6C33B",
  hara: "#43A95E",
  gulabi: "#E66CA7",
  kesariya: "#F28A2E",
};

export const FONT = {
  display: '"Tiro Devanagari Hindi", "Tiro Devanagari", serif',
  sans: 'Mukta, "Noto Sans Devanagari", sans-serif',
  brush: '"Yatra One", serif',
};

const FACES: [string, string, string, string][] = [
  // family, file, weight, style
  ["Tiro Devanagari Hindi", "fonts/TiroDevanagariHindi-Regular.ttf", "400", "normal"],
  ["Tiro Devanagari Hindi", "fonts/tiro-devanagari-400-italic.woff2", "400", "italic"],
  ["Tiro Devanagari Hindi", "fonts/tiro-latin-400-italic.woff2", "400", "italic"],
  ["Yatra One", "fonts/YatraOne-Regular.ttf", "400", "normal"],
  ...(["400", "500", "600", "700"] as const).flatMap((w) => [
    ["Mukta", `fonts/mukta-devanagari-${w}.woff2`, w, "normal"] as [string, string, string, string],
    ["Mukta", `fonts/mukta-latin-${w}.woff2`, w, "normal"] as [string, string, string, string],
  ]),
];

let loaded = false;
/** Local font files only (renders run without network). Blocks the first frame until every face is ready. */
export const loadFonts = () => {
  if (loaded || typeof document === "undefined") return;
  loaded = true;
  const h = delayRender("fonts");
  Promise.all(
    FACES.map(([family, file, weight, style]) => {
      const face = new FontFace(family, `url(${staticFile(file)})`, { weight, style });
      return face.load().then((f) => { (document.fonts as unknown as { add: (f: FontFace) => void }).add(f); }).catch(() => undefined);
    }),
  ).then(() => continueRender(h));
};
