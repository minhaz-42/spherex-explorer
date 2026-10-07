// Q3 · WHAT — the demo (2:00–3:00). Real footage of SPHEREx Explorer running on live data, framed
// and zoomed like a product film: search, blink, our own search, JPL's check, the honest
// difference view, the range of the app, and the assistant.
import {
  C, E, F, H, W, buffer, chip, clamp, clipToScreen, drawClip, env, glowDot, img, inv, keys, lerp, letterbox,
  ring, rrect, text, vignette, windowFrame,
} from "../core.js";
import { drawSky } from "../sky.js";

// The main window: 1600 CSS px shown 1500 px wide.
const MAIN = { x: 210, y: 150, w: 1500, h: 844 };

function backdrop(ctx, t) {
  ctx.fillStyle = "#060918";
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.filter = "blur(3px)";
  drawSky(ctx, { u: 900 + (t - 120) * 1.5, v: 900, mpx: 1650 }, { frame: null });
  ctx.restore();
  const g = ctx.createRadialGradient(W * 0.3, H * 0.2, 50, W * 0.3, H * 0.2, W * 0.8);
  g.addColorStop(0, "rgba(255,138,92,0.10)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** Numbered step label, top left: the demo's chapters. */
function step(ctx, t, a, b, n, label) {
  const k = env(t, a, b, 0.35, 0.3);
  if (k <= 0) return;
  text(ctx, String(n).padStart(2, "0"), 70, 64, { size: 18, weight: 700, family: F.mono, align: "left", color: C.accent, alpha: k });
  text(ctx, label, 108, 64, { size: 18, weight: 600, family: F.mono, align: "left", track: 4, color: C.ink, alpha: k });
}

/** Window plus clip, with the view eased between keyframes [t, x, y, w]. */
function appShot(ctx, clip, ct, rect, view, o = {}) {
  windowFrame(ctx, rect, { alpha: o.alpha ?? 1 });
  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  drawClip(ctx, clip, ct, rect, view, { cursor: o.cursor ?? true, radius: [0, 0, 18, 18] });
  ctx.restore();
}
function viewAt(t, ks) {
  const v = keys(t, ks.map(([tt, x, y, w]) => [tt, [x, y, w]]), E.inOut);
  return { x: v[0], y: v[1], w: v[2] };
}

/** A soft highlight box around a CSS region of the clip, drawn on screen. */
function highlight(ctx, clip, rect, view, box, k, o = {}) {
  if (k <= 0) return;
  const [x0, y0, s] = clipToScreen(clip, rect, view, box[0], box[1]);
  const pad = (o.pad ?? 10) * s;
  const w = box[2] * s + 2 * pad;
  const h = box[3] * s + 2 * pad;
  ctx.save();
  ctx.globalAlpha *= k;
  ctx.shadowColor = C.accent;
  ctx.shadowBlur = 22;
  ctx.strokeStyle = C.accent;
  ctx.lineWidth = 2.5;
  rrect(ctx, x0 - pad, y0 - pad, w * (o.grow === false ? 1 : E.out(Math.min(1, k * 1.4))), h, 10);
  ctx.stroke();
  ctx.restore();
}

// ---- 01 · The way in --------------------------------------------------------------------------------
function drawIntro(ctx, t, D) {
  // The lone dot from the end of Q2 opens into the app; the backdrop arrives with it.
  const open = E.inOutExpo(inv(120.3, 121.6, t));
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalAlpha = E.sine(inv(120.4, 121.8, t));
  backdrop(ctx, t);
  ctx.restore();
  const clip = D.clips.search;
  if (open < 1) {
    glowDot(ctx, W / 2, H / 2, 46 * (1 - open) + 4, "255,255,255", 1 - open);
  }
  if (open > 0) {
    const s = lerp(0.02, 1, open);
    const r = { x: W / 2 - (MAIN.w * s) / 2, y: H / 2 + 22 - (MAIN.h * s) / 2, w: MAIN.w * s, h: MAIN.h * s };
    ctx.save();
    ctx.globalAlpha = Math.min(1, open * 3);
    appShot(ctx, clip, 1.0 + Math.max(0, t - 121.0) * 0.5, r, { x: 0, y: 0, w: 1600 }, { cursor: false });
    ctx.restore();
  }
  letterbox(ctx, 1 - E.inOut(inv(120.0, 121.4, t)));
  return 0.035;
}

// ---- 02 · Search ----------------------------------------------------------------------------------
function drawSearch(ctx, t, D) {
  backdrop(ctx, t);
  const clip = D.clips.search;
  // Film time → clip time: typing at life speed, then the loaded page, then the timeline playing.
  const ct = t < 129.4 ? 1.6 + (t - 123.2) : t < 131.0 ? 7.8 + (t - 129.4) : 12.3 + (t - 131.0);
  const view =
    t < 129.4
      ? viewAt(t, [[123.2, 0, 0, 1600], [124.4, 40, 520, 760], [127.6, 40, 520, 760], [128.4, 0, 60, 1000], [129.4, 0, 60, 1000]])
      : t < 131.0
        ? viewAt(t, [[129.4, 0, 60, 1000], [131.0, 0, 40, 1100]])
        : viewAt(t, [[131.0, 0, 200, 1250], [133.6, 0, 230, 1200]]);
  appShot(ctx, clip, ct, MAIN, view);
  // "341 frames in 5 passes": every SPHEREx image of the place.
  const b = clip.boxes.framesIn;
  if (b) highlight(ctx, clip, MAIN, view, [b.bx, b.by, b.bw, b.bh], env(t, 128.6, 131.0, 0.4, 0.3), { pad: 8 });
  const lb = env(t, 128.7, 131.0, 0.4, 0.3);
  if (lb > 0) chip(ctx, "Every SPHEREx image of this place, from the IRSA archive", MAIN.x + 40, MAIN.y + MAIN.h - 60, { size: 20, alpha: lb, dot: C.live });
  step(ctx, t, 123.2, 133.6, 1, "SEARCH ANY PLACE IN THE SKY");
  return 0.03;
}

// ---- 03 · Blink ------------------------------------------------------------------------------------
// The asteroid's place in the irisImage clip (CSS px): image box 1088 px for 0.3°, centred on
// its position at 21:49 UTC (frame B); at 12:06 UTC (frame A) it was up and to the right.
const IMG = { x: 72, y: 136, s: 1088 };
const IRIS_B = [IMG.x + IMG.s / 2, IMG.y + IMG.s / 2];
const IRIS_A = [IRIS_B[0] + 335.6, IRIS_B[1] - 213.7];

function drawBlink(ctx, t, D) {
  backdrop(ctx, t);
  const clip = D.clips.irisImage;
  const ct = 0.0 + (t - 133.6);
  const view = viewAt(t, [[133.6, 0, 60, 1600], [135.0, 40, 110, 1180], [137.6, 40, 110, 1180], [138.8, 380, 300, 760], [141.8, 400, 310, 740]]);
  appShot(ctx, clip, ct, MAIN, view);
  // "And something moves": where it was, and where it went.
  const k = inv(138.5, 139.3, t);
  if (k > 0) {
    const [ax, ay, s] = clipToScreen(clip, MAIN, view, IRIS_A[0], IRIS_A[1]);
    const [bx, by] = clipToScreen(clip, MAIN, view, IRIS_B[0], IRIS_B[1]);
    ring(ctx, ax, ay, 26 * s, { color: C.accent, width: 2.5, alpha: E.out(k), glow: 12 });
    ring(ctx, bx, by, 26 * s, { color: C.accent, width: 2.5, alpha: E.out(inv(138.8, 139.5, t)), glow: 12 });
    const a = E.out(inv(139.0, 140.0, t));
    ctx.save();
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([7, 8]);
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    const dx = bx - ax;
    const dy = by - ay;
    const L = Math.hypot(dx, dy);
    const ux = dx / L;
    const uy = dy / L;
    ctx.moveTo(ax + ux * 34 * s, ay + uy * 34 * s);
    ctx.lineTo(ax + ux * (34 * s + (L - 68 * s) * a), ay + uy * (34 * s + (L - 68 * s) * a));
    ctx.stroke();
    ctx.restore();
    chip(ctx, "9.7 hours later, it had moved", MAIN.x + 40, MAIN.y + MAIN.h - 60, { size: 20, alpha: env(t, 139.2, 141.8, 0.4, 0.3), dot: C.accent });
  }
  step(ctx, t, 133.6, 141.8, 2, "BLINK THE FRAMES");
  return 0.03;
}

// ---- 04 · Find it, then check it ----------------------------------------------------------------------
function drawDetect(ctx, t, D) {
  backdrop(ctx, t);
  const img_ = D.clips.irisImage;
  const pan = D.clips.irisPanel;
  // Two windows: the image (our search's marks and JPL's track appear on it) and the panel beside it.
  const imgCt = t < 145 ? t - 136.3 : t < 146.4 ? lerp(145 - 136.3, 146.4 - 137.0, inv(145, 146.4, t)) : t - 137.0;
  const panCt = t - 140.6;
  const L = { x: 90, y: 150, w: 860, h: 840 };
  const R = { x: 1010, y: 150, w: 820, h: 840 };
  const enter = E.out(inv(141.8, 142.6, t));
  ctx.save();
  ctx.globalAlpha = enter;
  ctx.translate((1 - enter) * -40, 0);
  appShot(ctx, img_, imgCt, L, { x: 110, y: 128, w: 1040 });
  ctx.restore();
  // The panel: zoom in on our search's answer, then on JPL's.
  const pv = viewAt(t, [[141.8, 1180, 300, 420], [146.0, 1180, 470, 420], [147.6, 1180, 300, 420], [149.4, 1180, 520, 400], [155.5, 1185, 540, 390]]);
  ctx.save();
  ctx.globalAlpha = enter;
  ctx.translate((1 - enter) * 40, 0);
  appShot(ctx, pan, panCt, R, pv);
  ctx.restore();
  const c1 = pan.boxes.c1;
  const mr = pan.boxes.movingResult;
  if (c1 && mr) highlight(ctx, pan, R, pv, [mr.bx, mr.by, mr.bw, c1.by + c1.bh - mr.by + 26], env(t, 142.9, 146.6, 0.4, 0.3), { pad: 8 });
  const m = pan.boxes.matches;
  if (m) highlight(ctx, pan, R, pv, [m.bx, m.by - 30, m.bw, m.bh + 30], env(t, 147.5, 155.6, 0.4, 0.3), { pad: 8 });
  chip(ctx, "Our own search: knows nothing about asteroids", L.x + 30, L.y + L.h - 50, { size: 19, alpha: env(t, 142.9, 146.8, 0.4, 0.3), dot: "#7fd7ff" });
  chip(ctx, "JPL's predicted track: the same object", L.x + 30, L.y + L.h - 50, { size: 19, alpha: env(t, 147.3, 151.2, 0.4, 0.3), dot: C.jpl });
  chip(ctx, "7 Iris · main-belt asteroid · 2.1 au · 1–3 Dec 2025", L.x + 30, L.y + L.h - 50, { size: 19, alpha: env(t, 151.2, 155.6, 0.4, 0.3), dot: C.accent });
  step(ctx, t, 141.8, 148.8, 3, "FIND WHAT MOVED");
  step(ctx, t, 148.8, 155.6, 4, "CHECK IT WITH NASA JPL");
  return 0.03;
}

// ---- 05 · Honest ------------------------------------------------------------------------------------
function drawHonest(ctx, t, D) {
  backdrop(ctx, t);
  const clip = D.clips.irisImage;
  const ct = 17.8 + (t - 155.6);
  const box = clip.boxes.misleading;
  const view = viewAt(t, [[155.6, 0, 60, 1600], [157.8, 0, 60, 1600], [158.9, 360, 520, 560], [162.8, 372, 528, 540]]);
  appShot(ctx, clip, ct, MAIN, view);
  if (box) highlight(ctx, clip, MAIN, view, [box.bx - 10, box.by - 8, 380, 150], env(t, 159.2, 162.8, 0.4, 0.3), { pad: 10 });
  step(ctx, t, 155.6, 162.8, 5, "HONEST ABOUT WAVELENGTH");
  return 0.03;
}

// ---- 06 · Range: decades, the game, Bangla -------------------------------------------------------------
function drawRange(ctx, t, D) {
  backdrop(ctx, t);
  const segs = [
    { a: 162.8, b: 165.7, clip: D.clips.decades, ct: (tt) => 0.6 + (tt - 162.8) * 1.35, view: [[162.8, 0, 40, 1600], [165.7, 30, 80, 1350]], label: "75 YEARS OF SURVEYS, SIDE BY SIDE" },
    { a: 165.7, b: 168.35, clip: D.clips.play, ct: (tt) => 5.4 + (tt - 165.7), view: [[165.7, 0, 40, 1600], [168.35, 40, 120, 1250]], label: "SPOT THE MOVER: A GAME" },
    { a: 168.35, b: 172.0, clip: D.clips.bangla, ct: (tt) => 0.35 + (tt - 168.35), view: [[168.35, 0, 0, 1600], [172.0, 0, 0, 1400]], label: "ENGLISH  ·  বাংলা" },
  ];
  segs.forEach((s, i) => {
    if (t < s.a - 0.35 || t > s.b + 0.35) return;
    // Slide in from the right, out to the left.
    const inK = i === 0 ? 1 : E.inOut(inv(s.a - 0.35, s.a + 0.25, t));
    const outK = i === segs.length - 1 ? 0 : E.inOut(inv(s.b - 0.35, s.b + 0.25, t));
    const dx = (1 - inK) * W * 0.9 - outK * W * 0.9;
    ctx.save();
    ctx.translate(dx, 0);
    appShot(ctx, s.clip, s.ct(t), MAIN, viewAt(t, s.view));
    ctx.restore();
    const k = env(t, s.a, s.b, 0.3, 0.3);
    if (k > 0) {
      text(ctx, "06", 70, 64, { size: 18, weight: 700, family: F.mono, align: "left", color: C.accent, alpha: k });
      text(ctx, s.label, 108, 64, { size: 18, weight: 600, family: i === 2 ? F.bangla : F.mono, align: "left", track: i === 2 ? 2 : 4, color: C.ink, alpha: k });
    }
  });
  return 0.03;
}

// ---- 07 · Ask ----------------------------------------------------------------------------------------
function drawAsk(ctx, t, D) {
  backdrop(ctx, t);
  const clip = D.clips.ask;
  // Typing at life speed; the wait and the answer at a little over twice speed.
  const ct = t < 174.9 ? 1.4 + (t - 172.0) : Math.min(clip.duration, 4.3 + (t - 174.9) * 2.35);
  const view = viewAt(t, [[172.0, 0, 0, 1600], [173.6, 120, 380, 1100], [174.8, 120, 380, 1100], [176.0, 160, 0, 1150], [180, 180, 10, 1100]]);
  appShot(ctx, clip, ct, MAIN, view);
  chip(ctx, "Answers cite numbered sources: the frames, JPL, the search", MAIN.x + 40, MAIN.y + MAIN.h - 60, { size: 20, alpha: env(t, 176.4, 180.0, 0.5, 0.01), dot: C.cyan });
  step(ctx, t, 172.0, 180.0, 7, "ASK, AND SEE THE SOURCES");
  return 0.03;
}

export const q3 = [
  { a: 120, b: 123.2, draw: (ctx, t, D) => drawIntro(ctx, t, D) },
  { a: 123.2, b: 133.6, draw: (ctx, t, D) => drawSearch(ctx, t, D) },
  { a: 133.6, b: 141.8, draw: (ctx, t, D) => drawBlink(ctx, t, D) },
  { a: 141.8, b: 155.6, draw: (ctx, t, D) => drawDetect(ctx, t, D) },
  { a: 155.6, b: 162.8, draw: (ctx, t, D) => drawHonest(ctx, t, D) },
  { a: 162.8, b: 172.0, draw: (ctx, t, D) => drawRange(ctx, t, D) },
  { a: 172.0, b: 180.0, draw: (ctx, t, D) => drawAsk(ctx, t, D) },
];

export function q3Cues(D) {
  const cues = [{ t: 120.3, kind: "open", gain: 1 }];
  // UI sounds follow the footage's own clicks and keys, mapped to film time.
  const map = [
    ["search", (tt) => (tt < 129.4 ? 1.6 + (tt - 123.2) : null), 123.2, 129.4],
    ["irisImage", (tt) => tt - 133.6, 133.6, 141.8],
    ["irisPanel", (tt) => tt - 140.6, 141.8, 155.6],
    ["irisImage", (tt) => 17.8 + (tt - 155.6), 155.6, 162.8],
    ["play", (tt) => 5.4 + (tt - 165.7), 165.7, 168.35],
    ["bangla", (tt) => 0.35 + (tt - 168.35), 168.35, 172.0],
    ["ask", (tt) => 1.4 + (tt - 172.0), 172.0, 174.9],
  ];
  for (const [name, f, a, b] of map) {
    const clip = D.clips[name];
    if (!clip) continue;
    for (let tt = a; tt < b; tt += 1 / 30) {
      const c0 = f(tt);
      const c1 = f(tt + 1 / 30);
      if (c0 === null || c1 === null) continue;
      for (const e of clip.m.events) {
        if (e.t >= c0 && e.t < c1) {
          if (e.type === "down") cues.push({ t: tt, kind: "click", gain: 0.7 });
          if (e.type === "key") cues.push({ t: tt, kind: "key", gain: 0.35 });
        }
      }
    }
  }
  for (const t of [123.2, 133.6, 141.8, 155.6, 162.8, 165.7, 168.35, 172.0]) cues.push({ t, kind: "swish", gain: 0.45 });
  cues.push({ t: 138.5, kind: "chime", gain: 0.8 });
  cues.push({ t: 147.0, kind: "chime", gain: 0.7 });
  return cues;
}
