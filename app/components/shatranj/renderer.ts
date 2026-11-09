import type { Draw, Effect, Gpu, StorageBuffer, Surface, Texture } from "vgpu";

import boardWgsl from "./shatranj-board.wgsl";
import piecesWgsl from "./shatranj-pieces.wgsl";
import { ATLAS_COLUMNS, createShatranjGlyphAtlas } from "./glyph-atlas";
import {
  DISC_RATIO,
  INNER_RING,
  RIM_WIDTH,
  readLabelFont,
  readPalette,
  type Palette,
} from "./visual";

export const MAX_DISCS = 48;

export type GpuDisc = {
  x: number;
  y: number;
  lift: number;
  opacity: number;
  rotation: number;
  scale: number;
  atlasIndex: number;
  her: boolean;
};

/** Display cell (col, row) or null. */
export type Cell = { col: number; row: number } | null;

export type GpuFrame = {
  discs: GpuDisc[];
  lastFrom: Cell;
  lastTo: Cell;
  selected: Cell;
  check: Cell;
  /** Keep drawing every frame while true (motion, drag). */
  animating: boolean;
};

export type ShatranjRenderer = {
  ready: Promise<void>;
  /** Ask for a new frame; the renderer pulls the scene from `getFrame`. */
  invalidate: () => void;
  /** Re-read the palette (after a theme change). */
  refreshPalette: () => void;
  dispose: () => void;
};

type RendererOptions = {
  canvas: HTMLCanvasElement;
  /** The 8x8 board element the canvas overhangs; defines square geometry. */
  board: HTMLElement;
  /** Element whose CSS custom properties carry the palette and label font. */
  styleRoot: HTMLElement;
  getFrame: (now: number) => GpuFrame;
};

const NO_CELL = [-1, -1] as const;

function cellUniform(cell: Cell) {
  return cell ? ([cell.col, cell.row] as const) : NO_CELL;
}

/**
 * vGPU Shatranj scene: a full-canvas clay board effect and one instanced draw
 * of round discs with labels sampled from a glyph atlas. The renderer only
 * draws; the board component owns the position, the motion timeline and the
 * DOM accessibility layer, and hands each frame over through `getFrame`.
 */
