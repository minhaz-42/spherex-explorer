// One camera for the sky around asteroid (7) Iris: the real SPHEREx frames of the pass and the
// SPHEREx colour maps at widening fields of view, all centred on the same point, north up.
// Positions are in "median pixels": the pixel grid of build/img/iris/median.png.
import { C, E, H, W, clamp, img, inv, lerp, place, ring } from "./core.js";

export const MED = 1758; // median.png size
export const MC = 879; // its centre: the case's target position (Iris at 21:49 UTC on 2 Dec 2025)
export const DEG_PER_MED = 1.025 / 3600; // arcsec per median px → degrees

// SPHEREx QR2 colour, from CDS hips2fits, 1920 px square, centred on the same point.
// (The 145.8° level is left out: its Galactic centre shows the QR2 map's unfinished tiles.)
const ZOOMS = [0.6, 1.8, 5.4, 16.2, 48.6].map((fov) => ({
  url: `/build/img/sky/iris_zoom_${fov}.jpg`,
  degPerPx: fov / 1920,
  size: [1920, 1920],
  c: [959.5, 959.5],
}));
// The whole sky, Mollweide, centred on the same point (scale at the centre).
const ALLSKY_EQ = { url: "/build/img/sky/allsky_eq_iris.jpg", degPerPx: 0.09, size: [4000, 2000], c: [2000, 1000], whole: true };

/** Screen position of a median-pixel point for camera {u, v, mpx}. */
export function toScreen(cam, x, y) {
  const z = W / cam.mpx;
  return [W / 2 + (x - cam.u) * z, H / 2 + (y - cam.v) * z, z];
}

export function fovDeg(cam) {
  return cam.mpx * DEG_PER_MED;
}

function drawLayer(ctx, L, cam, alpha) {
  if (alpha <= 0.002) return;
  const im = img(L.url);
  if (!im) return;
  const fov = fovDeg(cam);
  const zoom = (W * L.degPerPx) / fov; // screen px per layer px
  const u = L.c[0] + ((cam.u - MC) * DEG_PER_MED) / L.degPerPx;
  const v = L.c[1] + ((cam.v - MC) * DEG_PER_MED) / L.degPerPx;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.imageSmoothingQuality = "high";
  place(ctx, im, u, v, zoom);
  ctx.restore();
}

/**
 * The sky behind a camera. `gray` (0..1) is how much the real single-detector frame shows over
 * the colour maps; `frame` picks which composite (comp_XX) or the clean median.
 */
export function drawSky(ctx, cam, o = {}) {
  const { gray = 1, frame = null, frameMix = null, colorBoost = 1 } = o;
  const fov = fovDeg(cam);
  const aspect = H / W;
  // Coarse to fine; each layer fades out as the view outgrows it.
  const cover = (L) => {
    if (L.whole) return 1;
    const wDeg = L.size[0] * L.degPerPx;
    const off = Math.abs((cam.u - MC) * DEG_PER_MED) * 2 + Math.abs((cam.v - MC) * DEG_PER_MED) * 2;
    const need = Math.max(fov, (fov * aspect) / 1) + off;
    return clamp((wDeg / need - 1.0) / 0.35);
  };
  if (gray < 1 || fov > 0.45) {
    ctx.save();
    if (colorBoost !== 1) ctx.filter = `saturate(${colorBoost})`;
    drawLayer(ctx, ALLSKY_EQ, cam, E.sine(inv(26, 44, fov)));
    for (const L of [...ZOOMS].reverse()) drawLayer(ctx, L, cam, cover(L));
    ctx.restore();
  }
  // The real frames on top, while the view is inside them.
  const medCover = clamp((0.5006 / Math.max(fov, 1e-6) - 1.0) / 0.25);
  const a = gray * medCover;
  if (a > 0.002) {
    const z = W / cam.mpx;
    const url = frame === null ? "/build/img/iris/median.png" : `/build/img/iris/comp_${String(frame).padStart(2, "0")}.png`;
    const im = img(url);
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.globalCompositeOperation = gray < 1 ? "source-over" : "source-over";
    place(ctx, im, cam.u, cam.v, z);
    if (frameMix) {
      const im2 = img(`/build/img/iris/comp_${String(frameMix.frame).padStart(2, "0")}.png`);
      ctx.globalAlpha = a * frameMix.k;
      place(ctx, im2, cam.u, cam.v, z);
    }
    ctx.restore();
  }
}

