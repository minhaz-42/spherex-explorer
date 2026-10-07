// Drawing toolkit for the film. Every frame is a pure function of time: scenes call these helpers
// with `t` in seconds and nothing carries over between frames, so any frame can be rendered alone.

export const W = 1920;
export const H = 1080;
export const FPS = 30;

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
/** 0 before a, 1 after b, linear between. */
export const inv = (a, b, x) => (b === a ? (x >= b ? 1 : 0) : clamp((x - a) / (b - a)));
export const E = {
  lin: (k) => k,
  in: (k) => k * k * k,
  out: (k) => 1 - Math.pow(1 - k, 3),
  inOut: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  sine: (k) => -(Math.cos(Math.PI * k) - 1) / 2,
  outExpo: (k) => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k)),
  inExpo: (k) => (k <= 0 ? 0 : Math.pow(2, 10 * k - 10)),
  inOutExpo: (k) =>
    k <= 0 ? 0 : k >= 1 ? 1 : k < 0.5 ? Math.pow(2, 20 * k - 10) / 2 : (2 - Math.pow(2, -20 * k + 10)) / 2,
  outBack: (k) => 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2),
};
/** Eased progress from a to b. */
export const prog = (t, a, b, ease = E.inOut) => ease(inv(a, b, t));
/** Visibility envelope: fades in from a over `fin`, holds, fades out ending at b over `fout`. */
export function env(t, a, b, fin = 0.4, fout = 0.4) {
  if (t < a || t > b) return 0;
  const i = fin > 0 ? E.sine(inv(a, a + fin, t)) : 1;
  const o = fout > 0 ? E.sine(1 - inv(b - fout, b, t)) : 1;
  return Math.min(i, o);
}
/** Interpolate keyframes [[t, value], ...] with easing between each pair. */
export function keys(t, ks, ease = E.inOut) {
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) {
    if (t <= ks[i][0]) {
      const [t0, v0] = ks[i - 1];
      const [t1, v1] = ks[i];
      const k = ease((t - t0) / (t1 - t0));
      return Array.isArray(v0) ? v0.map((v, j) => lerp(v, v1[j], k)) : lerp(v0, v1, k);
    }
  }
  return ks[ks.length - 1][1];
}
/** Log-space interpolation, for zooms: equal ratios per second feel like steady motion. */
export const loglerp = (a, b, k) => Math.exp(lerp(Math.log(a), Math.log(b), k));

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Smooth 1-D value noise, for camera drift and handheld shake. */
export function noise1(x, seed = 1) {
  const h = (n) => {
    const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u) * 2 - 1;
}

// ---------------------------------------------------------------------------------------------
// Images. `img(url)` returns the decoded image, or null and queues the load; `settle` redraws a
// frame until nothing is pending, so every frame is drawn with all its pictures.

const cache = new Map();
let pending = [];
const LIMIT = 40;

export function img(url) {
  let e = cache.get(url);
  if (!e) {
    const im = new Image();
    e = { im, ok: false, used: 0 };
    e.p = new Promise((res) => {
      im.onload = () => im.decode().then(() => ((e.ok = true), res()), () => ((e.ok = true), res()));
      im.onerror = () => {
        console.error("missing image", url);
        e.ok = "error";
        res();
      };
    });
    im.src = url;
    cache.set(url, e);
    if (cache.size > LIMIT) {
      // Drop the least recently used decoded frames (app footage frames are large).
      const old = [...cache.entries()].filter(([, v]) => v.ok).sort((a, b) => a[1].used - b[1].used);
      for (const [k] of old.slice(0, cache.size - LIMIT)) cache.delete(k);
    }
  }
  e.used = performance.now();
  if (e.ok === true) return e.im;
  if (!e.ok) pending.push(e.p);
  return null;
}

export async function settle(draw) {
  for (let pass = 0; pass < 8; pass++) {
    pending = [];
    draw();
    if (!pending.length) return;
    await Promise.all(pending);
  }
}

