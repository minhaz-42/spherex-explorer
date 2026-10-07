// New material on the finished film's clock (see edit.json): the opening title, the team, and the
// NASA Space Apps logo that then stays in the corner, as a broadcaster's does.
import { C, E, F, H, W, buffer, clamp, env, img, inv, lerp, letterbox, measure, text, vignette } from "../core.js";
import { drawSky } from "../sky.js";
import { darkFieldCam } from "./q1.js";

const OPEN_LOGO = "/brand/space-apps-logo.png";
const TEAM = "/brand/team.png";
const BUG_ALPHA = 0.6;
export const OPENING_END = 4.4;

// ---- The corner logo -------------------------------------------------------------------------
function cornerLogo(D) {
  return img(`/${D.config.cornerLogo || "brand/space-apps-logo.png"}`);
}
/** Top right, inside the letterbox bar. A long logo sits smaller, at the same centre line. */
function bugRect(im) {
  const aspect = im ? im.width / im.height : 1;
  const h = aspect > 1.8 ? 54 : 92;
  const w = h * aspect;
  return { x: W - 40 - w, y: 66 - h / 2, w, h };
}

export function drawBug(ctx, T, D, duration) {
  if (T < OPENING_END) return;
  const im = cornerLogo(D);
  const a = BUG_ALPHA * (1 - E.sine(inv(duration - 0.9, duration, T)));
  if (!im || a <= 0) return;
  const r = bugRect(im);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.drawImage(im, r.x, r.y, r.w, r.h);
  ctx.restore();
}

// ---- The opening: the logo, who presents, and the logo into the corner -----------------------
const LOGO = 480; // its size while centred

