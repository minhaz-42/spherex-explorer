/**
 * Procedural surface maps (equirectangular, longitude −180°…180° across, latitude 90°…−90° down)
 * for the Sun, planets, the Moon and (7) Iris. They are painted from noise to evoke each body's real
 * look, not taken from spacecraft images. The alpha channel marks open water for sun glints.
 */
import { clamp, fbm3, lerp, seeded, smoothstep } from "./noise";

export type TextureId =
  "sun" | "mercury" | "venus" | "earth" | "moon" | "mars" | "iris" | "jupiter" | "saturn" | "uranus" | "neptune";

export interface Texture {
  w: number;
  h: number;
  rgba: Uint8ClampedArray;
}

type RGB = [number, number, number];

function hex(h: string): RGB {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function scale(c: RGB, k: number): RGB {
  return [c[0] * k, c[1] * k, c[2] * k];
}

/** Piecewise-linear colour ramp over sorted stops. */
function ramp(stops: Array<[number, string]>, t: number): RGB {
  const first = stops[0]!;
  if (t <= first[0]) return hex(first[1]);
  for (let k = 1; k < stops.length; k++) {
    const [t1, c1] = stops[k]!;
    const [t0, c0] = stops[k - 1]!;
    if (t <= t1) return mix(hex(c0), hex(c1), (t - t0) / (t1 - t0));
  }
  return hex(stops[stops.length - 1]![1]);
}

type Painter = (x: number, y: number, z: number, latDeg: number, lonDeg: number) => [number, number, number, number];

function paint(w: number, h: number, painter: Painter): Texture {
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let j = 0; j < h; j++) {
    const lat = (0.5 - (j + 0.5) / h) * Math.PI;
    const cl = Math.cos(lat);
    const sl = Math.sin(lat);
    for (let i = 0; i < w; i++) {
      const lon = ((i + 0.5) / w) * 2 * Math.PI - Math.PI;
      const [r, g, b, a] = painter(
        cl * Math.cos(lon),
        cl * Math.sin(lon),
        sl,
        (lat * 180) / Math.PI,
        (lon * 180) / Math.PI,
      );
      const k = (j * w + i) * 4;
      rgba[k] = r;
      rgba[k + 1] = g;
      rgba[k + 2] = b;
      rgba[k + 3] = a;
    }
  }
  return { w, h, rgba };
}

interface Crater {
  c: [number, number, number];
  r: number;
}

function craters(seed: number, count: number, minR: number, maxR: number): Crater[] {
  const rand = seeded(seed);
  return Array.from({ length: count }, () => {
    const u = rand() * 2 - 1;
    const a = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    return { c: [s * Math.cos(a), s * Math.sin(a), u], r: minR + Math.pow(rand(), 2.2) * (maxR - minR) };
  });
}

/** Darkened floors and bright rims where craters sit. */
function craterShade(list: Crater[], x: number, y: number, z: number): number {
  let k = 1;
  for (const cr of list) {
    const d = Math.hypot(x - cr.c[0], y - cr.c[1], z - cr.c[2]);
    if (d > cr.r * 1.25) continue;
    const q = d / cr.r;
    if (q < 0.85) k *= 0.84 + 0.1 * q;
    else if (q < 1.1) k *= 1.1;
  }
  return k;
}

/** Degrees of longitude between two angles, wrapped to −180…180. */
function dLon(a: number, b: number): number {
  return ((a - b + 540) % 360) - 180;
}