/** RA/Dec of a median pixel (inverse gnomonic, north up, east left). */
const RA0 = 161.29678;
const DEC0 = 2.44824;
export function medToRaDec(x, y) {
  const s = (DEG_PER_MED * Math.PI) / 180;
  const xi = -(x - MC) * s;
  const eta = -(y - MC) * s;
  const d0 = (DEC0 * Math.PI) / 180;
  const rho = Math.hypot(xi, eta);
  const c = Math.atan(rho);
  const dec = rho === 0 ? d0 : Math.asin(Math.cos(c) * Math.sin(d0) + (eta * Math.sin(c) * Math.cos(d0)) / rho);
  const ra = RA0 * (Math.PI / 180) + Math.atan2(xi * Math.sin(c), rho * Math.cos(d0) * Math.cos(c) - eta * Math.sin(d0) * Math.sin(c));
  return [(ra * 180) / Math.PI, (dec * 180) / Math.PI];
}
export function raDecToMed(ra, dec) {
  const r = (ra * Math.PI) / 180;
  const d = (dec * Math.PI) / 180;
  const r0 = (RA0 * Math.PI) / 180;
  const d0 = (DEC0 * Math.PI) / 180;
  const cosc = Math.sin(d0) * Math.sin(d) + Math.cos(d0) * Math.cos(d) * Math.cos(r - r0);
  const xi = (Math.cos(d) * Math.sin(r - r0)) / cosc;
  const eta = (Math.cos(d0) * Math.sin(d) - Math.sin(d0) * Math.cos(d) * Math.cos(r - r0)) / cosc;
  const s = (DEG_PER_MED * Math.PI) / 180;
  return [MC - xi / s, MC - eta / s];
}

export function fmtRA(ra) {
  const h = ra / 15;
  const hh = Math.floor(h);
  const m = (h - hh) * 60;
  const mm = Math.floor(m);
  const ss = Math.round((m - mm) * 60);
  return `${hh}h ${String(mm).padStart(2, "0")}m ${String(ss).padStart(2, "0")}s`;
}
export function fmtDec(dec) {
  const sgn = dec < 0 ? "−" : "+";
  const a = Math.abs(dec);
  const d = Math.floor(a);
  const m = Math.round((a - d) * 60);
  return `${sgn}${d}° ${String(m).padStart(2, "0")}′`;
}

/** A thin RA/Dec grid with edge labels, the "data visualisation" look. */
export function graticule(ctx, cam, alpha) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = "rgba(150,180,255,0.22)";
  ctx.lineWidth = 1;
  ctx.font = '500 15px "JetBrains Mono"';
  ctx.fillStyle = "rgba(190,210,255,0.6)";
  const [ra0, dec0] = medToRaDec(cam.u, cam.v);
  const stepDec = 2 / 60;
  const stepRa = 8 / 3600 * 15; // 8 s of RA
  for (let k = -8; k <= 8; k++) {
    const dec = Math.round(dec0 / stepDec) * stepDec + k * stepDec;
    ctx.beginPath();
    for (let j = -10; j <= 10; j++) {
      const [x, y] = raDecToMed(ra0 + j * stepRa, dec);
      const [sx, sy] = toScreen(cam, x, y);
      j === -10 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    const [x, y] = raDecToMed(ra0, dec);
    const [, sy] = toScreen(cam, x, y);
    if (sy > 40 && sy < H - 40) ctx.fillText(fmtDec(dec), 24, sy - 8);
  }
  for (let k = -8; k <= 8; k++) {
    const ra = Math.round(ra0 / stepRa) * stepRa + k * stepRa;
    ctx.beginPath();
    for (let j = -10; j <= 10; j++) {
      const [x, y] = raDecToMed(ra, dec0 + j * stepDec);
      const [sx, sy] = toScreen(cam, x, y);
      j === -10 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    const [x, y] = raDecToMed(ra, dec0);
    const [sx] = toScreen(cam, x, y);
    if (sx > 80 && sx < W - 160) ctx.fillText(fmtRA(ra), sx + 6, H - 22);
  }
  ctx.restore();
}

/** The interface's lock-on mark and label for the moving point. */
export function lockOn(ctx, x, y, k, label, sub) {
  if (k <= 0) return;
  const r = lerp(90, 34, E.out(k));
  ctx.save();
  ctx.globalAlpha *= Math.min(1, k * 2);
  ring(ctx, x, y, r, { color: C.accent, width: 2.5, glow: 14 });
  ctx.restore();
  return r;
}
