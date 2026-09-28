// Draws the generated preview frames. SPHEREx pixels are large (6.2″), so the
// frames are rendered on a coarse grid and scaled up without smoothing.
import { rng, starFlux } from './data.js';

export const GRID = 72;

// One fixed star field around the target, shared by every frame.
const field = (() => {
  const r = rng(907);
  const stars = [];
  for (let i = 0; i < 46; i++) {
    stars.push({ x: r() * GRID, y: r() * GRID, f: Math.pow(r(), 5) * 1.6 + 0.04, temp: 3000 + r() * 9000 });
  }
  return stars;
})();

function tempFlux(temp, micron) {
  const x = 14388 / (micron * temp);
  return 1 / (Math.pow(micron, 4) * (Math.exp(x) - 1)) * (temp / 5000) ** -3 * 30;
}

function addStar(buf, cx, cy, amp, sigma = 0.9) {
  const r0 = Math.ceil(sigma * 3);
  for (let y = Math.max(0, Math.floor(cy - r0)); y <= Math.min(GRID - 1, Math.ceil(cy + r0)); y++) {
    for (let x = Math.max(0, Math.floor(cx - r0)); x <= Math.min(GRID - 1, Math.ceil(cx + r0)); x++) {
      const d2 = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2;
      buf[y * GRID + x] += amp * Math.exp(-d2 / (2 * sigma * sigma));
    }
  }
}

/** Pixel values for one frame (arbitrary units, background-subtracted-ish). */
export function frameData(frame) {
  const buf = new Float32Array(GRID * GRID);
  const r = rng(frame.seed * 7919);
  const bg = 0.05 + (frame.lambda / 5) * 0.12; // zodiacal light rises to the red
  for (let i = 0; i < buf.length; i++) buf[i] = bg + (r() - 0.5) * 0.06;
  field.forEach((s) => addStar(buf, s.x, s.y, Math.min(3, s.f * tempFlux(s.temp, frame.lambda)), 0.8));
  // The target at the centre, with its own spectrum.
  addStar(buf, GRID / 2, GRID / 2, starFlux(frame.lambda) * 5, 1.1);
  // A faint moving source crossing the field during each pass.
  const hours = (frame.date.getTime() - Date.UTC(2025, 0, 1)) / 3.6e6;
  const drift = (hours % 60) / 60;
  addStar(buf, 14 + drift * 40, 50 - drift * 22, 0.9 * (frame.lambda > 3.5 ? 1.8 : 0.7), 0.9);
  return buf;
}

function stretch(v) {
  // asinh stretch, clipped to 0..1
  return Math.min(1, Math.max(0, Math.asinh(v * 6) / Math.asinh(6 * 1.6)));
}

/**
 * Paints pixel data into a canvas.
 * colors: { ink: [r,g,b], paper: [r,g,b], pos: [r,g,b], neg: [r,g,b] }
 */
export function paint(canvas, data, colors, { diverging = false } = {}) {
  const off = paint._off || (paint._off = document.createElement('canvas'));
  off.width = GRID; off.height = GRID;
  const octx = off.getContext('2d');
  const img = octx.createImageData(GRID, GRID);
  for (let i = 0; i < data.length; i++) {
    let c;
    if (diverging) {
      const v = Math.max(-1, Math.min(1, data[i] * 1.5));
      const col = v >= 0 ? colors.pos : colors.neg;
      const a = Math.abs(v);
      c = colors.paper.map((p, k) => p + (col[k] - p) * a);
    } else {
      const v = stretch(data[i]);
      c = colors.paper.map((p, k) => p + (colors.ink[k] - p) * v);
    }
    img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255;
  }
  octx.putImageData(img, 0, 0);
  const size = canvas.clientWidth || 360;
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
}

export function diff(a, b) {
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] - b[i];
  return out;
}

/** Parses "#rrggbb" or "rgb(…)" into [r,g,b]. */
export function rgb(str) {
  const s = str.trim();
  if (s.startsWith('#')) {
    const h = s.length === 4 ? s.slice(1).split('').map((c) => c + c).join('') : s.slice(1);
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  const m = s.match(/[\d.]+/g);
  return m ? m.slice(0, 3).map(Number) : [0, 0, 0];
}

/** A quiet static starfield for backgrounds. Redraws on resize and theme change. */
export function starfield(canvas, { density = 0.00018, seed = 1, color = '--star' } = {}) {
  const draw = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = canvas.clientWidth; const h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    const r = rng(seed);
    const n = Math.round(w * h * density);
    const col = getComputedStyle(document.documentElement).getPropertyValue(color).trim() || '#fff';
    ctx.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const size = Math.pow(r(), 6) * 1.8 + 0.35;
      ctx.globalAlpha = 0.25 + r() * 0.75;
      ctx.beginPath();
      ctx.arc(r() * w, r() * h, size, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  draw();
  new ResizeObserver(draw).observe(canvas);
  window.addEventListener('themechange', () => requestAnimationFrame(draw));
}
