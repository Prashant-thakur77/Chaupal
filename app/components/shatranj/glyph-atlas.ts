import type { Gpu, Texture } from "vgpu";

import {
  KINDS,
  LABEL_SCALE,
  PIECE_NAMES,
  type Language,
  type PieceKind,
} from "./model";
import { LABEL_FONT_WEIGHT, LABEL_RATIO } from "./visual";

export const ATLAS_COLUMNS = 4;
export const ATLAS_ROWS = 3;
const LANGUAGES: readonly Language[] = ["hi", "en"];

export function atlasIndex(language: Language, kind: PieceKind) {
  return LANGUAGES.indexOf(language) * KINDS.length + KINDS.indexOf(kind);
}

async function waitForLabelFont(fontFamily: string) {
  if (typeof document === "undefined" || !document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load(
        `${LABEL_FONT_WEIGHT} 48px ${fontFamily}`,
        PIECE_NAMES.hi.p + PIECE_NAMES.hi.n,
      ),
      document.fonts.load(`${LABEL_FONT_WEIGHT} 48px ${fontFamily}`, "Knight"),
    ]);
    await document.fonts.ready;
  } catch {
    // A missing web font falls back to the system Devanagari face.
  }
}

/**
 * Rasterise every disc label once, at the disc's on-screen pixel size, so the
 * piece shader samples it 1:1 on the disc face. Labels are white alpha masks;
 * the shader inks them per side. Both languages share one atlas, so switching
 * language is a uniform change, not a re-upload.
 */
export async function createShatranjGlyphAtlas(
  gpu: Gpu,
  cellPx: number,
  fontFamily: string,
): Promise<Texture> {
  await waitForLabelFont(fontFamily);

  const cell = Math.max(24, Math.round(cellPx));
  const atlas = document.createElement("canvas");
  atlas.width = ATLAS_COLUMNS * cell;
  atlas.height = ATLAS_ROWS * cell;
  const context = atlas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Could not create the Shatranj glyph atlas");

  context.clearRect(0, 0, atlas.width, atlas.height);
  context.fillStyle = "#ffffff";
  context.textAlign = "center";
  context.textBaseline = "alphabetic";

  for (const language of LANGUAGES) {
    for (const kind of KINDS) {
      const index = atlasIndex(language, kind);
      const column = index % ATLAS_COLUMNS;
      const row = Math.floor(index / ATLAS_COLUMNS);
      const centerX = column * cell + cell * 0.5;
      const centerY = row * cell + cell * 0.5;
      const fontSize = cell * LABEL_RATIO * LABEL_SCALE[language][kind];
      context.font = `${LABEL_FONT_WEIGHT} ${fontSize}px ${fontFamily}`;
      const label = PIECE_NAMES[language][kind];
      const metrics = context.measureText(label);
      // Centre the font's ascent/descent box, as CSS does for a line-height: 1
      // line, so the GPU label sits where the DOM label sits.
      const ascent = metrics.fontBoundingBoxAscent || fontSize * 0.9;
      const descent = metrics.fontBoundingBoxDescent || fontSize * 0.3;
      const baselineY = centerY + (ascent - descent) / 2;
      context.save();
      context.beginPath();
      context.rect(column * cell, row * cell, cell, cell);
      context.clip();
      context.fillText(label, centerX, baselineY);
      context.restore();
    }
  }

  const pixels = context.getImageData(0, 0, atlas.width, atlas.height).data;
  const texture = gpu.device.createTexture({
    size: [atlas.width, atlas.height],
    format: "rgba8unorm",
    usage: ["copy_dst", "texture_binding"],
    label: "chaupal-shatranj-glyph-atlas",
  });
  // writeTexture rather than copyExternalImageToTexture keeps the atlas
  // identical in extension sessions and embedded in-app browsers.
  gpu.gpu.queue.writeTexture(
    { texture: texture.gpu },
    pixels,
    { bytesPerRow: atlas.width * 4, rowsPerImage: atlas.height },
    { width: atlas.width, height: atlas.height, depthOrArrayLayers: 1 },
  );
  return texture;
}