export async function json(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

export async function textFile(url) {
  const r = await fetch(url);
  return r.ok ? r.text() : "";
}

// ---------------------------------------------------------------------------------------------
// Offscreen canvases, reused by name so per-frame work allocates nothing.

const scratch = new Map();
export function buffer(name, w = W, h = H) {
  let c = scratch.get(name);
  if (!c || c.width !== w || c.height !== h) {
    c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    scratch.set(name, c);
  }
  const g = c.getContext("2d");
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
  g.filter = "none";
  g.clearRect(0, 0, w, h);
  return [c, g];
}

/**
 * Draw `im` so that image point (u, v) lands at screen point (sx, sy), scaled by `zoom` screen
 * pixels per image pixel, optionally rotated (radians) about that point.
 */
export function place(ctx, im, u, v, zoom, sx = W / 2, sy = H / 2, rot = 0) {
  if (!im) return;
  ctx.save();
  ctx.translate(sx, sy);
  if (rot) ctx.rotate(rot);
  ctx.scale(zoom, zoom);
  ctx.drawImage(im, -u, -v);
  ctx.restore();
}

/** Fill the frame with the image, cropped to cover, centred. */
export function cover(ctx, im, alpha = 1, zoom = 1, ox = 0, oy = 0) {
  if (!im) return;
  const s = Math.max(W / im.width, H / im.height) * zoom;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.drawImage(im, W / 2 - (im.width * s) / 2 + ox, H / 2 - (im.height * s) / 2 + oy, im.width * s, im.height * s);
  ctx.restore();
}

export function black(ctx, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

export function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// ---------------------------------------------------------------------------------------------
// Type. The app's own faces: Sora for display, Plus Jakarta Sans for text, JetBrains Mono for data.

export const F = {
  display: "Sora",
  sans: "Plus Jakarta Sans",
  mono: "JetBrains Mono",
  type: "Special Elite",
  serif: "Cormorant Garamond",
  bangla: "Noto Sans Bengali",
};

export const C = {
  ink: "#eef2ff",
  dim: "rgba(214,222,255,0.62)",
  faint: "rgba(214,222,255,0.38)",
  accent: "#ff8a5c", // the app's orange
  accent2: "#ffb48a",
  cyan: "#7fd7ff",
  jpl: "#5eead4",
  live: "#4ade80",
  bg: "#070b1a",
  navy: "#0f1631",
};

export function text(ctx, s, x, y, o = {}) {
  const {
    size = 40,
    weight = 400,
    family = F.display,
    color = C.ink,
    align = "center",
    base = "middle",
    track = 0,
    alpha = 1,
    glow = 0,
    glowColor = "rgba(160,190,255,0.8)",
    italic = false,
    maxWidth,
  } = o;
  if (alpha <= 0 || !s) return 0;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = `${italic ? "italic " : ""}${weight} ${size}px "${family}"`;
  ctx.letterSpacing = `${track}px`;
  ctx.textAlign = align;
  ctx.textBaseline = base;
  ctx.fillStyle = color;
  if (glow) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = glow;
  }
  // letterSpacing adds space after the last glyph too; nudge centred text back.
  const nudge = align === "center" ? track / 2 : align === "right" ? track : 0;
  ctx.fillText(s, x + nudge, y, maxWidth);
  const w = ctx.measureText(s).width;
  ctx.restore();
  return w;
}

export function measure(ctx, s, o = {}) {
  const { size = 40, weight = 400, family = F.display, track = 0 } = o;
  ctx.save();
  ctx.font = `${weight} ${size}px "${family}"`;
  ctx.letterSpacing = `${track}px`;
  const w = ctx.measureText(s).width;
  ctx.restore();
  return w;
}

/** Words that rise and sharpen in one after another. */
export function revealWords(ctx, s, x, y, t, t0, o = {}) {
  const { per = 0.09, dur = 0.7, align = "center" } = o;
  const words = s.split(" ");
  const space = measure(ctx, " ", o);
  const widths = words.map((w) => measure(ctx, w, o));
  const total = widths.reduce((a, b) => a + b, 0) + space * (words.length - 1);
  let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  words.forEach((w, i) => {
    const k = E.out(inv(t0 + i * per, t0 + i * per + dur, t));
    if (k > 0) {
      ctx.save();
      ctx.filter = k < 1 ? `blur(${(1 - k) * 8}px)` : "none";
      text(ctx, w, cx, y + (1 - k) * 18, { ...o, align: "left", alpha: (o.alpha ?? 1) * k });
      ctx.restore();
    }
    cx += widths[i] + space;
  });
  return total;
}

/** Typewriter: characters appear at `cps` per second from t0. */
export function typed(s, t, t0, cps = 18) {
  const n = Math.floor(Math.max(0, t - t0) * cps);
  return s.slice(0, n);
}

// ---------------------------------------------------------------------------------------------
// Film finish: grain, vignette, letterbox, flashes.

const grains = [];
export function makeGrain() {
  const r = rng(99);
  for (let i = 0; i < 8; i++) {
    const c = document.createElement("canvas");
    c.width = 960;
    c.height = 540;
    const g = c.getContext("2d");
    const d = g.createImageData(960, 540);
    for (let p = 0; p < d.data.length; p += 4) {
      const v = 128 + (r() + r() + r() - 1.5) * 110;
      d.data[p] = d.data[p + 1] = d.data[p + 2] = v;
      d.data[p + 3] = 255;
    }
    g.putImageData(d, 0, 0);
    grains.push(c);
  }
}
export function grain(ctx, frame, amount = 0.07) {
  if (amount <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = amount;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(grains[frame % grains.length], 0, 0, W, H);
  ctx.restore();
}

export function vignette(ctx, amount = 0.55, inner = 0.45) {
  if (amount <= 0) return;
  const g = ctx.createRadialGradient(W / 2, H / 2, H * inner, W / 2, H / 2, H * 1.05);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${amount})`);
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

export function letterbox(ctx, k) {
  if (k <= 0) return;
  const bar = 132 * k;
  ctx.save();
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, bar);
  ctx.fillRect(0, H - bar, W, bar);
  ctx.restore();
}

export function flash(ctx, alpha, color = "#fff") {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// Glows and marks.

let glowSprite;
export function glowDot(ctx, x, y, r, color = "255,255,255", alpha = 1) {
  if (!glowSprite) {
    glowSprite = document.createElement("canvas");
    glowSprite.width = glowSprite.height = 256;
    const g = glowSprite.getContext("2d");
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(0.08, "rgba(255,255,255,0.9)");
    gr.addColorStop(0.25, "rgba(255,255,255,0.28)");
    gr.addColorStop(0.6, "rgba(255,255,255,0.06)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
  }
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.globalCompositeOperation = "lighter";
  if (color !== "255,255,255") {
    // Tint by drawing a coloured radial gradient instead.
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${color},1)`);
    gr.addColorStop(0.2, `rgba(${color},0.35)`);
    gr.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = gr;
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  } else {
    ctx.drawImage(glowSprite, x - r, y - r, 2 * r, 2 * r);
  }
  ctx.restore();
}

