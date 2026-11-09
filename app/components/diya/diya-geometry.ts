/**
 * Where the flame sits on the stage (a square shared by the clay lamp SVG and
 * the flame canvas). The lamp is drawn in a 200×200 viewBox with the wick tip
 * at (100, 141); a resting flame is 80 viewBox units tall.
 */
const WICK_VB = { x: 100, y: 141 } as const;
const FLAME_VB = 80;

export interface DiyaLayout {
  /** SVG viewBox for the lamp. */
  viewBox: string;
  /** Wick tip as fractions of the stage. */
  wick: { x: number; y: number };
  /** Height of a resting flame as a fraction of the stage height. */
  unit: number;
}

function layoutFor(x: number, y: number, size: number): DiyaLayout {
  return {
    viewBox: `${x} ${y} ${size} ${size}`,
    wick: { x: (WICK_VB.x - x) / size, y: (WICK_VB.y - y) / size },
    unit: FLAME_VB / size,
  };
}

/** Full scene: lamp, rangoli and headroom for a tall flame. */
export const DIYA_LAYOUT_FULL = layoutFor(0, 6, 200);

/** Header-sized diyas crop in on the lamp and flame so they stay legible. */
export const DIYA_LAYOUT_COMPACT = layoutFor(24, 36, 152);
