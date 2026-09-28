/**
 * Renders a textured, lit sphere into a small offscreen canvas, pixel by pixel. Bodies are tiny on
 * screen, so this is cheap enough to redo every frame, which lets planets spin and show true phases
 * as they move around the Sun.
 *
 * Camera coordinates throughout: x to the right, y up, z towards the viewer.
 */
import { clamp } from "./noise";
import type { Texture } from "./textures";

export type Vec3 = [number, number, number];

export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export function normalize(v: Vec3): Vec3 {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
}

const DEG = Math.PI / 180;
const OBLIQUITY = 23.4392911 * DEG;

/** An equatorial (J2000) direction given as RA/Dec in degrees, as an ecliptic unit vector. */
export function eclipticFromEquatorial(raDeg: number, decDeg: number): Vec3 {
  const ra = raDeg * DEG;
  const dec = decDeg * DEG;
  const x = Math.cos(dec) * Math.cos(ra);
  const y = Math.cos(dec) * Math.sin(ra);
  const z = Math.sin(dec);
  return [x, y * Math.cos(OBLIQUITY) + z * Math.sin(OBLIQUITY), -y * Math.sin(OBLIQUITY) + z * Math.cos(OBLIQUITY)];
}

/** A unit vector perpendicular to `pole`, turned `spin` radians about it: the body's prime meridian. */
export function primeMeridian(pole: Vec3, spin: number): Vec3 {
  const ref: Vec3 = Math.abs(pole[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const q0 = normalize(cross(ref, pole));
  const r0 = cross(pole, q0);
  const c = Math.cos(spin);
  const s = Math.sin(spin);
  return [q0[0] * c + r0[0] * s, q0[1] * c + r0[1] * s, q0[2] * c + r0[2] * s];
}

export interface SphereLook {
  /** Body north pole and prime meridian, in camera coordinates. */
  pole: Vec3;
  prime: Vec3;
  /** Unit vector towards the light, in camera coordinates; null for a body that shines (the Sun). */
  light: Vec3 | null;
  /** Brightness of the unlit side, 0–1. */
  ambient?: number;
  /** Colour the night side sinks towards (instead of black), 0–255. */
  shadow?: Vec3;
  /** Rim glow from an atmosphere: colour 0–255 and strength. */
  atmosphere?: [number, number, number, number];
  /** Strength of a sun glint where the texture's alpha channel marks water. */
  glint?: number;
  /** Limb darkening for shining bodies, 0–1. */
  limbDarkening?: number;
  /** Radius factor by direction, for lumpy bodies like asteroids. */
  lumpy?: (angle: number) => number;
}

const NIGHT: Vec3 = [22, 28, 64];

/** A reusable offscreen canvas that holds one rendered body. */
export class SphereSprite {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private image: ImageData | null = null;
  size = 0;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");
  }

  /** Renders the body at `sizePx` device pixels across. Returns false if canvas is unavailable. */
  render(tex: Texture, sizePx: number, look: SphereLook, smooth = sizePx > 70): boolean {
    const ctx = this.ctx;
    if (!ctx) return false;
    const S = Math.max(4, Math.ceil(sizePx) + 2);
    if (S !== this.size || !this.image) {
      this.canvas.width = S;
      this.canvas.height = S;
      this.image = ctx.createImageData(S, S);
      this.size = S;
    }
    const data = this.image.data;
    const R = (S - 2) / 2;
    const c = S / 2;
    const P = look.pole;
    const Q = look.prime;
    const Rv = cross(P, Q);
    const L = look.light;
    const ambient = look.ambient ?? 0.16;
    const shadow = look.shadow ?? NIGHT;
    const atm = look.atmosphere;
    const glint = look.glint ?? 0;
    const H = L ? normalize([L[0], L[1], L[2] + 1]) : null;
    const ld = look.limbDarkening ?? 0;
    const tw = tex.w;
    const th = tex.h;
    const t = tex.rgba;

    for (let py = 0; py < S; py++) {
      const ny0 = -(py + 0.5 - c) / R;
      for (let px = 0; px < S; px++) {
        const i = (py * S + px) * 4;
        const nx0 = (px + 0.5 - c) / R;
        const dist = Math.hypot(nx0, ny0);
        const edge = look.lumpy ? look.lumpy(Math.atan2(ny0, nx0)) : 1;
        const alpha = clamp((edge - dist) * R + 0.5, 0, 1);
        if (alpha <= 0) {
          data[i + 3] = 0;
          continue;
        }
        // Inside a lumpy outline, shade as if the rock were a sphere of that local radius.
        const nx = Math.min(0.999, nx0 / edge);
        const ny = ny0 / edge;
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));

        const sinLat = nx * P[0] + ny * P[1] + nz * P[2];
        const bx = nx * Q[0] + ny * Q[1] + nz * Q[2];
        const by = nx * Rv[0] + ny * Rv[1] + nz * Rv[2];
        const lat = Math.asin(clamp(sinLat, -1, 1));
        const lon = Math.atan2(by, bx);
        const u = (lon / (2 * Math.PI) + 0.5) * tw;
        const v = (0.5 - lat / Math.PI) * th;

        let r: number;
        let g: number;
        let b: number;
        let wet: number;
        if (smooth) {
          const x0 = Math.floor(u - 0.5);
          const y0 = Math.max(0, Math.min(th - 2, Math.floor(v - 0.5)));
          const fx = u - 0.5 - x0;
          const fy = clamp(v - 0.5 - y0, 0, 1);
          const xa = ((x0 % tw) + tw) % tw;
          const xb = (xa + 1) % tw;
          const a = (y0 * tw + xa) * 4;
          const bb = (y0 * tw + xb) * 4;
          const cc = ((y0 + 1) * tw + xa) * 4;
          const dd = ((y0 + 1) * tw + xb) * 4;
          const w00 = (1 - fx) * (1 - fy);
          const w10 = fx * (1 - fy);
          const w01 = (1 - fx) * fy;
          const w11 = fx * fy;
          r = t[a]! * w00 + t[bb]! * w10 + t[cc]! * w01 + t[dd]! * w11;
          g = t[a + 1]! * w00 + t[bb + 1]! * w10 + t[cc + 1]! * w01 + t[dd + 1]! * w11;
          b = t[a + 2]! * w00 + t[bb + 2]! * w10 + t[cc + 2]! * w01 + t[dd + 2]! * w11;
          wet = t[a + 3]! * w00 + t[bb + 3]! * w10 + t[cc + 3]! * w01 + t[dd + 3]! * w11;
        } else {
          const xi = ((Math.floor(u) % tw) + tw) % tw;
          const yi = Math.max(0, Math.min(th - 1, Math.floor(v)));
          const a = (yi * tw + xi) * 4;
          r = t[a]!;
          g = t[a + 1]!;
          b = t[a + 2]!;
          wet = t[a + 3]!;
        }

        if (L) {
          const d = nx * L[0] + ny * L[1] + nz * L[2];
          // Wrapped lighting gives the soft terminator of a body seen through a little atmosphere.
          const w = clamp((d + 0.14) / 1.14, 0, 1);
          const lit = ambient + (1 - ambient) * w * w * (3 - 2 * w);
          r = r * lit + shadow[0] * (1 - lit) * 0.6;
          g = g * lit + shadow[1] * (1 - lit) * 0.6;
          b = b * lit + shadow[2] * (1 - lit) * 0.6;
          if (atm) {
            const rim = Math.pow(1 - nz, 2.4) * atm[3] * clamp(d * 1.3 + 0.45, 0, 1);
            r += atm[0] * rim;
            g += atm[1] * rim;
            b += atm[2] * rim;
          }
          if (glint > 0 && wet > 0 && H) {
            const s = Math.pow(Math.max(0, nx * H[0] + ny * H[1] + nz * H[2]), 55) * glint * (wet / 255);
            r += 255 * s;
            g += 250 * s;
            b += 235 * s;
          }
        } else if (ld > 0) {
          const k = 1 - ld * (1 - Math.pow(nz, 0.55));
          r *= k;
          g *= k * 0.97;
          b *= k * 0.9;
        }

        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = alpha * 255;
      }
    }
    ctx.putImageData(this.image, 0, 0);
    return true;
  }
}

/**
 * Points around a ring (radius in body radii) lying in the plane perpendicular to `pole`, as screen
 * offsets from the body centre (y down) plus whether each point is in front of the body.
 */
export function ringPoints(pole: Vec3, radius: number, steps = 64): Array<{ x: number; y: number; front: boolean }> {
  const major = normalize(Math.hypot(pole[0], pole[1]) > 1e-6 ? [-pole[1], pole[0], 0] : [1, 0, 0]);
  const minor = cross(pole, major);
  const out: Array<{ x: number; y: number; front: boolean }> = [];
  for (let k = 0; k <= steps; k++) {
    const a = (k / steps) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const x = (major[0] * c + minor[0] * s) * radius;
    const y = (major[1] * c + minor[1] * s) * radius;
    const z = (major[2] * c + minor[2] * s) * radius;
    out.push({ x, y: -y, front: z >= 0 });
  }
  return out;
}