export function ring(ctx, x, y, r, o = {}) {
  const { color = C.accent, width = 2.5, alpha = 1, dash = null, glow = 0 } = o;
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  if (dash) ctx.setLineDash(dash);
  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
  }
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Four corner brackets around a point: the interface "locking on". */
export function brackets(ctx, x, y, r, o = {}) {
  const { color = C.accent, width = 2.5, alpha = 1, len = 0.42 } = o;
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  const l = r * len;
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    ctx.beginPath();
    ctx.moveTo(x + sx * r, y + sy * (r - l));
    ctx.lineTo(x + sx * r, y + sy * r);
    ctx.lineTo(x + sx * (r - l), y + sy * r);
    ctx.stroke();
  }
  ctx.restore();
}

/** A small label chip, like the app's badges. */
export function chip(ctx, s, x, y, o = {}) {
  const { size = 22, color = C.ink, bg = "rgba(10,14,32,0.72)", border = "rgba(255,255,255,0.14)", alpha = 1, dot = null, family = F.sans, weight = 600, align = "left" } = o;
  if (alpha <= 0) return;
  const pad = size * 0.65;
  const w = measure(ctx, s, { size, weight, family }) + pad * 2 + (dot ? size * 0.9 : 0);
  const h = size * 1.8;
  const x0 = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
  ctx.save();
  ctx.globalAlpha *= alpha;
  rrect(ctx, x0, y - h / 2, w, h, h / 2);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  let tx = x0 + pad;
  if (dot) {
    ctx.fillStyle = dot;
    ctx.shadowColor = dot;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(tx + size * 0.28, y, size * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    tx += size * 0.9;
  }
  text(ctx, s, tx, y + 1, { size, weight, family, color, align: "left" });
  ctx.restore();
  return w;
}

// ---------------------------------------------------------------------------------------------
// App footage. A clip is the frame list and events captured by capture/harness.mjs.

export class Clip {
  constructor(name, meta) {
    this.name = name;
    this.m = meta;
    this.times = meta.frames.map((f) => f.t);
    this.moves = meta.events.filter((e) => ["move", "down", "up", "start", "key", "scroll"].includes(e.type));
    this.downs = meta.events.filter((e) => e.type === "down").map((e) => e.t);
    this.boxes = Object.fromEntries(meta.events.filter((e) => e.type === "box").map((e) => [e.name, e]));
    this.marks = Object.fromEntries(meta.events.filter((e) => e.type === "mark").map((e) => [e.label, e.t]));
  }
  get w() {
    return this.m.width;
  }
  get h() {
    return this.m.height;
  }
  get duration() {
    return this.m.duration;
  }
  frame(t) {
    let lo = 0;
    let hi = this.times.length - 1;
    if (t <= this.times[0]) return this.url(0);
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.times[mid] <= t) lo = mid;
      else hi = mid - 1;
    }
    return this.url(lo);
  }
  url(i) {
    return `/build/capture/${this.name}/frames/${this.m.frames[i].file}`;
  }
  cursor(t) {
    let p = null;
    for (const e of this.moves) {
      if (e.t > t) break;
      p = e;
    }
    if (!p) return null;
    let lastDown = -1e9;
    for (const d of this.downs) if (d <= t) lastDown = d;
    return { x: p.x, y: p.y, click: t - lastDown };
  }
}

