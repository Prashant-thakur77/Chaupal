"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import "./shatranj.css";
import { atlasIndex } from "./glyph-atlas";
import {
  COLOR_NAMES,
  LABEL_SCALE,
  PIECE_NAMES,
  TURN_NAMES,
  diffPositions,
  displayToSquare,
  initialDiscs,
  parseCode,
  parseFen,
  pieceAriaLabel,
  plyFromFen,
  squareCenter,
  squareToDisplay,
  type Color,
  type Disc,
  type Language,
  type LegalMove,
  type Move,
  type PieceCode,
  type PositionDiff,
} from "./model";
import {
  DRAG_LIFT,
  SELECT_LIFT,
  buildCaptureTrack,
  buildReducedTrack,
  buildSettleTrack,
  buildSlideTrack,
  planDuration,
  restingPose,
  samplePose,
  shadowFor,
  type DiscPose,
  type MotionPlan,
  type MotionTrack,
  type Point,
} from "./motion";
import {
  createShatranjRenderer,
  type GpuDisc,
  type GpuFrame,
  type ShatranjRenderer,
} from "./renderer";
import { DISC_RATIO, LABEL_RATIO } from "./visual";

export type { Move, LegalMove } from "./model";

export interface ShatranjBoardProps {
  /** chess.js FEN */
  fen: string;
  /** Side at the bottom (the elder's side). */
  orientation: "w" | "b";
  lastMove?: Move | null;
  /** Legal-move preview: highlight the piece and its targets, move nothing. */
  preview?: { from: string; targets: string[] } | null;
  /** May the local person move now. */
  interactive: boolean;
  /** Which colour the local person controls. */
  movableColor: "w" | "b" | null;
  /** Legal moves for the local person (when interactive). */
  legalMoves: LegalMove[];
  onMove?: (
    from: string,
    to: string,
    via: "drag" | "tap",
  ) => Promise<void> | void;
  /** Called once per reported move when its animation has finished. */
  onAnimationComplete?: (ply: number) => void;
  language: "hi" | "en";
  /** Accepted for API compatibility; the board shows no toast. */
  conflictMessage?: string | null;
  /** Plies played; preferred over the count derived from the FEN. */
  moveCount?: number;
  /** "auto" tries WebGPU and falls back to the DOM renderer. */
  renderer?: "auto" | "dom";
  /** Colour drawn as her ivory discs. Defaults to `orientation`. */
  herColor?: "w" | "b";
  className?: string;
}

type RendererMode = "webgpu" | "dom";

type Scene = {
  fen: string;
  discs: Disc[];
  plan: MotionPlan | null;
  /** Identity of the last move this scene has already played. */
  moveKey: string;
};

function moveKeyOf(move: Move | null | undefined) {
  return move ? `${move.from}-${move.to}-${move.ply ?? ""}` : "";
}

type DragState = {
  discId: string;
  square: string;
  pointerId: number;
  startX: number;
  startY: number;
  dragging: boolean;
  point: Point;
};

type Landing = { discId: string; from: string; to: string; point: Point };

type ReturnMotion = {
  discId: string;
  track: MotionTrack;
  startedAt: number;
};

const NO_LEGAL: LegalMove[] = [];
let planCounter = 0;

function subscribeReducedMotion(callback: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function readReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function useReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    readReducedMotion,
    () => false,
  );
}

function buildPlan(
  diff: PositionDiff,
  orientation: Color,
  reduced: boolean,
  landing: Landing | null,
  ply: number,
): MotionPlan {
  planCounter += 1;
  const tracks: MotionTrack[] = [];
  const main = diff.movers[0];
  const push = main
    ? {
        x: squareCenter(main.to, orientation).x - squareCenter(main.from, orientation).x,
        y: squareCenter(main.to, orientation).y - squareCenter(main.from, orientation).y,
      }
    : { x: 0, y: 0 };

  for (const mover of diff.movers) {
    const from = squareCenter(mover.from, orientation);
    const to = squareCenter(mover.to, orientation);
    if (reduced) {
      tracks.push(buildReducedTrack(mover.id, mover.code, to, "appear"));
    } else if (
      landing &&
      landing.discId === mover.id &&
      landing.to === mover.to
    ) {
      tracks.push(buildSettleTrack(mover.id, mover.code, landing.point, to));
    } else {
      tracks.push(buildSlideTrack(mover.id, mover.code, from, to));
    }
  }
  diff.captured.forEach((captured, index) => {
    const at = squareCenter(captured.square, orientation);
    tracks.push(
      reduced
        ? buildReducedTrack(captured.id, captured.code, at, "vanish")
        : buildCaptureTrack(captured.id, captured.code, at, push, ply + index),
    );
  });
  return {
    key: `plan-${planCounter}`,
    ply,
    tracks,
    duration: planDuration(tracks),
    reduced,
  };
}

