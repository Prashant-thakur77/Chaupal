/**
 * Minimal TrueType (sfnt + glyf) reader for Sulekh.
 *
 * HarfBuzz does the shaping. Glyph outlines are read here, straight from
 * the `glyf` table, so that no JS callback has to be registered inside the
 * HarfBuzz wasm (registering one needs runtime wasm compilation, which
 * Cloudflare Workers forbid). Only TrueType-flavoured fonts are supported;
 * every font in the Sulekh catalog is a static or default-instance glyf TTF.
 *
 * No DOM and no Node APIs: input is a Uint8Array.
 */

export type OutlineCommand =
  | { op: "M"; x: number; y: number }
  | { op: "L"; x: number; y: number }
  | { op: "Q"; cx: number; cy: number; x: number; y: number }
  | { op: "Z" };

export interface FontInfo {
  unitsPerEm: number;
  numGlyphs: number;
  ascender: number;
  descender: number;
  hasGlyf: boolean;
  isVariable: boolean;
  tables: string[];
}

interface TableRecord {
  offset: number;
  length: number;
}

export class SfntFont {
  readonly bytes: Uint8Array;
  readonly view: DataView;
  readonly tables = new Map<string, TableRecord>();
  readonly info: FontInfo;
  private readonly locaOffsets: Uint32Array | null;
  private readonly outlineCache = new Map<number, OutlineCommand[]>();

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tag = this.view.getUint32(0);
    if (tag === 0x74746366 /* ttcf */) {
      throw new Error("SULEKH_FONT_COLLECTION_UNSUPPORTED");
    }
    if (tag === 0x774f4646 || tag === 0x774f4632 /* wOFF / wOF2 */) {
      throw new Error("SULEKH_FONT_WOFF_UNSUPPORTED: pass raw TTF bytes");
    }
    const numTables = this.view.getUint16(4);
    for (let i = 0; i < numTables; i++) {
      const rec = 12 + i * 16;
      const name = String.fromCharCode(
        bytes[rec],
        bytes[rec + 1],
        bytes[rec + 2],
        bytes[rec + 3],
      );
      this.tables.set(name, {
        offset: this.view.getUint32(rec + 8),
        length: this.view.getUint32(rec + 12),
      });
    }
    const head = this.table("head");
    const maxp = this.table("maxp");
    const hhea = this.tables.get("hhea");
    const unitsPerEm = this.view.getUint16(head.offset + 18);
    const indexToLocFormat = this.view.getInt16(head.offset + 50);
    const numGlyphs = this.view.getUint16(maxp.offset + 4);
    const hasGlyf = this.tables.has("glyf") && this.tables.has("loca");
    this.info = {
      unitsPerEm,
      numGlyphs,
      ascender: hhea ? this.view.getInt16(hhea.offset + 4) : unitsPerEm * 0.8,
      descender: hhea ? this.view.getInt16(hhea.offset + 6) : -unitsPerEm * 0.2,
      hasGlyf,
      isVariable: this.tables.has("fvar"),
      tables: [...this.tables.keys()],
    };
    if (hasGlyf) {
      const loca = this.table("loca");
      const offsets = new Uint32Array(numGlyphs + 1);
      for (let i = 0; i <= numGlyphs; i++) {
        offsets[i] =
          indexToLocFormat === 0
            ? this.view.getUint16(loca.offset + i * 2) * 2
            : this.view.getUint32(loca.offset + i * 4);
      }
      this.locaOffsets = offsets;
    } else {
      this.locaOffsets = null;
    }
  }

  table(name: string): TableRecord {
    const t = this.tables.get(name);
    if (!t) throw new Error(`SULEKH_FONT_MISSING_TABLE:${name}`);
    return t;
  }

  /** Outline of one glyph in font units, y-up (TrueType convention). */
  outline(glyphId: number): OutlineCommand[] {
    const cached = this.outlineCache.get(glyphId);
    if (cached) return cached;
    if (!this.locaOffsets) {
      throw new Error("SULEKH_FONT_NOT_GLYF: only TrueType outlines are supported");
    }
    const contours = this.contours(glyphId, 0);
    const commands: OutlineCommand[] = [];
    for (const contour of contours) appendContour(commands, contour);
    this.outlineCache.set(glyphId, commands);
    return commands;
  }

  private contours(glyphId: number, depth: number): Point[][] {
    if (depth > 8 || glyphId < 0 || glyphId >= this.info.numGlyphs) return [];
    const offsets = this.locaOffsets!;
    const start = offsets[glyphId];
    const end = offsets[glyphId + 1];
    if (end <= start) return []; // empty glyph (space etc.)
    const glyf = this.table("glyf");
    const p = glyf.offset + start;
    const v = this.view;
    const numberOfContours = v.getInt16(p);
    if (numberOfContours >= 0) return this.simpleGlyph(p, numberOfContours);

    // Composite glyph.
    const result: Point[][] = [];
    let q = p + 10;
    for (;;) {
      const flags = v.getUint16(q);
      const component = v.getUint16(q + 2);
      q += 4;
      let arg1: number;
      let arg2: number;
      if (flags & 0x0001) {
        arg1 = flags & 0x0002 ? v.getInt16(q) : v.getUint16(q);
        arg2 = flags & 0x0002 ? v.getInt16(q + 2) : v.getUint16(q + 2);
        q += 4;
      } else {
        arg1 = flags & 0x0002 ? v.getInt8(q) : v.getUint8(q);
        arg2 = flags & 0x0002 ? v.getInt8(q + 1) : v.getUint8(q + 1);
        q += 2;
      }
      let a = 1;
      let b = 0;
      let c = 0;
      let d = 1;
      if (flags & 0x0008) {
        a = d = f2dot14(v, q);
        q += 2;
      } else if (flags & 0x0040) {
        a = f2dot14(v, q);
        d = f2dot14(v, q + 2);
        q += 4;
      } else if (flags & 0x0080) {
        a = f2dot14(v, q);
        b = f2dot14(v, q + 2);
        c = f2dot14(v, q + 4);
        d = f2dot14(v, q + 6);
        q += 8;
      }
      const child = this.contours(component, depth + 1);
      let dx = 0;
      let dy = 0;
      if (flags & 0x0002) {
        dx = arg1;
        dy = arg2;
      } else {
        // Point matching: align child point arg2 with parent point arg1.
        const parentPts = result.flat();
        const childPts = child.flat();
        const pp = parentPts[arg1];
        const cp = childPts[arg2];
        if (pp && cp) {
          dx = pp.x - (cp.x * a + cp.y * c);
          dy = pp.y - (cp.x * b + cp.y * d);
        }
      }
      for (const contour of child) {
        result.push(
          contour.map((pt) => ({
            x: pt.x * a + pt.y * c + dx,
            y: pt.x * b + pt.y * d + dy,
            on: pt.on,
          })),
        );
      }
      if (!(flags & 0x0020)) break;
    }
    return result;
  }

  private simpleGlyph(p: number, numberOfContours: number): Point[][] {
    const v = this.view;
    const endPts: number[] = [];
    let q = p + 10;
    for (let i = 0; i < numberOfContours; i++) {
      endPts.push(v.getUint16(q));
      q += 2;
    }
    const numPoints = numberOfContours ? endPts[numberOfContours - 1] + 1 : 0;
    const instructionLength = v.getUint16(q);
    q += 2 + instructionLength;
    const flags = new Uint8Array(numPoints);
    for (let i = 0; i < numPoints; ) {
      const f = v.getUint8(q++);
      flags[i++] = f;
      if (f & 0x08) {
        let repeat = v.getUint8(q++);
        while (repeat-- > 0 && i < numPoints) flags[i++] = f;
      }
    }
    const xs = new Int32Array(numPoints);
    let x = 0;
    for (let i = 0; i < numPoints; i++) {
      const f = flags[i];
      if (f & 0x02) {
        const dx = v.getUint8(q++);
        x += f & 0x10 ? dx : -dx;
      } else if (!(f & 0x10)) {
        x += v.getInt16(q);
        q += 2;
      }
      xs[i] = x;
    }
    const ys = new Int32Array(numPoints);
    let y = 0;
    for (let i = 0; i < numPoints; i++) {
      const f = flags[i];
      if (f & 0x04) {
        const dy = v.getUint8(q++);
        y += f & 0x20 ? dy : -dy;
      } else if (!(f & 0x20)) {
        y += v.getInt16(q);
        q += 2;
      }
      ys[i] = y;
    }
    const contours: Point[][] = [];
    let s = 0;
    for (const e of endPts) {
      const contour: Point[] = [];
      for (let i = s; i <= e; i++) {
        contour.push({ x: xs[i], y: ys[i], on: (flags[i] & 0x01) !== 0 });
      }
      contours.push(contour);
      s = e + 1;
    }
    return contours;
  }
}

