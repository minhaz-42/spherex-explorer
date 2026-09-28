/**
 * Turns a blink (two or more images of the same patch of sky) into a shareable GIF or video, with a
 * caption band that carries the title, each frame's date and wavelength, and the image credits, so
 * a shared copy never loses where the data came from.
 */
import { applyPalette, GIFEncoder, quantize } from "gifenc";

import { canvasFont } from "../../components/space/theme";
import { currentLang, translate } from "../../lib/i18n";
import { SHARE } from "./messages";

export interface BlinkFrame {
  /** Anything canvas can draw: an <img>, <canvas> or ImageBitmap of the frame. */
  image: CanvasImageSource;
  /** One line under the title for this frame, e.g. "2 Dec 2025 · 12:07 UTC · 1.508 µm". */
  caption: string;
}

export interface BlinkExport {
  title: string;
  /** Credit line, e.g. "SPHEREx · NASA/IPAC IRSA · SPHEREx Explorer". */
  credit: string;
  frames: BlinkFrame[];
  /** Output width in pixels; the picture is square and the caption band sits below it. */
  size?: number;
  delayMs?: number;
}

const BAND = 92;
const WELL = "#0f1530";
const INK = "#e8ebf7";
const FAINT = "#aeb5d3";
const EMBER = "#ffb35c";

function drawFrame(ctx: CanvasRenderingContext2D, spec: BlinkExport, frame: BlinkFrame, index: number, size: number) {
  const n = spec.frames.length;
  ctx.fillStyle = WELL;
  ctx.fillRect(0, 0, size, size + BAND);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(frame.image, 0, 0, size, size);

  // Which frame this is, top left, as the viewer shows it.
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(10, 10, 58, 24);
  ctx.fillStyle = EMBER;
  ctx.font = canvasFont(600, 13);
  ctx.textBaseline = "middle";
  ctx.fillText(`${String.fromCharCode(65 + index)} ${index + 1}/${n}`, 18, 22);

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = INK;
  ctx.font = canvasFont(600, 17);
  ctx.fillText(spec.title, 16, size + 28, size - 32);
  ctx.fillStyle = EMBER;
  ctx.font = canvasFont(500, 13);
  ctx.fillText(frame.caption, 16, size + 52, size - 32);
  ctx.fillStyle = FAINT;
  ctx.font = canvasFont(400, 12);
  ctx.fillText(spec.credit, 16, size + 76, size - 32);
}

function canvasFor(spec: BlinkExport) {
  const size = spec.size ?? 480;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size + BAND;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error(translate(SHARE, currentLang(), "noCanvas"));
  return { canvas, ctx, size };
}

/** A looping GIF of the blink. */
export function blinkToGif(spec: BlinkExport): Blob {
  const { canvas, ctx, size } = canvasFor(spec);
  const gif = GIFEncoder();
  spec.frames.forEach((frame, i) => {
    drawFrame(ctx, spec, frame, i, size);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    gif.writeFrame(index, canvas.width, canvas.height, { palette, delay: spec.delayMs ?? 700, repeat: 0 });
  });
  gif.finish();
  // Copy into a plain ArrayBuffer-backed array, which Blob accepts on every TypeScript lib.
  return new Blob([new Uint8Array(gif.bytes())], { type: "image/gif" });
}

/** The best video type this browser can record, or null when it cannot record canvas video. */
export function videoType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const type of ["video/mp4;codecs=avc1", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return null;
}

/** A short video of the blink (a few loops), recorded from a canvas in real time. */
export async function blinkToVideo(spec: BlinkExport, loops = 4): Promise<Blob> {
  const type = videoType();
  if (!type) throw new Error(translate(SHARE, currentLang(), "noVideo"));
  const { canvas, ctx, size } = canvasFor(spec);
  drawFrame(ctx, spec, spec.frames[0]!, 0, size);
  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 4_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const done = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });
  recorder.start();
  const delay = spec.delayMs ?? 700;
  for (let loop = 0; loop < loops; loop++) {
    for (let i = 0; i < spec.frames.length; i++) {
      drawFrame(ctx, spec, spec.frames[i]!, i, size);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  recorder.stop();
  await done;
  stream.getTracks().forEach((t) => t.stop());
  return new Blob(chunks, { type: type.split(";")[0] });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * A filesystem-safe name from a title, e.g. "spherex-asteroid-7-iris.gif". Bangla letters are kept,
 * so a title in Bangla names its file in Bangla rather than being reduced to its numbers.
 */
export function exportName(title: string, ext: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\u0980-\u09ff]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
    .normalize("NFC");
  return `spherex-${slug || "blink"}.${ext}`;
}
