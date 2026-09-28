/**
 * Draws the orrery: the Sun, the planets, the main belt and (7) Iris, seen from above the north
 * side of the ecliptic at an angle, so orbits run anticlockwise as they do in the sky. Distances
 * are compressed so every orbit fits; sizes are exaggerated. Each body is a lit, spinning sphere,
 * so planets on the near side of the Sun show crescents.
 */
import { BODIES, BODY_ORDER, irisOutline, type SelectableId } from "./bodies";
import { clamp, seeded } from "./noise";
import { displayRadius, ELEMENTS, heliocentric, type HelioPosition, orbitPath, periodDays, VIEWS } from "./orbits";
import { cross, eclipticFromEquatorial, normalize, primeMeridian, SphereSprite, type Vec3 } from "./sphere";
import { texture } from "./textures";

export interface Camera {
  /** Azimuth of the viewpoint around the ecliptic pole and its elevation above the ecliptic (radians). */
  az: number;
  el: number;
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
  warm: boolean;
}

export interface Scene {
  jd0: number;
  orbits: Record<string, HelioPosition[]>;
  belt: BeltRock[];
  poles: Record<SelectableId, Vec3>;
  sprites: Map<string, SphereSprite>;
}

const DEG = Math.PI / 180;
const EARTH_RATE = 0.98560028; // degrees per day
const INK = "11, 20, 55";
const EMBER = "181, 56, 27";

const ink = (a: number) => `rgba(${INK}, ${a})`;
const ember = (a: number) => `rgba(${EMBER}, ${a})`;

export function createScene(jd: number, beltCount = 460): Scene {
  const rand = seeded(7);
  const orbits: Record<string, HelioPosition[]> = {};
  for (const id of BODY_ORDER) orbits[id] = orbitPath(ELEMENTS[id], jd, 180);
  const belt: BeltRock[] = [];
  for (let k = 0; k < beltCount; k++) {
    const a = 2.15 + Math.pow(rand(), 0.8) * 1.15;
    belt.push({
      a,
      lon0: rand() * 360,
      rate: EARTH_RATE * Math.pow(a, -1.5),
      z: (rand() * 2 - 1) * 0.08 * a,
      size: 0.6 + rand() * 0.9,
      alpha: 0.18 + rand() * 0.35,
      warm: rand() < 0.25,
    });
  }
  const poles = {} as Record<SelectableId, Vec3>;
  for (const id of ["sun", ...BODY_ORDER] as SelectableId[]) {
    const [ra, dec] = BODIES[id].pole;
    poles[id] = eclipticFromEquatorial(ra, dec);
  }
  return { jd0: jd, orbits, belt, poles, sprites: new Map() };
}

interface Basis {
  right: Vec3;
  up: Vec3;
  toward: Vec3;
}

/** Camera axes in ecliptic coordinates for a viewpoint at azimuth `az` and elevation `el`. */
function basis(cam: Camera): Basis {
  const ca = Math.cos(cam.az);
  const sa = Math.sin(cam.az);
  const ce = Math.cos(cam.el);
  const se = Math.sin(cam.el);
  return { right: [-sa, ca, 0], up: [-se * ca, -se * sa, ce], toward: [ce * ca, ce * sa, se] };
}

function toCamera(v: Vec3, b: Basis): Vec3 {
  return [
    v[0] * b.right[0] + v[1] * b.right[1] + v[2] * b.right[2],
    v[0] * b.up[0] + v[1] * b.up[1] + v[2] * b.up[2],
    v[0] * b.toward[0] + v[1] * b.toward[1] + v[2] * b.toward[2],
  ];
}

interface Frame {
  ctx: CanvasRenderingContext2D;
  b: Basis;
  cam: Camera;
  cx: number;
  cy: number;
  edge: number;
  unit: number;
  dpr: number;
}

interface Projected {
  x: number;
  y: number;
  depth: number;
  cam: Vec3;
  fade: number;
}

function project(f: Frame, p: { x: number; y: number; z: number; r: number }): Projected {
  const rd =
    displayRadius(p.r, VIEWS.inner, f.edge) * (1 - f.cam.mix) + displayRadius(p.r, VIEWS.whole, f.edge) * f.cam.mix;
  const s = p.r > 0 ? rd / p.r : 0;
  const c = toCamera([p.x * s, p.y * s, p.z * s], f.b);
  return {
    x: f.cx + c[0],
    y: f.cy - c[1],
    depth: c[2],
    cam: c,
    // Outer bodies fade out as the inner view zooms past them.
    fade: clamp((1.32 * f.edge - rd) / (0.3 * f.edge), 0, 1),
  };
}

