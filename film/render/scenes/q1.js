// Q1 · WHO / ATTENTION — "The Dot" (0:00–1:00)
// Darkness; real stars of the SPHEREx field around asteroid (7) Iris appear one by one; one point
// shifts; freeze. The view pulls back through the SPHEREx maps to the whole sky, in six bands.
// Then the people and the screens, and the name.
import {
  C, E, F, H, W, black, buffer, chip, clamp, cover, depthOfField, drawClip, env, glowDot, img, inv, keys, lerp,
  letterbox, loglerp, measure, noise1, prog, revealWords, ring, rng, text, vignette, windowFrame,
} from "../core.js";
import { DEG_PER_MED, MC, drawSky, fovDeg, graticule, toScreen } from "../sky.js";

// ---- The opening frame -------------------------------------------------------------------------
const FREEZE = 10.7;
export function openingCam(t) {
  const k = E.sine(Math.min(t, FREEZE) / 15);
  return { u: lerp(706, 724, k), v: lerp(1178, 1152, k), mpx: lerp(1030, 1190, k) };
}
// Which composite frame is on screen: 04:22 UTC on 3 Dec, then 05:57 UTC, blinking.
export function openingFrame(t) {
  if (t < 8.4) return 13;
  if (t < 9.25) return 17;
  if (t < 10.1) return 13;
  return 17;
}

let revealPlan = null;
function plan(D) {
  if (revealPlan) return revealPlan;
  const cam = openingCam(2);
  const inView = D.iris.stars.filter(([x, y]) => {
    const [sx, sy] = toScreen(cam, x, y);
    return sx > -40 && sx < W + 40 && sy > -40 && sy < H + 40;
  });
  const r = rng(7);
  // Two lone stars first, faint-to-middling and well apart, then the rest ever faster.
  const mid = inView.filter((s, i) => i > inView.length * 0.25 && i < inView.length * 0.6);
  const first = mid.reduce((b, s) => (Math.hypot(s[0] - 980, s[1] - 1230) < Math.hypot(b[0] - 980, b[1] - 1230) ? s : b));
  const second = mid.reduce((b, s) => (Math.hypot(s[0] - 430, s[1] - 1010) < Math.hypot(b[0] - 430, b[1] - 1010) ? s : b));
  const rest = inView.filter((s) => s !== first && s !== second).map((s) => [s, r()]).sort((a, b) => a[1] - b[1]).map((p) => p[0]);
  const items = [
    { x: first[0], y: first[1], f: first[2], t: 0.85 },
    { x: second[0], y: second[1], f: second[2], t: 1.75 },
  ];
  rest.forEach((s, i) => items.push({ x: s[0], y: s[1], f: s[2], t: 2.35 + 2.3 * Math.pow(i / rest.length, 0.62) }));
  revealPlan = items;
  return items;
}

