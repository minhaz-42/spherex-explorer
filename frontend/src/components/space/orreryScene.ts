/**
 * Draws the pencil orrery: the Sun, the planets, the main belt and (7) Iris, seen from above the
 * ecliptic at an angle. Distances are compressed so every orbit fits; sizes are exaggerated.
 */
import { BODIES, BODY_ORDER, type SelectableId } from "./bodies";
import { displayRadius, ELEMENTS, heliocentric, type HelioPosition, orbitPath, VIEWS } from "./orbits";
import { graphite, hatchDisc, jitter, type Rand, seeded, shadeDisc, sketchCircle, sketchPath } from "./sketch";

export interface Camera {
  /** Rotation about the ecliptic pole and the viewing angle above the ecliptic (radians). */
  yaw: number;
  elev: number;
  /** 0 = inner planets fill the view, 1 = the whole system fills it. */
  mix: number;
}

export interface Hit {
  id: SelectableId;
  x: number;
  y: number;
  r: number;
}

interface BeltRock {
  a: number;
  lon0: number;
  rate: number;
  z: number;
  size: number;
  alpha: number;
}

export interface Scene {
  jd0: number;
  orbits: Record<string, HelioPosition[]>;
  belt: BeltRock[];
  irisShape: number[];
}

const DEG = Math.PI / 180;
const ACCENT = "#b93d12";
const EARTH_RATE = 0.98560028; // degrees per day

export function createScene(jd: number, beltCount = 420): Scene {
  const rand = seeded(7);
  const orbits: Record<string, HelioPosition[]> = {};
  for (const id of BODY_ORDER) orbits[id] = orbitPath(ELEMENTS[id], jd, 160);
  const belt: BeltRock[] = [];
  for (let k = 0; k < beltCount; k++) {
    const a = 2.15 + Math.pow(rand(), 0.8) * 1.15;
    belt.push({
      a,
      lon0: rand() * 360,
      rate: EARTH_RATE * Math.pow(a, -1.5),
      z: jitter(rand, 0.09) * a,
      size: 0.7 + rand() * 0.9,
      alpha: 0.25 + rand() * 0.4,
    });
  }
  const irisShape = Array.from({ length: 9 }, () => 0.75 + rand() * 0.45);
  return { jd0: jd, orbits, belt, irisShape };
}

interface Frame {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  cam: Camera;
  cx: number;
  cy: number;
  edge: number;
  unit: number;
}

function project(f: Frame, p: { x: number; y: number; z: number; r: number }) {
  const rd = lerp(displayRadius(p.r, VIEWS.inner, f.edge), displayRadius(p.r, VIEWS.whole, f.edge), f.cam.mix);
  const s = p.r > 0 ? rd / p.r : 0;
  const x = p.x * s;
  const y = p.y * s;
  const z = p.z * s;
  const cy = Math.cos(f.cam.yaw);
  const sy = Math.sin(f.cam.yaw);
  const xr = x * cy - y * sy;
  const yr = x * sy + y * cy;
  const se = Math.sin(f.cam.elev);
  const ce = Math.cos(f.cam.elev);
  return {
    x: f.cx + xr,
    y: f.cy + yr * se - z * ce,
    depth: yr * ce + z * se,
    rd,
    // Outer bodies fade out as the inner view zooms past them.
    fade: clamp((1.32 * f.edge - rd) / (0.3 * f.edge), 0, 1),
  };
}