export interface DrawOptions {
  jd: number;
  /** Seconds since the animation started: spin, corona and satellite motion. */
  t: number;
  dpr: number;
  selected: SelectableId | null;
  hovered: SelectableId | null;
}

function sprite(scene: Scene, key: string): SphereSprite {
  let s = scene.sprites.get(key);
  if (!s) {
    s = new SphereSprite();
    scene.sprites.set(key, s);
  }
  return s;
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  width: number,
  height: number,
  cam: Camera,
  opt: DrawOptions,
): Hit[] {
  const se = Math.max(Math.sin(cam.el), 0.2);
  const edge = Math.max(40, Math.min(width / 2 - 16, (height / 2 - 30) / se));
  const f: Frame = {
    ctx,
    b: basis(cam),
    cam,
    cx: width / 2,
    cy: height / 2 + 8,
    edge,
    unit: clamp(edge / 290, 0.75, 1.45),
    dpr: opt.dpr,
  };
  ctx.clearRect(0, 0, width, height);

  const sunR = BODIES.sun.size * f.unit;

  // Sunlight washing over the page.
  const halo = ctx.createRadialGradient(f.cx, f.cy, sunR * 0.5, f.cx, f.cy, sunR * 9);
  halo.addColorStop(0, "rgba(255, 196, 102, 0.5)");
  halo.addColorStop(0.25, "rgba(255, 178, 92, 0.18)");
  halo.addColorStop(1, "rgba(255, 178, 92, 0)");
  ctx.fillStyle = halo;
  ctx.fillRect(f.cx - sunR * 9, f.cy - sunR * 9, sunR * 18, sunR * 18);

  // Orbits as hairlines.
  BODY_ORDER.forEach((id) => {
    const path = scene.orbits[id];
    if (!path) return;
    const pts = path.map((p) => project(f, p));
    const fade = Math.min(...pts.map((p) => p.fade));
    if (fade <= 0.02) return;
    const isSel = opt.selected === id;
    ctx.save();
    ctx.lineWidth = isSel ? 1.3 : 1;
    ctx.strokeStyle = isSel ? ember(0.7 * fade) : ink((id === "iris" ? 0.16 : 0.14) * fade);
    if (id === "iris" && !isSel) ctx.setLineDash([2, 4]);
    ctx.beginPath();
    pts.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  });

  // The main belt.
  const days = opt.jd - scene.jd0;
  for (const rock of scene.belt) {
    const lon = (rock.lon0 + rock.rate * days) * DEG;
    const p = project(f, { x: rock.a * Math.cos(lon), y: rock.a * Math.sin(lon), z: rock.z, r: rock.a });
    if (p.fade <= 0) continue;
    ctx.fillStyle = rock.warm ? `rgba(176, 120, 60, ${rock.alpha * p.fade})` : ink(rock.alpha * p.fade);
    const s = rock.size * f.unit;
    ctx.beginPath();
    ctx.arc(p.x, p.y, s / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  type Item = { id: SelectableId; x: number; y: number; depth: number; r: number; fade: number; cam: Vec3 };
  const items: Item[] = [{ id: "sun", x: f.cx, y: f.cy, depth: 0, r: sunR, fade: 1, cam: [0, 0, 0] }];
  for (const id of BODY_ORDER) {
    const p = project(f, heliocentric(ELEMENTS[id], opt.jd));
    if (p.fade <= 0.02) continue;
    const persp = clamp(1 + p.depth / (edge * 5), 0.86, 1.14);
    const grow = opt.hovered === id ? 1.15 : 1;
    items.push({
      id,
      x: p.x,
      y: p.y,
      depth: p.depth,
      r: BODIES[id].size * f.unit * persp * grow,
      fade: p.fade,
      cam: p.cam,
    });
    drawTrail(f, id, opt.jd, p.fade);
  }
  items.sort((a, b) => a.depth - b.depth);

  for (const item of items) {
    ctx.globalAlpha = item.fade;
    if (item.id === "sun") drawSun(f, scene, item.x, item.y, item.r, opt.t);
    else drawPlanet(f, scene, item.id, item.x, item.y, item.r, item.cam, opt);
    ctx.globalAlpha = 1;
  }

  for (const item of items) {
    if (opt.selected === item.id) drawReticle(ctx, item.x, item.y, item.r + 5 * f.unit, opt.t);
  }

  // Labels, most important first, each placed where it overlaps nothing already placed.
  const rank = (id: SelectableId) => (id === opt.selected ? 0 : id === opt.hovered ? 1 : id === "earth" ? 2 : 3);
  const placed: Box[] = [];
  for (const item of [...items].sort((a, b) => rank(a.id) - rank(b.id))) {
    const isSel = opt.selected === item.id;
    if (!shouldLabel(item.id, cam.mix, isSel, opt.hovered === item.id)) continue;
    drawLabel(ctx, item, f.unit, isSel, width, height, placed, rank(item.id) < 2);
  }

  return items.filter((i) => i.fade > 0.3).map(({ id, x, y, r }) => ({ id, x, y, r }));
}

/** A fading arc behind each planet: where it has just been. */
function drawTrail(f: Frame, id: (typeof BODY_ORDER)[number], jd: number, fade: number): void {
  const el = ELEMENTS[id];
  const span = Math.max(24, periodDays(el) * 0.075);
  const steps = 26;
  const { ctx } = f;
  const [r, g, b] = rgb(BODIES[id].color);
  let prev = project(f, heliocentric(el, jd - span));
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = 1.8 * f.unit;
  for (let k = 1; k <= steps; k++) {
    const next = project(f, heliocentric(el, jd - span + (span * k) / steps));
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${Math.pow(k / steps, 1.6) * 0.85 * fade})`;
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(next.x, next.y);
    ctx.stroke();
    prev = next;
  }
  ctx.restore();
}

function shouldLabel(id: SelectableId, mix: number, selected: boolean, hovered: boolean): boolean {
  if (selected || hovered || id === "earth") return true;
  if (id === "sun") return false;
  const inner = ["mercury", "venus", "mars", "iris"].includes(id);
  return inner ? mix < 0.5 : mix >= 0.5;
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * A chart-style label: a thin leader line out from the body, then the name in small capitals. It
 * tries up-right, up-left, down-right and down-left and takes the first spot that is free and on
 * the canvas; an unimportant label with nowhere to go is left out.
 */
function drawLabel(
  ctx: CanvasRenderingContext2D,
  item: { id: SelectableId; x: number; y: number; r: number; fade: number },
  unit: number,
  selected: boolean,
  width: number,
  height: number,
  placed: Box[],
  force: boolean,
): void {
  const name = (item.id === "earth" ? "Earth · SPHEREx" : BODIES[item.id].name).toUpperCase();
  ctx.save();
  ctx.font = `600 ${Math.round(10 * unit + 0.5)}px "IBM Plex Sans", system-ui, sans-serif`;
  if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "1.2px";
  const w = ctx.measureText(name).width;
  const h = 13 * unit;
  const { x, y, r } = item;

  const layout = (sx: number, sy: number) => {
    const x0 = x + sx * (r * 0.72 + 2);
    const y0 = y + sy * (r * 0.72 + 2);
    const x1 = x0 + sx * 9 * unit;
    const y1 = y0 + sy * 9 * unit;
    const x2 = x1 + sx * (w + 4);
    const box: Box = {
      x0: Math.min(x1, x2) - 2,
      x1: Math.max(x1, x2) + 2,
      y0: sy < 0 ? y1 - h - 3 : y1 - 1,
      y1: sy < 0 ? y1 + 1 : y1 + h + 3,
    };
    return { sx, sy, x0, y0, x1, y1, x2, box };
  };
  const options = [layout(1, -1), layout(-1, -1), layout(1, 1), layout(-1, 1)];
  const fits = (o: (typeof options)[number]) =>
    o.box.x0 >= 2 &&
    o.box.x1 <= width - 2 &&
    o.box.y0 >= 2 &&
    o.box.y1 <= height - 2 &&
    !placed.some((p) => overlaps(p, o.box));
  const choice =
    options.find(fits) ??
    (force ? (options.find((o) => o.box.x1 <= width - 2 && o.box.x0 >= 2) ?? options[0]) : undefined);
  if (!choice) {
    ctx.restore();
    return;
  }
  placed.push(choice.box);

  const color = selected ? ember(0.95) : item.id === "iris" ? ember(0.85) : ink(0.72);
  ctx.globalAlpha = item.fade;
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(choice.x0, choice.y0);
  ctx.lineTo(choice.x1, choice.y1);
  ctx.lineTo(choice.x2, choice.y1);
  ctx.stroke();
  ctx.textAlign = choice.sx === 1 ? "left" : "right";
  const tx = choice.x1 + choice.sx * 2;
  const ty = choice.sy < 0 ? choice.y1 - 4 : choice.y1 + h - 1;
  // A pale halo so labels stay legible where they cross orbits and trails.
  ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.strokeText(name, tx, ty);
  ctx.fillStyle = color;
  ctx.fillText(name, tx, ty);
  ctx.restore();
}

/** Thin ember circle with four ticks, turning slowly: the selected body. */
function drawReticle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number): void {
  ctx.save();
  ctx.strokeStyle = ember(0.9);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  for (let k = 0; k < 4; k++) {
    const a = t * 0.4 + (k * Math.PI) / 2;
    ctx.moveTo(x + Math.cos(a) * (r + 2), y + Math.sin(a) * (r + 2));
    ctx.lineTo(x + Math.cos(a) * (r + 7), y + Math.sin(a) * (r + 7));
  }
  ctx.stroke();
  ctx.restore();
}

function drawSun(f: Frame, scene: Scene, x: number, y: number, r: number, t: number): void {
  const { ctx } = f;
  // Corona: soft rays that breathe and turn slowly.
  ctx.save();
  ctx.translate(x, y);
  const rays = 18;
  for (let k = 0; k < rays; k++) {
    const a = (k / rays) * Math.PI * 2 + t * 0.035;
    const len = r * (1.7 + 0.45 * Math.sin(t * 0.6 + k * 1.9) + (k % 3 === 0 ? 0.5 : 0));
    const g = ctx.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
    g.addColorStop(0.45, "rgba(255, 190, 90, 0.5)");
    g.addColorStop(1, "rgba(255, 190, 90, 0)");
    ctx.fillStyle = g;
    const w = r * 0.16;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a + Math.PI / 2) * w, Math.sin(a + Math.PI / 2) * w);
    ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
    ctx.lineTo(Math.cos(a - Math.PI / 2) * w, Math.sin(a - Math.PI / 2) * w);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  const pole = toCamera(scene.poles.sun, f.b);
  const prime = toCamera(primeMeridian(scene.poles.sun, (t / BODIES.sun.spin) * Math.PI * 2), f.b);
  const s = sprite(scene, "sun");
  if (s.render(texture("sun"), 2 * r * f.dpr, { pole, prime, light: null, limbDarkening: 0.45 })) {
    const size = s.size / f.dpr;
    ctx.drawImage(s.canvas, x - size / 2, y - size / 2, size, size);
  }
  const bloom = ctx.createRadialGradient(x - r * 0.2, y - r * 0.25, 0, x, y, r * 1.35);
  bloom.addColorStop(0, "rgba(255, 252, 235, 0.55)");
  bloom.addColorStop(0.6, "rgba(255, 240, 200, 0.1)");
  bloom.addColorStop(1, "rgba(255, 230, 180, 0)");
  ctx.fillStyle = bloom;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.35, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlanet(
  f: Frame,
  scene: Scene,
  id: Exclude<SelectableId, "sun">,
  x: number,
  y: number,
  r: number,
  camPos: Vec3,
  opt: DrawOptions,
): void {
  const { ctx } = f;
  const style = BODIES[id];
  const light = litFrom(camPos);
  const poleEcl = scene.poles[id];
  const pole = toCamera(poleEcl, f.b);
  const prime = toCamera(primeMeridian(poleEcl, (opt.t / style.spin) * Math.PI * 2), f.b);

  // A faint glow in the planet's own colour keeps it from looking pasted onto the page.
  const glow = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 2.4);
  glow.addColorStop(0, rgba(style.color, 0.22));
  glow.addColorStop(1, rgba(style.color, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8);

  if (style.rings) drawRings(ctx, x, y, r, pole, "back");

  const s = sprite(scene, id);
  const ok = s.render(texture(style.texture), 2 * r * f.dpr, {
    pole,
    prime,
    light,
    ambient: 0.3,
    atmosphere: style.atmosphere,
    glint: style.glint,
    lumpy: id === "iris" ? irisOutline : undefined,
  });
  if (ok) {
    const size = s.size / f.dpr;
    ctx.drawImage(s.canvas, x - size / 2, y - size / 2, size, size);
  }

  if (style.rings) drawRings(ctx, x, y, r, pole, "front");

  if (id === "earth") {
    // The Moon on its real 27.3-day period; SPHEREx on a decorative, much faster loop.
    const moonA = ((opt.jd % 27.321661) / 27.321661) * Math.PI * 2;
    const offset = toCamera([Math.cos(moonA) * r * 2.7, Math.sin(moonA) * r * 2.7, 0], f.b);
    const mx = x + offset[0];
    const my = y - offset[1];
    const mr = Math.max(1.7, r * 0.3);
    const moonCam: Vec3 = [camPos[0] + offset[0], camPos[1] + offset[1], camPos[2] + offset[2]];
    const ms = sprite(scene, "moon");
    const moonLook = {
      pole: toCamera(scene.poles.earth, f.b),
      prime: toCamera([1, 0, 0], f.b),
      light: litFrom(moonCam),
      ambient: 0.3,
    };
    if (ms.render(texture("moon"), 2 * mr * f.dpr, moonLook)) {
      const size = ms.size / f.dpr;
      ctx.drawImage(ms.canvas, mx - size / 2, my - size / 2, size, size);
    }
    drawSatellite(ctx, x, y, r, opt.t, f.unit, opt.selected === "earth" || opt.hovered === "earth");
  }
}

/** Saturn's rings in the plane perpendicular to its pole, split into the halves behind and in front. */
function drawRings(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  pole: Vec3,
  half: "back" | "front",
): void {
  const major = normalize(Math.hypot(pole[0], pole[1]) > 1e-6 ? [-pole[1], pole[0], 0] : [1, 0, 0]);
  const minor = cross(pole, major);
  // C ring, B ring, then the A ring beyond the Cassini division (radii in planet radii).
  const zones: Array<[number, number, string]> = [
    [1.24, 1.52, "rgba(160, 140, 112, 0.35)"],
    [1.52, 1.95, "rgba(226, 208, 168, 0.9)"],
    [2.03, 2.27, "rgba(206, 190, 152, 0.75)"],
  ];
  // minor has a non-negative z, so angles 0…π are the half nearer the viewer.
  const from = half === "back" ? Math.PI : 0;
  const steps = 40;
  const at = (a: number, k: number) => {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return { x: x + (major[0] * c + minor[0] * s) * r * k, y: y - (major[1] * c + minor[1] * s) * r * k };
  };
  ctx.save();
  for (const [inner, outer, color] of zones) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let k = 0; k <= steps; k++) {
      const p = at(from + (Math.PI * k) / steps, outer);
      if (k === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    for (let k = steps; k >= 0; k--) {
      const p = at(from + (Math.PI * k) / steps, inner);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawSatellite(
  ctx: CanvasRenderingContext2D,
  ex: number,
  ey: number,
  r: number,
  t: number,
  unit: number,
  scanning: boolean,
): void {
  const a = t * 2.1;
  const x = ex + Math.cos(a) * r * 1.8;
  const y = ey + Math.sin(a) * r * 0.6;
  ctx.save();
  ctx.translate(x, y);
  if (scanning) {
    ctx.strokeStyle = ember(0.65);
    ctx.setLineDash([2, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * 16 * unit, Math.sin(a) * 16 * unit);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.rotate(a);
  const s = 2.2 * unit;
  ctx.fillStyle = ink(0.9);
  ctx.fillRect(-s / 2, -s / 2, s, s);
  ctx.strokeStyle = "rgba(58, 86, 212, 0.95)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, -s * 2.1);
  ctx.lineTo(0, s * 2.1);
  ctx.stroke();
  ctx.restore();
}

/**
 * Light on a body at camera position `p`: from the Sun, plus a little from the viewer's side so a
 * disc reads as a lit sphere on a light page. The terminator still faces the Sun.
 */
function litFrom(p: Vec3): Vec3 {
  const s = normalize([-p[0], -p[1], -p[2]]);
  return normalize([s[0], s[1], s[2] + 0.75]);
}

function rgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function rgba(hex: string, a: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