interface Point {
  x: number;
  y: number;
  on: boolean;
}

function f2dot14(v: DataView, offset: number): number {
  return v.getInt16(offset) / 16384;
}

/** Convert one TrueType contour (on/off-curve points) into M/L/Q/Z commands. */
function appendContour(out: OutlineCommand[], pts: Point[]): void {
  const n = pts.length;
  if (n === 0) return;
  // Pick a starting on-curve point (or synthesise one between two off-curve points).
  let startIndex = pts.findIndex((p) => p.on);
  let start: { x: number; y: number };
  if (startIndex === -1) {
    start = mid(pts[0], pts[1 % n]);
    startIndex = 0;
  } else {
    start = pts[startIndex];
  }
  out.push({ op: "M", x: start.x, y: start.y });
  let pendingCtrl: Point | null = null;
  const firstOffAll = pts.every((p) => !p.on);
  for (let k = 1; k <= n; k++) {
    const p = pts[(startIndex + k) % n];
    if (firstOffAll && k === n) {
      // close back through the original first off-curve point
      if (pendingCtrl) {
        const m = mid(pendingCtrl, p);
        out.push({ op: "Q", cx: pendingCtrl.x, cy: pendingCtrl.y, x: m.x, y: m.y });
      }
      out.push({ op: "Q", cx: p.x, cy: p.y, x: start.x, y: start.y });
      pendingCtrl = null;
      break;
    }
    if (p.on) {
      if (pendingCtrl) {
        out.push({ op: "Q", cx: pendingCtrl.x, cy: pendingCtrl.y, x: p.x, y: p.y });
        pendingCtrl = null;
      } else {
        out.push({ op: "L", x: p.x, y: p.y });
      }
    } else {
      if (pendingCtrl) {
        const m = mid(pendingCtrl, p);
        out.push({ op: "Q", cx: pendingCtrl.x, cy: pendingCtrl.y, x: m.x, y: m.y });
      }
      pendingCtrl = p;
    }
  }
  if (pendingCtrl) {
    out.push({ op: "Q", cx: pendingCtrl.x, cy: pendingCtrl.y, x: start.x, y: start.y });
  }
  out.push({ op: "Z" });
}

function mid(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
