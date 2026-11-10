// The other cuts: the app demonstration (cuts/demo) and the 30-second film (cuts/short). Their pieces
// are the main film's own shots (source-timeline stretches, with the film's chapter labels off) and
// the scenes here: chapters of real app footage, and the title, NASA-data and end cards. Any piece
// can carry its own chapter title (`n`, `label` or `labels`) and caption (`captions`), drawn over it.
import { C, E, F, H, W, drawClip, env, inv, keys, phoneFrame, rrect, text, vignette, windowFrame } from "../core.js";
import { backdrop } from "./q3.js";

// The film's main window, so footage chapters and the film's own shots sit in the same place.
const WIN = { x: 210, y: 150, w: 1500, h: 844 };

const viewAt = (t, ks) => {
  const v = keys(t, ks.map(([tt, x, y, w]) => [tt, [x, y, w]]), E.inOut);
  return { x: v[0], y: v[1], w: v[2] };
};
const ctAt = (t, ks) => keys(t, ks, E.lin);

// ---- Chapters of app footage ---------------------------------------------------------------------
// clip: the capture; ct: [[chapter time, clip time], ...] (linear); view: [[t, x, y, w], ...] in the
// clip's CSS px (eased); phone: draw it in a phone instead of a window.
const CHAPTERS = {
  // The NASA challenge's five test targets on Explore, then Barnard's Star opening.
  targets: {
    clip: "targets",
    ct: [[0, 0.6], [11, 13.8]],
    view: [[0, 0, 0, 1600], [1.3, 0, 0, 1600], [2.1, 600, 230, 1000], [6.9, 600, 230, 1000], [7.7, 0, 0, 1600], [11, 0, 30, 1500]],
  },
  // Barnard's Star: SPHEREx frames centred on where it is now; the app's cross marks 2000.
  followed: {
    clip: "barnard",
    ct: [[0, -0.5], [7, 6.5]],
    view: [[0, 0, 60, 1600], [1.4, 150, 600, 900], [7, 170, 620, 860]],
  },
  // The brightness at the target for every frame of a pass, as the timeline plays (M31).
  brightness: {
    clip: "search",
    ct: [[0, 12.2], [6.5, 18.7]],
    view: [[0, 0, 200, 1250], [6.5, 0, 225, 1200]],
  },
  // NASA WISE: CatWISE2020's catalogued movers switched on over WISE 0855's field.
  catwise: {
    clip: "catwise",
    ct: [[0, -0.2], [8.5, 8.3]],
    view: [[0, 0, 60, 1600], [1.1, 0, 60, 1600], [2.3, 330, 470, 560], [8.5, 350, 480, 520]],
  },
  // Discover: what SPHEREx has seen change, from live data.
  discover: {
    clip: "discover",
    ct: [[0, 0.8], [5.5, 6.3]],
    view: [[0, 0, 0, 1600], [5.5, 60, 60, 1450]],
  },
  // On a phone, in Bangla.
  phone: {
    clip: "phone",
    phone: true,
    ct: [[0, 1.2], [5.5, 8.7]],
  },
};

function drawChapter(ctx, tl, D, frame, piece) {
  const ch = CHAPTERS[piece.chapter];
  const t = tl + (piece.from ?? 0);
  backdrop(ctx, 150);
  const clip = D.clips[ch.clip];
  if (!clip) return 0.03;
  const ct = ctAt(t, ch.ct);
  if (ch.phone) {
    const r = phoneFrame(ctx, W / 2, H / 2 - 10, 820);
    drawClip(ctx, clip, ct, r, { x: 0, y: 0, w: clip.w }, { radius: r.r, cursor: false });
    return 0.03;
  }
  windowFrame(ctx, WIN);
  drawClip(ctx, clip, ct, WIN, viewAt(t, ch.view), { radius: [0, 0, 18, 18] });
  return 0.03;
}

// ---- Cards ---------------------------------------------------------------------------------------
function wordmark(ctx, y, size, alpha) {
  const bold = "SPHEREx";
  const light = " Explorer";
  ctx.save();
  ctx.font = `700 ${size}px "${F.display}"`;
  const w1 = ctx.measureText(bold).width;
  ctx.font = `300 ${size}px "${F.display}"`;
  const w2 = ctx.measureText(light).width;
  ctx.restore();
  const x0 = W / 2 - (w1 + w2) / 2;
  text(ctx, bold, x0, y, { size, weight: 700, family: F.display, align: "left", alpha, glow: 24, glowColor: "rgba(140,170,255,0.45)" });
  text(ctx, light, x0 + w1, y, { size, weight: 300, family: F.display, align: "left", alpha, glow: 24, glowColor: "rgba(140,170,255,0.45)" });
}