/**
 * Draw a clip into the screen rectangle `dst` ({x, y, w, h}), showing the page region whose
 * top-left is (vx, vy) in CSS pixels and which is `vw` CSS pixels wide (height follows dst).
 */
export function drawClip(ctx, clip, t, dst, view = {}, o = {}) {
  const im = img(clip.frame(t));
  const vw = view.w ?? clip.w;
  const vx = view.x ?? 0;
  const vy = view.y ?? 0;
  const s = dst.w / vw; // screen px per CSS px
  ctx.save();
  rrect(ctx, dst.x, dst.y, dst.w, dst.h, o.radius ?? 0);
  ctx.clip();
  ctx.fillStyle = C.bg;
  ctx.fillRect(dst.x, dst.y, dst.w, dst.h);
  if (im) {
    const px = im.width / clip.w; // image px per CSS px
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(im, vx * px, vy * px, vw * px, (dst.h / s) * px, dst.x, dst.y, dst.w, dst.h);
  }
  if (o.cursor !== false) {
    const c = clip.cursor(t);
    if (c) drawCursor(ctx, dst.x + (c.x - vx) * s, dst.y + (c.y - vy) * s, Math.max(0.8, Math.min(1.8, s)), c.click);
  }
  ctx.restore();
  return s;
}

/** Map a CSS point of the clip's page to the screen, for the same view as drawClip. */
export function clipToScreen(clip, dst, view, x, y) {
  const vw = view.w ?? clip.w;
  const s = dst.w / vw;
  return [dst.x + (x - (view.x ?? 0)) * s, dst.y + (y - (view.y ?? 0)) * s, s];
}

