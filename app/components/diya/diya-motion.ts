import type { DiyaReaction } from "./diya-model";

/**
 * The flame's body language, computed once per frame on the CPU and shared by
 * the WebGPU shader and the Canvas2D fallback so both renderers move alike.
 * Units are "flame units": a resting flame is 1 tall.
 */
export interface FlameFrame {
  time: number;
  height: number;
  width: number;
  /** Lateral offset of the tip, in flame heights. */
  lean: number;
  turbulence: number;
  flickerSpeed: number;
  /** Overall heat of the flame body (0.4..1.6). */
  core: number;
  glow: number;
  glowRadius: number;
  /** Halo colour, 0..1 RGB. */
  glowColor: [number, number, number];
  ripple: number;
  swirl: number;
  sparks: number;
  /** Light that reaches the clay (drives the lamp's light layer). */
  light: number;
}

const BEHAVIOR_COUNT = 6;
// DESIGN.md §7: flame scale and glow cross-fade over 420ms. Never snap.
const BEHAVIOR_TRANSITION_MS = 420;
const REDUCED_TRANSITION_MS = 2400;
const TAU = Math.PI * 2;

type Shape = Omit<FlameFrame, "time" | "light" | "glowColor">;
type Rgb = [number, number, number];

const hex = (value: number): Rgb => [
  ((value >> 16) & 255) / 255,
  ((value >> 8) & 255) / 255,
  (value & 255) / 255,
];

/** Halo colour per behaviour (DESIGN.md §7 phase table). */
const GLOW_COLORS: Rgb[] = [
  hex(0xf4a93c), // ready: marigold
  hex(0xffc866), // listening: a warmer, closer light
  hex(0xf4a93c), // receiving
  hex(0xf28a2e), // creating: saffron
  hex(0xffd58c), // speaking: pale gold
  hex(0x9c9cf0), // awaiting: indigo
];

function speechEnvelope(t: number) {
  // Syllable beats (~0.44s) inside slower phrases: rhythmic, like speech.
  const syllable = Math.max(0, Math.sin(TAU * 2.27 * t));
  const accent = Math.max(0, Math.sin(TAU * 1.13 * t + 0.6));
  const phrase = 0.55 + 0.45 * Math.sin(TAU * 0.32 * t);
  return Math.min(
    1,
    (syllable ** 2 * 0.75 + accent ** 3 * 0.35) * phrase + 0.08,
  );
}

/**
 * Each phase's flame at time t. With `still`, breath and flicker freeze at a
 * neutral frame: reduced motion keeps each phase's height, lean and light,
 * never its movement.
 */