/** The demo's title. */
function drawTitle(ctx, tl, D, frame, piece) {
  backdrop(ctx, 150);
  vignette(ctx, 0.35);
  const dur = piece.dur;
  const k = env(tl, 0, dur, 0.6, 0.4);
  ctx.save();
  ctx.translate(0, (1 - E.out(inv(0, 0.9, tl))) * 18);
  wordmark(ctx, H / 2 - 40, 120, k);
  ctx.restore();
  text(ctx, piece.subtitle ?? "What the web app does", W / 2, H / 2 + 60, { size: 40, weight: 400, family: F.display, color: C.accent2, alpha: k * E.out(inv(0.4, 1.1, tl)) });
  const team = D.config.team || "Team Oblivion · Bangladesh";
  text(ctx, `${team}  ·  ${D.config.event || "NASA Space Apps Challenge 2026"}`, W / 2, H / 2 + 150, { size: 22, weight: 600, family: F.mono, track: 3, color: C.dim, alpha: k * E.out(inv(0.8, 1.5, tl)) });
  return 0.04;
}

// The NASA data the app works from, and what each gives it.
const NASA = [
  ["SPHEREx", "Every image, its wavelength and time, and the spacecraft's position", "NASA/JPL-Caltech/IPAC · Quick Releases, via NASA/IPAC IRSA"],
  ["WISE & NEOWISE · CatWISE2020", "Known moving stars and brown dwarfs, placed on each frame's date", "NASA/IPAC IRSA"],
  ["NASA SkyView", "The same patch in visible and infrared light: DSS2, 2MASS, AllWISE", "HEASARC, NASA Goddard"],
  ["JPL Horizons & SBIdent", "Known asteroids and comets in each frame, and their orbits", "NASA Jet Propulsion Laboratory"],
];
function drawNasa(ctx, tl, D, frame, piece) {
  backdrop(ctx, 150);
  vignette(ctx, 0.4);
  const k = env(tl, 0, piece.dur, 0.4, 0.4);
  text(ctx, "NASA DATA IN SPHEREx EXPLORER", W / 2, 170, { size: 24, weight: 700, family: F.mono, track: 6, color: C.accent, alpha: k });
  NASA.forEach(([name, what, who], i) => {
    const a = 0.35 + i * 0.4;
    const kr = E.out(inv(a, a + 0.45, tl)) * k;
    if (kr <= 0) return;
    const y = 290 + i * 160;
    ctx.save();
    ctx.globalAlpha *= kr;
    ctx.translate(0, (1 - kr) * 16);
    rrect(ctx, 300, y - 58, W - 600, 128, 18);
    ctx.fillStyle = "rgba(20,28,60,0.72)";
    ctx.fill();
    ctx.strokeStyle = "rgba(160,185,255,0.18)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    text(ctx, name, 350, y - 14, { size: 36, weight: 600, family: F.display, align: "left" });
    text(ctx, what, 350, y + 32, { size: 24, weight: 400, family: F.sans, align: "left", color: C.dim });
    text(ctx, who, W - 350, y - 14, { size: 19, weight: 600, family: F.mono, align: "right", color: C.accent2 });
    ctx.restore();
  });
  const kf = E.out(inv(2.2, 2.8, tl)) * k;
  text(ctx, "Also: SIMBAD and Sesame (CDS, Strasbourg) · Digitized Sky Survey plates (STScI). Not affiliated with or endorsed by NASA.", W / 2, 950, { size: 20, family: F.sans, color: C.faint, alpha: kf });
  return 0.035;
}