function isGhostTrack(track: MotionTrack) {
  return track.kind === "capture" || track.kind === "vanish";
}

/** Web Animations keyframes for one disc following a track. */
function trackKeyframes(track: MotionTrack, home: Point, squarePx: number) {
  const total = track.delay + track.duration;
  const steps = Math.max(2, Math.round(total / 16));
  const wrap: Keyframe[] = [];
  const shadow: Keyframe[] = [];
  const label: Keyframe[] = [];
  for (let index = 0; index <= steps; index += 1) {
    const offset = index / steps;
    const pose = samplePose(track, offset * total);
    pushPoseFrames(pose, home, squarePx, offset, wrap, shadow, label);
  }
  return { wrap, shadow, label, total };
}

function pushPoseFrames(
  pose: DiscPose,
  home: Point,
  squarePx: number,
  offset: number,
  wrap: Keyframe[],
  shadow: Keyframe[],
  label: Keyframe[],
) {
  const cast = shadowFor(pose.lift);
  wrap.push({
    offset,
    transform: `translate(${(pose.x - home.x) * squarePx}px, ${(pose.y - home.y) * squarePx}px) scale(${pose.scale})`,
    opacity: pose.opacity,
  });
  shadow.push({
    offset,
    transform: `translate(${(cast.dx * squarePx) / pose.scale}px, ${(cast.dy * squarePx) / pose.scale}px) scale(${cast.scale})`,
    opacity: cast.opacity,
  });
  label.push({ offset, transform: `rotate(${pose.rotation}rad)` });
}

function applyPoseInline(
  element: HTMLElement,
  pose: DiscPose,
  home: Point,
  squarePx: number,
) {
  const wrap = element.querySelector<HTMLElement>(".sj-disc-wrap");
  const shadow = element.querySelector<HTMLElement>(".sj-disc-shadow");
  if (!wrap || !shadow) return;
  const cast = shadowFor(pose.lift);
  wrap.style.transform = `translate(${(pose.x - home.x) * squarePx}px, ${(pose.y - home.y) * squarePx}px) scale(${pose.scale})`;
  shadow.style.transform = `translate(${(cast.dx * squarePx) / pose.scale}px, ${(cast.dy * squarePx) / pose.scale}px) scale(${cast.scale})`;
  shadow.style.opacity = String(cast.opacity);
}

function clearPoseInline(element: HTMLElement) {
  const wrap = element.querySelector<HTMLElement>(".sj-disc-wrap");
  const shadow = element.querySelector<HTMLElement>(".sj-disc-shadow");
  if (wrap) wrap.style.transform = "";
  if (shadow) {
    shadow.style.transform = "";
    shadow.style.opacity = "";
  }
}

/** Runs a track on a DOM disc; resolves when its animation finishes. */
function animateDomDisc(
  element: HTMLElement,
  track: MotionTrack,
  home: Point,
  squarePx: number,
  fill: FillMode,
) {
  const wrap = element.querySelector<HTMLElement>(".sj-disc-wrap");
  const shadow = element.querySelector<HTMLElement>(".sj-disc-shadow");
  const label = element.querySelector<HTMLElement>(".sj-disc-label");
  if (!wrap || !shadow || !label || typeof wrap.animate !== "function") {
    return { animations: [] as Animation[], finished: Promise.resolve() };
  }
  const frames = trackKeyframes(track, home, squarePx);
  const options: KeyframeAnimationOptions = {
    duration: frames.total,
    easing: "linear",
    fill,
  };
  const animations = [
    wrap.animate(frames.wrap, options),
    shadow.animate(frames.shadow, options),
    label.animate(frames.label, options),
  ];
  const finished = Promise.all(
    animations.map((animation) => animation.finished.catch(() => undefined)),
  ).then(() => undefined);
  return { animations, finished };
}

function DiscVisual({
  code,
  her,
  language,
}: {
  code: PieceCode;
  her: boolean;
  language: Language;
}) {
  const { kind } = parseCode(code);
  return (
    <span className="sj-disc-wrap" aria-hidden="true">
      <span className="sj-disc-shadow" />
      <span className="sj-disc" data-side={her ? "her" : "other"}>
        <span
          className="sj-disc-label"
          lang={language}
          style={
            { "--sj-label-scale": LABEL_SCALE[language][kind] } as CSSProperties
          }
        >
          {PIECE_NAMES[language][kind]}
        </span>
      </span>
    </span>
  );
}