function drawOpening(ctx, t, D, frame) {
  const cam = openingCam(t);
  const f = openingFrame(t);
  const items = plan(D);
  const full = inv(4.6, 6.2, t); // the rest of the field (faint background) fades up last
  if (full < 1) {
    const [mc, mg] = buffer("mask");
    const z = W / cam.mpx;
    for (const s of items) {
      const p = E.out(inv(s.t, s.t + 0.9, t));
      if (p <= 0) continue;
      const [sx, sy] = toScreen(cam, s.x, s.y);
      const rr = (9 + 3.2 * Math.sqrt(Math.max(s.f, 1))) * z;
      const g = mg.createRadialGradient(sx, sy, 0, sx, sy, rr);
      g.addColorStop(0, `rgba(255,255,255,${p})`);
      g.addColorStop(0.55, `rgba(255,255,255,${p * 0.85})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      mg.fillStyle = g;
      mg.fillRect(sx - rr, sy - rr, rr * 2, rr * 2);
    }
    // The asteroid itself, revealed among the crowd.
    const fi = D.iris.frames[f].iris;
    const pI = E.out(inv(3.35, 4.2, t));
    if (pI > 0) {
      const [sx, sy] = toScreen(cam, fi[0], fi[1]);
      const g = mg.createRadialGradient(sx, sy, 0, sx, sy, 30 * z);
      g.addColorStop(0, `rgba(255,255,255,${pI})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      mg.fillStyle = g;
      mg.fillRect(sx - 30 * z, sy - 30 * z, 60 * z, 60 * z);
    }
    // 36 Sextantis, just above the frame, blooms in.
    const pS = E.inOut(inv(3.9, 5.4, t));
    if (pS > 0) {
      const [sx, sy] = toScreen(cam, D.iris.star36Sex[0], D.iris.star36Sex[1]);
      const rr = 260 * z;
      const g = mg.createRadialGradient(sx, sy, 0, sx, sy, rr);
      g.addColorStop(0, `rgba(255,255,255,${pS})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      mg.fillStyle = g;
      mg.fillRect(sx - rr, sy - rr, rr * 2, rr * 2);
    }
    const [rc, rg] = buffer("reveal");
    drawSky(rg, cam, { frame: f });
    rg.globalCompositeOperation = "destination-in";
    rg.drawImage(mc, 0, 0);
    ctx.drawImage(rc, 0, 0);
    // A brief sparkle as each early star arrives.
    for (const s of items.slice(0, 40)) {
      const k = inv(s.t, s.t + 0.7, t);
      if (k <= 0 || k >= 1) continue;
      const [sx, sy] = toScreen(cam, s.x, s.y);
      glowDot(ctx, sx, sy, 34 * (1 - k) + 6, "255,255,255", 0.55 * (1 - k));
    }
  }
  if (full > 0) {
    ctx.save();
    ctx.globalAlpha = E.sine(full);
    drawSky(ctx, cam, { frame: f });
    ctx.restore();
  }
  // The question, after the freeze.
  const q = env(t, 11.5, 14.75, 0.9, 0.7);
  if (q > 0) {
    revealWords(ctx, "Did you see it move?", W / 2, H * 0.79, t, 11.5, { size: 46, weight: 300, family: F.display, track: 3, alpha: q, per: 0.12 });
  }
  letterbox(ctx, 1);
  vignette(ctx, 0.5);
  return 0.045;
}

// ---- Scale: the field becomes data, then the sky --------------------------------------------
function scaleCam(t) {
  const c0 = openingCam(15);
  const k = E.inOutExpo(inv(17.0, 21.7, t));
  const slow = E.sine(inv(15, 17.2, t));
  const mpx0 = c0.mpx * (1 + 0.08 * slow);
  return { u: lerp(c0.u, MC, E.inOut(inv(16.5, 19.5, t))), v: lerp(c0.v, MC, E.inOut(inv(16.5, 19.5, t))), mpx: loglerp(mpx0, 400 / DEG_PER_MED, k) };
}

function fmtCount(n) {
  // Estimates read as estimates: three significant figures once past ten thousand.
  if (n < 1e4) return Math.round(n).toLocaleString("en-US");
  const p = Math.pow(10, Math.floor(Math.log10(n)) - 2);
  return (Math.round(n / p) * p).toLocaleString("en-US");
}

function drawScale(ctx, t, D) {
  const cam = scaleCam(t);
  const fov = fovDeg(cam);
  const gray = 1 - E.sine(inv(0.36, 0.52, fov));
  const toGal = E.inOut(inv(21.35, 22.4, t));
  if (toGal < 1) {
    ctx.save();
    ctx.globalAlpha = 1 - toGal;
    drawSky(ctx, cam, { gray, frame: 17 });
    ctx.restore();
  }
  // The whole sky in galactic coordinates: the Milky Way across the middle.
  if (toGal > 0) drawWholeSky(ctx, t, toGal);

  // Data: a ring on every detected source, a coordinate grid and a running count.
  const dv = env(t, 15.05, 17.9, 0.5, 0.7);
  if (dv > 0) {
    const order = plan(D);
    for (const s of order) {
      const [sx, sy, z] = toScreen(cam, s.x, s.y);
      if (sx < 0 || sx > W || sy < 0 || sy > H) continue;
      const d = Math.hypot(sx - W / 2, sy - H / 2) / 1100;
      const k = E.out(inv(15.1 + d * 1.1, 15.5 + d * 1.1, t));
      if (k <= 0) continue;
      ring(ctx, sx, sy, (7 + 1.6 * Math.sqrt(Math.max(1, s.f))) * Math.max(z, 0.6) + 6 * (1 - k), { color: "rgba(127,215,255,0.9)", width: 1.2, alpha: dv * k * 0.7 });
    }
    graticule(ctx, cam, dv * 0.9);
  }
  // The count of sources in view, from this field's density.
  const cv = env(t, 15.3, 21.9, 0.4, 0.6);
  if (cv > 0) {
    const wDeg = fov;
    const hDeg = fov * (H / W);
    const field = 1405 / (0.3 * 0.3);
    const n = t < 17.05 ? 1405 * E.out(inv(15.3, 16.6, t)) : Math.min(41253, wDeg * hDeg) * field;
    const label = t < 17.05 ? "POINT SOURCES FOUND IN THIS FIELD" : "SOURCES IN VIEW · ESTIMATED FROM THIS FIELD";
    text(ctx, label, 120, H - 236, { size: 15, weight: 600, family: F.mono, align: "left", color: C.dim, track: 2.5, alpha: cv });
    text(ctx, (t < 17.05 ? "" : "≈ ") + fmtCount(n), 116, H - 186, { size: 54, weight: 300, family: F.mono, align: "left", color: C.ink, alpha: cv });
  }
  // The name.
  const ti = env(t, 17.55, 21.15, 0.9, 0.6);
  if (ti > 0) {
    ctx.save();
    ctx.filter = `blur(${(1 - E.out(inv(17.55, 18.5, t))) * 14}px)`;
    text(ctx, "SPHEREx", W / 2, H / 2 - 18, { size: 168, weight: 600, family: F.display, track: 26, alpha: ti, glow: 40, glowColor: "rgba(120,170,255,0.55)" });
    ctx.restore();
    text(ctx, "NASA'S INFRARED ALL-SKY SURVEY  ·  LAUNCHED MARCH 2025", W / 2, H / 2 + 96, { size: 20, weight: 500, family: F.mono, track: 5, color: C.dim, alpha: ti * E.out(inv(18.2, 19.0, t)) });
  }
  letterbox(ctx, 1);
  vignette(ctx, 0.45);
  return 0.045;
}

// The whole sky: the SPHEREx QR2 colour map, Mollweide, galactic.
function skyRect(scale = 1) {
  const w = 1720 * scale;
  return { x: W / 2 - w / 2, y: H / 2 - w / 4, w, h: w / 2 };
}
function drawWholeSky(ctx, t, alpha, o = {}) {
  const { scale = keys(t, [[21.4, 1.25], [23.2, 1.0], [27.2, 1.0], [30, 1.16]], E.inOut), bright = 1 } = o;
  const im = img("/build/img/sky/allsky_gal.jpg");
  const r = skyRect(scale);
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (im) ctx.drawImage(im, r.x, r.y, r.w, r.h);
  // The survey's sweep: the map brightens as a scan line crosses it.
  for (const [a, b] of [[21.8, 23.3], [27.0, 27.65], [27.7, 28.35]]) {
    const k = inv(a, b, t);
    if (k <= 0 || k >= 1) continue;
    const x = r.x + r.w * E.inOut(k);
    const g = ctx.createLinearGradient(x - 220, 0, x + 6, 0);
    g.addColorStop(0, "rgba(160,200,255,0)");
    g.addColorStop(0.92, "rgba(170,210,255,0.22)");
    g.addColorStop(1, "rgba(220,235,255,0.75)");
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, r.h / 2, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = g;
    ctx.fillRect(x - 220, r.y, 226, r.h);
    ctx.restore();
  }
  ctx.restore();
}

// ---- 102 colours: the six detectors' skies fan out --------------------------------------------
const BANDS = [
  { d: 1, um: "0.75–1.09 µm", tint: "#7b8cff" },
  { d: 2, um: "1.10–1.62 µm", tint: "#5cc8ff" },
  { d: 3, um: "1.63–2.41 µm", tint: "#52f0c4" },
  { d: 4, um: "2.42–3.82 µm", tint: "#d6f25e" },
  { d: 5, um: "3.83–4.41 µm", tint: "#ffb24f" },
  { d: 6, um: "4.42–5.00 µm", tint: "#ff6262" },
];
function tinted(band) {
  const im = img(`/build/img/sky/allsky_D${band.d}.jpg`);
  if (!im) return null;
  const [c, g] = buffer(`band${band.d}`, 1000, 500);
  g.drawImage(im, 0, 0, 1000, 500);
  g.globalCompositeOperation = "multiply";
  g.fillStyle = band.tint;
  g.fillRect(0, 0, 1000, 500);
  return c;
}
function drawBands(ctx, t, D) {
  const open = E.inOut(inv(23.15, 24.6, t)) * (1 - E.inOut(inv(26.35, 27.25, t)));
  const base = 1 - open;
  drawWholeSky(ctx, t, Math.max(0, base));
  if (open > 0.001) {
    const r = skyRect(1);
    BANDS.forEach((b, i) => {
      const c = tinted(b);
      if (!c) return;
      const k = (i - 2.5) / 2.5; // -1 .. 1
      const sx = lerp(1, 0.44, open);
      const sy = lerp(1, 0.44 * 0.5, open);
      const skew = lerp(0, -0.42, open);
      const cx = lerp(W / 2, W * 0.64, open);
      const cy = lerp(H / 2, H / 2 + k * 104, open);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.95 * E.sine(open);
      ctx.setTransform(sx, 0, skew * sy, sy, cx, cy);
      ctx.drawImage(c, -r.w / 2, -r.h / 2, r.w, r.h);
      ctx.restore();
      // Label each layer.
      const la = open * E.out(inv(23.9 + i * 0.12, 24.5 + i * 0.12, t));
      const lx = cx + (r.w / 2) * sx + 34;
      ctx.save();
      ctx.globalAlpha = la;
      ctx.fillStyle = b.tint;
      ctx.beginPath();
      ctx.arc(lx, cy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      text(ctx, `D${b.d}  ${b.um}`, lx + 18, cy + 1, { size: 19, weight: 500, family: F.mono, align: "left", color: C.ink, alpha: la });
    });
    const h = open * E.out(inv(23.5, 24.4, t));
    text(ctx, "102", 300, H / 2 - 40, { size: 230, weight: 200, family: F.display, align: "center", alpha: h, glow: 30, glowColor: "rgba(140,180,255,0.5)" });
    text(ctx, "colours of infrared light", 300, H / 2 + 92, { size: 34, weight: 400, family: F.display, alpha: h });
    text(ctx, "SIX DETECTORS · 0.75 – 5.0 µm", 300, H / 2 + 146, { size: 17, weight: 500, family: F.mono, track: 4, color: C.dim, alpha: h });
  }
  const again = env(t, 27.15, 29.5, 0.25, 0.6);
  if (again > 0) {
    text(ctx, "EVERY SIX MONTHS", W / 2, H - 196, { size: 17, weight: 600, family: F.mono, track: 6, color: C.dim, alpha: again });
  }
  letterbox(ctx, 1);
  vignette(ctx, 0.45);
  return 0.045;
}

// ---- The people: screens, filmed close ---------------------------------------------------------
const KW = /\b(def|for|in|if|return|not|and|or|else|elif|while|import|from|as|with|None|True|False|lambda|continue|break|yield)\b/g;
function codeLine(ctx, line, x, y, size) {
  // A small highlighter: comments, strings, keywords, numbers, the rest.
  ctx.font = `400 ${size}px "${F.mono}"`;
  ctx.letterSpacing = "0px";
  const parts = [];
  const comment = line.indexOf("#");
  const code = comment >= 0 ? line.slice(0, comment) : line;
  const re = /("[^"]*"|'[^']*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*\b|\s+|.)/g;
  let m;
  while ((m = re.exec(code))) {
    const s = m[0];
    let c = "#c9d4ff";
    if (/^["']/.test(s)) c = "#a5e8a0";
    else if (/^\d/.test(s)) c = "#7fd7ff";
    else if (KW.test(s)) c = "#ff9e7a";
    else if (/^[A-Z]/.test(s)) c = "#ffd27a";
    KW.lastIndex = 0;
    parts.push([s, c]);
  }
  if (comment >= 0) parts.push([line.slice(comment), "#6b7799"]);
  let cx = x;
  for (const [s, c] of parts) {
    ctx.fillStyle = c;
    ctx.fillText(s, cx, y);
    cx += ctx.measureText(s).width;
  }
}

function filmedScreen(ctx, t, a, b, drawContent, o = {}) {
  const { tilt = -0.07, focus = H * 0.48, zoom = [1.18, 1.3], drift = [0, -40], glow = "rgba(80,120,255,0.18)" } = o;
  const k = inv(a, b, t);
  const [sc, sg] = buffer("screen");
  sg.fillStyle = "#070b18";
  sg.fillRect(0, 0, W, H);
  drawContent(sg, t, k);
  // Handheld: slow drift plus a little shake.
  const sh = 6;
  const nx = noise1(t * 0.9, 3) * sh;
  const ny = noise1(t * 0.8, 7) * sh;
  const z = lerp(zoom[0], zoom[1], E.sine(k));
  ctx.save();
  ctx.translate(W / 2 + nx + drift[0] * k, H / 2 + ny + drift[1] * k);
  ctx.rotate(tilt + noise1(t * 0.5, 11) * 0.004);
  ctx.transform(1, 0, -0.08, 1, 0, 0);
  ctx.scale(z, z);
  ctx.drawImage(sc, -W / 2, -H / 2);
  ctx.restore();
  depthOfField(ctx, focus, 210, 9);
  // Screen glow and lens bloom.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(W * 0.45, H * 0.45, 50, W / 2, H / 2, W * 0.7);
  g.addColorStop(0, glow);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  vignette(ctx, 0.75, 0.3);
}

/** The team's own footage, when there is some: two short shots in the montage. */
function teamShot(ctx, t, D) {
  const T = D.team;
  if (!T) return false;
  let i = -1;
  if (t >= 32.3 && t < 34.4) i = Math.floor((t - 32.3) * 30);
  else if (t >= 37.2 && t < 39.8) i = Math.floor((2.1 + t - 37.2) * 30);
  if (i < 0) return false;
  i = Math.min(i, T.count - 1);
  const im = img(`/build/footage/team/${String(i + 1).padStart(5, "0")}.jpg`);
  const z = 1.04 + 0.03 * E.sine(inv(30, 45, t));
  cover(ctx, im, 1, z, noise1(t * 0.8, 3) * 6, noise1(t * 0.7, 9) * 6);
  vignette(ctx, 0.65, 0.35);
  return true;
}

function drawPeople(ctx, t, D, frame) {
  if (teamShot(ctx, t, D)) return 0.06;
  // Shot A: code. The moving-source search, as it is in the repository.
  if (t < 32.3) {
    filmedScreen(ctx, t, 30, 32.3, (g, tt, k) => {
      const lines = D.code.split("\n").slice(0, 34);
      const size = 30;
      const lh = 46;
      const y0 = 150 - k * 120;
      lines.forEach((ln, i) => {
        g.fillStyle = "#3d4766";
        g.font = `400 ${size}px "${F.mono}"`;
        g.textAlign = "right";
        g.fillText(String(148 + i), 150, y0 + i * lh);
        g.textAlign = "left";
        codeLine(g, ln, 190, y0 + i * lh, size);
      });
      // The caret, blinking at the end of a line.
      if (Math.floor(tt * 2.4) % 2 === 0) {
        g.fillStyle = "#ff8a5c";
        g.fillRect(190 + 23 * 18, y0 + 9 * lh - 26, 3, 34);
      }
    }, { tilt: -0.075, focus: H * 0.5, zoom: [1.3, 1.42], drift: [-30, -20] });
  } else if (t < 34.4) {
    // Shot B: the terminal, the project's real history scrolling past.
    filmedScreen(ctx, t, 32.3, 34.4, (g, tt, k) => {
      const lines = D.gitlog.trim().split("\n");
      const shown = Math.min(lines.length, Math.floor(8 + k * lines.length * 1.1));
      const size = 27;
      const lh = 42;
      const top = H - 120 - shown * lh;
      g.font = `400 ${size}px "${F.mono}"`;
      g.fillStyle = "#7fd7ff";
      g.fillText("~/spherex-explorer $ git log --reverse --oneline", 120, top - lh);
      lines.slice(0, shown).forEach((ln, i) => {
        const y = top + i * lh;
        if (y < -50) return;
        const [hash, ...rest] = ln.split(" ");
        g.fillStyle = "#ffb48a";
        g.fillText(hash, 120, y);
        g.fillStyle = "#6b7799";
        g.fillText(rest.slice(0, 2).join(" "), 280, y);
        g.fillStyle = "#e6ebff";
        g.fillText(rest.slice(2).join(" "), 440, y);
      });
    }, { tilt: 0.06, focus: H * 0.62, zoom: [1.24, 1.32], drift: [20, -30], glow: "rgba(255,140,90,0.10)" });
  } else if (t < 37.2) {
    // Shot C: the blink in the app, the pointer on the moving point.
    const clip = D.clips.irisImage;
    filmedScreen(ctx, t, 34.4, 37.2, (g, tt, k) => {
      const ct = 0.6 + (tt - 34.4);
      drawClip(g, clip, ct, { x: 0, y: 0, w: W, h: H }, { x: lerp(250, 300, k), y: lerp(250, 280, k), w: 1180 });
    }, { tilt: -0.05, focus: H * 0.5, zoom: [1.12, 1.22], drift: [-20, 10] });
  } else if (t < 39.8) {
    // Shot D: someone hunting by eye, and finding it.
    const clip = D.clips.play;
    const tap = clip.marks.tap ?? 8.2;
    filmedScreen(ctx, t, 37.2, 39.8, (g, tt, k) => {
      const ct = tap - 1.9 + (tt - 37.2);
      drawClip(g, clip, ct, { x: 0, y: 0, w: W, h: H }, { x: 180, y: 150, w: 1150 });
    }, { tilt: 0.05, focus: H * 0.55, zoom: [1.1, 1.18], drift: [10, -20] });
  } else if (t < 42.4) {
    // Shot E: comparing frames: the nineteen real frames of the pass.
    filmedScreen(ctx, t, 39.8, 42.4, (g, tt, k) => {
      const cell = 300;
      const gap = 18;
      const ox = 80 - k * 260;
      for (let i = 0; i < 19; i++) {
        const col = i % 7;
        const row = Math.floor(i / 7);
        const x = ox + col * (cell + gap);
        const y = 90 + row * (cell + gap + 34);
        const im = img(`/build/img/iris/raw_${String(i).padStart(2, "0")}.png`);
        if (im) g.drawImage(im, 300, 380, 1100, 1100, x, y, cell, cell);
        g.strokeStyle = i === 9 || i === 13 ? "rgba(255,138,92,0.9)" : "rgba(255,255,255,0.12)";
        g.lineWidth = i === 9 || i === 13 ? 3 : 1;
        g.strokeRect(x, y, cell, cell);
        g.font = `500 17px "${F.mono}"`;
        g.fillStyle = "rgba(220,228,255,0.7)";
        g.fillText(D.iris.frames[i].isoMid.slice(5, 16).replace("T", " ") + " UTC", x, y + cell + 24);
      }
    }, { tilt: -0.04, focus: H * 0.45, zoom: [1.06, 1.12], drift: [-30, 0], glow: "rgba(90,130,255,0.12)" });
  } else {
    // Shot F: back into the dark field. Something could be hiding in there.
    const cam = darkFieldCam(t);
    ctx.save();
    ctx.globalAlpha = E.sine(inv(42.4, 43.2, t));
    drawSky(ctx, cam, { frame: null });
    ctx.restore();
    letterbox(ctx, E.inOut(inv(42.4, 43.6, t)));
    vignette(ctx, 0.6);
  }
  return 0.06;
}

// The dark field from 42.4 s, carried on under the name so the cut never shows.
function darkFieldCam(t) {
  const k = E.sine(inv(42.4, 45.0, t));
  const back = E.inOut(inv(45.0, 52.0, t));
  return { u: lerp(760 + 40 * k, 830, back), v: lerp(980 - 30 * k, 920, back), mpx: loglerp(loglerp(1500, 820, k), 1350, back) };
}

// ---- The name ----------------------------------------------------------------------------------
let particles = null;
function wordmarkParticles() {
  if (particles) return particles;
  const [c, g] = buffer("wordmark", W, H);
  g.font = `700 150px "${F.display}"`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.letterSpacing = "-2px";
  const s1 = "SPHEREx";
  const s2 = " Explorer";
  const w1 = g.measureText(s1).width;
  g.font = `300 150px "${F.display}"`;
  const w2 = g.measureText(s2).width;
  const x0 = W / 2 - (w1 + w2) / 2;
  g.textAlign = "left";
  g.font = `700 150px "${F.display}"`;
  g.fillStyle = "#fff";
  g.fillText(s1, x0, H / 2 - 40);
  g.font = `300 150px "${F.display}"`;
  g.fillText(s2, x0 + w1, H / 2 - 40);
  const d = g.getImageData(0, 0, W, H).data;
  const r = rng(42);
  const pts = [];
  for (let i = 0; i < 26000 && pts.length < 2600; i++) {
    const x = Math.floor(r() * W);
    const y = Math.floor(H / 2 - 160 + r() * 240);
    if (d[(y * W + x) * 4 + 3] > 128) pts.push({ x, y, ox: r() * W, oy: r() * H, d: r() * 0.7, s: 0.6 + r() * 1.3 });
  }
  particles = { pts, x0, w1, w2 };
  return particles;
}
function wordmark(ctx, alpha, y = H / 2 - 40, size = 150) {
  const w1 = measure(ctx, "SPHEREx", { size, weight: 700, family: F.display, track: -2 });
  const w2 = measure(ctx, " Explorer", { size, weight: 300, family: F.display, track: -2 });
  const x0 = W / 2 - (w1 + w2) / 2;
  text(ctx, "SPHEREx", x0, y, { size, weight: 700, family: F.display, align: "left", track: -2, alpha, glow: 26, glowColor: "rgba(120,160,255,0.45)" });
  text(ctx, " Explorer", x0 + w1, y, { size, weight: 300, family: F.display, align: "left", track: -2, alpha, glow: 26, glowColor: "rgba(120,160,255,0.45)" });
}
export { wordmark };

function drawName(ctx, t, D) {
  // A soft field behind everything.
  const bg = lerp(1, 0.5, E.sine(inv(45.0, 46.4, t)));
  ctx.save();
  ctx.globalAlpha = bg;
  drawSky(ctx, darkFieldCam(t), { frame: null });
  ctx.restore();
  // The app's front page, rising out of the dark.
  const app = env(t, 45.2, 49.6, 1.0, 0.8);
  if (app > 0) {
    const clip = D.clips.search;
    const s = lerp(0.78, 0.84, inv(45.2, 49.6, t));
    const w = 1600 * s;
    const h = 900 * s;
    const r = { x: W / 2 - w / 2, y: H / 2 - h / 2 + 22 + (1 - app) * 30, w, h };
    ctx.save();
    ctx.globalAlpha = app;
    windowFrame(ctx, r);
    drawClip(ctx, clip, 0.3 + (t - 45.2) * 0.3, r, { x: 0, y: 0, w: 1600 }, { cursor: false });
    ctx.restore();
  }
  // Stars gather into the name.
  const P = wordmarkParticles();
  const gather = inv(49.3, 51.6, t);
  if (gather > 0) {
    const crisp = E.sine(inv(51.2, 52.0, t));
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of P.pts) {
      const k = E.inOutExpo(clamp((gather - p.d * 0.35) / 0.65));
      if (k <= 0) continue;
      const x = lerp(p.ox, p.x, k);
      const y = lerp(p.oy, p.y, k);
      ctx.globalAlpha = (1 - crisp) * Math.min(1, k * 2) * 0.9;
      ctx.fillStyle = "#cfe0ff";
      ctx.fillRect(x - p.s / 2, y - p.s / 2, p.s, p.s);
    }
    ctx.restore();
    wordmark(ctx, crisp);
  }
  // The belief, under the name, as it is said.
  const b = env(t, 51.8, 59.3, 0.6, 0.01);
  if (b > 0) {
    revealWords(ctx, "Discovery shouldn't belong only to the people", W / 2, H / 2 + 92, t, 51.9, { size: 34, weight: 400, family: F.sans, color: C.dim, alpha: b, per: 0.16 });
    revealWords(ctx, "who have the tools to look for it.", W / 2, H / 2 + 142, t, 53.1, { size: 34, weight: 400, family: F.sans, color: C.dim, alpha: b, per: 0.16 });
  }
  letterbox(ctx, 1);
  vignette(ctx, 0.5);
  if (t >= 59.3) black(ctx, 1);
  return 0.05;
}

export const q1 = [
  { a: 0, b: 15, draw: (ctx, t, D, f) => drawOpening(ctx, t, D, f) },
  { a: 15, b: 23.15, draw: (ctx, t, D) => drawScale(ctx, t, D) },
  { a: 23.15, b: 30, draw: (ctx, t, D) => drawBands(ctx, t, D) },
  { a: 30, b: 45, draw: (ctx, t, D, f) => drawPeople(ctx, t, D, f) },
  { a: 45, b: 60, draw: (ctx, t, D) => drawName(ctx, t, D) },
];

export function q1Cues(D) {
  const cues = [];
  plan(D).slice(0, 60).forEach((s, i) => cues.push({ t: s.t, kind: "ping", gain: i < 2 ? 1 : 0.35 * Math.pow(0.97, i) }));
  for (const t of [8.4, 9.25, 10.1]) cues.push({ t, kind: "blip", gain: 0.6 });
  cues.push({ t: FREEZE, kind: "freeze", gain: 1 });
  cues.push({ t: 15.05, kind: "data", gain: 0.8 });
  cues.push({ t: 17.0, kind: "whoosh-out", gain: 1 });
  cues.push({ t: 17.6, kind: "title-hit", gain: 0.9 });
  cues.push({ t: 21.8, kind: "sweep", gain: 0.6 });
  cues.push({ t: 23.2, kind: "fan", gain: 0.8 });
  cues.push({ t: 27.0, kind: "sweep", gain: 0.5 });
  cues.push({ t: 27.7, kind: "sweep", gain: 0.5 });
  cues.push({ t: 30.0, kind: "cut-hit", gain: 1 });
  for (const t of [32.3, 34.4, 37.2, 39.8]) cues.push({ t, kind: "cut-soft", gain: 0.5 });
  cues.push({ t: 49.3, kind: "gather", gain: 1 });
  cues.push({ t: 51.4, kind: "title-hit", gain: 1 });
  cues.push({ t: 59.3, kind: "cut-black", gain: 1 });
  return cues;
}