function behaviorShape(index: number, t: number, still = false): Shape {
  const m = still ? 0 : 1;
  switch (index) {
    case 1: // listening: leans in, steadies, comes a little closer
      return {
        height: 1.08 + 0.025 * Math.sin(0.9 * t) * m,
        width: 1.08,
        lean: 0.16 + 0.03 * Math.sin(0.75 * t) * m,
        turbulence: 0.3,
        flickerSpeed: 0.75,
        core: 1.05,
        glow: 0.98,
        glowRadius: 0.86,
        ripple: 0,
        swirl: 0,
        sparks: 0,
      };
    case 2: // receiving: ripples rise through the flame, light gathers in
      return {
        height: 0.98 + 0.02 * Math.sin(1.4 * t) * m,
        width: 1.02,
        lean: 0.04 * Math.sin(1.1 * t) * m,
        turbulence: 0.45,
        flickerSpeed: 1.05,
        core: 0.94,
        glow: 0.84,
        glowRadius: 1.04,
        ripple: 1,
        swirl: 0,
        sparks: 0,
      };
    case 3: // creating: 1.22 tall, bright, quick flicker, embers circulate
      return {
        height:
          1.22 +
          (0.05 * Math.sin((TAU * t) / 0.9) + 0.03 * Math.sin(3.7 * t)) * m,
        width: 1.06,
        lean: (0.07 * Math.sin(1.6 * t) + 0.03 * Math.sin(2.9 * t)) * m,
        turbulence: 0.85,
        flickerSpeed: 1.4,
        core: 1.2,
        glow: 1.14,
        glowRadius: 1.12,
        ripple: 0,
        swirl: 1,
        sparks: 0.9,
      };
    case 4: {
      // speaking: rhythmic pulse of height and light, 1.0–1.25
      const p = still ? 0.45 : speechEnvelope(t);
      return {
        height: 1 + 0.22 * p,
        width: 1 + 0.07 * p,
        lean: 0.03 * Math.sin(0.9 * t) * m,
        turbulence: 0.42,
        flickerSpeed: 1,
        core: 0.94 + 0.26 * p,
        glow: 0.8 + 0.42 * p,
        glowRadius: 0.96 + 0.12 * p,
        ripple: 0,
        swirl: 0,
        sparks: 0,
      };
    }
    case 5: {
      // awaiting: low (0.82) and calm, a slow 4.8s breath, still glowing
      const b = still ? 0.5 : 0.5 + 0.5 * Math.sin((TAU * t) / 4.8);
      return {
        height: 0.8 + 0.04 * b,
        width: 0.94,
        lean: 0.02 * Math.sin(0.35 * t) * m,
        turbulence: 0.2,
        flickerSpeed: 0.5,
        core: 0.84 + 0.06 * b,
        glow: 0.66 + 0.1 * b,
        glowRadius: 1.2,
        ripple: 0,
        swirl: 0,
        sparks: 0,
      };
    }
    default: {
      // ready: full flame with a slow 3.2s breath (scale .94–1, light
      // .78–1) and a small 2.6s skew.
      const b = still ? 1 : 0.5 + 0.5 * Math.sin((TAU * t) / 3.2);
      return {
        height: 0.94 + 0.06 * b,
        width: 1,
        lean: 0.028 * Math.sin((TAU * t) / 2.6) * m,
        turbulence: 0.55,
        flickerSpeed: 1,
        core: 0.96 + 0.06 * b,
        glow: 0.86 * (0.78 + 0.22 * b),
        glowRadius: 1,
        ripple: 0,
        swirl: 0,
        sparks: 0,
      };
    }
  }
}

const SHAPE_KEYS: (keyof Shape)[] = [
  "height",
  "width",
  "lean",
  "turbulence",
  "flickerSpeed",
  "core",
  "glow",
  "glowRadius",
  "ripple",
  "swirl",
  "sparks",
];

/** Reduced motion freezes the flame at this calm, neutral moment. */
const STILL_TIME = 2.4;

export class DiyaMotion {
  private vitalityTarget: number;
  private vitality: number;
  private behaviorIndex: number;
  private weights: number[];
  private startWeights: number[];
  private targetWeights: number[];
  private transitionStart = -1;
  private reactionKind: DiyaReaction | null = null;
  private reactionStart = -1;
  private reactionDuration = 1;
  private epoch = -1;
  private lastNow = -1;

  constructor(
    initialVitality: number,
    initialBehavior: number,
    private reduced: boolean,
  ) {
    this.vitality = this.vitalityTarget = initialVitality;
    this.behaviorIndex = initialBehavior;
    this.weights = this.weightsFor(initialBehavior);
    this.startWeights = [...this.weights];
    this.targetWeights = [...this.weights];
  }

  private weightsFor(index: number) {
    return Array.from({ length: BEHAVIOR_COUNT }, (_, i) =>
      i === index ? 1 : 0,
    );
  }

  setReduced(reduced: boolean) {
    this.reduced = reduced;
  }

  setVitality(value: number) {
    this.vitalityTarget = Math.min(1, Math.max(0, value));
  }

  setBehavior(index: number, now: number) {
    if (index === this.behaviorIndex) return;
    this.behaviorIndex = index;
    this.startWeights = [...this.weights];
    this.targetWeights = this.weightsFor(index);
    this.transitionStart = now;
  }

