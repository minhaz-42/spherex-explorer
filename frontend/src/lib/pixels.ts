/**
 * Turning float images in MJy/sr into screen pixels.
 *
 * Every frame of a sequence is drawn with the same limits, so a change in brightness on screen is
 * a change in the data, never a change of stretch.
 */

import type { CutoutPayload, DecodedCutout } from "./types";

export function decodeBase64(data: string): Uint8Array {
  const binary = atob(data);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function decodeCutout(payload: CutoutPayload): DecodedCutout {
  const bytes = decodeBase64(payload.image.data);
  // Copy into an aligned buffer: the base64 bytes are little-endian float32.
  const pixels = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const mask = decodeBase64(payload.mask.data);
  const { width, height } = payload.image;
  if (pixels.length !== width * height || mask.length !== width * height) {
    throw new Error("The cutout arrays do not match its declared size.");
  }
  return { payload, width, height, pixels, mask };
}

export type StretchKind = "asinh" | "linear" | "log";

export interface Stretch {
  kind: StretchKind;
  low: number; // MJy/sr drawn as black
  high: number; // MJy/sr drawn as white
  soft: number; // asinh softening, MJy/sr
}

/** Limits from one reference frame: black a little below the background, white near the brightest star. */
export function autoStretch(ref: DecodedCutout, kind: StretchKind = "asinh", contrast = 1): Stretch {
  const rms = ref.payload.background.rmsMJySr ?? 0.01;
  const stats = ref.payload.image.stats;
  const top = stats ? Math.max(stats.p995, stats.p99) : 10 * rms;
  const high = Math.max(top / contrast, 5 * rms);
  return { kind, low: -2 * rms, high, soft: Math.max(2 * rms, 1e-6) };
}

function transfer(s: Stretch): (v: number) => number {
  const range = s.high - s.low;
  if (s.kind === "linear") return (v) => (v - s.low) / range;
  if (s.kind === "log") {
    const scale = Math.log10(1 + 1000);
    return (v) => Math.log10(1 + (1000 * Math.max(v - s.low, 0)) / range) / scale;
  }
  const norm = Math.asinh(range / s.soft);
  return (v) => Math.asinh((v - s.low) / s.soft) / norm;
}

export interface Palette {
  noData: [number, number, number];
  flagged: [number, number, number] | null; // null: draw the filled value
}

export const DEFAULT_PALETTE: Palette = { noData: [18, 21, 26], flagged: null };

/** Grey-scale RGBA pixels, rows flipped so that north (the last row) is at the top. */
export function renderGray(img: DecodedCutout, stretch: Stretch, palette: Palette = DEFAULT_PALETTE): Uint8ClampedArray {
  const { width, height, pixels, mask } = img;
  const f = transfer(stretch);
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const src = (height - 1 - y) * width;
    const dst = y * width;
    for (let x = 0; x < width; x++) {
      const i = src + x;
      const o = (dst + x) * 4;
      const m = mask[i]!;
      const v = pixels[i]!;
      if (m & 2 || !Number.isFinite(v)) {
        out[o] = palette.noData[0];
        out[o + 1] = palette.noData[1];
        out[o + 2] = palette.noData[2];
      } else if (m & 1 && palette.flagged) {
        out[o] = palette.flagged[0];
        out[o + 1] = palette.flagged[1];
        out[o + 2] = palette.flagged[2];
      } else {
        const g = Math.round(255 * Math.min(Math.max(f(v), 0), 1));
        out[o] = g;
        out[o + 1] = g;
        out[o + 2] = g;
      }
      out[o + 3] = 255;
    }
  }
  return out;
}

/**
 * B − A on a diverging scale: fainter in B is cyan, brighter is amber, no change is near black.
 * Pixels masked or missing in either frame are drawn as no data.
 */
export function renderDifference(
  a: DecodedCutout,
  b: DecodedCutout,
  limit: number,
  noData: [number, number, number] = [18, 21, 26],
): Uint8ClampedArray {
  const { width, height } = a;
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const src = (height - 1 - y) * width;
    const dst = y * width;
    for (let x = 0; x < width; x++) {
      const i = src + x;
      const o = (dst + x) * 4;
      const bad = a.mask[i]! | b.mask[i]!;
      const d = b.pixels[i]! - a.pixels[i]!;
      if (bad || !Number.isFinite(d)) {
        out[o] = noData[0];
        out[o + 1] = noData[1];
        out[o + 2] = noData[2];
      } else {
        const t = Math.max(-1, Math.min(1, d / limit));
        const k = Math.sqrt(Math.abs(t));
        if (t >= 0) {
          out[o] = 12 + k * (255 - 12);
          out[o + 1] = 14 + k * (176 - 14);
          out[o + 2] = 17 + k * (70 - 17);
        } else {
          out[o] = 12 + k * (80 - 12);
          out[o + 1] = 14 + k * (200 - 14);
          out[o + 2] = 17 + k * (255 - 17);
        }
      }
      out[o + 3] = 255;
    }
  }
  return out;
}

/** Value and mask bits at grid pixel (x, y) with y measured from the top of the screen. */
export function sampleAt(img: DecodedCutout, x: number, yFromTop: number): { value: number; mask: number } | null {
  const ix = Math.floor(x);
  const iy = img.height - 1 - Math.floor(yFromTop);
  if (ix < 0 || iy < 0 || ix >= img.width || iy >= img.height) return null;
  const i = iy * img.width + ix;
  return { value: img.pixels[i]!, mask: img.mask[i]! };
}