export function createShatranjRenderer({
  canvas,
  board,
  styleRoot,
  getFrame,
}: RendererOptions): ShatranjRenderer {
  let disposed = false;
  let gpu: Gpu | undefined;
  let output: Surface | undefined;
  let boardEffect: Effect | undefined;
  let piecesDraw: Draw | undefined;
  let discBuffer: StorageBuffer | undefined;
  let glyphAtlas: Texture | undefined;
  let glyphSampler: GPUSampler | undefined;
  let atlasCellPx = 0;
  let atlasBuilding: Promise<void> | null = null;
  let resizeObserver: ResizeObserver | undefined;
  let visibilityObserver: IntersectionObserver | undefined;
  let frameId = 0;
  let visible = true;
  let palette: Palette | undefined;
  let layout = { originX: 0, originY: 0, squarePx: 1, dpr: 1 };
  const discData = new Float32Array(MAX_DISCS * 8);

  const measure = () => {
    if (!output) return;
    const canvasRect = canvas.getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();
    if (canvasRect.width <= 0 || boardRect.width <= 0) return;
    const dpr = output.size[0] / canvasRect.width;
    layout = {
      originX: (boardRect.left - canvasRect.left) * dpr,
      originY: (boardRect.top - canvasRect.top) * dpr,
      squarePx: (boardRect.width / 8) * dpr,
      dpr,
    };
  };

  const applyPalette = () => {
    if (!palette || !boardEffect || !piecesDraw) return;
    boardEffect.set({
      params: {
        squareDark: palette.squareDark,
        squareLight: palette.squareLight,
        lastMove: palette.lastMove,
        selected: palette.selected,
        check: palette.check,
      },
    });
    piecesDraw.set({
      params: {
        herFace: palette.herFace,
        herInk: palette.herInk,
        herRim: palette.herRim,
        herRing: palette.herRing,
        otherFace: palette.otherFace,
        otherInk: palette.otherInk,
        otherRim: palette.otherRim,
        otherRing: palette.otherRing,
        shadow: palette.shadow,
      },
    });
  };

  const ensureAtlas = (force = false) => {
    if (!gpu || disposed) return Promise.resolve();
    const wanted = Math.max(24, Math.round(layout.squarePx * DISC_RATIO));
    if (!force && glyphAtlas && Math.abs(wanted - atlasCellPx) < 1) {
      return Promise.resolve();
    }
    if (atlasBuilding) return atlasBuilding;
    const currentGpu = gpu;
    atlasBuilding = createShatranjGlyphAtlas(
      currentGpu,
      wanted,
      readLabelFont(styleRoot),
    )
      .then((texture) => {
        if (disposed) {
          texture.destroy();
          return;
        }
        const previous = glyphAtlas;
        glyphAtlas = texture;
        atlasCellPx = wanted;
        piecesDraw?.set({ glyphAtlas, params: { atlasCellPx } });
        previous?.destroy();
      })
      .finally(() => {
        atlasBuilding = null;
        // The board may have resized while the atlas was being drawn.
        const latest = Math.max(24, Math.round(layout.squarePx * DISC_RATIO));
        if (!disposed && Math.abs(latest - atlasCellPx) >= 1) {
          void ensureAtlas();
        }
        invalidate();
      });
    return atlasBuilding;
  };

  const resize = () => {
    if (!output || disposed) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    output.resize([
      Math.max(1, Math.round(rect.width * dpr)),
      Math.max(1, Math.round(rect.height * dpr)),
    ]);
    measure();
    void ensureAtlas();
    invalidate();
  };

  const render = (time: number) => {
    frameId = 0;
    if (
      disposed ||
      !gpu ||
      !output ||
      !boardEffect ||
      !piecesDraw ||
      !discBuffer ||
      !glyphAtlas ||
      !visible
    ) {
      return;
    }
    measure();
    const scene = getFrame(time);
    const discs = scene.discs.slice(0, MAX_DISCS);
    // Lifted discs draw last so they pass over the ones at rest.
    discs.sort((first, second) => first.lift - second.lift);
    discData.fill(0);
    discs.forEach((disc, index) => {
      const offset = index * 8;
      discData[offset] = disc.x;
      discData[offset + 1] = disc.y;
      discData[offset + 2] = disc.lift;
      discData[offset + 3] = disc.opacity;
      discData[offset + 4] = disc.rotation;
      discData[offset + 5] = disc.atlasIndex;
      discData[offset + 6] = disc.her ? 1 : 0;
      discData[offset + 7] = disc.scale;
    });
    discBuffer.write(discData);

    boardEffect.set({
      params: {
        boardOrigin: [layout.originX, layout.originY],
        squarePx: layout.squarePx,
        dpr: layout.dpr,
        lastFrom: cellUniform(scene.lastFrom),
        lastTo: cellUniform(scene.lastTo),
        selectedSquare: cellUniform(scene.selected),
        checkSquare: cellUniform(scene.check),
      },
    });
    piecesDraw.set({
      params: {
        canvasSize: [output.size[0], output.size[1]],
        boardOrigin: [layout.originX, layout.originY],
        squarePx: layout.squarePx,
        ringPx: Math.max(1, (layout.squarePx / layout.dpr) * 0.02) * layout.dpr,
        dpr: layout.dpr,
      },
    });

    const currentBoard = boardEffect;
    const currentPieces = piecesDraw;
    const count = discs.length;
    const { frame } = vgpuModule!;
    frame(gpu, (currentFrame) => {
      currentFrame.pass({ target: output!, clear: [0, 0, 0, 0] }, (pass) => {
        pass.draw(currentBoard);
        if (count > 0) pass.draw(currentPieces, { instances: count });
      });
    });

    if (scene.animating) frameId = requestAnimationFrame(render);
  };

  let vgpuModule: typeof import("vgpu") | undefined;

  const invalidate = () => {
    if (!frameId && visible && !disposed && boardEffect) {
      frameId = requestAnimationFrame(render);
    }
  };

  const initialize = async () => {
    if (typeof navigator === "undefined" || !("gpu" in navigator)) {
      throw new Error("WebGPU is not available in this browser");
    }
    vgpuModule = await import("vgpu");
    const { init, surface, effect, draw, storage, sampler } = vgpuModule;
    if (disposed) return;
    gpu = await init();
    if (disposed) {
      gpu.dispose();
      return;
    }
    gpu.onError((error: unknown) => {
      console.error("Shatranj board: GPU error", error);
    });
    output = surface(gpu, canvas, {
      alphaMode: "premultiplied",
      clearColor: [0, 0, 0, 0],
      dpr: [1, 3],
      label: "chaupal-shatranj-output",
    });
    discBuffer = storage(gpu, MAX_DISCS * 8 * Float32Array.BYTES_PER_ELEMENT, "read");
    discBuffer.write(discData);
    glyphSampler = sampler(gpu, {
      minFilter: "linear",
      magFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    });
    boardEffect = effect(gpu, boardWgsl, {
      label: "chaupal-shatranj-board",
    });
    piecesDraw = draw(gpu, {
      shader: piecesWgsl,
      vertices: 6,
      instances: 0,
      blend: "premultiplied",
      label: "chaupal-shatranj-discs",
    });
    piecesDraw.set({
      discs: discBuffer,
      glyphSampler,
      params: {
        discRatio: DISC_RATIO,
        innerRing: INNER_RING,
        rimWidth: RIM_WIDTH,
        atlasColumns: ATLAS_COLUMNS,
      },
    });
    palette = readPalette(styleRoot);
    applyPalette();

    resize();
    await ensureAtlas(true);
    if (disposed) return;
    await Promise.all([
      boardEffect.compile({ colors: [output.format] }),
      piecesDraw.compile({ colors: [output.format] }),
    ]);
    if (disposed) return;

    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resizeObserver.observe(board);
    visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      if (visible) invalidate();
    });
    visibilityObserver.observe(canvas);
    if (typeof document !== "undefined" && document.fonts) {
      document.fonts.addEventListener("loadingdone", onFontsLoaded);
    }
    invalidate();
  };

  const onFontsLoaded = () => {
    void ensureAtlas(true);
  };

  const ready = initialize();

  const refreshPalette = () => {
    if (!boardEffect) return;
    palette = readPalette(styleRoot);
    applyPalette();
    invalidate();
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    resizeObserver?.disconnect();
    visibilityObserver?.disconnect();
    if (typeof document !== "undefined" && document.fonts) {
      document.fonts.removeEventListener("loadingdone", onFontsLoaded);
    }
    glyphAtlas?.destroy();
    output?.dispose();
    gpu?.dispose();
  };

  return { ready, invalidate, refreshPalette, dispose };
}
