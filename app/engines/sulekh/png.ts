/**
 * Minimal PNG decoder (8/16-bit gray, gray+alpha, RGB, RGBA, palette with
 * tRNS; non-interlaced) returning RGBA8 pixels. Uses DecompressionStream,
 * which exists in Node ≥ 18, browsers and Cloudflare Workers. No DOM.
 */

export interface DecodedImage {
  width: number;
  height: number;
  /** RGBA, 8 bits per channel, row-major. */
  rgba: Uint8Array;
  /** True when the file can carry transparency at all (alpha channel or tRNS). */
  hasAlphaChannel: boolean;
}

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

export function isPng(bytes: Uint8Array): boolean {
  return bytes.length > 8 && SIGNATURE.every((b, i) => bytes[i] === b);
}

/** Width and height from the IHDR chunk without decoding pixels. */
export function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (!isPng(bytes) || bytes.length < 24) return null;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: v.getUint32(16), height: v.getUint32(20) };
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function decodePng(bytes: Uint8Array): Promise<DecodedImage> {
  if (!isPng(bytes)) throw new Error("PNG_DECODE_FAILED:not_png");
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 8;
  let colorType = 6;
  let interlace = 0;
  let palette: Uint8Array | null = null;
  let trns: Uint8Array | null = null;
  const idat: Uint8Array[] = [];
  while (pos + 8 <= bytes.length) {
    const len = v.getUint32(pos);
    const type = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7]);
    const data = bytes.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = v.getUint32(pos + 8);
      height = v.getUint32(pos + 12);
      bitDepth = bytes[pos + 16];
      colorType = bytes[pos + 17];
      interlace = bytes[pos + 20];
    } else if (type === "PLTE") palette = data;
    else if (type === "tRNS") trns = data;
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  if (!width || !height) throw new Error("PNG_DECODE_FAILED:no_ihdr");
  if (interlace) throw new Error("PNG_DECODE_FAILED:interlaced_unsupported");
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType as 0 | 2 | 3 | 4 | 6];
  if (!channels) throw new Error(`PNG_DECODE_FAILED:color_type_${colorType}`);
  const total = idat.reduce((a, c) => a + c.length, 0);
  const joined = new Uint8Array(total);
  let o = 0;
  for (const c of idat) {
    joined.set(c, o);
    o += c.length;
  }
  const raw = await inflate(joined);
  const bitsPerPixel = channels * bitDepth;
  const bpp = Math.max(1, bitsPerPixel >> 3);
  const stride = Math.ceil((width * bitsPerPixel) / 8);
  const pixels = new Uint8Array(stride * height);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = pixels.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let val = line[x];
      switch (filter) {
        case 1: val += a; break;
        case 2: val += b; break;
        case 3: val += (a + b) >> 1; break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          val += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          break;
        }
      }
      out[x] = val & 0xff;
    }
    prev = out;
  }
  const rgba = new Uint8Array(width * height * 4);
  const sample = (row: number, index: number): number => {
    // index-th sample in the row, scaled to 8 bits
    const base = row * stride;
    if (bitDepth === 8) return pixels[base + index];
    if (bitDepth === 16) return pixels[base + index * 2];
    const perByte = 8 / bitDepth;
    const byte = pixels[base + Math.floor(index / perByte)];
    const shift = 8 - bitDepth * ((index % perByte) + 1);
    const value = (byte >> shift) & ((1 << bitDepth) - 1);
    return colorType === 3 ? value : Math.round((value * 255) / ((1 << bitDepth) - 1));
  };
  const trnsGray = trns && colorType === 0 ? (trns[0] << 8) | trns[1] : -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4;
      if (colorType === 6) {
        rgba[p] = sample(y, x * 4);
        rgba[p + 1] = sample(y, x * 4 + 1);
        rgba[p + 2] = sample(y, x * 4 + 2);
        rgba[p + 3] = sample(y, x * 4 + 3);
      } else if (colorType === 4) {
        const g = sample(y, x * 2);
        rgba[p] = rgba[p + 1] = rgba[p + 2] = g;
        rgba[p + 3] = sample(y, x * 2 + 1);
      } else if (colorType === 2) {
        rgba[p] = sample(y, x * 3);
        rgba[p + 1] = sample(y, x * 3 + 1);
        rgba[p + 2] = sample(y, x * 3 + 2);
        rgba[p + 3] = 255;
      } else if (colorType === 0) {
        const g = sample(y, x);
        rgba[p] = rgba[p + 1] = rgba[p + 2] = g;
        rgba[p + 3] = bitDepth === 8 && g === trnsGray ? 0 : 255;
      } else {
        const i = sample(y, x);
        rgba[p] = palette ? palette[i * 3] : 0;
        rgba[p + 1] = palette ? palette[i * 3 + 1] : 0;
        rgba[p + 2] = palette ? palette[i * 3 + 2] : 0;
        rgba[p + 3] = trns && i < trns.length ? trns[i] : 255;
      }
    }
  }
  return {
    width,
    height,
    rgba,
    hasAlphaChannel: colorType === 4 || colorType === 6 || trns !== null,
  };
}