const cursorPath = new Path2D("M0 0 L0 23 L5.6 17.6 L9.6 26.6 L13.4 25 L9.5 16.2 L17 16.2 Z");
export function drawCursor(ctx, x, y, scale = 1, sinceClick = 99) {
  ctx.save();
  if (sinceClick >= 0 && sinceClick < 0.6) {
    const k = sinceClick / 0.6;
    ring(ctx, x, y, 10 + 34 * E.out(k) * scale, { color: "#ffffff", width: 2.5, alpha: 0.75 * (1 - k) });
  }
  ctx.translate(x, y);
  ctx.scale(scale * 1.15, scale * 1.15);
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = "#fff";
  ctx.fill(cursorPath);
  ctx.shadowColor = "transparent";
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = "#111";
  ctx.stroke(cursorPath);
  ctx.restore();
}

/** A dark browser window: shadow, title bar, traffic lights and the app's tab title. */
export function windowFrame(ctx, r, o = {}) {
  const { title = "SPHEREx Explorer", alpha = 1, bar = 44, radius = 18, glow = 0.35 } = o;
  ctx.save();
  ctx.globalAlpha *= alpha;
  // Glow behind the window, as if lit by the screen.
  ctx.shadowColor = `rgba(90,120,255,${glow})`;
  ctx.shadowBlur = 90;
  rrect(ctx, r.x, r.y - bar, r.w, r.h + bar, radius);
  ctx.fillStyle = "#0b1022";
  ctx.fill();
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 24;
  ctx.fill();
  ctx.shadowColor = "transparent";
  // Title bar.
  ctx.save();
  rrect(ctx, r.x, r.y - bar, r.w, bar, [radius, radius, 0, 0]);
  ctx.fillStyle = "#121935";
  ctx.fill();
  ctx.restore();
  const cy = r.y - bar / 2;
  ["#ff5f57", "#febc2e", "#28c840"].forEach((c, i) => {
    ctx.beginPath();
    ctx.arc(r.x + 24 + i * 22, cy, 6.5, 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.fill();
  });
  const tw = measure(ctx, title, { size: 16, weight: 600, family: F.sans }) + 64;
  rrect(ctx, r.x + r.w / 2 - tw / 2, cy - 14, tw, 28, 8);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fill();
  text(ctx, title, r.x + r.w / 2 + 10, cy + 1, { size: 16, weight: 600, family: F.sans, color: "rgba(230,236,255,0.85)" });
  // A tiny planet mark, like the app's wordmark.
  ctx.beginPath();
  ctx.arc(r.x + r.w / 2 - tw / 2 + 22, cy, 6, 0, Math.PI * 2);
  ctx.fillStyle = "#9fb4ff";
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.globalAlpha *= alpha;
  rrect(ctx, r.x - 0.5, r.y - bar - 0.5, r.w + 1, r.h + bar + 1, radius);
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

/** A phone: rounded body, the screen inset. Returns the screen rectangle. */
export function phoneFrame(ctx, cx, cy, sh, alpha = 1) {
  const sw = sh * (390 / 844);
  const bez = sh * 0.03;
  const x = cx - sw / 2;
  const y = cy - sh / 2;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 30;
  rrect(ctx, x - bez, y - bez, sw + 2 * bez, sh + 2 * bez, sh * 0.075);
  ctx.fillStyle = "#05070f";
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  return { x, y, w: sw, h: sh, r: sh * 0.06 };
}

/** Screen-space depth of field: sharp band around `focusY`, blurring away from it. */
export function depthOfField(ctx, focusY, band = 260, maxBlur = 7) {
  const [c, g] = buffer("dof");
  g.filter = `blur(${maxBlur}px)`;
  g.drawImage(ctx.canvas, 0, 0);
  g.filter = "none";
  g.globalCompositeOperation = "destination-in";
  const gr = g.createLinearGradient(0, 0, 0, H);
  const a = clamp((focusY - band) / H);
  const b = clamp((focusY + band) / H);
  gr.addColorStop(0, "rgba(0,0,0,1)");
  gr.addColorStop(clamp(a - 0.12), "rgba(0,0,0,1)");
  gr.addColorStop(a, "rgba(0,0,0,0)");
  gr.addColorStop(b, "rgba(0,0,0,0)");
  gr.addColorStop(clamp(b + 0.12), "rgba(0,0,0,1)");
  gr.addColorStop(1, "rgba(0,0,0,1)");
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  ctx.drawImage(c, 0, 0);
}
