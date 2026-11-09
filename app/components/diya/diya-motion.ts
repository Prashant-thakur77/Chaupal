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
  /** Overall brightness of the flame body (0.4..1.6). */
  core: number;
  glow: number;
  glowRadius: number;
  ripple: number;
  swirl: number;
  sparks: number;
  /** Light that reaches the clay (drives the CSS rim light). */
  light: number;
}

const BEHAVIOR_COUNT = 6;
const BEHAVIOR_TRANSITION_MS = 1080;
const TAU = Math.PI * 2;

type Shape = Omit<FlameFrame, "time" | "light">;

function speechEnvelope(t: number) {
  // Syllable beats inside slower phrases: a rhythmic pulse that still
  // breathes like speech rather than a metronome.
  const syllable = Math.max(0, Math.sin(TAU * 2.1 * t));
  const accent = Math.max(0, Math.sin(TAU * 1.05 * t + 0.6));
  const phrase = 0.55 + 0.45 * Math.sin(TAU * 0.32 * t);
  return Math.min(1, (syllable ** 2 * 0.75 + accent ** 3 * 0.35) * phrase + 0.08);
}

function behaviorShape(index: number, t: number): Shape {
  switch (index) {
    case 1: // listening: leans in, steadies, comes a little closer
      return {
        height: 1.08 + 0.025 * Math.sin(0.9 * t),
        width: 1.08,
        lean: 0.17 + 0.03 * Math.sin(0.75 * t),
        turbulence: 0.3,
        flickerSpeed: 0.75,
        core: 1.05,
        glow: 0.98,
        glowRadius: 0.86,
        ripple: 0,
        swirl: 0,
        sparks: 0,
      };
    case 2: // receiving: ripples rise through the flame and spread outward
      return {
        height: 0.98 + 0.02 * Math.sin(1.4 * t),
        width: 1.02,
        lean: 0.04 * Math.sin(1.1 * t),
        turbulence: 0.45,
        flickerSpeed: 1.05,
        core: 0.92,
        glow: 0.82,
        glowRadius: 1.08,
        ripple: 1,
        swirl: 0,
        sparks: 0,
      };
    case 3: // creating: tall, bright, embers circulate
      return {
        height: 1.2 + 0.05 * Math.sin(2.3 * t) + 0.03 * Math.sin(3.7 * t),
        width: 1.06,
        lean: 0.07 * Math.sin(1.6 * t) + 0.03 * Math.sin(2.9 * t),
        turbulence: 0.85,
        flickerSpeed: 1.4,
        core: 1.22,
        glow: 1.18,
        glowRadius: 1.12,
        ripple: 0,
        swirl: 1,
        sparks: 0.55,
      };
    case 4: {
      // speaking: rhythmic pulse of height and light
      const p = speechEnvelope(t);
      return {
        height: 0.96 + 0.2 * p,
        width: 1 + 0.07 * p,
        lean: 0.03 * Math.sin(0.9 * t),
        turbulence: 0.42,
        flickerSpeed: 1,
        core: 0.92 + 0.28 * p,
        glow: 0.72 + 0.48 * p,
        glowRadius: 0.95 + 0.12 * p,
        ripple: 0,
        swirl: 0,
        sparks: 0,
      };
    }
    case 5: {
      // awaiting: low and calm, slow breath, still glowing
      const b = 0.5 + 0.5 * Math.sin((TAU * t) / 5.6);
      return {
        height: 0.62 + 0.05 * b,
        width: 0.92,
        lean: 0.02 * Math.sin(0.35 * t),
        turbulence: 0.2,
        flickerSpeed: 0.5,
        core: 0.82 + 0.06 * b,
        glow: 0.66 + 0.1 * b,
        glowRadius: 1.22,
        ripple: 0,
        swirl: 0,
        sparks: 0,
      };
    }
    default: // ready: an easy natural flicker
      return {
        height: 1 + 0.03 * Math.sin(1.3 * t),
        width: 1,
        lean: 0.035 * Math.sin(0.7 * t) + 0.02 * Math.sin(1.9 * t),
        turbulence: 0.55,
        flickerSpeed: 1,
        core: 1,
        glow: 0.86,
        glowRadius: 1,
        ripple: 0,
        swirl: 0,
        sparks: 0,
      };
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

export class DiyaMotion {
  private vitalityTarget = 0.92;
  private vitality = 0.92;
  private behaviorIndex = 0;
  private weights = [1, 0, 0, 0, 0, 0];
  private startWeights = [1, 0, 0, 0, 0, 0];
  private targetWeights = [1, 0, 0, 0, 0, 0];
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

  /** True when nothing would change on the next frame (reduced motion only). */
  get settled() {
    return Math.abs(this.vitality - this.vitalityTarget) < 0.0008;
  }

  step(now: number): FlameFrame {
    if (this.epoch < 0) this.epoch = now;
    const dt = this.lastNow < 0 ? 16 : Math.min(64, now - this.lastNow);
    this.lastNow = now;

    if (this.reduced) return this.stepReduced(dt);

    // Vitality eases in like the base runtime (0.035 per 60fps frame).
    const k = 1 - Math.pow(1 - 0.035, dt / 16.67);
    this.vitality += (this.vitalityTarget - this.vitality) * k;

    if (this.transitionStart >= 0) {
      const p = Math.min(
        1,
        Math.max(0, (now - this.transitionStart) / BEHAVIOR_TRANSITION_MS),
      );
      const e = p * p * (3 - 2 * p);
      for (let i = 0; i < BEHAVIOR_COUNT; i += 1) {
        this.weights[i] =
          this.startWeights[i] +
          (this.targetWeights[i] - this.startWeights[i]) * e;
      }
      if (p >= 1) this.transitionStart = -1;
    }

    const t = (now - this.epoch) * 0.001;
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
    for (let i = 0; i < BEHAVIOR_COUNT; i += 1) {
      const w = this.weights[i];
      if (w <= 0.0001) continue;
      const s = behaviorShape(i, t);
      for (const key of SHAPE_KEYS) out[key] += s[key] * w;
    }

    const v = this.vitality;
    out.glow *= 0.72 + 0.28 * v;
    out.core *= 0.84 + 0.16 * v;
    out.turbulence *= 0.65 + 0.35 * v;

    // Reactions: celebrate leaps up and showers sparks; recoil ducks and shivers.
    const re = now - this.reactionStart;
    if (this.reactionKind && re >= 0 && re < this.reactionDuration) {
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
      light: Math.max(0, Math.min(1.4, out.glow * (0.6 + 0.4 * out.core))),
    };
  }

  /**
   * Reduced motion: a still flame in its resting shape. Only brightness moves,
   * and only slowly, when the phase changes.
   */
  private stepReduced(dt: number): FlameFrame {
    const k = 1 - Math.pow(1 - 0.012, dt / 16.67);
    this.vitality += (this.vitalityTarget - this.vitality) * k;
    if (this.settled) this.vitality = this.vitalityTarget;
    const v = this.vitality;
    const shape = behaviorShape(0, 0);
    const glow = 0.42 + 0.6 * v;
    const core = 0.78 + 0.26 * v;
    return {
      time: 2.4,
      ...shape,
      height: 0.95,
      turbulence: 0.35,
      lean: 0.015,
      core,
      glow,
      light: glow * (0.6 + 0.4 * core),
    };
  }
}