  react(kind: DiyaReaction, now: number) {
    if (this.reduced) return;
    this.reactionKind = kind;
    this.reactionStart = now;
    this.reactionDuration = kind === "recoil" ? 920 : 1220;
  }

  /** True when a reduced-motion frame would no longer change. */
  get settled() {
    return (
      this.transitionStart < 0 &&
      Math.abs(this.vitality - this.vitalityTarget) < 0.0008
    );
  }

  step(now: number): FlameFrame {
    if (this.epoch < 0) this.epoch = now;
    const dt = this.lastNow < 0 ? 16 : Math.min(64, now - this.lastNow);
    this.lastNow = now;
    const reduced = this.reduced;

    // Vitality eases in like the base runtime (0.035 per 60fps frame);
    // reduced motion lets the brightness drift over a few seconds instead.
    const rate = reduced ? 0.012 : 0.035;
    const k = 1 - Math.pow(1 - rate, dt / 16.67);
    this.vitality += (this.vitalityTarget - this.vitality) * k;
    if (Math.abs(this.vitality - this.vitalityTarget) < 0.0008) {
      this.vitality = this.vitalityTarget;
    }

    if (this.transitionStart >= 0) {
      const duration = reduced ? REDUCED_TRANSITION_MS : BEHAVIOR_TRANSITION_MS;
      const p = Math.min(1, Math.max(0, (now - this.transitionStart) / duration));
      const e = p * p * p * (p * (p * 6 - 15) + 10);
      for (let i = 0; i < BEHAVIOR_COUNT; i += 1) {
        this.weights[i] =
          this.startWeights[i] +
          (this.targetWeights[i] - this.startWeights[i]) * e;
      }
      if (p >= 1) this.transitionStart = -1;
    }

    const t = reduced ? STILL_TIME : (now - this.epoch) * 0.001;
    const out: Shape = {
      height: 0,
      width: 0,
      lean: 0,
      turbulence: 0,
      flickerSpeed: 0,
      core: 0,
      glow: 0,
      glowRadius: 0,
      ripple: 0,
      swirl: 0,
      sparks: 0,
    };
    const glowColor: Rgb = [0, 0, 0];
    for (let i = 0; i < BEHAVIOR_COUNT; i += 1) {
      const w = this.weights[i];
      if (w <= 0.0001) continue;
      const s = behaviorShape(i, t, reduced);
      for (const key of SHAPE_KEYS) out[key] += s[key] * w;
      const c = GLOW_COLORS[i];
      glowColor[0] += c[0] * w;
      glowColor[1] += c[1] * w;
      glowColor[2] += c[2] * w;
    }

    const v = this.vitality;
    out.glow *= 0.72 + 0.28 * v;
    out.core *= 0.84 + 0.16 * v;
    out.turbulence *= 0.65 + 0.35 * v;
    if (reduced) out.turbulence = Math.min(out.turbulence, 0.35);

    // Reactions: celebrate leaps up and showers sparks; recoil ducks and shivers.
    const re = now - this.reactionStart;
    if (!reduced && this.reactionKind && re >= 0 && re < this.reactionDuration) {
      const p = re / this.reactionDuration;
      const env = Math.sin(p * Math.PI) * (1 - p * 0.16);
      if (this.reactionKind === "celebrate") {
        out.height += 0.5 * env;
        out.width += 0.06 * env;
        out.core += 0.32 * env;
        out.glow += 0.55 * env;
        out.glowRadius += 0.18 * env;
        out.sparks = Math.max(out.sparks, env * 1.6);
        out.swirl = Math.max(out.swirl, env * 0.7);
      } else {
        out.height -= 0.36 * env;
        out.width += 0.12 * env;
        out.lean += 0.14 * Math.sin(re * 0.045) * env;
        out.core -= 0.18 * env;
        out.glow -= 0.32 * env;
        out.turbulence += 0.5 * env;
      }
    } else {
      this.reactionKind = null;
    }

    return {
      time: t,
      ...out,
      glowColor,
      light: Math.max(0, Math.min(1.4, out.glow * (0.6 + 0.4 * out.core))),
    };
  }
}
