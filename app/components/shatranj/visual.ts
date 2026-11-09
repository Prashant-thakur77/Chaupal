/**
 * Proportions shared by the WebGPU renderer, the glyph atlas and the DOM
 * fallback, so both views draw the same disc at the same size.
 */

/** Disc diameter as a fraction of a square. */
export const DISC_RATIO = 0.88;
/** Label font size as a fraction of the disc diameter (before LABEL_SCALE). */
export const LABEL_RATIO = 0.42;
/** Radius of the incised inner ring, as a fraction of the disc radius. */
export const INNER_RING = 0.86;
/** Width of the outer rim band, as a fraction of the disc radius. */
export const RIM_WIDTH = 0.085;

export const LABEL_FONT_WEIGHT = 700;

/**
 * Board palette, as CSS custom properties on the board root. Each falls back
 * to the Chaupal token (when the token sheet is loaded) and then to a fixed
 * value. The WebGPU renderer reads the resolved values from the root, so a
 * theme change reaches both views.
 */
export const PALETTE_VARS = {
  squareDark: "--sj-square-dark",
  squareLight: "--sj-square-light",
  herFace: "--sj-her-face",
  herInk: "--sj-her-ink",
  herRim: "--sj-her-rim",
  herRing: "--sj-her-ring",
  otherFace: "--sj-other-face",
  otherInk: "--sj-other-ink",
  otherRim: "--sj-other-rim",
  otherRing: "--sj-other-ring",
  lastMove: "--sj-last-move",
  selected: "--sj-selected",
  check: "--sj-check",
  shadow: "--sj-shadow",
} as const;

export type PaletteKey = keyof typeof PALETTE_VARS;
export type Rgba = [number, number, number, number];
export type Palette = Record<PaletteKey, Rgba>;

const FALLBACKS: Record<PaletteKey, string> = {
  squareDark: "#8e5232",
  squareLight: "#d7a577",
  herFace: "#f4e8d2",
  herInk: "#6a2611",
  herRim: "#6a2611",
  herRing: "#f4a93c",
  otherFace: "#2e2955",
  otherInk: "#ffd58c",
  otherRim: "#0e0c20",
  otherRing: "#9c9cf0",
  lastMove: "#e9b860",
  selected: "#ffc866",
  check: "#e0473b",
  shadow: "#1a0b05",
};

let colorProbe: CanvasRenderingContext2D | null = null;

/** Parses any CSS colour into sRGB 0..1 floats. */
export function parseCssColor(value: string, fallback: string): Rgba {
  if (typeof document === "undefined") return [0, 0, 0, 1];
  if (!colorProbe) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    colorProbe = canvas.getContext("2d", { willReadFrequently: true });
  }
  const context = colorProbe;
  if (!context) return [0, 0, 0, 1];
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = fallback;
  context.fillStyle = value.trim() || fallback;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255, a / 255];
}

export function readPalette(element: Element): Palette {
  const style = getComputedStyle(element);
  const palette = {} as Palette;
  for (const key of Object.keys(PALETTE_VARS) as PaletteKey[]) {
    palette[key] = parseCssColor(
      style.getPropertyValue(PALETTE_VARS[key]),
      FALLBACKS[key],
    );
  }
  return palette;
}

export function readLabelFont(element: Element) {
  const value = getComputedStyle(element)
    .getPropertyValue("--sj-label-font")
    .trim();
  return value || '"Mukta", "Noto Sans Devanagari", system-ui, sans-serif';
}
