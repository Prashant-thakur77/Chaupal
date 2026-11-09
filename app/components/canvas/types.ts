/** Shared types for the tracing canvases (Sulekh and Rangoli). */

export type CanvasLanguage = "hi" | "en";

export type StrokeInput = "touch" | "air";

/** One committed stroke on her layer. Points are normalized to the canvas box. */
export interface Stroke {
  id: string;
  /** [x, y, pressure?] with x and y in 0..1 of the drawing box. */
  points: number[][];
  author: string;
  input: StrokeInput | string;
}

export type InputMode =
  | "none"
  | "touch"
  | "air-requested"
  | "air"
  | "air-denied";

/** The browser's camera outcome, reported back to the session. */
export type InputModeReport = "air" | "air-denied" | "touch";

/** One sample from a non-pointer pen (the air-writing hand tracker). */
export interface PenSample {
  /** 0..1 of the drawing box. */
  x: number;
  y: number;
  /** Pen touching the page (a closed hand in air-writing). */
  down: boolean;
  /** A hand is currently tracked. */
  tracking: boolean;
  /** 0..1 */
  pressure?: number;
}

export interface PenSource {
  subscribe(listener: (sample: PenSample) => void): () => void;
}

export interface PaletteColour {
  id: string;
  hex: string;
  hi: string;
  en: string;
}

export interface SulekhReferenceView {
  text: string;
  svg: string;
  altHi: string;
  altEn: string;
  script: string;
  style: string;
}

export interface RangoliDesignView {
  kind: "pulli" | "rangoli" | "pookalam";
  svg: string;
  regions: { id: string; zone: string }[];
  fills: Record<string, { colour: string }>;
  altHi: string;
  altEn: string;
}

/** Morning stage palette ("subah"): paper and sandstone, warm ink, peacock teal. */
export const STAGE = {
  night: "#14122B",
  indigo: "#1E1A3A",
  clay: "#8B4A32",
  terracotta: "#B65F49",
  marigold: "#F2A93B",
  chalk: "#F4EFE6",
  paper: "#FFFDF8",
  text: "#2D2620",
  textSoft: "#5A4D42",
  teal: "#2B6B6C",
  /** kolam and rangoli outlines on the light floor */
  line: "#8A4B2E",
  /** a soft paper halo that keeps her lines readable over colour */
  halo: "#FFFDF8",
  /** her own ink */
  ink: "#2B6B6C",
} as const;
