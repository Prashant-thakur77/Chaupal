/**
 * Air-writing: camera → hand landmarks → a pen on her layer.
 *
 * Uses the hand-tracking runtime unchanged: the camera source
 * (getUserMedia only inside the click that asked for it), the WebGPU crop
 * stages of the visual pipeline, the ONNX palm detector and landmark model on
 * ORT WebGPU, the SSD decoding, the slot tracker and the coalescing inference
 * scheduler. The difference is the output: the runtime keeps everything on the
 * GPU and paints a mask; Chaupal needs the path itself, so the 63 landmark
 * floats are read back (one tiny tensor per frame) and the hand pose becomes
 * PenSamples that the stroke layer turns into committed strokes.
 *
 * The gesture: close the hand into a fist to put the pen
 * down, open it to lift. The working tip sits one palm-length above the
 * knuckles, so the pen appears held rather than hidden under the hand.
 *
 * Frames stay on the device. Nothing here uploads or stores video.
 */

import type {
  CameraSource,
  PendingCameraRequest,
} from "@/features/calligraphy/runtime/camera-source";
import {
  DETECTOR_BOXES_OUTPUT,
  DETECTOR_INPUT_DIMS,
  DETECTOR_INPUT_NAME,
  DETECTOR_SCORES_OUTPUT,
  DETECTOR_URL,
  LANDMARK_INPUT_DIMS,
  LANDMARK_INPUT_NAME,
  LANDMARK_POINTS_OUTPUT,
  LANDMARK_PRESENCE_OUTPUT,
  LANDMARK_SIZE,
  LANDMARK_URL,
  MAX_HANDS,
  PRESENCE_STAY,
  ROI_MAX_FRACTION,
  ROI_MIN_FRACTION,
} from "@/features/calligraphy/runtime/hand-model-contract";
import {
  computeLetterbox,
  decodeDetections,
  detectionToSquareRoi,
  roiToSource,
  ssdAnchors,
  weightedNms,
  type HandRoi,
} from "@/features/calligraphy/runtime/hand-pipeline";
import {
  createHandTracker,
  type HandCandidate,
  type HandTracker,
} from "@/features/calligraphy/runtime/hand-tracker";
import {
  createInferenceScheduler,
  type InferenceScheduler,
} from "@/features/calligraphy/runtime/inference-scheduler";
import {
  createSharedDeviceSession,
  createSiblingSession,
  OrtInitCancelled,
  type OrtTensor,
  type SharedDeviceSession,
  type SiblingSession,
} from "@/features/calligraphy/runtime/ort-webgpu";
import {
  createVisualPipeline,
  type VisualPipeline,
} from "@/features/calligraphy/runtime/visual-pipeline";

import type { PenSample } from "./types";

export type AirTrackerStatus = "starting" | "running" | "stopped" | "failed";

export interface AirTracker {
  /** Resolves once the camera is live and both models are loaded. */
  readonly ready: Promise<void>;
  /** The local, never-uploaded camera element (for a mirrored preview). */
  readonly video: Promise<HTMLVideoElement>;
  stop(): void;
}

interface Options {
  onPen(sample: PenSample): void;
  /** A live failure after `ready` (lost camera, GPU device lost). */
  onFailure?(error: unknown): void;
}

// The hand.wgsl gesture and filter constants, on the CPU.
const HAND_ENGAGE_THRESHOLD = 0.2;
const HAND_RELEASE_THRESHOLD = 0.34;
const BRUSH_TIP_OFFSET_SCALE = 1.15;
const MIN_TIP_OFFSET = 42;
const MAX_TIP_OFFSET = 120;
const EMA_TAU = 0.075;
const MAX_JUMP = 0.18 * Math.SQRT2;
const LOOPBACK_SCALE = 2;
/**
 * The part of the camera frame that maps onto the whole stage, so she can
 * reach every corner of the reference without stretching to the frame edge.
 */
const ACTIVE_ZONE = { left: 0.14, right: 0.86, top: 0.12, bottom: 0.78 };

type Vec = { x: number; y: number };

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function cropToSource(px: number, py: number, roi: HandRoi): Vec {
  const c = Math.cos(roi.rotation);
  const s = Math.sin(roi.rotation);
  const dx = (px / LANDMARK_SIZE - 0.5) * roi.size;
  const dy = (py / LANDMARK_SIZE - 0.5) * roi.size;
  return { x: roi.cx + dx * c - dy * s, y: roi.cy + dx * s + dy * c };
}

function normaliseAngle(a: number) {
  const tau = Math.PI * 2;
  return a - tau * Math.floor((a + Math.PI) / tau);
}