/** The logo with a band of light passing across it, only where the logo is. */
function sheen(im, k) {
  const [c, g] = buffer("openingLogo", LOGO, LOGO);
  g.drawImage(im, 0, 0, LOGO, LOGO);
  if (k > 0 && k < 1) {
    const x = lerp(-0.5, 1.5, k) * LOGO;
    const dx = Math.cos(0.35) * LOGO * 0.28;
    const dy = Math.sin(0.35) * LOGO * 0.28;
    const gr = g.createLinearGradient(x - dx, LOGO / 2 - dy, x + dx, LOGO / 2 + dy);
    gr.addColorStop(0, "rgba(255,255,255,0)");
    gr.addColorStop(0.5, "rgba(255,255,255,0.7)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = gr;
    g.fillRect(0, 0, LOGO, LOGO);
  }
  return c;
}

export function drawOpening(ctx, T, D) {
  const im = img(OPEN_LOGO);
  const bugIm = cornerLogo(D);
  if (!im) return;
  const appear = E.out(inv(0.35, 1.7, T));
  const dock = E.inOut(inv(3.3, OPENING_END, T));
  // A faint cool light behind the logo while it is centred.
  const glow = appear * (1 - dock);
  if (glow > 0) {
    const g = ctx.createRadialGradient(W / 2, H / 2 - 40, 0, W / 2, H / 2 - 40, 560);
    g.addColorStop(0, `rgba(90,120,210,${0.11 * glow})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  // Out of focus to sharp, a slow breath, then a glide into the corner. A different corner logo
  // (config.json `cornerLogo`) takes over during the glide.
  const r = bugRect(bugIm);
  const breathe = lerp(0.94, 1, appear) * lerp(1, 1.02, E.sine(inv(1.7, 3.3, T)));
  const cx = lerp(W / 2, r.x + r.w / 2, dock);
  const cy = lerp(H / 2 - 40, r.y + r.h / 2, dock);
  const size = lerp(LOGO * breathe, r.h, dock);
  const swap = !bugIm || bugIm === im ? 0 : E.sine(inv(0.55, 1, dock));
  const alpha = appear * lerp(1, BUG_ALPHA, dock);
  const blur = (1 - E.out(inv(0.35, 1.5, T))) * 18;
  ctx.save();
  ctx.globalAlpha = alpha * (1 - swap);
  if (blur > 0.05) ctx.filter = `blur(${blur}px)`;
  ctx.drawImage(sheen(im, inv(1.25, 2.35, T)), cx - size / 2, cy - size / 2, size, size);
  ctx.restore();
  if (swap > 0) {
    const w = lerp(size, r.w, swap);
    ctx.save();
    ctx.globalAlpha = alpha * swap;
    ctx.drawImage(bugIm, cx - w / 2, cy - r.h / 2, w, r.h);
    ctx.restore();
  }
  // Who presents: the letters close up as they arrive.
  const [strong, light] = (D.config.presents || ["Team Oblivion", "presents"]).map((s) => s.toUpperCase());
  const lin = E.out(inv(1.65, 2.8, T));
  const la = lin * (1 - E.sine(inv(2.95, 3.45, T)));
  if (la > 0) {
    const track = lerp(22, 11, E.out(inv(1.65, 3.3, T)));
    const o1 = { size: 26, weight: 600, family: F.display, track };
    const o2 = { size: 26, weight: 300, family: F.display, track };
    const gap = 16;
    const w1 = measure(ctx, strong, o1);
    const w2 = measure(ctx, light, o2);
    const x0 = W / 2 - (w1 + gap + w2 - track) / 2;
    const y = H / 2 - 40 + LOGO / 2 + 30;
    ctx.save();
    if (lin < 1) ctx.filter = `blur(${(1 - lin) * 6}px)`;
    text(ctx, strong, x0, y, { ...o1, align: "left", alpha: la });
    text(ctx, light, x0 + w1 + gap, y, { ...o2, align: "left", color: C.dim, alpha: la });
    ctx.restore();
  }
}

// ---- The team: out of the dark field; then each of them in turn, right to left, close ----------
// Each card is timed by its narration line (config.json `line`, placed in build/vo/lines.json).
const SCALE = 1.24; // the group shot: screen pixels per photo pixel
const CLOSE = 2.3; // each person, close
const HEAD_TOP = 273; // the tallest head in brand/team.png, in photo pixels
const EXIT = 1.3; // the pull back to the group and the dissolve, at the end

/** The group: the photo's right edge just past the frame, the tallest head under the bar. */
function groupView(t, im, dur) {
  const zoom = lerp(1, 1.035, E.sine(clamp(t / dur)));
  const ox0 = W + 8 - im.width * SCALE;
  const oy0 = 175 - HEAD_TOP * SCALE;
  return { ox: W / 2 + (ox0 - W / 2) * zoom, oy: H / 2 + (oy0 - H / 2) * zoom, s: SCALE * zoom };
}

/** Close on one person: the face on the right third, the head under the bar, a slow push in. The
 *  first stands at the photo's cut edge, so the face sits further right to keep the edge out. */
function closeView(m, i, push, im) {
  const s = CLOSE * (1 + 0.015 * push);
  const X = i === 0 ? Math.max(1330, W + 12 - (im.width - m.x) * s) : 1330;
  return { ox: X - m.x * s, oy: 205 - m.top * s, s };
}

const mix = (a, b, k) => ({ ox: lerp(a.ox, b.ox, k), oy: lerp(a.oy, b.oy, k), s: lerp(a.s, b.s, k) });

function teamTimes(D, piece, members) {
  const lines = Object.fromEntries((D.lines || []).map((l) => [l.id, l]));
  const exit = piece.dur - EXIT;
  const starts = members.map((m, i) => (lines[m.line] ? lines[m.line].at - piece.at : 2.8 + (i * (exit - 2.8)) / members.length));
  // The camera arrives on each person just as their line begins.
  const glide = (i) => (i === 0 ? [starts[0] - 0.8, starts[0] + 0.1] : [starts[i] - 0.45, starts[i] + 0.15]);
  return { starts, exit, glide, dur: piece.dur };
}

/** Where the camera is, and which of them is in the light (a fractional index while it moves). */
function cameraAt(t, im, members, T) {
  const n = members.length;
  const g = groupView(t, im, T.dur);
  const holdEnd = (i) => (i + 1 < n ? T.glide(i + 1)[0] : T.exit);
  const push = (i) => clamp((t - T.glide(i)[0]) / (holdEnd(i) - T.glide(i)[0]));
  if (t < T.glide(0)[0]) return { view: g, at: 0 };
  if (t >= T.exit) return { view: mix(closeView(members[n - 1], n - 1, 1, im), g, E.inOut(inv(T.exit, T.exit + 0.75, t))), at: n - 1 };
  let i = n - 1;
  while (i > 0 && t < T.glide(i)[0]) i--;
  const k = E.inOut(inv(...T.glide(i), t));
  const from = i === 0 ? g : closeView(members[i - 1], i - 1, 1, im);
  return { view: mix(from, closeView(members[i], i, push(i), im), k), at: i === 0 ? 0 : i - 1 + k };
}

/** The lit stretch of the photo (photo pixels): halfway to each neighbour. */
function bandOf(members, width, at) {
  const band = (i) => [
    i === members.length - 1 ? -400 : (members[i].x + members[i + 1].x) / 2,
    i === 0 ? width + 400 : (members[i].x + members[i - 1].x) / 2,
  ];
  const i = Math.floor(at);
  const [a, b] = [band(i), band(Math.min(i + 1, members.length - 1))];
  return [lerp(a[0], b[0], at - i), lerp(a[1], b[1], at - i)];
}

/** Text in lines no wider than maxW. */
function wrapped(ctx, s, x, y, maxW, lh, o) {
  const words = s.split(" ");
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (line && measure(ctx, next, o) > maxW) {
      text(ctx, line, x, y, o);
      y += lh;
      line = w;
    } else line = next;
  }
  text(ctx, line, x, y, o);
}

/** One person's card, left of them: number, name, role, what they did. */
function card(ctx, m, i, n, t, a0, b0) {
  const kin = E.out(inv(a0, a0 + 0.5, t));
  const kout = E.sine(inv(b0 - 0.28, b0, t));
  const a = kin * (1 - kout);
  if (a <= 0) return;
  const x0 = 150;
  ctx.save();
  ctx.globalAlpha = a * 0.7;
  ctx.fillStyle = C.accent;
  const h = 300 * E.out(inv(a0, a0 + 0.6, t));
  ctx.fillRect(x0 - 34, 376, 2, h);
  ctx.restore();
  text(ctx, String(i + 1).padStart(2, "0"), x0, 396, { size: 18, weight: 600, family: F.mono, color: C.accent, align: "left", track: 2, alpha: a });
  text(ctx, `/ ${String(n).padStart(2, "0")}`, x0 + 38, 396, { size: 18, weight: 500, family: F.mono, color: C.faint, align: "left", track: 2, alpha: a });
  const nameO = { size: 76, weight: 600, family: F.display, track: -0.5 };
  const w = measure(ctx, m.name, nameO);
  if (w > 820) nameO.size = Math.floor((nameO.size * 820) / w);
  ctx.save();
  if (kin < 1 || kout > 0) ctx.filter = `blur(${(1 - kin) * 6 + kout * 4}px)`;
  text(ctx, m.name, x0 - (1 - kin) * 36, 470, { ...nameO, align: "left", alpha: a, glow: 18, glowColor: "rgba(120,160,255,0.35)" });
  ctx.restore();
  const kr = E.out(inv(a0 + 0.12, a0 + 0.6, t));
  text(ctx, m.role.toUpperCase(), x0, 540, { size: 20, weight: 600, family: F.mono, color: C.accent, align: "left", track: lerp(10, 6, kr), alpha: kr * (1 - kout) });
  const kd = E.out(inv(a0 + 0.25, a0 + 0.75, t));
  if (m.did) wrapped(ctx, m.did, x0, 600, 660, 42, { size: 29, weight: 400, family: F.sans, color: C.dim, align: "left", alpha: kd * (1 - kout) });
}

export function drawTeam(ctx, t, D, frame, piece) {
  const im = img(TEAM);
  const cfg = D.config;
  const members = cfg.members || [];
  const n = members.length;
  const T = teamTimes(D, piece, members);
  // The dark field the montage came back to, settling exactly where the next shot begins.
  const cam0 = darkFieldCam(44.8);
  const sky = { u: cam0.u, v: cam0.v, mpx: cam0.mpx * lerp(1.12, 1, E.sine(clamp(t / T.dur))) };
  const out = E.sine(inv(T.dur - 0.55, T.dur, t)); // the group gives way to the stars
  ctx.save();
  ctx.globalAlpha = lerp(0.5, 1, out);
  drawSky(ctx, sky, { frame: null });
  ctx.restore();
  // Close: one in the light, the rest in shadow and out of focus; at the last, all of them.
  const close = n ? E.sine(inv(...T.glide(0), t)) * (1 - E.sine(inv(T.exit, T.exit + 0.6, t))) : 0;
  const all = E.sine(inv(T.exit + 0.3, T.exit + 0.75, t));
  if (im && n) {
    const { view: P, at } = cameraAt(t, im, members, T);
    const dw = im.width * P.s;
    const dh = im.height * P.s;
    const rise = E.out(inv(0, 1.3, t));
    const reveal = rise * (1 - out);
    if (reveal > 0) {
      ctx.save();
      ctx.globalAlpha = reveal;
      ctx.filter = `brightness(${lerp(0.12, lerp(0.42, 0.3, close), rise)}) saturate(0.55) blur(${lerp(8, lerp(1.2, 2.6, close), rise)}px)`;
      ctx.drawImage(im, P.ox, P.oy, dw, dh);
      ctx.restore();
    }
    const lit = Math.max(close, all) * (1 - out);
    if (lit > 0) {
      const [c, g] = buffer("teamLit");
      g.filter = "contrast(1.05)";
      g.drawImage(im, P.ox, P.oy, dw, dh);
      g.filter = "none";
      if (all < 1) {
        const [l, r] = bandOf(members, im.width, at);
        const xl = P.ox + l * P.s;
        const xr = P.ox + r * P.s;
        const f = 46 * P.s;
        const gr = g.createLinearGradient(0, 0, W, 0);
        gr.addColorStop(clamp((xl - f) / W), `rgba(0,0,0,${all})`);
        gr.addColorStop(clamp((xl + f) / W), "rgba(0,0,0,1)");
        gr.addColorStop(clamp((xr - f) / W), "rgba(0,0,0,1)");
        gr.addColorStop(clamp((xr + f) / W), `rgba(0,0,0,${all})`);
        g.globalCompositeOperation = "destination-in";
        g.fillStyle = gr;
        g.fillRect(0, 0, W, H);
      }
      ctx.save();
      ctx.globalAlpha = lit;
      ctx.drawImage(c, 0, 0);
      ctx.restore();
    }
    // Shade on the left for the words.
    const shade = close * (1 - all);
    if (shade > 0) {
      const gr = ctx.createLinearGradient(0, 0, 1120, 0);
      gr.addColorStop(0, `rgba(0,0,0,${0.88 * shade})`);
      gr.addColorStop(0.6, `rgba(0,0,0,${0.6 * shade})`);
      gr.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, 1120, H);
    }
  }
  vignette(ctx, 0.6);
  letterbox(ctx, E.inOut(inv(0, 0.6, t)));
  // The team's name in the top bar, the whole time.
  const kick = env(t, 0.5, T.dur - 0.3, 0.7, 0.5);
  if (kick > 0) text(ctx, (cfg.team || "").toUpperCase(), W / 2, 66, { size: 17, weight: 600, family: F.mono, track: 8, color: C.dim, alpha: kick });
  members.forEach((m, i) => card(ctx, m, i, n, t, T.starts[i] - 0.3, i + 1 < n ? T.glide(i + 1)[0] + 0.05 : T.exit + 0.1));
  return 0.06;
}
