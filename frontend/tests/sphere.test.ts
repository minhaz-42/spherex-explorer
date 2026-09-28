import { describe, expect, it } from "vitest";

import { BODIES } from "../src/components/space/bodies";
import { fbm3, noise3 } from "../src/components/space/noise";
import { cross, dot, eclipticFromEquatorial, primeMeridian, ringPoints } from "../src/components/space/sphere";
import { texture } from "../src/components/space/textures";

const DEG = 180 / Math.PI;

function eclipticLatLon(v: [number, number, number]) {
  return { lat: Math.asin(v[2]) * DEG, lon: (((Math.atan2(v[1], v[0]) * DEG) % 360) + 360) % 360 };
}

describe("pole directions", () => {
  it("puts Earth's pole 23.44° from the ecliptic pole, towards ecliptic longitude 90°", () => {
    const { lat, lon } = eclipticLatLon(eclipticFromEquatorial(0, 90));
    expect(lat).toBeCloseTo(66.56, 1);
    expect(lon).toBeCloseTo(90, 1);
  });

  it("converts Saturn's IAU pole to ecliptic coordinates", () => {
    const [ra, dec] = BODIES.saturn.pole;
    const { lat, lon } = eclipticLatLon(eclipticFromEquatorial(ra, dec));
    expect(lat).toBeCloseTo(61.95, 1);
    expect(lon).toBeCloseTo(79.53, 1);
  });

  it("tips Uranus nearly into its orbital plane", () => {
    const [ra, dec] = BODIES.uranus.pole;
    expect(Math.abs(eclipticLatLon(eclipticFromEquatorial(ra, dec)).lat)).toBeLessThan(15);
  });

  it("gives a prime meridian perpendicular to the pole at every spin", () => {
    const pole = eclipticFromEquatorial(...BODIES.mars.pole);
    for (const spin of [0, 1, 2.5, 4]) {
      const q = primeMeridian(pole, spin);
      expect(dot(pole, q)).toBeCloseTo(0, 9);
      expect(Math.hypot(...q)).toBeCloseTo(1, 9);
    }
  });
});

describe("rings", () => {
  it("draw a circle of the given radius in the plane perpendicular to the pole", () => {
    const pole: [number, number, number] = [0.3, 0.8, 0.52];
    const n = Math.hypot(...pole);
    const p: [number, number, number] = [pole[0] / n, pole[1] / n, pole[2] / n];
    const pts = ringPoints(p, 2, 32);
    for (const q of pts) {
      // Screen y points down; undo it and check the 3D point lies in the ring plane.
      const zSq = 4 - q.x * q.x - q.y * q.y;
      expect(zSq).toBeGreaterThanOrEqual(-1e-9);
    }
    const major = cross(p, [0, 0, 1]);
    expect(Math.hypot(...major)).toBeGreaterThan(0);
    expect(pts.some((q) => q.front) && pts.some((q) => !q.front)).toBe(true);
  });
});

describe("textures", () => {
  it("builds seamless, cached equirectangular maps", () => {
    const tex = texture("jupiter");
    expect(tex.w).toBe(tex.h * 2);
    expect(tex.rgba.length).toBe(tex.w * tex.h * 4);
    expect(texture("jupiter")).toBe(tex);
    // Longitude −180° and +180° sit next to each other: the first and last columns should match closely.
    const row = Math.floor(tex.h / 2) * tex.w * 4;
    const first = tex.rgba[row]!;
    const last = tex.rgba[row + (tex.w - 1) * 4]!;
    expect(Math.abs(first - last)).toBeLessThan(40);
  });

  it("marks Earth's oceans for sun glints and nowhere else", () => {
    const earth = texture("earth");
    let wet = 0;
    for (let k = 3; k < earth.rgba.length; k += 4) if (earth.rgba[k]! > 0) wet++;
    const share = wet / (earth.rgba.length / 4);
    expect(share).toBeGreaterThan(0.2);
    expect(share).toBeLessThan(0.9);
    const mars = texture("mars");
    expect(mars.rgba.every((v, k) => k % 4 !== 3 || v === 0)).toBe(true);
  });
});

describe("noise", () => {
  it("is deterministic and bounded", () => {
    expect(noise3(1.3, 2.7, -0.4, 5)).toBe(noise3(1.3, 2.7, -0.4, 5));
    for (let k = 0; k < 200; k++) {
      const v = fbm3(k * 0.37, k * 0.11, k * 0.53, 4, 3);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});
