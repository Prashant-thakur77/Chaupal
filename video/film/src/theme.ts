import { continueRender, delayRender, staticFile } from "remotion";
import filmData from "../film.json";

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

/** The film's world, as tokens. Every scene reads T (never a raw colour), so the whole film re-skins by palette.
 *  film.json "palette": "dusk" (the first cut) or "light" (softer, calmer). */
type Palette = {
  bg: string; skyTop: string; skyMid: string; skyLow: string; floorTop: string; floorBottom: string;
  glow: string; glowWarm: string; glowK: number; starK: number;
  ink: string; inkSoft: string; inkMuted: string; inkFaint: string;
  line: string; lineAccent: string; accent: string; accentText: string; onAccent: string;
  good: string; bad: string;
  chipBg: string; chipBorder: string; noteBg: string; band: string; frame: string; shadow: string; textShadow: string;
  dim: string; cityTint: string; footageWash: string; vignette: string; recapWash: string; flash: string;
  fog: string; ambient: string; hemiSky: string; hemiGround: string; key: string; clayFloor: string; clayFloor2: string;
  grainBlend: "overlay" | "multiply"; grainK: number;
  slab1: string; slab2: string; slab3: string; slabGlow: string; slabGlowK: number; packet: string; lineSoft: string;
  boardDark: string; boardLight: string; boardFrame: string; herDisc: string; herInk: string; otherDisc: string; otherInk: string;
  diyaLine: string; sunK: number;
};
const DUSK: Palette = {
  bg: "#0e0c20", skyTop: "#0e0c20", skyMid: "#15132B", skyLow: "#221E40", floorTop: "#3A1A0C", floorBottom: "#5A2A17",
  glow: "244,169,60", glowWarm: "208,100,58", glowK: 1, starK: 1,
  ink: "#F7F1E6", inkSoft: "#E3D6C0", inkMuted: "#BCAA8E", inkFaint: "#b4a99a",
  line: "#F7F1E6", lineAccent: "#FFC866", accent: "#F4A93C", accentText: "#FFC866", onAccent: "#1A0F08",
  good: "#8FD69E", bad: "#FF8A7A",
  chipBg: "rgba(21,19,43,.97)", chipBorder: "#3A345F", noteBg: "rgba(14,12,32,.85)", band: "14,12,32", frame: "#0b0a18", shadow: "rgba(0,0,0,.6)", textShadow: "14,12,32",
  dim: "#0e0c20", cityTint: "40,60,120", footageWash: "21,19,43", vignette: "14,12,32", recapWash: "14,12,32", flash: "#FFF4D6",
  fog: "#15132B", ambient: "#9c9cf0", hemiSky: "#2E2955", hemiGround: "#3A1A0C", key: "#9c9cf0", clayFloor: "#5A2A17", clayFloor2: "#3A1A0C",
  grainBlend: "overlay", grainK: 1,
  slab1: "#6A2611", slab2: "#8E5232", slab3: "#D0643A", slabGlow: "#F4A93C", slabGlowK: 1, packet: "#FFC866", lineSoft: "#F7F1E6",
  boardDark: "#8E5232", boardLight: "#D7A577", boardFrame: "#4a2312", herDisc: "#F4E8D2", herInk: "#6A2611", otherDisc: "#26245E", otherInk: "#FFD58C",
  diyaLine: "#F7F1E6", sunK: 0,
};
// "Subah": morning light on a lime-washed courtyard. Mostly ivory; peacock teal used sparingly; marigold only for the
// lamp's warmth and small accents; warm, soft shadows; light floors and daylight in the 3D scenes.
const LIGHT: Palette = {
  bg: "#FAF6EF", skyTop: "#FDFBF7", skyMid: "#FAF5ED", skyLow: "#F6ECDE", floorTop: "#F0E4D2", floorBottom: "#F1E9DC",
  glow: "233,163,64", glowWarm: "240,214,170", glowK: 0.32, starK: 0,
  ink: "#2D2620", inkSoft: "#5A4D42", inkMuted: "#75675B", inkFaint: "#A99B8E",
  line: "#8A4B2E", lineAccent: "#3A8384", accent: "#2B6B6C", accentText: "#2B6B6C", onAccent: "#FFFDF8",
  good: "#2F7A43", bad: "#A8321F",
  chipBg: "rgba(255,253,249,.97)", chipBorder: "#E4D8C5", noteBg: "rgba(255,253,249,.92)", band: "250,246,239", frame: "#FFFFFF", shadow: "rgba(70,50,30,.11)", textShadow: "255,253,249",
  dim: "#FAF6EF", cityTint: "74,89,163", footageWash: "250,246,239", vignette: "241,233,220", recapWash: "250,246,239", flash: "#FFFFFF",
  fog: "#F6ECDE", ambient: "#FFF8EE", hemiSky: "#FDFBF7", hemiGround: "#E9D9C2", key: "#FFF1DC", clayFloor: "#F0E4D2", clayFloor2: "#E8D8C2",
  grainBlend: "multiply", grainK: 0.35,
  slab1: "#E7D6BF", slab2: "#EFE2CF", slab3: "#E4F0EF", slabGlow: "#3A8384", slabGlowK: 0.25, packet: "#2B6B6C", lineSoft: "#E4D8C5",
  boardDark: "#C4936B", boardLight: "#F1DFC4", boardFrame: "#B78A62", herDisc: "#FDF6EA", herInk: "#6A2611", otherDisc: "#2B6B6C", otherInk: "#FDF3E1",
  diyaLine: "#9A7350", sunK: 1,
};
export const T: Palette = (filmData as { palette?: string }).palette === "light" ? LIGHT : DUSK;
export const LIGHT_MODE = T === LIGHT;

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