function cellStyle(square: string, orientation: Color): CSSProperties {
  const { col, row } = squareToDisplay(square, orientation);
  return { left: `${col * 12.5}%`, top: `${row * 12.5}%` };
}

function squareTone(col: number, row: number) {
  return (col + row) % 2 === 1 ? "dark" : "light";
}

export function ShatranjBoard({
  fen,
  orientation,
  lastMove = null,
  preview = null,
  interactive,
  movableColor,
  legalMoves = NO_LEGAL,
  onMove,
  onAnimationComplete,
  language,
  moveCount,
  renderer: rendererPreference = "auto",
  herColor: herColorProp,
  className,
}: ShatranjBoardProps) {
  const herColor = herColorProp ?? orientation;
  const reducedMotion = useReducedMotion();
  const position = useMemo(() => parseFen(fen), [fen]);
  const plies = moveCount ?? plyFromFen(position);

  const rootRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ShatranjRenderer | null>(null);
  const landingRef = useRef<Landing | null>(null);
  const landingTimerRef = useRef<number>(0);
  const dragRef = useRef<DragState | null>(null);
  const returnRef = useRef<ReturnMotion | null>(null);
  const planStartRef = useRef<{ key: string; at: number } | null>(null);
  const completedRef = useRef<Set<string>>(new Set());
  const pendingRef = useRef(false);
  const suppressClickRef = useRef(false);
  const pointerDownRef = useRef<{ square: string; wasSelected: boolean } | null>(
    null,
  );
  const focusRequestRef = useRef(false);

  const [mode, setMode] = useState<RendererMode>("dom");
  const [pending, setPending] = useState(false);
  const [selection, setSelection] = useState<{
    square: string;
    fen: string;
  } | null>(null);
  const [focusSquare, setFocusSquare] = useState<string>(() =>
    orientation === "w" ? "e2" : "e7",
  );
  const [draggingSquare, setDraggingSquare] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<string | null>(null);
  const [donePlanKey, setDonePlanKey] = useState<string | null>(null);

  // ---- disc identities and the motion plan, derived when the FEN changes ----
  const [scene, setScene] = useState<Scene>(() => ({
    fen,
    discs: initialDiscs(position),
    plan: null,
    moveKey: moveKeyOf(lastMove),
  }));
  if (scene.fen !== fen) {
    const moveKey = moveKeyOf(lastMove);
    const diff = diffPositions(
      scene.discs,
      position,
      moveKey !== scene.moveKey ? lastMove : null,
    );
    const ply = lastMove?.ply ?? plies;
    const landing = landingRef.current;
    const plan =
      lastMove && moveKey !== scene.moveKey
      ? buildPlan(
          diff.matched ? diff : { ...diff, movers: [], captured: [] },
          orientation,
          reducedMotion,
          landing,
          ply,
        )
      : null;
    setScene({ fen, discs: diff.discs, plan, moveKey });
  }

  const plan = scene.plan;
  const planActive = Boolean(plan && plan.key !== donePlanKey);
  const discBySquare = useMemo(
    () => new Map(scene.discs.map((disc) => [disc.square, disc])),
    [scene.discs],
  );

  // ---- selection and legal destinations ----
  const canAct =
    interactive && movableColor !== null && !pending && position.valid;
  const selectedSquare =
    selection && selection.fen === fen && canAct ? selection.square : null;
  const destinations = useMemo(() => {
    if (!selectedSquare) return new Set<string>();
    return new Set(
      legalMoves
        .filter((move) => move.from === selectedSquare)
        .map((move) => move.to),
    );
  }, [legalMoves, selectedSquare]);
  const previewFrom = preview?.from ?? null;
  const previewTargets = preview?.targets ?? [];
  const liftedSquare = selectedSquare ?? previewFrom;

  const isOwn = useCallback(
    (square: string) => {
      const disc = discBySquare.get(square);
      return Boolean(disc && movableColor && disc.code[0] === movableColor);
    },
    [discBySquare, movableColor],
  );

  // ---- completion reporting (once per plan) ----
  const onCompleteRef = useRef(onAnimationComplete);
  onCompleteRef.current = onAnimationComplete;
  const completePlan = useCallback((target: MotionPlan) => {
    if (completedRef.current.has(target.key)) return;
    completedRef.current.add(target.key);
    setDonePlanKey(target.key);
    onCompleteRef.current?.(target.ply);
  }, []);

  // A move the person dropped has landed (or the position moved on).
  useEffect(() => {
    if (landingRef.current) {
      landingRef.current = null;
      window.clearTimeout(landingTimerRef.current);
    }
  }, [fen]);

  // ---- frame source for the WebGPU renderer ----
  const frameStateRef = useRef({
    discs: scene.discs,
    plan,
    planActive,
    language,
    herColor,
    orientation,
    liftedSquare,
    lastMove,
    checkSquare: position.checkSquare,
  });
  frameStateRef.current = {
    discs: scene.discs,
    plan,
    planActive,
    language,
    herColor,
    orientation,
    liftedSquare,
    lastMove,
    checkSquare: position.checkSquare,
  };

  const getFrame = useCallback(
    (now: number): GpuFrame => {
      const state = frameStateRef.current;
      const toCell = (square: string | null | undefined) =>
        square ? squareToDisplay(square, state.orientation) : null;
      const gpuDisc = (code: PieceCode, pose: DiscPose): GpuDisc => {
        const { color, kind } = parseCode(code);
        return {
          x: pose.x,
          y: pose.y,
          lift: pose.lift,
          opacity: pose.opacity,
          rotation: pose.rotation,
          scale: pose.scale,
          atlasIndex: atlasIndex(state.language, kind),
          her: color === state.herColor,
        };
      };

      const activePlan = state.planActive ? state.plan : null;
      let elapsed = 0;
      if (activePlan) {
        const start = planStartRef.current;
        if (!start || start.key !== activePlan.key) {
          planStartRef.current = { key: activePlan.key, at: now };
        }
        elapsed = now - (planStartRef.current?.at ?? now);
      }
      const tracksById = new Map(
        (activePlan?.tracks ?? []).map((track) => [track.id, track]),
      );
      const drag = dragRef.current?.dragging ? dragRef.current : null;
      const returning = returnRef.current;
      let returningActive = false;

      const discs: GpuDisc[] = [];
      for (const disc of state.discs) {
        const home = squareCenter(disc.square, state.orientation);
        let pose: DiscPose;
        if (drag && drag.discId === disc.id) {
          pose = restingPose(drag.point, DRAG_LIFT);
        } else if (landingRef.current?.discId === disc.id) {
          pose = restingPose(landingRef.current.point, DRAG_LIFT);
        } else if (returning && returning.discId === disc.id) {
          const t = now - returning.startedAt;
          pose = samplePose(returning.track, t);
          if (t < returning.track.duration) returningActive = true;
          else returnRef.current = null;
        } else if (tracksById.has(disc.id) && elapsed < activePlan!.duration) {
          pose = samplePose(tracksById.get(disc.id)!, elapsed);
        } else {
          pose = restingPose(
            home,
            disc.square === state.liftedSquare ? SELECT_LIFT : 0,
          );
        }
        discs.push(gpuDisc(disc.code, pose));
      }
      if (activePlan && elapsed < activePlan.duration) {
        for (const track of activePlan.tracks) {
          if (isGhostTrack(track)) {
            discs.push(gpuDisc(track.code, samplePose(track, elapsed)));
          }
        }
      }
      if (activePlan && elapsed >= activePlan.duration) {
        queueMicrotask(() => completePlan(activePlan));
      }

      const last = state.lastMove;
      return {
        discs,
        lastFrom: toCell(last?.from),
        lastTo: toCell(last?.to),
        selected: toCell(state.liftedSquare),
        check: toCell(state.checkSquare),
        animating: Boolean(
          (activePlan && elapsed < activePlan.duration) ||
            drag ||
            returningActive,
        ),
      };
    },
    [completePlan],
  );

  // ---- WebGPU renderer lifecycle ----
  useEffect(() => {
    if (rendererPreference === "dom") {
      setMode("dom");
      return;
    }
    const canvas = canvasRef.current;
    const board = boardRef.current;
    const root = rootRef.current;
    if (!canvas || !board || !root) return;
    let cancelled = false;
    let instance: ShatranjRenderer | null = null;
    // Start on the next task, so a mount that is immediately torn down (React
    // strict mode) never configures the canvas twice.
    const startTimer = window.setTimeout(() => {
      if (cancelled) return;
      try {
        instance = createShatranjRenderer({
          canvas,
          board,
          styleRoot: root,
          getFrame,
        });
      } catch (error) {
        console.warn("Shatranj board: WebGPU unavailable, using DOM", error);
        return;
      }
      rendererRef.current = instance;
      instance.ready
        .then(() => {
          if (!cancelled) setMode("webgpu");
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          console.warn("Shatranj board: WebGPU unavailable, using DOM", error);
          setMode("dom");
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
      rendererRef.current = null;
      instance?.dispose();
      setMode("dom");
    };
  }, [getFrame, rendererPreference]);

  // Every committed render may change what the GPU should draw.
  useEffect(() => {
    rendererRef.current?.invalidate();
  });

  // ---- plan playback: DOM animations, or GPU timing + safety net ----
  const previousPlanRef = useRef<MotionPlan | null>(null);
  useLayoutEffect(() => {
    // A newer move superseded an unfinished animation: that one is done.
    const previous = previousPlanRef.current;
    if (previous && plan && previous.key !== plan.key) completePlan(previous);
    if (plan) previousPlanRef.current = plan;
    if (!plan || !planActive) return;
    const start = performance.now();
    planStartRef.current = { key: plan.key, at: start };
    const safety = window.setTimeout(
      () => completePlan(plan),
      plan.duration + 600,
    );
    if (plan.tracks.length === 0) {
      completePlan(plan);
      window.clearTimeout(safety);
      return;
    }
    if (mode === "webgpu") {
      rendererRef.current?.invalidate();
      return () => window.clearTimeout(safety);
    }

    const board = boardRef.current;
    if (!board) return () => window.clearTimeout(safety);
    const squarePx = board.getBoundingClientRect().width / 8;
    const running: Animation[] = [];
    const finishes: Promise<void>[] = [];
    for (const track of plan.tracks) {
      const ghost = isGhostTrack(track);
      const element = board.querySelector<HTMLElement>(
        ghost
          ? `[data-ghost-id="${track.id}"]`
          : `[data-disc-id="${track.id}"]`,
      );
      if (!element) continue;
      if (!ghost) {
        clearPoseInline(element);
        element.dataset.animating = "true";
      }
      const home = ghost ? track.from : track.to;
      const run = animateDomDisc(
        element,
        track,
        home,
        squarePx,
        ghost ? "forwards" : "none",
      );
      running.push(...run.animations);
      finishes.push(
        run.finished.then(() => {
          if (!ghost) delete element.dataset.animating;
        }),
      );
    }
    let cancelled = false;
    void Promise.all(finishes).then(() => {
      if (!cancelled) completePlan(plan);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(safety);
      for (const animation of running) animation.cancel();
    };
    // Playback is keyed by the plan; mode switches restart it cleanly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.key, mode]);

  // ---- committing a move ----
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const commitMove = useCallback(
    async (from: string, to: string, via: "drag" | "tap") => {
      const handler = onMoveRef.current;
      if (!handler || pendingRef.current) return false;
      pendingRef.current = true;
      setPending(true);
      setSelection(null);
      try {
        await handler(from, to, via);
        return true;
      } catch (error) {
        console.error("Shatranj board: move was not accepted", error);
        return false;
      } finally {
        pendingRef.current = false;
        setPending(false);
      }
    },
    [],
  );

  const activateSquare = useCallback(
    (square: string) => {
      setFocusSquare(square);
      if (selectedSquare && destinations.has(square)) {
        void commitMove(selectedSquare, square, "tap");
        return;
      }
      if (canAct && isOwn(square)) {
        setSelection((current) =>
          current && current.square === square && current.fen === fen
            ? null
            : { square, fen },
        );
        return;
      }
      setSelection(null);
    },
    [canAct, commitMove, destinations, fen, isOwn, selectedSquare],
  );

  // ---- drag and drop (both renderers) ----
  const boardPoint = (clientX: number, clientY: number): Point | null => {
    const board = boardRef.current;
    if (!board) return null;
    const rect = board.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 8,
      y: ((clientY - rect.top) / rect.height) * 8,
    };
  };

  const snapTarget = (point: Point, from: string) => {
    const options = legalMoves
      .filter((move) => move.from === from)
      .map((move) => move.to);
    if (options.length === 0) return null;
    const col = Math.floor(point.x);
    const row = Math.floor(point.y);
    if (col >= 0 && col < 8 && row >= 0 && row < 8) {
      const under = displayToSquare(col, row, orientation);
      if (options.includes(under)) return under;
    }
    let best: string | null = null;
    let bestDistance = 0.8;
    for (const square of options) {
      const center = squareCenter(square, orientation);
      const distance = Math.hypot(center.x - point.x, center.y - point.y);
      if (distance < bestDistance) {
        best = square;
        bestDistance = distance;
      }
    }
    return best;
  };

  const startReturn = (discId: string, square: string, from: Point) => {
    const home = squareCenter(square, orientation);
    const disc = scene.discs.find((candidate) => candidate.id === discId);
    if (!disc) return;
    const track = buildSettleTrack(discId, disc.code, from, home);
    if (mode === "webgpu") {
      returnRef.current = { discId, track, startedAt: performance.now() };
      rendererRef.current?.invalidate();
      return;
    }
    const element = boardRef.current?.querySelector<HTMLElement>(
      `[data-disc-id="${discId}"]`,
    );
    const board = boardRef.current;
    if (!element || !board) return;
    clearPoseInline(element);
    animateDomDisc(
      element,
      track,
      home,
      board.getBoundingClientRect().width / 8,
      "none",
    );
  };

  const onPiecePointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    disc: Disc,
  ) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    pointerDownRef.current = {
      square: disc.square,
      wasSelected: selectedSquare === disc.square,
    };
    if (!canAct || !isOwn(disc.square)) return;
    const point = boardPoint(event.clientX, event.clientY);
    if (!point) return;
    if (selectedSquare !== disc.square) {
      setSelection({ square: disc.square, fen });
    }
    dragRef.current = {
      discId: disc.id,
      square: disc.square,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
      point,
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic pointers (tests) may not support capture.
    }
  };

  const onPiecePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = boardPoint(event.clientX, event.clientY);
    if (!point) return;
    const distance = Math.hypot(
      event.clientX - drag.startX,
      event.clientY - drag.startY,
    );
    if (!drag.dragging && distance > 6) {
      drag.dragging = true;
      setDraggingSquare(drag.square);
    }
    if (!drag.dragging) return;
    event.preventDefault();
    drag.point = point;
    const hint = snapTarget(point, drag.square);
    setDropHint((current) => (current === hint ? current : hint));
    if (mode === "webgpu") {
      rendererRef.current?.invalidate();
    } else {
      const board = boardRef.current;
      if (board) {
        applyPoseInline(
          event.currentTarget,
          restingPose(point, DRAG_LIFT),
          squareCenter(drag.square, orientation),
          board.getBoundingClientRect().width / 8,
        );
      }
    }
  };

  const finishDrag = (
    event: ReactPointerEvent<HTMLButtonElement>,
    cancelled: boolean,
  ) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // ignore
    }
    setDraggingSquare(null);
    setDropHint(null);
    if (!drag.dragging) return;
    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
    const point = boardPoint(event.clientX, event.clientY) ?? drag.point;
    const target = cancelled ? null : snapTarget(point, drag.square);
    if (!target) {
      startReturn(drag.discId, drag.square, point);
      return;
    }
    const landing: Landing = {
      discId: drag.discId,
      from: drag.square,
      to: target,
      point,
    };
    landingRef.current = landing;
    const giveBack = () => {
      if (landingRef.current !== landing) return;
      landingRef.current = null;
      startReturn(drag.discId, drag.square, point);
    };
    window.clearTimeout(landingTimerRef.current);
    landingTimerRef.current = window.setTimeout(giveBack, 2500);
    void commitMove(drag.square, target, "drag").then((accepted) => {
      if (!accepted) giveBack();
    });
  };

  // ---- keyboard: arrows move focus over squares, Enter/Space activate ----
  const onBoardKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const deltas: Record<string, [number, number]> = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
    };
    if (event.key === "Escape") {
      setSelection(null);
      return;
    }
    const delta = deltas[event.key];
    if (!delta) return;
    event.preventDefault();
    const { col, row } = squareToDisplay(focusSquare, orientation);
    const nextCol = Math.min(7, Math.max(0, col + delta[0]));
    const nextRow = Math.min(7, Math.max(0, row + delta[1]));
    focusRequestRef.current = true;
    setFocusSquare(displayToSquare(nextCol, nextRow, orientation));
  };

  useEffect(() => {
    if (!focusRequestRef.current) return;
    focusRequestRef.current = false;
    boardRef.current
      ?.querySelector<HTMLElement>(`[data-focus-square="${focusSquare}"]`)
      ?.focus();
  }, [focusSquare]);

  // ---- derived DOM data ----
  const lastPiece = useMemo(() => {
    if (!lastMove) return "";
    if (lastMove.piece) return lastMove.piece.toLowerCase();
    const disc = discBySquare.get(lastMove.to);
    return disc ? parseCode(disc.code).kind : "";
  }, [discBySquare, lastMove]);

  const ghostTracks =
    mode === "dom" && plan && planActive
      ? plan.tracks.filter(isGhostTrack)
      : [];

  const announce = useMemo(() => {
    if (!lastMove) return "";
    const name = lastPiece
      ? PIECE_NAMES[language][lastPiece as keyof (typeof PIECE_NAMES)["hi"]]
      : "";
    return language === "hi"
      ? `${name} ${lastMove.from} से ${lastMove.to}`.trim()
      : `${name} ${lastMove.from} to ${lastMove.to}`.trim();
  }, [language, lastMove, lastPiece]);

  const boardLabel =
    language === "hi"
      ? `शतरंज की बिसात। ${TURN_NAMES.hi[position.turn]} की चाल।${position.inCheck ? " शह!" : ""}`
      : `Chess board. ${COLOR_NAMES.en[position.turn]} to move.${position.inCheck ? " Check." : ""}`;

  const focusKind = (square: string) => {
    if (destinations.has(square)) return "dest";
    if (discBySquare.has(square)) return "piece";
    return "empty";
  };

  const squares: { square: string; col: number; row: number }[] = [];
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      squares.push({ square: displayToSquare(col, row, orientation), col, row });
    }
  }

  const discsInOrder = [...scene.discs].sort(
    (first, second) =>
      Number(first.id.slice(5)) - Number(second.id.slice(5)),
  );

  const rootStyle = {
    "--sj-disc-ratio": DISC_RATIO,
    "--sj-label-ratio": LABEL_RATIO,
  } as CSSProperties;

  return (
    <div
      ref={rootRef}
      className={`sj-root${className ? ` ${className}` : ""}`}
      style={rootStyle}
      role="group"
      aria-label={boardLabel}
      lang={language}
      data-testid="shatranj-board"
      data-fen={fen}
      data-turn={position.turn}
      data-move-count={plies}
      data-last-from={lastMove?.from ?? ""}
      data-last-to={lastMove?.to ?? ""}
      data-last-piece={lastPiece}
      data-last-actor={lastMove?.actor ?? ""}
      data-preview-from={previewFrom ?? ""}
      data-preview-count={previewTargets.length}
      data-renderer={mode}
      data-orientation={orientation}
      data-animating={planActive ? "true" : "false"}
      data-selected={selectedSquare ?? ""}
    >
      <div className="sj-frame" aria-hidden="true" />
      <div
        ref={boardRef}
        className="sj-board"
        onKeyDown={onBoardKeyDown}
        onClick={(event) => {
          if (event.target === event.currentTarget) setSelection(null);
        }}
      >
        {mode === "dom" ? (
          <div className="sj-squares" aria-hidden="true">
            {squares.map(({ square, col, row }) => {
              const mark =
                square === liftedSquare
                  ? "selected"
                  : square === lastMove?.from || square === lastMove?.to
                    ? "last"
                    : undefined;
              return (
                <div
                  key={square}
                  className="sj-square"
                  data-tone={squareTone(col, row)}
                  data-mark={mark}
                  data-check={
                    square === position.checkSquare ? "true" : undefined
                  }
                />
              );
            })}
          </div>
        ) : null}

        <canvas
          ref={canvasRef}
          className="sj-canvas"
          data-ready={mode === "webgpu" ? "true" : "false"}
          aria-hidden="true"
        />

        <div className="sj-coords" aria-hidden="true">
          {squares
            .filter(({ col, row }) => col === 0 || row === 7)
            .map(({ square, col, row }) => (
              <div
                key={`coord-${square}`}
                className="sj-cell"
                style={{ left: `${col * 12.5}%`, top: `${row * 12.5}%` }}
              >
                {col === 0 ? (
                  <span
                    className="sj-coord sj-coord--rank"
                    data-tone={squareTone(col, row)}
                  >
                    {square[1]}
                  </span>
                ) : null}
                {row === 7 ? (
                  <span
                    className="sj-coord sj-coord--file"
                    data-tone={squareTone(col, row)}
                  >
                    {square[0]}
                  </span>
                ) : null}
              </div>
            ))}
        </div>

        {/* Pieces: one button each, in both renderers. */}
        {discsInOrder.map((disc) => {
          const { color } = parseCode(disc.code);
          const own = canAct && movableColor === color;
          const pressed = selectedSquare === disc.square;
          const isFocusTarget =
            focusSquare === disc.square && focusKind(disc.square) === "piece";
          return (
            <button
              key={disc.id}
              type="button"
              className="sj-btn sj-cell sj-piece"
              style={cellStyle(disc.square, orientation)}
              data-testid={`piece-${disc.square}`}
              data-piece={disc.code}
              data-square={disc.square}
              data-disc-id={disc.id}
              data-movable={own ? "true" : "false"}
              data-lifted={disc.square === liftedSquare ? "true" : "false"}
              data-dragging={draggingSquare === disc.square ? "true" : undefined}
              data-focus-square={
                focusKind(disc.square) === "piece" ? disc.square : undefined
              }
              aria-label={pieceAriaLabel(disc.code, disc.square, language)}
              aria-pressed={pressed}
              tabIndex={isFocusTarget ? 0 : -1}
              onPointerDown={(event) => onPiecePointerDown(event, disc)}
              onPointerMove={onPiecePointerMove}
              onPointerUp={(event) => finishDrag(event, false)}
              onPointerCancel={(event) => finishDrag(event, true)}
              onFocus={() => setFocusSquare(disc.square)}
              onClick={(event) => {
                event.stopPropagation();
                if (suppressClickRef.current) return;
                const down = pointerDownRef.current;
                pointerDownRef.current = null;
                if (down && down.square === disc.square && !down.wasSelected) {
                  // The pointer press already selected it.
                  setFocusSquare(disc.square);
                  if (canAct && isOwn(disc.square)) {
                    setSelection({ square: disc.square, fen });
                    return;
                  }
                }
                activateSquare(disc.square);
              }}
            >
              {mode === "dom" ? (
                <DiscVisual
                  code={disc.code}
                  her={color === herColor}
                  language={language}
                />
              ) : null}
            </button>
          );
        })}

        {/* Captured discs leaving the board (DOM renderer). */}
        {ghostTracks.length > 0 ? (
          <div className="sj-ghosts" aria-hidden="true">
            {ghostTracks.map((track) => (
              <div
                key={track.id}
                className="sj-cell"
                data-ghost-id={track.id}
                style={{
                  left: `${(track.from.x - 0.5) * 12.5}%`,
                  top: `${(track.from.y - 0.5) * 12.5}%`,
                }}
              >
                <DiscVisual
                  code={track.code}
                  her={track.code[0] === herColor}
                  language={language}
                />
              </div>
            ))}
          </div>
        ) : null}

        {/* Empty squares: focus targets for keyboard travel. */}
        {squares
          .filter(({ square }) => focusKind(square) === "empty")
          .map(({ square }) => (
            <button
              key={`empty-${square}`}
              type="button"
              className="sj-btn sj-cell sj-empty"
              style={cellStyle(square, orientation)}
              data-square={square}
              data-focus-square={square}
              aria-label={square}
              tabIndex={focusSquare === square ? 0 : -1}
              onFocus={() => setFocusSquare(square)}
              onClick={(event) => {
                event.stopPropagation();
                activateSquare(square);
              }}
            />
          ))}

        {/* Legal destinations while a piece is selected. */}
        {[...destinations].map((square) => (
          <button
            key={`dest-${square}`}
            type="button"
            className="sj-btn sj-cell sj-dest"
            style={cellStyle(square, orientation)}
            data-testid={`dest-${square}`}
            data-square={square}
            data-focus-square={square}
            data-capture={discBySquare.has(square) ? "true" : "false"}
            data-drop-hint={dropHint === square ? "true" : undefined}
            aria-label={
              language === "hi"
                ? `${square} पर चलें`
                : `Move to ${square}`
            }
            tabIndex={focusSquare === square ? 0 : -1}
            onFocus={() => setFocusSquare(square)}
            onClick={(event) => {
              event.stopPropagation();
              if (selectedSquare) {
                setFocusSquare(square);
                void commitMove(selectedSquare, square, "tap");
              }
            }}
          />
        ))}

        {/* Preview targets (no move). */}
        {previewTargets.map((square) => (
          <div
            key={`preview-${square}`}
            className="sj-cell"
            style={{ ...cellStyle(square, orientation), zIndex: 5, pointerEvents: "none" }}
            data-preview-target={square}
            aria-hidden="true"
          >
            <span className="sj-preview-target" />
          </div>
        ))}
      </div>
      <p className="sj-sr-only" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}

export default ShatranjBoard;
