// Q2 · WHY — "The Blink" (1:00–2:00)
// 1930: Clyde Tombaugh's blink comparator (a reconstruction from a real Palomar plate and JPL's
// positions for Pluto). The technique carried forward through 75 years of real surveys of
// Barnard's Star to SPHEREx. Then the scale, and a person searching by hand.
import {
  C, E, F, H, W, black, buffer, clamp, drawCursor, env, glowDot, img, inv, keys, lerp, letterbox, loglerp,
  noise1, revealWords, ring, rng, text, typed, vignette,
} from "../core.js";
import { wordmark } from "./q1.js";

// ---- Archival look --------------------------------------------------------------------------------
function archival(ctx, t, frame, amount = 1) {
  if (amount <= 0) return;
  // Sepia grade over whatever is drawn.
  ctx.save();
  ctx.globalAlpha = amount;
  ctx.globalCompositeOperation = "color";
  ctx.fillStyle = "#8a6a45";
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  // Projector flicker.
  const fl = 0.06 * noise1(frame * 0.9, 5) + 0.03 * Math.sin(frame * 2.1);
  ctx.save();
  ctx.globalAlpha = Math.abs(fl) * amount;
  ctx.fillStyle = fl > 0 ? "#fff3dc" : "#000";
  ctx.globalCompositeOperation = fl > 0 ? "soft-light" : "source-over";
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  // Dust and the odd scratch, different every frame.
  const r = rng(frame * 7919 + 13);
  ctx.save();
  ctx.globalAlpha = 0.55 * amount;
  for (let i = 0; i < 9; i++) {
    const x = r() * W;
    const y = r() * H;
    const s = 1 + r() * 3.5;
    ctx.fillStyle = r() < 0.5 ? "rgba(255,248,230,0.8)" : "rgba(0,0,0,0.8)";
    ctx.beginPath();
    ctx.ellipse(x, y, s, s * (0.4 + r()), r() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  if (r() < 0.35) {
    const x = r() * W;
    ctx.strokeStyle = "rgba(255,248,230,0.35)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (r() - 0.5) * 30, H);
    ctx.stroke();
  }
  ctx.restore();
}

// ---- The blink comparator, drawn like a patent figure ---------------------------------------------
// Polylines in a 400 × 400 box; circles as [cx, cy, r].
const MACHINE = {
  lines: [
    [[10, 340], [390, 340], [390, 362], [10, 362], [10, 340]], // base
    [[30, 340], [30, 300], [370, 300], [370, 340]], // table
    [[38, 300], [62, 236], [176, 236], [168, 300]], // left plate stage
    [[232, 300], [224, 236], [338, 236], [362, 300]], // right plate stage
    [[62, 248], [170, 248]], [[230, 248], [338, 248]],
    [[186, 300], [186, 128], [214, 128], [214, 300]], // column
    [[176, 128], [176, 96], [224, 96], [224, 128], [176, 128]], // prism head
    [[200, 96], [232, 44]], [[214, 104], [246, 52]], // eyepiece tube
    [[228, 40], [254, 56], [262, 44], [236, 28], [228, 40]], // eyepiece
    [[186, 150], [120, 236]], [[214, 150], [280, 236]], // optical paths
  ],
  dashed: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0].map((d, i) => i >= 11),
  circles: [[200, 196, 20], [200, 196, 6], [104, 320, 9], [296, 320, 9]],
};
export function drawMachine(ctx, x, y, s, k, alpha, color = "#f3e6cc") {
  if (alpha <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.2 / s;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const all = [...MACHINE.lines.map((pts, i) => ({ pts, dash: i >= 11 })), ...MACHINE.circles.map((c) => ({ c }))];
  all.forEach((it, i) => {
    const kk = clamp((k * all.length - i * 0.55) / 2.2);
    if (kk <= 0) return;
    ctx.save();
    if (it.pts) {
      let len = 0;
      for (let j = 1; j < it.pts.length; j++) len += Math.hypot(it.pts[j][0] - it.pts[j - 1][0], it.pts[j][1] - it.pts[j - 1][1]);
      ctx.setLineDash(it.dash ? [6, 7] : [len, len]);
      if (!it.dash) ctx.lineDashOffset = len * (1 - kk);
      else ctx.globalAlpha *= kk;
      ctx.beginPath();
      it.pts.forEach(([px, py], j) => (j ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.stroke();
    } else {
      const [cx, cy, r] = it.c;
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * kk);
      ctx.stroke();
    }
    ctx.restore();
  });
  // A few stars on each plate.
  const r = rng(5);
  ctx.fillStyle = color;
  for (let i = 0; i < 26; i++) {
    const left = i < 13;
    const px = left ? 70 + r() * 95 : 232 + r() * 95;
    const py = 256 + r() * 36;
    ctx.globalAlpha = alpha * clamp(k * 2 - 1);
    ctx.fillRect(px, py, 2, 2);
  }
  ctx.restore();
}

// ---- 1930 ---------------------------------------------------------------------------------------
function plateSide(t) {
  // Which plate the comparator shows: it flips between the two nights.
  if (t < 61.0) return "jan23";
  const period = t < 67.8 ? 0.62 : 0.85;
  const n = Math.floor((t - 61.0) / period);
  return n % 2 === 0 ? "jan23" : "jan29";
}
function flipTimes() {
  const out = [];
  for (let t = 61.0; t < 73.0; ) {
    const period = t < 67.8 ? 0.62 : 0.85;
    out.push(t);
    t += period;
  }
  return out;
}

function drawEyepiece(ctx, t, D, cx, cy, R, zoom, alpha) {
  const P = D.pluto;
  const side = plateSide(t);
  const im = img(`/build/img/pluto/plate_${side}.png`);
  const a = P.pluto.jan23;
  const b = P.pluto.jan29;
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2 + 20;
  // Weave: the frame jitters slightly, as old film does.
  const wx = noise1(t * 7, 1) * 2;
  const wy = noise1(t * 6, 2) * 2;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = "#e8dcc4";
  ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
  if (im) {
    ctx.save();
    ctx.translate(cx + wx, cy + wy);
    ctx.scale(zoom, zoom);
    ctx.drawImage(im, -mx, -my);
    ctx.restore();
  }
  // The shutter blade crossing at each flip.
  for (const ft of flipTimes()) {
    const k = inv(ft - 0.05, ft + 0.05, t);
    if (k > 0 && k < 1) {
      ctx.fillStyle = "rgba(20,14,8,0.92)";
      ctx.fillRect(cx - R + 2 * R * k - R, cy - R, R, 2 * R);
    }
  }
  // Tombaugh inked arrows on his plates; ours point to where Pluto is on the plate shown.
  const ink = inv(68.6, 69.6, t);
  if (ink > 0) {
    const p = side === "jan23" ? a : b;
    const px = cx + wx + (p[0] - mx) * zoom;
    const py = cy + wy + (p[1] - my) * zoom;
    ctx.strokeStyle = "rgba(40,22,10,0.9)";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    const len = 70 * E.out(ink);
    ctx.beginPath();
    ctx.moveTo(px - 18 - len, py + 18 + len);
    ctx.lineTo(px - 14, py + 14);
    ctx.stroke();
    if (ink > 0.6) {
      ctx.beginPath();
      ctx.moveTo(px - 14, py + 14);
      ctx.lineTo(px - 30, py + 16);
      ctx.moveTo(px - 14, py + 14);
      ctx.lineTo(px - 16, py + 30);
      ctx.stroke();
    }
  }
  ctx.restore();
  // The eyepiece's brass rim and the dark around it.
  ctx.save();
  ctx.globalAlpha *= alpha;
  const g = ctx.createRadialGradient(cx, cy, R * 0.82, cx, cy, R * 1.02);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.85)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(200,170,120,0.55)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
  return side;
}

function drawTombaugh(ctx, t, D, frame) {
  ctx.fillStyle = "#0d0a07";
  ctx.fillRect(0, 0, W, H);
  // The comparator, drawn in.
  const mk = inv(60.4, 63.2, t);
  const shrink = E.inOut(inv(67.6, 69.0, t));
  drawMachine(ctx, 190, 380, 1.18, mk, 1 - shrink);
  // The eyepiece view: the plate, blinking.
  const zoom = keys(t, [[60, 0.62], [67.6, 0.66], [69.6, 1.55], [73, 1.7]], E.inOut);
  const cx = lerp(1240, W / 2, shrink);
  const cy = H / 2 + 10;
  const R = lerp(370, 430, shrink);
  const side = drawEyepiece(ctx, t, D, cx, cy, R, zoom, E.sine(inv(60.6, 61.4, t)));
  // Labels in the eyepiece corner.
  const lab = E.sine(inv(61.2, 61.8, t)) * (1 - E.sine(inv(69.8, 70.4, t)));
  text(ctx, side === "jan23" ? "PLATE A · 23 JAN 1930" : "PLATE B · 29 JAN 1930", cx, cy + R + 44, { size: 22, family: F.type, color: "#f3e6cc", track: 4, alpha: lab });
  // The place and the date, typed.
  text(ctx, typed("LOWELL OBSERVATORY · FLAGSTAFF, ARIZONA", t, 60.25, 26), 120, 150, { size: 26, family: F.type, color: "#f3e6cc", align: "left", track: 3, alpha: 1 - shrink });
  text(ctx, typed("FEBRUARY 1930", t, 61.9, 20), 120, 196, { size: 26, family: F.type, color: "#f3e6cc", align: "left", track: 3, alpha: 1 - shrink });
  // The name, once the point has moved.
  const pl = env(t, 70.1, 73.6, 0.1, 0.5);
  if (pl > 0) {
    ctx.save();
    ctx.globalAlpha = 0.55 * pl;
    ctx.fillStyle = "#0d0a07";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    text(ctx, typed("PLUTO", t, 70.1, 9), W / 2, H / 2 - 20, { size: 150, family: F.type, color: "#f6ead2", track: 30, alpha: pl });
    text(ctx, "found by Clyde Tombaugh · 18 February 1930", W / 2, H / 2 + 92, { size: 34, family: F.serif, weight: 500, italic: true, color: "#e9dcc2", alpha: pl * E.out(inv(71.0, 71.8, t)) });
  }
  const note = env(t, 61.5, 73.6, 0.8, 0.5);
  text(ctx, "Reconstruction · a 1954 Palomar plate of the discovery field, with Pluto at JPL Horizons' positions for 23 and 29 January 1930", W / 2, H - 168, { size: 15, family: F.sans, weight: 500, color: "rgba(243,230,204,0.55)", alpha: note });
  archival(ctx, t, frame, 1);
  letterbox(ctx, 1);
  vignette(ctx, 0.75, 0.35);
  return 0.16;
}

// ---- Through the decades -------------------------------------------------------------------------
const TILE = 640;
function barnardTile(id) {
  return img(`/build/img/barnard/${id}.png`);
}
function drawDecades(ctx, t, D, frame) {
  const B = D.barnard;
  const order = ["poss1", "poss2", "2mass", "wise", "spherex"];
  const times = [73.6, 74.75, 75.9, 77.05, 78.2];
  const cx = W / 2 - 150;
  const cy = H / 2 + 8;
  const s = TILE / B.size;
  // The Pluto plate dissolves into the first Palomar plate of Barnard's Star.
  const fromPlate = 1 - E.inOut(inv(73.0, 74.0, t));
  ctx.fillStyle = "#05070d";
  ctx.fillRect(0, 0, W, H);
  // Negative (as plates are) turning positive, then colour arriving survey by survey.
  const neg = 1 - E.inOut(inv(74.2, 75.0, t));
  let idx = 0;
  for (let i = 0; i < times.length; i++) if (t >= times[i]) idx = i;
  const prev = Math.max(0, idx - 1);
  const mix = E.inOut(inv(times[idx], times[idx] + 0.45, t));
  const tints = { poss1: null, poss2: null, "2mass": "#ffb27a", wise: "#7fe6ff", spherex: "#c8d6ff" };
  const drawTile = (id, alpha) => {
    const im = barnardTile(id);
    if (!im || alpha <= 0) return;
    const [bc, bg] = buffer("btile", B.size, B.size);
    bg.drawImage(im, 0, 0);
    if (tints[id]) {
      bg.globalCompositeOperation = "color";
      bg.globalAlpha = 0.55;
      bg.fillStyle = tints[id];
      bg.fillRect(0, 0, B.size, B.size);
      bg.globalCompositeOperation = "destination-in";
      bg.globalAlpha = 1;
      bg.drawImage(im, 0, 0);
      bg.globalCompositeOperation = "destination-over";
      bg.fillStyle = "#000";
      bg.fillRect(0, 0, B.size, B.size);
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(bc, cx - TILE / 2, cy - TILE / 2, TILE, TILE);
    ctx.restore();
  };
  drawTile(order[prev], 1);
  if (idx !== prev) drawTile(order[idx], mix);
  if (neg > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "difference";
    ctx.globalAlpha = neg;
    ctx.fillStyle = "#fff";
    ctx.fillRect(cx - TILE / 2, cy - TILE / 2, TILE, TILE);
    ctx.restore();
  }
  if (fromPlate > 0) {
    // The last eyepiece view, still blinking, gives way to the first survey tile.
    ctx.save();
    ctx.globalAlpha = fromPlate;
    ctx.fillStyle = "#0d0a07";
    ctx.fillRect(0, 0, W, H);
    ctx.filter = `blur(${(1 - fromPlate) * 10}px)`;
    drawEyepiece(ctx, t, D, W / 2, H / 2 + 10, lerp(430, 470, 1 - fromPlate), 1.7, 1);
    ctx.restore();
  }
  // Where the catalogued motion puts the star, and the path it has taken.
  const ringA = E.sine(inv(74.0, 74.6, t));
  if (ringA > 0) {
    const pts = B.tiles.map((tl) => [cx - TILE / 2 + tl.xy[0] * s, cy - TILE / 2 + tl.xy[1] * s]);
    const cur = idx + (t >= times[idx] ? mix : 0) - (idx !== prev ? 1 : 0);
    const k = Math.min(cur, 4);
    const i0 = Math.floor(k);
    const f = k - i0;
    const p = i0 < 4 ? [lerp(pts[i0][0], pts[i0 + 1][0], f), lerp(pts[i0][1], pts[i0 + 1][1], f)] : pts[4];
    ctx.save();
    ctx.globalAlpha = ringA * 0.7;
    ctx.strokeStyle = C.accent;
    ctx.setLineDash([3, 7]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i <= i0; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.lineTo(p[0], p[1]);
    ctx.stroke();
    ctx.restore();
    ring(ctx, p[0], p[1], 22, { color: C.accent, width: 2.5, alpha: ringA, glow: 10 });
  }
  // The year, rolling forward.
  const years = [1930, 1950, 1991, 1999, 2010, 2026];
  const yt = [73.0, ...times];
  let year = 1930;
  for (let i = 1; i < years.length; i++) year = Math.round(lerp(year, years[i], E.inOut(inv(yt[i] - 0.4, yt[i] + 0.3, t))));
  const right = cx + TILE / 2 + 90;
  const lab = 1 - fromPlate;
  text(ctx, String(year), right, cy - 120, { size: 150, weight: 200, family: F.display, align: "left", color: C.ink, alpha: lab });
  const tile = B.tiles[idx];
  const names = { poss1: "PALOMAR PLATE · POSS-I", poss2: "PALOMAR PLATE · POSS-II", "2mass": "2MASS · NEAR-INFRARED", wise: "ALLWISE · MID-INFRARED", spherex: "SPHEREx" };
  const whenTxt = { poss1: "9 July 1950", poss2: "16 June 1991", "2mass": "1997–2001", wise: "2010–2011", spherex: "23 August 2026" };
  text(ctx, names[order[idx]], right + 4, cy + 4, { size: 20, weight: 600, family: F.mono, align: "left", track: 4, color: C.dim, alpha: lab });
  text(ctx, whenTxt[order[idx]], right + 4, cy + 44, { size: 28, weight: 400, family: F.sans, align: "left", color: C.ink, alpha: lab });
  text(ctx, "Barnard's Star · the same 24′ of sky in five surveys", right + 4, cy + 230, { size: 18, weight: 500, family: F.sans, align: "left", color: C.faint, alpha: E.sine(inv(74.4, 75.2, t)) });
  // The archival grade wears off as the decades pass.
  archival(ctx, t, frame, 1 - E.inOut(inv(73.8, 76.8, t)));
  letterbox(ctx, 1);
  vignette(ctx, 0.55, 0.4);
  return lerp(0.16, 0.05, E.inOut(inv(73.5, 77, t)));
}

// ---- SPHEREx → SPHEREx → SPHEREx, then the dataset -------------------------------------------------
// The stretch of the asteroid's path away from 36 Sextantis' glare: 21:32 on 1 Dec, then 03:58
// and 12:06 on 2 Dec. Median px.
const CROP = { x: 1080, y: 236, w: 678, h: 480 };
const IRIS_FRAMES = [0, 1, 5];
function irisTile(ctx, i, x, y, w, alpha, o = {}) {
  // The clean composite: the pass's median star field with this frame's own pixels at the asteroid.
  const im = img(`/build/img/iris/comp_${String(i).padStart(2, "0")}.png`);
  if (!im || alpha <= 0) return;
  const h = (w * CROP.h) / CROP.w;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.drawImage(im, CROP.x, CROP.y, CROP.w, CROP.h, x - w / 2, y - h / 2, w, h);
  ctx.strokeStyle = o.border ?? "rgba(255,255,255,0.14)";
  ctx.lineWidth = o.borderW ?? 1.5;
  ctx.strokeRect(x - w / 2, y - h / 2, w, h);
  ctx.restore();
  return h;
}
function irisXY(D, i, x, y, w) {
  const p = D.iris.frames[i].iris;
  const s = w / CROP.w;
  return [x - w / 2 + (p[0] - CROP.x) * s, y - (CROP.h * s) / 2 + (p[1] - CROP.y) * s];
}

function wallCam(t) {
  // Screen px per sheet px, from one big tile to the whole wall and beyond.
  return keys(t, [[84.0, 3.4], [89.5, 0.42], [95.35, 0.36], [97.2, 0.012], [104.8, 0.0042]], E.inOutExpo);
}
function drawWall(ctx, t, D, z, focusAlpha = 1, dim = 0) {
  const sheet = img("/build/img/sky/tiles_sheet.jpg");
  if (!sheet) return;
  const cols = 24;
  const tile = 192;
  const sw = sheet.width;
  const sh = sheet.height;
  // The wall repeats the real tiles in every direction; the asteroid's frame sits at its centre.
  const cx = W / 2;
  const cy = H / 2;
  const span = Math.max(W, H) / z;
  const reps = Math.ceil(span / Math.min(sw, sh)) + 3;
  ctx.save();
  ctx.imageSmoothingQuality = "low";
  ctx.translate(cx, cy);
  ctx.scale(z, z);
  ctx.translate(-tile / 2, -tile / 2);
  const ox = -Math.floor(cols / 2) * tile;
  const oy = -tile * 7;
  // Far away the wall turns into points of light: past a few hundred images, each is a dot.
  const wallA = clamp((z - 0.09) / (0.3 - 0.09));
  if (wallA <= 0) {
    // nothing: the dot field below takes over
  } else {
    ctx.filter = "brightness(1.7) contrast(1.08) saturate(1.15)";
    for (let ry = -reps; ry <= reps; ry++) {
      for (let rx = -reps; rx <= reps; rx++) {
        const x = ox + rx * sw;
        const y = oy + ry * sh;
        ctx.globalAlpha = (1 - dim) * wallA;
        ctx.drawImage(sheet, x, y);
      }
    }
    ctx.filter = "none";
    // Gaps between the images, so each reads as its own frame.
    if (z > 0.06) {
      ctx.strokeStyle = "rgba(4,6,12,0.9)";
      ctx.lineWidth = Math.min(10, 3 / z);
      const n = Math.ceil(span / tile) + 2;
      const gx = Math.floor((-span / 2) / tile) * tile;
      ctx.beginPath();
      for (let i = -n; i <= n; i++) {
        ctx.moveTo(i * tile, -span);
        ctx.lineTo(i * tile, span);
        ctx.moveTo(-span, i * tile);
        ctx.lineTo(span, i * tile);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
  if (wallA < 1) dotField(ctx, z, (1 - wallA) * (1 - dim));
  // The asteroid's frame, at the centre of everything, blinking.
  if (focusAlpha > 0 && z > 0.02) {
    const w = tile * z;
    const i = IRIS_FRAMES[Math.floor(t / 0.45) % 3];
    ctx.save();
    ctx.globalAlpha = focusAlpha;
    ctx.fillStyle = "#000";
    ctx.fillRect(cx - w / 2, cy - w / 2, w, w);
    const im = img(`/build/img/iris/comp_${String(i).padStart(2, "0")}.png`);
    if (im) ctx.drawImage(im, CROP.x + (CROP.w - CROP.h) / 2, CROP.y, CROP.h, CROP.h, cx - w / 2, cy - w / 2, w, w);
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = Math.max(1.5, 3 * Math.min(1, z));
    ctx.strokeRect(cx - w / 2, cy - w / 2, w, w);
    ctx.restore();
  }
}

/** A plane of points that recedes with the wall's zoom: more and more of them come into view. */
function dotField(ctx, z, alpha) {
  if (alpha <= 0) return;
  const r = rng(451);
  const k = z / 0.09; // about 1 when the field takes over, smaller as we pull away
  const extent = 52000; // wider than the screen even at the farthest zoom, so it never shows an edge
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = "#dbe6ff";
  for (let i = 0; i < 110000; i++) {
    const x = W / 2 + (r() - 0.5) * extent * k;
    const y = H / 2 + (r() - 0.5) * extent * k;
    const b = Math.pow(r(), 5);
    if (x < -4 || x > W + 4 || y < -4 || y > H + 4) continue;
    const s = 0.9 + b * 2.2;
    ctx.globalAlpha = alpha * (0.35 + 0.65 * b);
    ctx.fillRect(x, y, s, s);
  }
  ctx.restore();
}

function drawSpherex(ctx, t, D) {
  ctx.fillStyle = "#04060c";
  ctx.fillRect(0, 0, W, H);
  if (t < 84.0) {
    // Three real frames, a day apart: photograph, compare, look for what moved.
    const w = 540;
    const gather = E.inOut(inv(81.2, 82.2, t));
    IRIS_FRAMES.forEach((fi, j) => {
      const appear = E.out(inv(79.0 + j * 0.75, 79.6 + j * 0.75, t));
      const x0 = W / 2 + (j - 1) * (w + 40);
      const x = lerp(x0, W / 2, gather);
      const y = H / 2 - 10 + (1 - appear) * 40;
      const blinkOn = gather >= 1 ? IRIS_FRAMES[Math.floor((t - 82.2) / 0.42) % 3] === fi : true;
      if (!blinkOn) return;
      const ww = lerp(w, 820, gather);
      irisTile(ctx, fi, x, y, ww, appear);
      const lab = D.iris.frames[fi].isoMid;
      const label = `SPHEREx · ${lab.slice(8, 10)} Dec 2025 · ${lab.slice(11, 16)} UTC`;
      const hh = (ww * CROP.h) / CROP.w;
      text(ctx, label, x, y + hh / 2 + 34, { size: 19, weight: 500, family: F.mono, color: C.dim, alpha: appear * (gather >= 1 ? 1 : 1 - gather) });
      if (gather >= 1) {
        const [px, py] = irisXY(D, fi, x, y, ww);
        ring(ctx, px, py, 24, { color: C.accent, width: 2.5, glow: 10, alpha: E.out(inv(82.4, 82.9, t)) });
        text(ctx, label, x, y + hh / 2 + 34, { size: 19, weight: 500, family: F.mono, color: C.dim });
      }
    });
    const words = ["Photograph", "Compare", "Look for what moved"];
    words.forEach((wd, j) => {
      const a = env(t, 79.0 + j * 0.95, 82.4, 0.3, 0.4);
      text(ctx, wd, W / 2 + (j - 1) * 580, 190, { size: 30, weight: 300, family: F.display, alpha: a, color: C.ink });
    });
  } else {
    // The machinery is gone: the frame is one of a wall of SPHEREx images.
    const z = wallCam(t);
    const dim = E.inOut(inv(90.4, 91.2, t)) * (1 - E.inOut(inv(95.3, 95.6, t))) * 0.75;
    drawWall(ctx, t, D, z, 1, dim);
    if (t < 85.2) {
      // Hand over from the gathered frame.
      ctx.save();
      ctx.globalAlpha = 1 - E.sine(inv(84.0, 85.2, t));
      ctx.fillStyle = "#04060c";
      ctx.fillRect(0, 0, W, H);
      irisTile(ctx, IRIS_FRAMES[Math.floor((t - 82.2) / 0.42) % 3], W / 2, H / 2 - 10, 820, 1);
      ctx.restore();
    }
    // The scale, in numbers.
    const facts = [
      [96.6, "102", "colours"],
      [97.9, "×  the whole sky", ""],
      [99.2, "×  every six months", ""],
      [100.8, "450 million", "galaxies"],
      [102.3, "100 million", "stars in the Milky Way"],
    ];
    const fa = env(t, 96.4, 105.2, 0.3, 0.6);
    if (fa > 0) {
      ctx.save();
      ctx.globalAlpha = 0.45 * fa;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      facts.forEach(([ft, big, small], i) => {
        const a = fa * E.out(inv(ft, ft + 0.5, t));
        const y = H / 2 - 236 + i * 112;
        text(ctx, big, W / 2 + 10, y, { size: i >= 3 ? 82 : 66, weight: i >= 3 ? 600 : 300, family: F.display, align: "right", alpha: a });
        text(ctx, small, W / 2 + 36, y + 8, { size: 36, weight: 400, family: F.sans, align: "left", color: C.dim, alpha: a });
      });
      text(ctx, "Galaxy and star counts: NASA's expectations for the SPHEREx survey", W / 2, H - 170, { size: 15, weight: 500, family: F.sans, color: C.faint, alpha: fa * E.out(inv(101, 101.8, t)) });
    }
  }
  letterbox(ctx, 1);
  vignette(ctx, 0.5);
  return 0.05;
}

// ---- By hand ---------------------------------------------------------------------------------------
function drawByHand(ctx, t, D, frame) {
  ctx.fillStyle = "#04060c";
  ctx.fillRect(0, 0, W, H);
  const sheet = img("/build/img/sky/tiles_sheet.jpg");
  const handEnd = 111.6;
  const zoomOut = E.inOutExpo(inv(110.8, 115.2, t));
  if (sheet && t < 116.5) {
    // A person scrolling an archive of SPHEREx images, stopping to compare, scrolling on.
    const cell = 210;
    const gap = 14;
    const cols = 8;
    const scroll = keys(t, [[105, 0], [106.6, 2400], [107.4, 2550], [108.6, 2560], [109.4, 5200], [110.4, 5420], [116, 9000]], E.inOut);
    const z = loglerp(1, 0.035, zoomOut);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(z, z);
    const x0 = -(cols * (cell + gap)) / 2;
    const first = Math.floor((scroll - H / z) / (cell + gap)) - 2;
    const rows = Math.ceil((H / z) / (cell + gap)) + 5;
    for (let r = first; r < first + rows; r++) {
      for (let c = -Math.ceil(30 * zoomOut); c < cols + Math.ceil(30 * zoomOut); c++) {
        const id = ((r * 37 + c * 11) % 360 + 360) % 360;
        const sx = (id % 24) * 192;
        const sy = Math.floor(id / 24) * 192;
        const x = x0 + c * (cell + gap);
        const y = r * (cell + gap) - scroll;
        ctx.drawImage(sheet, sx, sy, 192, 192, x, y, cell, cell);
      }
    }
    ctx.restore();
    // The loupe: two images side by side, compared.
    const cmp = env(t, 107.3, 108.9, 0.25, 0.25);
    if (cmp > 0) {
      ctx.save();
      ctx.globalAlpha = cmp;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(0, 0, W, H);
      [0, 1].forEach((j) => {
        const id = 120 + j * 77;
        const sx = (id % 24) * 192;
        const sy = Math.floor(id / 24) * 192;
        const x = W / 2 - 430 + j * 450;
        ctx.drawImage(sheet, sx, sy, 192, 192, x, H / 2 - 210, 410, 410);
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.strokeRect(x, H / 2 - 210, 410, 410);
      });
      ctx.restore();
    }
    if (t < handEnd + 0.5) {
      const cx = keys(t, [[105, [1300, 700]], [106.4, [1180, 620]], [107.2, [760, 500]], [108.4, [1120, 560]], [109.2, [1400, 760]], [110.4, [900, 420]], [112, [1000, 520]]]);
      drawCursor(ctx, cx[0], cx[1], 1.3, t > 107.1 && t < 107.7 ? t - 107.1 : 99);
    }
    if (zoomOut > 0) {
      // Too many to look at: the wall dissolves into points of light.
      ctx.save();
      ctx.globalAlpha = E.sine(inv(112.2, 114.8, t));
      ctx.fillStyle = "#03050b";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }
  // Points, too many to count; one of them moves.
  const field = E.sine(inv(112.2, 114.8, t)) * (1 - E.inOut(inv(116.4, 117.6, t)));
  if (field > 0) {
    const r = rng(2026);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const n = 9000;
    const drift = (t - 112) * 6;
    for (let i = 0; i < n; i++) {
      const x = r() * W;
      const y = r() * H;
      const b = Math.pow(r(), 6);
      ctx.globalAlpha = field * (0.25 + 0.75 * b);
      const s = 1 + b * 2.5;
      ctx.fillStyle = "#dbe6ff";
      ctx.fillRect(x + drift * (x / W - 0.5) * 0.1, y, s, s);
    }
    ctx.restore();
  }
  // Only one point remains, and it has stopped.
  const dot = E.sine(inv(115.6, 116.8, t));
  if (dot > 0) {
    const jump = t < 117.0 ? (Math.floor((t - 112) / 0.55) % 2) * 14 : 0;
    glowDot(ctx, W / 2 + jump, H / 2, 46, "255,255,255", dot);
    ctx.save();
    ctx.globalAlpha = dot;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(W / 2 + jump, H / 2, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const name = env(t, 118.6, 120.0, 0.25, 0.01);
  if (name > 0) {
    text(ctx, "SPHEREx  EXPLORER", W / 2, H / 2 + 92, { size: 30, weight: 500, family: F.display, track: 20, alpha: name, glow: 18 });
  }
  letterbox(ctx, 1);
  vignette(ctx, 0.5);
  return 0.05;
}

export const q2 = [
  { a: 60, b: 73.0, draw: (ctx, t, D, f) => drawTombaugh(ctx, t, D, f) },
  { a: 73.0, b: 79.0, draw: (ctx, t, D, f) => drawDecades(ctx, t, D, f) },
  { a: 79.0, b: 105.0, draw: (ctx, t, D) => drawSpherex(ctx, t, D) },
  { a: 105.0, b: 120.0, draw: (ctx, t, D, f) => drawByHand(ctx, t, D, f) },
];

export function q2Cues() {
  const cues = [{ t: 60.0, kind: "projector", gain: 1, until: 73.4 }];
  for (const t of flipTimes()) cues.push({ t, kind: "clack", gain: t < 67.8 ? 0.8 : 1 });
  cues.push({ t: 68.6, kind: "ink", gain: 0.6 });
  cues.push({ t: 70.1, kind: "typewriter", gain: 0.9, n: 5, cps: 9 });
  for (const t of [60.25]) cues.push({ t, kind: "typewriter", gain: 0.6, n: 39, cps: 26 });
  cues.push({ t: 61.9, kind: "typewriter", gain: 0.6, n: 13, cps: 20 });
  for (const t of [73.6, 74.75, 75.9, 77.05, 78.2]) cues.push({ t, kind: "tick", gain: 0.7 });
  for (const t of [79.0, 79.75, 80.5]) cues.push({ t, kind: "shutter", gain: 0.7 });
  for (let t = 82.2; t < 84.4; t += 0.42) cues.push({ t, kind: "blip", gain: 0.45 });
  cues.push({ t: 84.0, kind: "whoosh-out", gain: 0.7 });
  cues.push({ t: 95.4, kind: "boom", gain: 1 });
  for (const t of [96.6, 97.9, 99.2, 100.8, 102.3]) cues.push({ t, kind: "data", gain: 0.5 });
  for (const t of [105.4, 106.0, 108.9, 109.6]) cues.push({ t, kind: "scroll", gain: 0.5 });
  cues.push({ t: 107.15, kind: "click", gain: 0.6 });
  cues.push({ t: 116.6, kind: "freeze", gain: 1 });
  cues.push({ t: 118.6, kind: "title-hit", gain: 0.8 });
  return cues;
}
