import { Easing, interpolate, spring } from "remotion";

export const OUT = Easing.bezier(0.16, 1, 0.3, 1); // the film's one ease
export const INOUT = Easing.bezier(0.65, 0, 0.35, 1); // camera moves
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 0 to 1 over [start, start+dur] frames. */
export const ramp = (f: number, start: number, dur: number, ease: (t: number) => number = OUT) =>
  interpolate(f, [start, start + Math.max(1, dur)], [0, 1], { ...clamp, easing: ease });
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const pop = (f: number, fps: number, delay = 0, damping = 14) => spring({ frame: f - delay, fps, config: { damping, stiffness: 140, mass: 0.7 } });
export const envelope = (f: number, a: number, b: number, inD = 10, outD = 8) => Math.min(ramp(f, a, inD), 1 - ramp(f, b - outD, outD));
/** Deterministic pseudo-random, never Math.random in a render. */
export const rand = (seed: number) => { const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
export const interp = (f: number, input: number[], output: number[], ease: (t: number) => number = INOUT) =>
  interpolate(f, input, output, { ...clamp, easing: ease });
/** The film's entrance: a 12 px rise and a fade. */
export const rise = (f: number, at: number, dur = 9) => {
  const t = ramp(f, at, dur);
  return { opacity: t, transform: `translateY(${(1 - t) * 12}px)` } as const;
};