function fingerOpenness(lm: Float32Array, pip: number, tip: number) {
  const wx = lm[0]!;
  const wy = lm[1]!;
  const pipDistance = Math.max(Math.hypot(lm[pip * 3]! - wx, lm[pip * 3 + 1]! - wy), 1);
  const tipDistance = Math.hypot(lm[tip * 3]! - wx, lm[tip * 3 + 1]! - wy);
  return smoothstep(1.02, 1.22, tipDistance / pipDistance);
}

function handOpenness(lm: Float32Array) {
  return (
    (fingerOpenness(lm, 6, 8) +
      fingerOpenness(lm, 10, 12) +
      fingerOpenness(lm, 14, 16) +
      fingerOpenness(lm, 18, 20)) *
    0.25
  );
}

export function startAirTracker(
  request: PendingCameraRequest,
  options: Options,
): AirTracker {
  let disposed = false;
  let camera: CameraSource | undefined;
  let shared: SharedDeviceSession | undefined;
  let detector: SiblingSession | undefined;
  let pipeline: VisualPipeline | undefined;
  let tracker: HandTracker | undefined;
  let scheduler: InferenceScheduler<number> | undefined;
  let detectorInput: OrtTensor | undefined;
  const landmarkInputs: OrtTensor[] = [];
  const rois: (HandRoi | undefined)[] = Array.from({ length: MAX_HANDS }, () => undefined);
  const anchors = ssdAnchors();
  let penSlot = -1;
  let lastResultMs: number | undefined;

  // CPU pen state (port of update_brush in hand.wgsl).
  const pen = {
    tracking: false,
    engaged: false,
    x: 0.5,
    y: 0.5,
    openness: 1,
    pressure: 0,
  };

  let resolveVideo!: (video: HTMLVideoElement) => void;
  let rejectVideo!: (error: unknown) => void;
  const video = new Promise<HTMLVideoElement>((resolve, reject) => {
    resolveVideo = resolve;
    rejectVideo = reject;
  });
  void video.catch(() => undefined);

  const emit = () =>
    options.onPen({
      x: pen.x,
      y: pen.y,
      down: pen.tracking && pen.engaged,
      tracking: pen.tracking,
      pressure: pen.pressure,
    });

  const loseHand = () => {
    if (!pen.tracking && !pen.engaged) return;
    pen.tracking = false;
    pen.engaged = false;
    emit();
  };

  const updatePen = (landmarks: Float32Array, roi: HandRoi, dt: number) => {
    if (!camera) return;
    const point = (i: number) => cropToSource(landmarks[i * 3]!, landmarks[i * 3 + 1]!, roi);
    const knuckles = [5, 9, 13, 17].map(point);
    const centroid = {
      x: knuckles.reduce((s, p) => s + p.x, 0) / 4,
      y: knuckles.reduce((s, p) => s + p.y, 0) / 4,
    };
    const wrist = point(0);
    const scale = camera.height / 540;
    const palm = Math.hypot(centroid.x - wrist.x, centroid.y - wrist.y);
    const offset = Math.min(
      MAX_TIP_OFFSET * scale,
      Math.max(MIN_TIP_OFFSET * scale, palm * BRUSH_TIP_OFFSET_SCALE),
    );
    const sx = centroid.x / camera.width;
    const sy = (centroid.y - offset) / camera.height;
    // Mirror like a looking glass, then map the comfortable zone to the stage.
    const mx = 1 - sx;
    const measured = {
      x: clamp01((mx - ACTIVE_ZONE.left) / (ACTIVE_ZONE.right - ACTIVE_ZONE.left)),
      y: clamp01((sy - ACTIVE_ZONE.top) / (ACTIVE_ZONE.bottom - ACTIVE_ZONE.top)),
    };
    const openness = handOpenness(landmarks);
    const pressure = 1 - smoothstep(0.02, HAND_RELEASE_THRESHOLD, openness);

    const step = Math.min(0.1, Math.max(0, dt));
    if (!pen.tracking) {
      pen.x = measured.x;
      pen.y = measured.y;
      pen.openness = openness;
      pen.pressure = pressure;
      pen.tracking = true;
      pen.engaged = false;
      emit();
      return;
    }
    const movement = Math.hypot(pen.x - measured.x, pen.y - measured.y);
    const tau = EMA_TAU + (0.018 - EMA_TAU) * smoothstep(0.006, 0.075, movement);
    const alpha = 1 - Math.exp(-step / Math.max(tau, 1e-4));
    const poseTau = 0.055 + (0.02 - 0.055) * smoothstep(0.025, 0.32, Math.abs(pen.openness - openness));
    pen.openness += (openness - pen.openness) * (1 - Math.exp(-step / poseTau));
    pen.pressure += (pressure - pen.pressure) * (1 - Math.exp(-step / 0.04));

    const threshold = pen.engaged ? HAND_RELEASE_THRESHOLD : HAND_ENGAGE_THRESHOLD;
    const engaged = pen.openness < threshold;
    if (engaged && pen.engaged && movement > MAX_JUMP) {
      // An implausible jump keeps the track but breaks the line.
      pen.engaged = false;
      emit();
      pen.x = measured.x;
      pen.y = measured.y;
      pen.engaged = true;
      emit();
      return;
    }
    pen.x += (measured.x - pen.x) * alpha;
    pen.y += (measured.y - pen.y) * alpha;
    pen.engaged = engaged;
    emit();
  };

  async function runDetector(): Promise<void> {
    if (!pipeline || !detector || !tracker || !detectorInput || !shared) return;
    pipeline.cropDetectorInput();
    await shared.gpu.device.queue.flush();
    if (disposed) return;
    const tensors = await detector.session.run(
      { [detector.inputNames[0] ?? DETECTOR_INPUT_NAME]: detectorInput },
      [DETECTOR_BOXES_OUTPUT, DETECTOR_SCORES_OUTPUT],
    );
    const boxes = tensors[DETECTOR_BOXES_OUTPUT];
    const scores = tensors[DETECTOR_SCORES_OUTPUT];
    try {
      if (disposed) return;
      const boxData = boxes?.data as Float32Array | undefined;
      const scoreData = scores?.data as Float32Array | undefined;
      if (!boxData || !scoreData) throw new Error("The palm detector returned no output.");
      const letterbox = computeLetterbox(pipeline.sourceWidth, pipeline.sourceHeight);
      const detections = weightedNms(decodeDetections(boxData, scoreData, anchors), MAX_HANDS);
      const candidates: HandCandidate[] = detections.map((detection) => {
        const roi = roiToSource(detectionToSquareRoi(detection), letterbox);
        return { roi, centroid: { x: roi.cx, y: roi.cy } };
      });
      for (const slot of tracker.acquire(candidates)) {
        const roi = tracker.slots[slot]?.pendingRoi;
        if (roi) {
          pipeline.writeRoi(slot, roi);
          rois[slot] = roi;
          tracker.clearPending(slot);
        }
      }
    } finally {
      boxes?.dispose();
      scores?.dispose();
    }
  }

  async function runOnce(): Promise<void> {
    if (disposed || !shared || !pipeline || !tracker || !camera) return;
    pipeline.copyAnalysisFrame(camera.frame);
    if (tracker.needsDetector()) {
      await runDetector();
      if (disposed) return;
    }
    const now = performance.now();
    const dt = lastResultMs === undefined ? 1 / 30 : (now - lastResultMs) / 1000;
    lastResultMs = now;

    const slots = tracker.activeSlots();
    const results = new Map<number, Float32Array>();
    for (const slot of slots) {
      const input = landmarkInputs[slot];
      const roi = rois[slot];
      if (!input || !roi) continue;
      pipeline.cropLandmarkInput(slot);
      await shared.gpu.device.queue.flush();
      if (disposed) return;
      const tensors = await shared.session.run(
        { [shared.inputNames[0] ?? LANDMARK_INPUT_NAME]: input },
        [LANDMARK_POINTS_OUTPUT, LANDMARK_PRESENCE_OUTPUT],
      );
      const points = tensors[LANDMARK_POINTS_OUTPUT];
      const presence = tensors[LANDMARK_PRESENCE_OUTPUT];
      try {
        if (disposed) return;
        const confidence = Number((presence?.data as Float32Array | undefined)?.[0] ?? 0);
        tracker.noteResult(slot, confidence);
        const data = points?.data as Float32Array | undefined;
        if (!data || data.length < 63 || confidence < PRESENCE_STAY) continue;
        const landmarks = Float32Array.from(data.subarray(0, 63));
        results.set(slot, landmarks);
        // ROI loopback (port of next_roi in hand.wgsl), done on the CPU here.
        const start = cropToSource(landmarks[0]!, landmarks[1]!, roi);
        const end = cropToSource(landmarks[27]!, landmarks[28]!, roi);
        const rotation = normaliseAngle(Math.PI / 2 - Math.atan2(-(end.y - start.y), end.x - start.x));
        let lox = Infinity;
        let loy = Infinity;
        let hix = -Infinity;
        let hiy = -Infinity;
        for (let i = 0; i < 21; i++) {
          const p = cropToSource(landmarks[i * 3]!, landmarks[i * 3 + 1]!, roi);
          lox = Math.min(lox, p.x);
          loy = Math.min(loy, p.y);
          hix = Math.max(hix, p.x);
          hiy = Math.max(hiy, p.y);
        }
        const size = Math.max(hix - lox, hiy - loy) * LOOPBACK_SCALE;
        const fraction = size / Math.max(1, Math.min(camera.width, camera.height));
        if (fraction > ROI_MIN_FRACTION && fraction < ROI_MAX_FRACTION) {
          const next: HandRoi = { cx: (lox + hix) / 2, cy: (loy + hiy) / 2, size, rotation };
          // The pen reads this frame's landmarks with the ROI they came from;
          // the next crop uses the loopback ROI.
          pendingRois.set(slot, next);
        }
      } finally {
        points?.dispose();
        presence?.dispose();
      }
    }
    for (let slot = 0; slot < MAX_HANDS; slot++) {
      if (!slots.includes(slot)) tracker.noteMissing(slot);
    }
    tracker.endFrame();

    const active = tracker.activeSlots();
    if (!active.includes(penSlot)) penSlot = active[0] ?? -1;
    const landmarks = penSlot >= 0 ? results.get(penSlot) : undefined;
    const roi = penSlot >= 0 ? rois[penSlot] : undefined;
    if (landmarks && roi) updatePen(landmarks, roi, dt);
    else if (penSlot < 0 || !active.length) loseHand();

    for (const [slot, next] of pendingRois) {
      rois[slot] = next;
      pipeline.writeRoi(slot, next);
    }
    pendingRois.clear();
  }
  const pendingRois = new Map<number, HandRoi>();

  const initialize = async () => {
    try {
      camera = await request.source;
    } catch (error) {
      rejectVideo(error);
      throw error;
    }
    if (disposed) {
      camera.dispose();
      throw new OrtInitCancelled();
    }
    resolveVideo(camera.frame);
    shared = await createSharedDeviceSession({
      modelUrl: LANDMARK_URL,
      label: "hand landmarks",
      isCancelled: () => disposed,
      preferredOutputLocation: {
        [LANDMARK_POINTS_OUTPUT]: "cpu",
        [LANDMARK_PRESENCE_OUTPUT]: "cpu",
      },
    });
    if (disposed) throw new OrtInitCancelled();
    detector = await createSiblingSession(shared, {
      modelUrl: DETECTOR_URL,
      label: "palm detector",
      isCancelled: () => disposed,
      preferredOutputLocation: "cpu",
    });
    if (disposed) throw new OrtInitCancelled();
    pipeline = createVisualPipeline(shared.gpu, {
      sourceWidth: camera.width,
      sourceHeight: camera.height,
      label: "chaupal-air-writing",
    });
    tracker = createHandTracker({ sourceWidth: camera.width, sourceHeight: camera.height });
    detectorInput = shared.ort.Tensor.fromGpuBuffer(pipeline.detectorInput.gpu, {
      dataType: "float32",
      dims: [...DETECTOR_INPUT_DIMS],
    });
    for (let slot = 0; slot < MAX_HANDS; slot++) {
      landmarkInputs.push(
        shared.ort.Tensor.fromGpuBuffer(pipeline.landmarkInput(slot).gpu, {
          dataType: "float32",
          dims: [...LANDMARK_INPUT_DIMS],
        }),
      );
    }
    scheduler = createInferenceScheduler<number>({
      run: () => runOnce(),
      onError: (error) => {
        stop();
        options.onFailure?.(error);
      },
    });
    camera.start((token) => scheduler?.request(token));
  };

  const stop = () => {
    if (disposed) return;
    disposed = true;
    loseHand();
    const draining = scheduler?.stop();
    try {
      camera?.dispose();
    } catch {}
    // Abort a camera request that has not resolved yet (tracks are stopped too).
    request.abort();
    void (async () => {
      try {
        await draining;
      } catch {}
      for (const tensor of landmarkInputs) {
        try {
          tensor.dispose();
        } catch {}
      }
      try {
        detectorInput?.dispose();
      } catch {}
      try {
        pipeline?.dispose();
      } catch {}
      try {
        await detector?.release();
      } catch {}
      try {
        await shared?.release();
      } catch {}
    })();
  };

  const ready = initialize().catch((error: unknown) => {
    stop();
    throw error;
  });
  void ready.catch(() => undefined);

  return { ready, video, stop };
}