/** The end card: the name, the line, where to find it, and (in the short film) the NASA data. */
function drawEnd(ctx, tl, D, frame, piece) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  const k = E.out(inv(0, 0.8, tl));
  ctx.save();
  ctx.translate(0, (1 - k) * 14);
  wordmark(ctx, H / 2 - 70, 116, k);
  ctx.restore();
  text(ctx, D.config.tagline || "Look closer. Discover what changed.", W / 2, H / 2 + 28, { size: 40, weight: 400, family: F.display, alpha: E.out(inv(0.4, 1.1, tl)) });
  const k2 = E.out(inv(0.8, 1.4, tl));
  text(ctx, "spherex-explorer.vercel.app", W / 2, H / 2 + 102, { size: 26, weight: 600, family: F.mono, track: 1, color: C.accent, alpha: k2 });
  text(ctx, D.config.team || "Team Oblivion · Bangladesh", W / 2, H / 2 + 160, { size: 26, weight: 600, family: F.sans, color: C.ink, alpha: k2 });
  text(ctx, D.config.event || "NASA Space Apps Challenge 2026", W / 2, H / 2 + 198, { size: 22, family: F.sans, color: C.dim, alpha: k2 });
  if (piece.credits) {
    const k3 = E.out(inv(1.2, 1.8, tl));
    text(ctx, "NASA data: SPHEREx (NASA/JPL-Caltech/IPAC, via IRSA) · WISE/NEOWISE CatWISE2020 (IRSA) · NASA SkyView (Goddard) · JPL Horizons & SBIdent", W / 2, H - 70, { size: 19, family: F.sans, color: C.dim, alpha: k3 });
  }
  return 0.04;
}

export const tourScenes = { chapter: drawChapter, title: drawTitle, nasa: drawNasa, end: drawEnd };

// ---- Chapter titles and captions over any piece ----------------------------------------------------------
function current(list, t) {
  let cur = null;
  for (const item of list) if (t >= item[0]) cur = item;
  return cur;
}

export function drawOverlay(ctx, piece, tl, D) {
  if (!D.cut) return;
  const dur = piece.dur;
  // Chapter title, top left, in the film's step-label style.
  const labels = piece.labels ?? (piece.label ? [[0, piece.label]] : []);
  const lab = current(labels, tl);
  if (lab) {
    const next = labels.find((l) => l[0] > lab[0]);
    const k = env(tl, lab[0], next ? next[0] : dur, 0.3, next ? 0.2 : 0.3);
    const n = lab[2] ?? piece.n; // a label can carry its own number
    if (n != null) text(ctx, String(n).padStart(2, "0"), 70, 64, { size: 20, weight: 700, family: F.mono, align: "left", color: C.accent, alpha: k });
    const bangla = /[ঀ-৿]/.test(lab[1]);
    text(ctx, lab[1], n != null ? 112 : 70, 64, { size: bangla ? 22 : 20, weight: 600, family: bangla ? F.bangla : F.mono, align: "left", track: bangla ? 1 : 4, color: C.ink, alpha: k });
  }
  // Caption under the window.
  const caps = piece.captions ?? [];
  const cap = current(caps, tl);
  if (cap) {
    const next = caps.find((c) => c[0] > cap[0]);
    const k = env(tl, cap[0], next ? next[0] : dur, 0.3, 0.25);
    text(ctx, cap[1], W / 2, 1038, { size: 28, weight: 500, family: F.sans, color: "rgba(236,240,255,0.94)", alpha: k, glow: 10, glowColor: "rgba(0,0,0,0.9)" });
  }
}

// ---- Sound cues on a piece's own clock (film.js places them) ----------------------------------------------
export function tourCues(piece, D) {
  const out = [];
  if (piece.scene === "where") out.push({ t: 0, kind: "swish", gain: 0.45 });
  if (piece.scene === "nasa") NASA.forEach((_, i) => out.push({ t: 0.35 + i * 0.4, kind: "tick", gain: 0.5 }));
  if (piece.scene !== "chapter") return out;
  out.push({ t: 0, kind: "swish", gain: 0.45 });
  const ch = CHAPTERS[piece.chapter];
  const clip = D.clips[ch.clip];
  if (!clip) return out;
  const from = piece.from ?? 0;
  for (let t = 0; t < piece.dur; t += 1 / 30) {
    const c0 = ctAt(t + from, ch.ct);
    const c1 = ctAt(t + from + 1 / 30, ch.ct);
    for (const e of clip.m.events) {
      if (e.t >= c0 && e.t < c1) {
        if (e.type === "down") out.push({ t, kind: "click", gain: 0.7 });
        if (e.type === "key") out.push({ t, kind: "key", gain: 0.35 });
      }
    }
  }
  return out;
}

