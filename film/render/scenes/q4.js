// Q4 · IMPACT / FUTURE — "The Invitation" (3:00–3:58)
// Stay on the discovery; pull back to the Solar System and to Earth; every generation's way of
// seeing; the data, and the people it needs; the advertisement; the dot from the first shot,
// caught at last; the name.
import {
  C, E, F, H, W, black, brackets, buffer, chip, clamp, drawClip, env, glowDot, img, inv, keys, lerp, letterbox,
  loglerp, measure, phoneFrame, revealWords, ring, rng, text, vignette, windowFrame,
} from "../core.js";
import { DEG_PER_MED, MC, drawSky, toScreen } from "../sky.js";
import { openingCam, wordmark } from "./q1.js";
import { drawMachine } from "./q2.js";

// ---- Stay on the discovery ------------------------------------------------------------------------
const PATH = [1, 5]; // 03:58 and 12:06 UTC on 2 Dec: the stretch of the track clear of 36 Sextantis
function pathFrame(t) {
  return PATH[Math.floor((t - 180) / 0.62) % PATH.length];
}
function drawTrack(ctx, D, cam, alpha, upto = PATH.length) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = C.jpl;
  ctx.setLineDash([4, 9]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  D.iris.frames.forEach((f, i) => {
    const [x, y] = toScreen(cam, f.iris[0], f.iris[1]);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.stroke();
  ctx.restore();
}
function discoveryCam(t) {
  const out = E.inOutExpo(inv(184.3, 188.0, t));
  return { u: lerp(1200, MC + 120, E.inOut(inv(183.8, 186.5, t))), v: lerp(600, MC - 60, E.inOut(inv(183.8, 186.5, t))), mpx: loglerp(1100, 26000, out) };
}
function drawDiscovery(ctx, t, D) {
  const cam = discoveryCam(t);
  const f = pathFrame(t);
  const toSolar = E.inOut(inv(186.9, 188.4, t));
  ctx.save();
  ctx.globalAlpha = 1 - toSolar;
  drawSky(ctx, cam, { frame: f, gray: 1 - E.sine(inv(184.6, 186.0, t)) });
  const fade = 1 - E.inOut(inv(184.6, 185.8, t));
  drawTrack(ctx, D, cam, 0.75 * fade);
  const p = D.iris.frames[f].iris;
  const [x, y, z] = toScreen(cam, p[0], p[1]);
  ring(ctx, x, y, Math.max(10, 30 * z), { color: C.accent, width: 2.5, glow: 12, alpha: fade });
  if (fade > 0) {
    chip(ctx, `7 Iris · ${D.iris.frames[f].isoMid.slice(8, 10)} Dec 2025 ${D.iris.frames[f].isoMid.slice(11, 16)} UTC`, x + 44, y - 40, { size: 20, alpha: fade * E.out(inv(180.4, 181.2, t)), dot: C.accent });
  }
  // One tiny object: as the view widens, keep a pin on it.
  const pin = E.sine(inv(185.2, 186.0, t)) * (1 - toSolar);
  if (pin > 0) {
    glowDot(ctx, x, y, 26, "255,170,130", pin);
    ring(ctx, x, y, 16, { color: C.accent, width: 2, alpha: pin });
  }
  ctx.restore();
  if (toSolar > 0) drawSolar(ctx, t, D, toSolar);
  letterbox(ctx, 1);
  vignette(ctx, 0.5);
  return 0.045;
}

// ---- The Solar System on 2 December 2025, from JPL's orbital elements -----------------------------------
function kepler(M, e) {
  let Ea = M;
  for (let i = 0; i < 12; i++) Ea -= (Ea - e * Math.sin(Ea) - M) / (1 - e * Math.cos(Ea));
  return Ea;
}
function orbitXY(el, nu) {
  const rad = Math.PI / 180;
  const r = (el.a * (1 - el.e * el.e)) / (1 + el.e * Math.cos(nu));
  const O = el.node * rad;
  const w = el.peri * rad;
  const i = el.i * rad;
  const u = w + nu;
  return [r * (Math.cos(O) * Math.cos(u) - Math.sin(O) * Math.sin(u) * Math.cos(i)), r * (Math.sin(O) * Math.cos(u) + Math.cos(O) * Math.sin(u) * Math.cos(i))];
}
function bodyXY(el) {
  const Ea = kepler((el.M * Math.PI) / 180, el.e);
  const nu = 2 * Math.atan2(Math.sqrt(1 + el.e) * Math.sin(Ea / 2), Math.sqrt(1 - el.e) * Math.cos(Ea / 2));
  return orbitXY(el, nu);
}
function solarCam(t, D) {
  const earth = bodyXY(D.orbits.bodies.Earth);
  const iris = bodyXY(D.orbits.bodies.Iris);
  const k = E.inOutExpo(inv(189.0, 191.4, t));
  const c0 = [iris[0] * 0.35, iris[1] * 0.35];
  return { cx: lerp(c0[0], earth[0], k), cy: lerp(c0[1], earth[1], k), s: loglerp(150, 5200, k) };
}
function drawSolar(ctx, t, D, alpha) {
  const B = D.orbits.bodies;
  const cam = solarCam(t, D);
  const P = (x, y) => [W / 2 + (x - cam.cx) * cam.s, H / 2 - (y - cam.cy) * cam.s];
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#03050c";
  ctx.fillRect(0, 0, W, H);
  // The Sun.
  const [sx, sy] = P(0, 0);
  glowDot(ctx, sx, sy, 90, "255,200,120", 0.9);
  glowDot(ctx, sx, sy, 22, "255,240,210", 1);
  const draw = E.out(inv(187.0, 188.6, t));
  for (const [name, el] of Object.entries(B)) {
    const iris = name === "Iris";
    ctx.save();
    ctx.strokeStyle = iris ? "rgba(255,138,92,0.85)" : "rgba(170,190,255,0.28)";
    ctx.lineWidth = iris ? 2 : 1.2;
    if (iris) ctx.setLineDash([5, 6]);
    ctx.beginPath();
    const n = 240;
    for (let j = 0; j <= n * draw; j++) {
      const [x, y] = P(...orbitXY(el, (j / n) * Math.PI * 2));
      j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
    const [bx, by] = P(...bodyXY(el));
    const col = { Mercury: "190,190,200", Venus: "240,220,170", Earth: "120,180,255", Mars: "240,120,90", Jupiter: "230,200,160", Iris: "255,160,120" }[name];
    glowDot(ctx, bx, by, iris ? 20 : 16, col, draw);
    const lab = draw * (1 - E.inOut(inv(189.2, 190.2, t)));
    if (lab > 0 && bx > 0 && bx < W && by > 0 && by < H) {
      text(ctx, iris ? "7 Iris · 2.1 au from SPHEREx" : name, bx + 16, by - 16, { size: iris ? 20 : 17, weight: iris ? 600 : 500, family: F.sans, align: "left", color: iris ? C.accent2 : C.dim, alpha: lab });
    }
  }
  // Earth, close: a globe with the coastlines, Bangladesh turned toward us.
  const g = E.inOut(inv(190.2, 191.8, t));
  if (g > 0) {
    const [ex, ey] = P(...bodyXY(B.Earth));
    globe(ctx, ex, ey, lerp(8, 270, g), g, D, t);
  }
  ctx.restore();
}

function globe(ctx, cx, cy, R, alpha, D, t) {
  const lon0 = ((88 + (t - 190) * 3) * Math.PI) / 180;
  const lat0 = (18 * Math.PI) / 180;
  ctx.save();
  ctx.globalAlpha *= alpha;
  const g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.35, R * 0.1, cx, cy, R);
  g.addColorStop(0, "#1d3a7a");
  g.addColorStop(1, "#060c22");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(140,190,255,0.75)";
  ctx.lineWidth = 1.4;
  for (const ring of D.land) {
    ctx.beginPath();
    let pen = false;
    for (let i = 0; i < ring.length; i += 2) {
      const lon = (ring[i] * Math.PI) / 180;
      const lat = (ring[i + 1] * Math.PI) / 180;
      const cosc = Math.sin(lat0) * Math.sin(lat) + Math.cos(lat0) * Math.cos(lat) * Math.cos(lon - lon0);
      if (cosc < 0) {
        pen = false;
        continue;
      }
      const x = cx + R * Math.cos(lat) * Math.sin(lon - lon0);
      const y = cy - R * (Math.cos(lat0) * Math.sin(lat) - Math.sin(lat0) * Math.cos(lat) * Math.cos(lon - lon0));
      pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      pen = true;
    }
    ctx.stroke();
  }
  // Atmosphere rim.
  const rim = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.18);
  rim.addColorStop(0, "rgba(110,170,255,0)");
  rim.addColorStop(0.35, "rgba(110,170,255,0.45)");
  rim.addColorStop(1, "rgba(110,170,255,0)");
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 1.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---- Every generation's way of seeing: line drawings ------------------------------------------------
const ART = {
  watcher: {
    year: "Thousands of years ago",
    label: "THE NAKED EYE",
    shapes: [
      { p: [[40, 385], [360, 385]] },
      { c: [200, 262, 17] },
      { p: [[203, 279], [206, 334]] },
      { p: [[206, 334], [190, 384]] }, { p: [[206, 334], [222, 384]] },
      { p: [[204, 292], [176, 318]] }, { p: [[204, 292], [232, 258]] },
      { p: [[150, 64], [176, 132], [199, 125], [222, 118], [242, 70]] },
      { p: [[176, 132], [164, 190]] }, { p: [[222, 118], [252, 186]] },
    ],
    stars: [[150, 64, 9], [242, 70, 7], [176, 132, 6], [199, 125, 6], [222, 118, 6], [164, 190, 6], [252, 186, 8], [90, 40, 3], [310, 110, 3], [330, 40, 3], [70, 150, 2]],
  },
  telescope: {
    year: "1609",
    label: "THE TELESCOPE",
    shapes: [
      { p: [[40, 385], [360, 385]] },
      { p: [[86, 236], [326, 140]] }, { p: [[94, 254], [334, 158]] },
      { p: [[86, 236], [94, 254]] }, { p: [[326, 140], [334, 158]] },
      { p: [[318, 134], [342, 166]] },
      { p: [[86, 236], [70, 246], [76, 260], [94, 254]] },
      { p: [[212, 196], [150, 380]] }, { p: [[212, 196], [272, 380]] }, { p: [[212, 196], [214, 382]] },
    ],
    stars: [[60, 60, 6], [120, 110, 3], [300, 50, 4], [350, 90, 3]],
  },
  plates: { year: "1930", label: "PHOTOGRAPHIC PLATES", machine: true, stars: [] },
  dome: {
    year: "1949",
    label: "THE GREAT OBSERVATORIES",
    shapes: [
      { p: [[40, 385], [360, 385]] },
      { p: [[96, 385], [96, 262], [304, 262], [304, 385]] },
      { a: [200, 262, 104, Math.PI, Math.PI * 2] },
      { p: [[186, 160], [186, 262]] }, { p: [[214, 160], [214, 262]] },
      { p: [[192, 236], [236, 150]] }, { p: [[208, 244], [250, 160]] },
      { p: [[176, 385], [176, 330], [224, 330], [224, 385]] },
    ],
    stars: [[70, 70, 4], [140, 40, 3], [300, 60, 6], [340, 130, 3]],
  },
  spherex: {
    year: "2025",
    label: "SPHEREx",
    shapes: [
      { e: [200, 92, 150, 28] }, { p: [[50, 92], [130, 250]] }, { p: [[350, 92], [270, 250]] },
      { e: [200, 116, 120, 22] }, { p: [[80, 116], [146, 250]] }, { p: [[320, 116], [254, 250]] },
      { e: [200, 140, 92, 17] },
      { e: [200, 250, 70, 13] },
      { p: [[150, 256], [150, 316], [250, 316], [250, 256]] },
      { p: [[150, 286], [250, 286]] },
      { p: [[250, 270], [362, 252], [362, 300], [250, 304]] },
      { p: [[278, 266], [278, 302]] }, { p: [[306, 262], [306, 302]] }, { p: [[334, 258], [334, 301]] },
    ],
    stars: [[40, 40, 4], [360, 30, 3], [70, 200, 2], [380, 180, 3]],
  },
};
const ORDER = ["watcher", "telescope", "plates", "dome", "spherex"];

function strokeShapes(ctx, shapes, k) {
  shapes.forEach((sh, i) => {
    const kk = clamp((k * shapes.length - i * 0.6) / 2.0);
    if (kk <= 0) return;
    ctx.save();
    if (sh.p) {
      let len = 0;
      for (let j = 1; j < sh.p.length; j++) len += Math.hypot(sh.p[j][0] - sh.p[j - 1][0], sh.p[j][1] - sh.p[j - 1][1]);
      ctx.setLineDash([len, len]);
      ctx.lineDashOffset = len * (1 - kk);
      ctx.beginPath();
      sh.p.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    } else if (sh.c) {
      ctx.beginPath();
      ctx.arc(sh.c[0], sh.c[1], sh.c[2], -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * kk);
      ctx.stroke();
    } else if (sh.e) {
      ctx.beginPath();
      ctx.ellipse(sh.e[0], sh.e[1], sh.e[2], sh.e[3], 0, 0, Math.PI * 2 * kk);
      ctx.stroke();
    } else if (sh.a) {
      ctx.beginPath();
      ctx.arc(sh.a[0], sh.a[1], sh.a[2], sh.a[3], lerp(sh.a[3], sh.a[4], kk));
      ctx.stroke();
    }
    ctx.restore();
  });
}

function drawArt(ctx, key, x, y, s, k, alpha, color = "#dfe8ff") {
  if (alpha <= 0) return;
  const a = ART[key];
  ctx.save();
  ctx.translate(x - 200 * s, y - 200 * s);
  ctx.scale(s, s);
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.2 / s;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(140,180,255,0.6)";
  ctx.shadowBlur = 8;
  if (a.machine) drawMachine(ctx, 0, 0, 1, k, 1, color);
  else strokeShapes(ctx, a.shapes, k);
  ctx.shadowBlur = 0;
  for (const [sx, sy, r] of a.stars) {
    const kk = clamp(k * 2 - 0.6);
    glowDot(ctx, sx, sy, r * 3.2, "220,232,255", kk);
  }
  ctx.restore();
}

function drawHistory(ctx, t, D) {
  ctx.fillStyle = "#04060e";
  ctx.fillRect(0, 0, W, H);
  // Faint stars behind.
  const r = rng(77);
  ctx.save();
  for (let i = 0; i < 260; i++) {
    ctx.globalAlpha = 0.15 + r() * 0.4;
    ctx.fillStyle = "#cfe0ff";
    const s = r() < 0.9 ? 1.2 : 2.2;
    ctx.fillRect(r() * W, r() * H, s, s);
  }
  ctx.restore();
  // The Earth hands over to the first drawing.
  const fromEarth = 1 - E.inOut(inv(191.6, 192.5, t));
  if (fromEarth > 0) {
    ctx.save();
    ctx.globalAlpha = fromEarth;
    drawSolar(ctx, t, D, 1);
    ctx.restore();
  }
  // One at a time, each drawn in, then all five in a row: the timeline of seeing.
  const starts = [192.1, 193.45, 194.8, 196.15, 197.5];
  const row = E.inOut(inv(198.9, 200.2, t));
  const focus = E.inOut(inv(202.5, 203.6, t)); // then SPHEREx alone
  ORDER.forEach((key, i) => {
    const s0 = starts[i];
    const k = inv(s0, s0 + 1.15, t);
    if (k <= 0) return;
    const solo = i === ORDER.length - 1 ? 1 : 1 - E.inOut(inv(starts[i + 1] - 0.2, starts[i + 1] + 0.3, t));
    const soloAlpha = Math.max(solo, row);
    const x = lerp(W / 2, 260 + i * 350, row);
    const y = lerp(H / 2 - 20, H / 2 - 40, row);
    const sc = lerp(1.35, 0.62, row);
    let alpha = soloAlpha * (i === 4 ? 1 : 1 - focus);
    let xx = x;
    let yy = y;
    let ss = sc;
    if (i === 4 && focus > 0) {
      xx = lerp(x, W / 2, focus);
      yy = lerp(y, H / 2 - 30, focus);
      ss = lerp(sc, 1.25, focus);
    }
    drawArt(ctx, key, xx, yy, ss, k, alpha);
    const a = ART[key];
    const la = alpha * E.out(inv(s0 + 0.3, s0 + 0.8, t));
    text(ctx, a.year, xx, yy + 250 * ss + 26, { size: lerp(34, 26, row), weight: 300, family: F.display, alpha: la * (i === 4 ? 1 - focus * 0 : 1) });
    text(ctx, a.label, xx, yy + 250 * ss + 66, { size: lerp(17, 14, row), weight: 600, family: F.mono, track: 4, color: C.dim, alpha: la });
  });
  // A thin timeline under the row.
  const tl = row * (1 - focus);
  if (tl > 0) {
    ctx.save();
    ctx.globalAlpha = tl * 0.5;
    ctx.strokeStyle = "#9fb4ff";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(140, H / 2 + 128);
    ctx.lineTo(140 + (W - 280) * E.out(inv(199.2, 200.6, t)), H / 2 + 128);
    ctx.stroke();
    ctx.restore();
  }
  letterbox(ctx, 1);
  vignette(ctx, 0.45);
  return 0.045;
}

// ---- More data than ever; more people looking -----------------------------------------------------------
function drawData(ctx, t, D) {
  ctx.fillStyle = "#04060e";
  ctx.fillRect(0, 0, W, H);
  // SPHEREx, then the sky it maps unfolding from it.
  const unfold = E.inOutExpo(inv(204.4, 206.2, t));
  const art = 1 - E.inOut(inv(204.6, 205.6, t));
  if (art > 0) drawArt(ctx, "spherex", W / 2, H / 2 - 30, lerp(1.25, 0.7, unfold), 1, art);
  const im = img("/build/img/sky/allsky_gal.jpg");
  if (im && unfold > 0) {
    const w = lerp(240, 1640, unfold);
    const h = w / 2;
    ctx.save();
    ctx.globalAlpha = Math.min(1, unfold * 1.5);
    ctx.drawImage(im, W / 2 - w / 2, H / 2 - h / 2 - lerp(140, 0, unfold), w, h);
    ctx.restore();
  }
  // People looking: hundreds of small reticles light up across the sky.
  const people = inv(209.3, 212.2, t);
  if (people > 0) {
    const r = rng(314);
    const w = 1640;
    const h = 820;
    const x0 = W / 2 - w / 2;
    const y0 = H / 2 - h / 2;
    for (let i = 0; i < 420; i++) {
      // Points inside the map's ellipse.
      let u;
      let v;
      do {
        u = r() * 2 - 1;
        v = r() * 2 - 1;
      } while (u * u + v * v > 0.92);
      const at = Math.pow(i / 420, 0.7);
      const k = E.out(inv(at, at + 0.12, people));
      if (k <= 0) continue;
      const x = x0 + (u * 0.5 + 0.5) * w;
      const y = y0 + (v * 0.5 + 0.5) * h;
      ring(ctx, x, y, lerp(22, 7, k), { color: i % 7 === 0 ? C.accent : "#bfe3ff", width: 1.5, alpha: 0.85 * k });
    }
  }
  const lines = [
    [206.0, 209.2, "More data than ever before."],
    [209.4, 212.4, "Now we need more people looking at it."],
  ];
  for (const [a, b, s] of lines) {
    const k = env(t, a, b, 0.4, 0.4);
    if (k > 0) revealWords(ctx, s, W / 2, H - 196, t, a, { size: 40, weight: 300, family: F.display, alpha: k, per: 0.08 });
  }
  letterbox(ctx, 1);
  vignette(ctx, 0.45);
  return 0.045;
}

// ---- The advertisement --------------------------------------------------------------------------------
const AD_WIN = { x: 360, y: 170, w: 1200, h: 675 };
function laptop(ctx, clip, ct, view, alpha = 1) {
  windowFrame(ctx, AD_WIN, { alpha });
  ctx.save();
  ctx.globalAlpha *= alpha;
  drawClip(ctx, clip, ct, AD_WIN, view, { radius: [0, 0, 18, 18] });
  ctx.restore();
}
function drawAd(ctx, t, D) {
  ctx.fillStyle = "#060918";
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalAlpha = 0.45;
  drawSky(ctx, { u: 700 + (t - 212) * 6, v: 1000, mpx: 1500 }, { frame: null });
  ctx.restore();
  const K = D.clips;
  const shots = [
    // [start, end, draw]
    [212.0, 213.6, () => {
      const r = phoneFrame(ctx, W / 2, H / 2 + 10, 820);
      drawClip(ctx, K.phone, 1.2 + (t - 212.0) * 1.6, r, { x: 0, y: 0, w: 390 }, { radius: r.r, cursor: false });
      chip(ctx, "বাংলায়, ফোনে", r.x + r.w + 50, H / 2 - 20, { size: 24, family: F.bangla, dot: C.accent });
      chip(ctx, "In Bangla, on a phone", r.x + r.w + 50, H / 2 + 40, { size: 22, dot: C.cyan });
    }],
    [213.6, 215.4, () => laptop(ctx, K.play, 6.6 + (t - 213.6), { x: 140, y: 120, w: 1300 })],
    [215.4, 217.4, () => laptop(ctx, K.discover, 1.2 + (t - 215.4) * 1.5, { x: 120, y: 60, w: 1360 })],
    [217.4, 219.2, () => laptop(ctx, K.irisPanel, 7.0 + (t - 217.4), { x: 1060, y: 520, w: 560 })],
    [219.2, 219.55, () => laptop(ctx, K.globe, 4.0 + (t - 219.2), { x: 700, y: 0, w: 900 })],
    [219.55, 219.9, () => laptop(ctx, K.decades, 6.5 + (t - 219.55), { x: 0, y: 40, w: 1300 })],
    [219.9, 220.25, () => laptop(ctx, K.ask, 16.0 + (t - 219.9), { x: 200, y: 0, w: 1100 })],
    [220.25, 220.6, () => laptop(ctx, K.bangla, 6.0 + (t - 220.25), { x: 0, y: 0, w: 1400 })],
    [220.6, 220.95, () => laptop(ctx, K.irisImage, 12.0 + (t - 220.6), { x: 72, y: 140, w: 1100 })],
    [220.95, 221.4, () => laptop(ctx, K.search, 9.6 + (t - 220.95), { x: 0, y: 0, w: 1600 })],
  ];
  for (const [a, b, fn] of shots) if (t >= a && t < b) fn();
  // The words, big, as they are said.
  const words = [
    [213.6, 215.3, "A student."],
    [215.4, 217.3, "A citizen scientist."],
    [217.4, 219.1, "An astronomer."],
    [219.2, 221.4, "Anyone curious enough to look."],
  ];
  for (const [a, b, s] of words) {
    const k = env(t, a, b, 0.12, 0.15);
    if (k <= 0) continue;
    ctx.save();
    ctx.globalAlpha = 0.6 * k;
    const g = ctx.createLinearGradient(0, H - 300, 0, H);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.95)");
    ctx.fillStyle = g;
    ctx.fillRect(0, H - 300, W, 300);
    ctx.restore();
    text(ctx, s, W / 2, H - 120, { size: 62, weight: 600, family: F.display, alpha: k, glow: 20, glowColor: "rgba(0,0,0,0.8)" });
  }
  // A flash between the fastest cuts.
  for (const c of [219.2, 219.55, 219.9, 220.25, 220.6, 220.95]) {
    const k = 1 - inv(c, c + 0.12, t);
    if (k > 0 && k < 1) {
      ctx.save();
      ctx.globalAlpha = 0.25 * k;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }
  if (t >= 221.4) black(ctx, 1);
  return 0.035;
}

// ---- The dot, caught ---------------------------------------------------------------------------------
function drawCaught(ctx, t, D) {
  // The same framing as the film's first shot, frozen where it stopped.
  const base = openingCam(10.7);
  const out = E.inOutExpo(inv(227.6, 232.0, t));
  const cam = { u: lerp(base.u, MC, E.inOut(inv(227.6, 230.5, t))), v: lerp(base.v, MC, E.inOut(inv(227.6, 230.5, t))), mpx: loglerp(base.mpx, 400 / DEG_PER_MED, out) };
  const fadeIn = E.sine(inv(221.6, 222.6, t));
  const f = t < 223.0 ? 13 : t < 223.85 ? 17 : t < 224.7 ? 13 : 17;
  const toGal = E.inOut(inv(231.0, 232.0, t));
  ctx.save();
  ctx.globalAlpha = fadeIn * (1 - toGal);
  drawSky(ctx, cam, { frame: f, gray: 1 - E.sine(inv(0.36, 0.52, cam.mpx * DEG_PER_MED)) });
  ctx.restore();
  if (toGal > 0) {
    const im = img("/build/img/sky/allsky_gal.jpg");
    ctx.save();
    ctx.globalAlpha = toGal * (1 - E.sine(inv(232.0, 232.6, t)));
    if (im) ctx.drawImage(im, W / 2 - 860, H / 2 - 430, 1720, 860);
    ctx.restore();
  }
  // The question again; this time the interface answers.
  const q = env(t, 222.5, 224.5, 0.5, 0.4);
  if (q > 0) revealWords(ctx, "Did you see it move?", W / 2, H * 0.79, t, 222.5, { size: 46, weight: 300, family: F.display, track: 3, alpha: q, per: 0.12 });
  const lock = inv(224.6, 225.3, t);
  const hold = 1 - E.inOut(inv(227.6, 228.6, t));
  if (lock > 0 && hold > 0) {
    const a = D.iris.frames[13].iris;
    const b = D.iris.frames[17].iris;
    const [ax, ay] = toScreen(cam, a[0], a[1]);
    const [bx, by, z] = toScreen(cam, b[0], b[1]);
    brackets(ctx, bx, by, lerp(120, 36, E.outBack(lock)), { color: C.accent, alpha: Math.min(1, lock * 2) * hold });
    ring(ctx, ax, ay, 14, { color: C.jpl, width: 2, dash: [3, 4], alpha: E.out(inv(225.0, 225.6, t)) * hold });
    ctx.save();
    ctx.globalAlpha = E.out(inv(225.1, 225.7, t)) * hold;
    ctx.strokeStyle = C.jpl;
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.restore();
    const la = E.out(inv(225.3, 225.9, t)) * hold;
    chip(ctx, "Moving · 53″ an hour", bx + 56, by - 34, { size: 21, alpha: la, dot: C.accent });
    chip(ctx, "Matches JPL: 7 Iris", bx + 56, by + 22, { size: 21, alpha: E.out(inv(225.8, 226.4, t)) * hold, dot: C.jpl });
  }
  letterbox(ctx, 1);
  vignette(ctx, 0.5);
  return 0.045;
}

// ---- The name ------------------------------------------------------------------------------------------
function drawEnd(ctx, t, D) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  const cfg = D.config || {};
  const fade = 1 - E.sine(inv(237.1, 238.0, t));
  const wm = E.out(inv(232.9, 234.0, t)) * fade;
  ctx.save();
  ctx.filter = `blur(${(1 - E.out(inv(232.9, 234.0, t))) * 12}px)`;
  wordmark(ctx, wm, H / 2 - 70, 132);
  ctx.restore();
  text(ctx, cfg.tagline || "Look closer. Discover what changed.", W / 2, H / 2 + 40, { size: 36, weight: 300, family: F.display, color: C.ink, alpha: E.out(inv(233.6, 234.4, t)) * fade });
  // Who made it, then where it was made for.
  text(ctx, cfg.team || "Team Oblivion · Bangladesh", W / 2, H / 2 + 112, { size: 24, weight: 600, family: F.sans, color: C.ink, track: 0.5, alpha: 0.88 * E.out(inv(234.2, 235.0, t)) * fade });
  text(ctx, cfg.event || "NASA Space Apps Challenge 2026", W / 2, H / 2 + 150, { size: 19, weight: 500, family: F.sans, color: C.dim, alpha: E.out(inv(234.45, 235.25, t)) * fade });
  const cr = E.out(inv(234.6, 235.4, t)) * fade;
  text(ctx, "SPHEREx data NASA/JPL-Caltech/IPAC via IRSA · SPHEREx QR2 maps via CDS hips2fits · DSS (STScI/AURA, Palomar) · 2MASS · AllWISE · JPL Horizons & SBIdent", W / 2, H - 92, { size: 14, weight: 500, family: F.sans, color: C.faint, alpha: cr });
  text(ctx, "Narration: synthetic voice · Music: original · The QR2 map's unfinished Galactic-centre tiles are smoothed for display · Not affiliated with or endorsed by NASA, JPL, Caltech or IPAC", W / 2, H - 66, { size: 14, weight: 500, family: F.sans, color: C.faint, alpha: cr });
  return 0.03;
}

export const q4 = [
  { a: 180, b: 188.4, draw: (ctx, t, D) => drawDiscovery(ctx, t, D) },
  { a: 188.4, b: 192.1, draw: (ctx, t, D) => { drawSolar(ctx, t, D, 1); letterbox(ctx, 1); vignette(ctx, 0.45); return 0.045; } },
  { a: 192.1, b: 204.4, draw: (ctx, t, D) => drawHistory(ctx, t, D) },
  { a: 204.4, b: 212.0, draw: (ctx, t, D) => drawData(ctx, t, D) },
  { a: 212.0, b: 221.6, draw: (ctx, t, D) => drawAd(ctx, t, D) },
  { a: 221.6, b: 232.6, draw: (ctx, t, D) => drawCaught(ctx, t, D) },
  { a: 232.6, b: 238.0, draw: (ctx, t, D) => drawEnd(ctx, t, D) },
];

export function q4Cues() {
  const cues = [];
  for (let t = 180.0; t < 184.5; t += 0.62) cues.push({ t, kind: "blip", gain: 0.3 });
  cues.push({ t: 184.3, kind: "whoosh-out", gain: 0.7 });
  cues.push({ t: 189.0, kind: "whoosh-in", gain: 0.6 });
  for (const t of [192.1, 193.45, 194.8, 196.15, 197.5]) cues.push({ t, kind: "draw", gain: 0.6 });
  cues.push({ t: 204.4, kind: "unfold", gain: 0.8 });
  cues.push({ t: 209.3, kind: "people", gain: 0.7, until: 212.2 });
  for (const t of [212.0, 213.6, 215.4, 217.4, 219.2, 219.55, 219.9, 220.25, 220.6, 220.95]) cues.push({ t, kind: "cut-hit", gain: t < 219 ? 0.4 : 0.28 });
  cues.push({ t: 221.4, kind: "cut-black", gain: 0.8 });
  for (const t of [223.0, 223.85, 224.7]) cues.push({ t, kind: "blip", gain: 0.6 });
  cues.push({ t: 224.6, kind: "lock", gain: 1 });
  cues.push({ t: 227.6, kind: "whoosh-out", gain: 0.9 });
  cues.push({ t: 232.9, kind: "title-hit", gain: 1 });
  return cues;
}
