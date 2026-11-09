import type { PieceCode } from "./model";

/**
 * One motion timeline drives both renderers. The WebGPU renderer samples it
 * every frame; the DOM renderer samples it into Web Animations keyframes. The
 * two views therefore move the same discs along the same arcs.
 */

export const SLIDE_MS = 600;
export const SETTLE_MS = 200;
export const CAPTURE_DELAY_RATIO = 0.62;
export const CAPTURE_MS = 560;
export const REDUCED_MS = 220;

/** Height a disc rises while it is selected or dragged (0..1 lift scale). */
export const SELECT_LIFT = 0.22;
export const DRAG_LIFT = 0.6;

export type Point = { x: number; y: number };

export type TrackKind = "slide" | "settle" | "capture" | "appear" | "vanish";

export type MotionTrack = {
  id: string;
  code: PieceCode;
  kind: TrackKind;
  from: Point;
  to: Point;
  delay: number;
  duration: number;
  /** Lateral bow of the slide arc (board units, signed). */
  bow: number;
  /** Total spin of a captured disc (radians). */
  spin: number;
  /** Lift at the start of a settle (dropped discs land from the hand). */
  startLift: number;
};

export type MotionPlan = {
  key: string;
  ply: number;
  tracks: MotionTrack[];
  duration: number;
  reduced: boolean;
};

export type DiscPose = {
  x: number;
  y: number;
  /** 0 = resting on the board, 1 = fully lifted. */
  lift: number;
  scale: number;
  opacity: number;
  rotation: number;
};

export function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInQuad(t: number) {
  return t * t;
}

export function liftScale(lift: number) {
  return 1 + lift * 0.13;
}

/**
 * Cast shadow of a disc at a given lift: offset in board units, a scale for
 * the shadow blob (higher discs throw a larger, softer shadow) and opacity.
 */
export function shadowFor(lift: number) {
  return {
    dx: 0.035 + lift * 0.11,
    dy: 0.06 + lift * 0.17,
    scale: 1 + lift * 0.3,
    opacity: 1 - lift * 0.35,
  };
}

export function restingPose(point: Point, lift = 0): DiscPose {
  return {
    x: point.x,
    y: point.y,
    lift,
    scale: liftScale(lift),
    opacity: 1,
    rotation: 0,
  };
}

/** Distance along `direction` from `origin` until the disc is off the board. */
function exitDistance(origin: Point, direction: Point) {
  const min = -0.85;
  const max = 8.85;
  let best = 9;
  for (const axis of ["x", "y"] as const) {
    const d = direction[axis];
    if (Math.abs(d) < 1e-6) continue;
    const bound = d > 0 ? max : min;
    const t = (bound - origin[axis]) / d;
    if (t > 0) best = Math.min(best, t);
  }
  return Math.max(1.6, best);
}

export function buildSlideTrack(
  id: string,
  code: PieceCode,
  from: Point,
  to: Point,
): MotionTrack {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const bow = Math.min(0.34, 0.1 * distance);
  return {
    id,
    code,
    kind: "slide",
    from,
    to,
    delay: 0,
    duration: SLIDE_MS,
    bow,
    spin: 0,
    startLift: 0,
  };
}

export function buildSettleTrack(
  id: string,
  code: PieceCode,
  from: Point,
  to: Point,
): MotionTrack {
  return {
    id,
    code,
    kind: "settle",
    from,
    to,
    delay: 0,
    duration: SETTLE_MS,
    bow: 0,
    spin: 0,
    startLift: DRAG_LIFT,
  };
}

export function buildCaptureTrack(
  id: string,
  code: PieceCode,
  at: Point,
  push: Point,
  seed: number,
): MotionTrack {
  let length = Math.hypot(push.x, push.y);
  let direction = length > 1e-6 ? { x: push.x / length, y: push.y / length } : null;
  if (!direction) {
    const away = { x: at.x - 4, y: at.y - 4 };
    length = Math.hypot(away.x, away.y) || 1;
    direction = { x: away.x / length, y: away.y / length };
  }
  const distance = exitDistance(at, direction);
  const spinSign = seed % 2 === 0 ? 1 : -1;
  return {
    id,
    code,
    kind: "capture",
    from: at,
    to: { x: at.x + direction.x * distance, y: at.y + direction.y * distance },
    delay: SLIDE_MS * CAPTURE_DELAY_RATIO,
    duration: CAPTURE_MS,
    bow: 0,
    spin: spinSign * Math.PI * (1.1 + (seed % 5) * 0.12),
    startLift: 0,
  };
}

export function buildReducedTrack(
  id: string,
  code: PieceCode,
  at: Point,
  kind: "appear" | "vanish",
): MotionTrack {
  return {
    id,
    code,
    kind,
    from: at,
    to: at,
    delay: 0,
    duration: REDUCED_MS,
    bow: 0,
    spin: 0,
    startLift: 0,
  };
}

export function planDuration(tracks: MotionTrack[]) {
  return tracks.reduce(
    (longest, track) => Math.max(longest, track.delay + track.duration),
    0,
  );
}

/** Pose of a track's disc `elapsed` ms after the plan started. */
export function samplePose(track: MotionTrack, elapsed: number): DiscPose {
  const t = clamp01((elapsed - track.delay) / Math.max(1, track.duration));
  const { from, to } = track;

  switch (track.kind) {
    case "slide": {
      const e = easeInOutCubic(t);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const distance = Math.hypot(dx, dy) || 1;
      let px = -dy / distance;
      let py = dx / distance;
      if (py > 0.01 || (Math.abs(py) <= 0.01 && px < 0)) {
        px = -px;
        py = -py;
      }
      const control = {
        x: (from.x + to.x) / 2 + px * track.bow * 2,
        y: (from.y + to.y) / 2 + py * track.bow * 2,
      };
      const inv = 1 - e;
      const x = inv * inv * from.x + 2 * inv * e * control.x + e * e * to.x;
      const y = inv * inv * from.y + 2 * inv * e * control.y + e * e * to.y;
      const lift = Math.sin(Math.PI * e) * Math.min(1, 0.55 + distance * 0.09);
      return { x, y, lift, scale: liftScale(lift), opacity: 1, rotation: 0 };
    }
    case "settle": {
      const e = easeOutCubic(t);
      const lift = track.startLift * (1 - e);
      return {
        x: from.x + (to.x - from.x) * e,
        y: from.y + (to.y - from.y) * e,
        lift,
        scale: liftScale(lift),
        opacity: 1,
        rotation: 0,
      };
    }
    case "capture": {
      // Knocked up first, then thrown off the nearest edge along the push.
      const rise = easeOutCubic(clamp01(t / 0.22));
      const fly = easeInQuad(clamp01((t - 0.12) / 0.88));
      const lift = rise * (1 - fly * 0.35);
      return {
        x: from.x + (to.x - from.x) * fly,
        y: from.y + (to.y - from.y) * fly,
        lift,
        scale: liftScale(lift) * (1 + rise * 0.05),
        opacity: 1 - clamp01((t - 0.55) / 0.45),
        rotation: track.spin * easeInOutCubic(clamp01((t - 0.08) / 0.92)),
      };
    }
    case "appear":
      return { ...restingPose(to), opacity: 0.35 + 0.65 * easeOutCubic(t) };
    case "vanish":
      return { ...restingPose(from), opacity: 1 - easeOutCubic(t) };
  }
}