const PAINTERS: Record<TextureId, (w: number, h: number) => Texture> = {
  sun: (w, h) =>
    paint(w, h, (x, y, z, lat) => {
      const gran = fbm3(x * 22, y * 22, z * 22, 3, 5);
      const spots = fbm3(x * 3.2, y * 3.2, z * 3.2, 3, 9);
      let c = mix(hex("#ffb640"), hex("#fff0b8"), smoothstep(0.3, 0.75, gran));
      const spot = smoothstep(0.7, 0.78, spots) * (1 - smoothstep(18, 38, Math.abs(lat)));
      c = mix(c, hex("#b4541e"), spot * 0.8);
      return [c[0], c[1], c[2], 0];
    }),

  mercury: (w, h) => {
    const list = craters(3, 60, 0.03, 0.22);
    return paint(w, h, (x, y, z) => {
      const t = fbm3(x * 2.6, y * 2.6, z * 2.6, 5, 1);
      const c = scale(
        ramp(
          [
            [0, "#6c6760"],
            [0.5, "#9c958c"],
            [1, "#d0c8bc"],
          ],
          t,
        ),
        craterShade(list, x, y, z),
      );
      return [c[0], c[1], c[2], 0];
    });
  },

  venus: (w, h) =>
    paint(w, h, (x, y, z, lat) => {
      const swirl = fbm3(x * 2, y * 2, z * 5, 4, 2);
      const v = 0.5 + 0.5 * Math.sin((lat * 0.07 + swirl * 2.6) * Math.PI);
      const c = scale(mix(hex("#dcbd82"), hex("#f6ead0"), v), 0.93 + 0.12 * fbm3(x * 6, y * 6, z * 6, 2, 4));
      return [c[0], c[1], c[2], 0];
    }),

  earth: (w, h) =>
    paint(w, h, (x, y, z, lat) => {
      const height = fbm3(x * 1.9 + 3, y * 1.9, z * 1.9, 5, 11);
      const ice = smoothstep(66, 76, Math.abs(lat));
      let c: RGB;
      let wet = 0;
      if (height < 0.53) {
        c = mix(hex("#2f86dc"), hex("#0d3a80"), smoothstep(0.02, 0.2, 0.53 - height));
        wet = 255;
      } else {
        const green = fbm3(x * 4, y * 4, z * 4, 3, 21);
        c = mix(hex("#4f7f38"), hex("#8c7c4e"), green);
        const dry =
          smoothstep(0.5, 0.66, fbm3(x * 2.4, y * 2.4, z * 2.4, 3, 31)) *
          (1 - smoothstep(12, 38, Math.abs(Math.abs(lat) - 23)));
        c = mix(c, hex("#cfae70"), dry);
        c = mix(c, hex("#8a8071"), smoothstep(0.72, 0.85, height));
      }
      c = mix(c, hex("#f3f6f9"), ice);
      const cloud = smoothstep(0.54, 0.74, fbm3(x * 3.1 + 7, y * 3.1 + 3, z * 3.1 + 1, 5, 41)) * 0.9;
      c = mix(c, hex("#ffffff"), cloud);
      return [c[0], c[1], c[2], wet * (1 - cloud) * (1 - ice)];
    }),

  moon: (w, h) => {
    const list = craters(8, 45, 0.03, 0.2);
    return paint(w, h, (x, y, z) => {
      const maria = smoothstep(0.55, 0.62, fbm3(x * 1.4 + 2, y * 1.4, z * 1.4, 3, 52));
      const t = fbm3(x * 3, y * 3, z * 3, 4, 51);
      let c = mix(hex("#aaa69f"), hex("#c9c5bd"), t);
      c = mix(c, hex("#76746f"), maria * 0.85);
      c = scale(c, craterShade(list, x, y, z));
      return [c[0], c[1], c[2], 0];
    });
  },

  mars: (w, h) =>
    paint(w, h, (x, y, z, lat) => {
      const t = fbm3(x * 2.2, y * 2.2, z * 2.2, 5, 61);
      let c = ramp(
        [
          [0, "#8d3b22"],
          [0.45, "#b9562e"],
          [0.7, "#d27a47"],
          [1, "#e3a06b"],
        ],
        t,
      );
      c = mix(c, hex("#6a3021"), smoothstep(0.54, 0.64, fbm3(x * 1.3 + 5, y * 1.3, z * 1.3, 3, 62)) * 0.6);
      c = mix(c, hex("#f5f0ea"), Math.max(smoothstep(74, 80, lat), smoothstep(78, 84, -lat)));
      return [c[0], c[1], c[2], 0];
    }),

  iris: (w, h) => {
    const list = craters(12, 30, 0.05, 0.3);
    return paint(w, h, (x, y, z) => {
      const t = fbm3(x * 3, y * 3, z * 3, 4, 71);
      const c = scale(
        ramp(
          [
            [0, "#6b5f51"],
            [0.5, "#93846f"],
            [1, "#b9ab95"],
          ],
          t,
        ),
        craterShade(list, x, y, z),
      );
      return [c[0], c[1], c[2], 0];
    });
  },

  jupiter: (w, h) =>
    paint(w, h, (x, y, z, lat, lon) => {
      const warp = (fbm3(x * 3, y * 3, z * 8, 4, 81) - 0.5) * 9;
      const latw = lat + warp;
      let c = ramp(
        [
          [-90, "#a58f78"],
          [-62, "#c3ab8e"],
          [-42, "#e6d6bc"],
          [-33, "#c79067"],
          [-24, "#efe4d0"],
          [-12, "#d5a276"],
          [-4, "#f2e9d9"],
          [6, "#f0e4cf"],
          [12, "#c3845a"],
          [20, "#eadcc4"],
          [29, "#bf8a61"],
          [40, "#e2d1b6"],
          [62, "#c1aa8e"],
          [90, "#a18b74"],
        ],
        latw,
      );
      c = scale(c, 0.94 + 0.12 * fbm3(x * 14, y * 14, z * 3, 2, 82));
      // The Great Red Spot, at 22° south.
      const e = Math.pow((dLon(lon, 40) * Math.cos((lat * Math.PI) / 180)) / 12, 2) + Math.pow((lat + 22) / 6, 2);
      if (e < 1.6) {
        c = mix(c, hex("#f1e4cf"), clamp(1.6 - e, 0, 0.6) * 0.6);
        if (e < 1) c = mix(c, hex("#c05a3a"), Math.pow(1 - e, 0.5) * 0.9);
      }
      return [c[0], c[1], c[2], 0];
    }),

  saturn: (w, h) =>
    paint(w, h, (x, y, z, lat) => {
      const latw = lat + (fbm3(x * 3, y * 3, z * 8, 3, 91) - 0.5) * 4;
      const c = scale(
        ramp(
          [
            [-90, "#bea77b"],
            [-45, "#e3cf9f"],
            [-25, "#d6bd86"],
            [-8, "#eadab1"],
            [8, "#efe0b8"],
            [22, "#d9c08c"],
            [40, "#e7d4a6"],
            [65, "#cdb485"],
            [90, "#b99f73"],
          ],
          latw,
        ),
        0.96 + 0.08 * fbm3(x * 12, y * 12, z * 3, 2, 92),
      );
      return [c[0], c[1], c[2], 0];
    }),

  uranus: (w, h) =>
    paint(w, h, (x, y, z, lat) => {
      let c = mix(hex("#93d8e0"), hex("#bdeef2"), 0.5 + 0.5 * Math.sin(lat * 0.08));
      c = mix(c, hex("#d8f6f7"), smoothstep(55, 85, lat) * 0.6);
      c = scale(c, 0.97 + 0.06 * fbm3(x * 4, y * 4, z * 9, 2, 101));
      return [c[0], c[1], c[2], 0];
    }),

  neptune: (w, h) =>
    paint(w, h, (x, y, z, lat, lon) => {
      const latw = lat + (fbm3(x * 3, y * 3, z * 7, 3, 111) - 0.5) * 7;
      let c = ramp(
        [
          [-90, "#2c4bb8"],
          [-50, "#3e66da"],
          [-30, "#2b4ab3"],
          [-12, "#4a74e4"],
          [10, "#4169de"],
          [40, "#355bd0"],
          [90, "#2a45ae"],
        ],
        latw,
      );
      const e = Math.pow((dLon(lon, -60) * Math.cos((lat * Math.PI) / 180)) / 13, 2) + Math.pow((lat + 22) / 6.5, 2);
      if (e < 1) c = mix(c, hex("#1d3188"), Math.pow(1 - e, 0.6) * 0.85);
      const streak = Math.pow((dLon(lon, -48) * Math.cos((lat * Math.PI) / 180)) / 16, 2) + Math.pow((lat + 31) / 2, 2);
      if (streak < 1) c = mix(c, hex("#e6eeff"), (1 - streak) * 0.7);
      return [c[0], c[1], c[2], 0];
    }),
};

const cache = new Map<string, Texture>();

/** A surface map for a body, generated on first use and cached. `detail` doubles the resolution. */
export function texture(id: TextureId, detail = false): Texture {
  const key = `${id}:${detail ? 2 : 1}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const w = detail ? 320 : 128;
  const tex = PAINTERS[id](w, w / 2);
  cache.set(key, tex);
  return tex;
}