export interface DrawOptions {
  jd: number;
  /** Seconds since the animation started, for the satellite and the Sun's rays. */
  t: number;
  /** Changes a few times a second to make pencil lines boil; fixed when motion is reduced. */
  boil: number;
  selected: SelectableId | null;
  hovered: SelectableId | null;
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  width: number,
  height: number,
  cam: Camera,
  opt: DrawOptions,
): Hit[] {
  const se = Math.max(Math.sin(cam.elev), 0.2);
  const edge = Math.max(40, Math.min(width / 2 - 18, (height / 2 - 26) / se));
  const f: Frame = {
    ctx,
    width,
    height,
    cam,
    cx: width / 2,
    cy: height / 2 + 6,
    edge,
    unit: clamp(edge / 300, 0.72, 1.35),
  };
  ctx.clearRect(0, 0, width, height);

  const sun = { x: f.cx, y: f.cy };
  const sunR = BODIES.sun.size * f.unit;

  // A warm smudge of colour around the Sun.
  const glow = ctx.createRadialGradient(sun.x, sun.y, sunR * 0.6, sun.x, sun.y, sunR * 3.2);
  glow.addColorStop(0, "rgba(255, 196, 90, 0.34)");
  glow.addColorStop(1, "rgba(255, 196, 90, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(sun.x - sunR * 3.2, sun.y - sunR * 3.2, sunR * 6.4, sunR * 6.4);

  // Orbits: fixed seeds, so they stay put while the planets move along them.
  BODY_ORDER.forEach((id, k) => {
    const path = scene.orbits[id];
    if (!path) return;
    const pts = path.map((p) => project(f, p));
    const fade = Math.min(...pts.map((p) => p.fade));
    if (fade <= 0.02) return;
    const isSel = opt.selected === id;
    const color = isSel ? `rgba(185, 61, 18, ${0.75 * fade})` : graphite((id === "iris" ? 0.22 : 0.3) * fade);
    sketchPath(ctx, pts, seeded(100 + k), { amount: 0.5, color, width: isSel ? 1.4 : 1, closed: true });
    sketchPath(ctx, pts, seeded(200 + k), { amount: 1.1, color: graphite(0.1 * fade), width: 0.8, closed: true });
  });

  // The main belt: graphite specks on circular orbits.
  const days = opt.jd - scene.jd0;
  ctx.fillStyle = graphite(1);
  for (const rock of scene.belt) {
    const lon = (rock.lon0 + rock.rate * days) * DEG;
    const p = project(f, { x: rock.a * Math.cos(lon), y: rock.a * Math.sin(lon), z: rock.z, r: rock.a });
    if (p.fade <= 0) continue;
    ctx.globalAlpha = rock.alpha * p.fade;
    const s = rock.size * f.unit;
    ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
  }
  ctx.globalAlpha = 1;

  type Item = { id: SelectableId; x: number; y: number; depth: number; r: number; fade: number; pos?: HelioPosition };
  const items: Item[] = [{ id: "sun", x: sun.x, y: sun.y, depth: 0, r: sunR, fade: 1 }];
  for (const id of BODY_ORDER) {
    const pos = heliocentric(ELEMENTS[id], opt.jd);
    const p = project(f, pos);
    if (p.fade <= 0.02) continue;
    const persp = clamp(1 + p.depth / (edge * 5), 0.85, 1.15);
    const grow = opt.hovered === id ? 1.18 : 1;
    items.push({ id, x: p.x, y: p.y, depth: p.depth, r: BODIES[id].size * f.unit * persp * grow, fade: p.fade, pos });
  }
  items.sort((a, b) => a.depth - b.depth);

  for (const item of items) {
    const rand = seeded(opt.boil * 31 + item.id.length * 977 + Math.round(item.r * 10));
    ctx.globalAlpha = item.fade;
    if (item.id === "sun") drawSun(ctx, item.x, item.y, item.r, opt.t, rand);
    else drawBody(f, item.id, item.x, item.y, item.r, sun, scene, opt, rand);
    ctx.globalAlpha = 1;
  }

  // Labels and the selection ring go on top of everything.
  for (const item of items) {
    const rand = seeded(opt.boil * 17 + item.id.length * 131);
    const isSel = opt.selected === item.id;
    if (isSel) {
      sketchCircle(ctx, item.x, item.y, item.r + 6 * f.unit, rand, { color: ACCENT, width: 1.6, wobble: 0.12 });
    }
    if (shouldLabel(item.id, cam.mix, isSel, opt.hovered === item.id)) {
      drawLabel(ctx, item.id, item.x, item.y, item.r, f.unit, item.fade, isSel);
    }
  }

  return items.filter((i) => i.fade > 0.3).map(({ id, x, y, r }) => ({ id, x, y, r }));
}

function shouldLabel(id: SelectableId, mix: number, selected: boolean, hovered: boolean): boolean {
  if (selected || hovered || id === "earth") return true;
  if (id === "sun") return false;
  const inner = ["mercury", "venus", "mars", "iris"].includes(id);
  return inner ? mix < 0.5 : mix >= 0.5;
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  id: SelectableId,
  x: number,
  y: number,
  r: number,
  unit: number,
  fade: number,
  selected: boolean,
): void {
  const name = id === "earth" ? "Earth + SPHEREx" : BODIES[id].name;
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.font = `600 ${Math.round(17 * unit)}px "Caveat Variable", Caveat, cursive`;
  ctx.fillStyle = selected || id === "iris" ? ACCENT : graphite(0.9);
  ctx.textBaseline = "alphabetic";
  const lx = x + r + 6 * unit;
  const ly = y - r - 2 * unit;
  ctx.fillText(name, lx, ly);
  ctx.restore();
}

function drawSun(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, rand: Rand): void {
  // Rays: short pencil strokes that turn slowly.
  ctx.save();
  ctx.strokeStyle = "rgba(232, 89, 12, 0.75)";
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  ctx.beginPath();
  const rays = 14;
  for (let k = 0; k < rays; k++) {
    const a = (k / rays) * Math.PI * 2 + t * 0.12;
    const r1 = r * (1.28 + jitter(rand, 0.05));
    const r2 = r * (k % 2 ? 1.62 : 1.9) * (1 + jitter(rand, 0.06));
    ctx.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
    ctx.lineTo(x + Math.cos(a + jitter(rand, 0.04)) * r2, y + Math.sin(a + jitter(rand, 0.04)) * r2);
  }
  ctx.stroke();
  ctx.restore();

  hatchDisc(ctx, x, y, r, rand, { color: "#f59f00", angle: -0.75, spacing: 1.8, width: 1.1, alpha: 0.95 });
  hatchDisc(ctx, x, y, r, rand, { color: "#e8590c", angle: 0.55, spacing: 3.1, width: 0.9, alpha: 0.55 });
  sketchCircle(ctx, x, y, r, rand, { color: graphite(0.8), width: 1.3 });
}

function drawBody(
  f: Frame,
  id: Exclude<SelectableId, "sun">,
  x: number,
  y: number,
  r: number,
  sun: { x: number; y: number },
  scene: Scene,
  opt: DrawOptions,
  rand: Rand,
): void {
  const { ctx } = f;
  const style = BODIES[id];
  const light = Math.atan2(sun.y - y, sun.x - x);
  const spacing = Math.max(1.5, r / 4.2);

  if (id === "saturn") drawRings(f, x, y, r, rand, "back");

  if (id === "iris") {
    // A lumpy rock rather than a disc.
    const pts = scene.irisShape.map((k, i) => {
      const a = (i / scene.irisShape.length) * Math.PI * 2;
      return { x: x + Math.cos(a) * r * k, y: y + Math.sin(a) * r * k };
    });
    ctx.save();
    ctx.fillStyle = "rgba(122, 106, 85, 0.55)";
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    sketchPath(ctx, pts, rand, { amount: 0.3, color: graphite(0.85), width: 1, closed: true });
    return;
  }

  hatchDisc(ctx, x, y, r, rand, { color: style.color, angle: -0.8, spacing, width: 1, alpha: 0.95 });
  hatchDisc(ctx, x, y, r, rand, { color: style.color, angle: 0.55, spacing: spacing * 1.35, width: 0.9, alpha: 0.5 });

  if (style.detail && (id === "jupiter" || id === "saturn")) {
    // Cloud belts: a few loose horizontal strokes.
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = style.detail;
    ctx.lineWidth = Math.max(1, r / 7);
    ctx.globalAlpha = 0.7;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (const k of [-0.5, -0.18, 0.2, 0.52]) {
      ctx.moveTo(x - r * 1.1, y + r * k + jitter(rand, 0.6));
      ctx.quadraticCurveTo(x, y + r * (k + 0.06) + jitter(rand, 0.8), x + r * 1.1, y + r * k + jitter(rand, 0.6));
    }
    ctx.stroke();
    ctx.restore();
  }

  if (id === "earth" && style.detail) {
    hatchDisc(ctx, x - r * 0.28, y - r * 0.2, r * 0.42, rand, {
      color: style.detail,
      angle: 0.9,
      spacing: 1.3,
      width: 1,
      alpha: 0.8,
    });
    hatchDisc(ctx, x + r * 0.35, y + r * 0.3, r * 0.3, rand, {
      color: style.detail,
      angle: 0.9,
      spacing: 1.3,
      width: 1,
      alpha: 0.8,
    });
  }

  shadeDisc(ctx, x, y, r, light, rand, 0.9);
  sketchCircle(ctx, x, y, r, rand, { color: graphite(0.85), width: 1.15 });

  if (id === "saturn") drawRings(f, x, y, r, rand, "front");

  if (id === "earth") {
    // The Moon, on its real 27.3-day period, and SPHEREx on a decorative, much faster loop.
    const moonA = ((opt.jd % 27.321661) / 27.321661) * Math.PI * 2;
    const mr = r * 2.5;
    const mx = x + Math.cos(moonA) * mr;
    const my = y + Math.sin(moonA) * mr * Math.max(Math.sin(f.cam.elev), 0.3);
    hatchDisc(ctx, mx, my, Math.max(1.6, r * 0.3), rand, {
      color: "#8d8378",
      angle: -0.7,
      spacing: 1.2,
      width: 0.8,
      alpha: 0.9,
    });
    sketchCircle(ctx, mx, my, Math.max(1.6, r * 0.3), rand, { color: graphite(0.7), width: 0.8, passes: 1 });

    const sa = opt.t * 2.2;
    const sr = r * 1.7;
    const sx = x + Math.cos(sa) * sr;
    const sy = y + Math.sin(sa) * sr * 0.55;
    drawSatellite(ctx, sx, sy, sa, f.unit, opt.selected === "earth" || opt.hovered === "earth");
  }
}

function drawRings(f: Frame, x: number, y: number, r: number, rand: Rand, half: "back" | "front"): void {
  const { ctx } = f;
  const tilt = -0.38;
  const flat = Math.max(0.2, Math.sin(f.cam.elev) * 0.5);
  const from = half === "back" ? Math.PI : 0;
  const to = half === "back" ? Math.PI * 2 : Math.PI;
  const rings: Array<[number, string, number]> = [
    [2.25, graphite(0.75), 1.1],
    [1.95, "rgba(168, 135, 74, 0.85)", 2.4],
    [1.6, "rgba(168, 135, 74, 0.6)", 1.6],
    [1.4, graphite(0.45), 0.9],
  ];
  ctx.save();
  ctx.lineCap = "round";
  for (const [k, color, width] of rings) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.ellipse(x + jitter(rand, 0.4), y + jitter(rand, 0.4), r * k, r * k * flat, tilt, from, to);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSatellite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  a: number,
  unit: number,
  scanning: boolean,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a + Math.PI / 2);
  const s = 2.6 * unit;
  if (scanning) {
    // The telescope looks straight out from Earth.
    ctx.strokeStyle = "rgba(185, 61, 18, 0.7)";
    ctx.setLineDash([2, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -16 * unit);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.fillStyle = graphite(0.9);
  ctx.fillRect(-s / 2, -s / 2, s, s);
  ctx.strokeStyle = "rgba(47, 86, 198, 0.9)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-s * 2.2, 0);
  ctx.lineTo(s * 2.2, 0);
  ctx.stroke();
  ctx.restore();
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
