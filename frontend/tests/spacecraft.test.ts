import { describe, expect, it } from "vitest";

import {
  dot,
  EARTH_RADIUS_KM,
  earthRotationDeg,
  julian,
  norm,
  radecVector,
  subPoint,
  sunDirection,
} from "../src/features/spacecraft/earth";
import { whereFrom } from "../src/features/spacecraft/where";

// SPHEREx's recorded state at mid-exposure of the first Iris frame (header X_SC… and VX_SC…, km and
// km/s, geocentric, ICRF-aligned). The expected values come from astropy 7 (GCRS → ITRS, get_sun).
const ISO = "2025-12-02T12:06:59.475";
const R: [number, number, number] = [-6445.162388862119, 2554.7445570790683, 1164.9117928838464];
const V: [number, number, number] = [1.5563548114357402, 0.5259860654002176, 7.350424549924576];

const deg = (x: number) => (x * 180) / Math.PI;

describe("where SPHEREx was", () => {
  it("matches astropy's Earth rotation angle", () => {
    expect(earthRotationDeg(julian(ISO))).toBeCloseTo(253.0051, 3);
    expect(earthRotationDeg(julian("2026-03-11T07:12:00"))).toBeCloseTo(276.6309, 3);
  });

  it("puts the Sun where astropy does, in the same axes as the headers", () => {
    for (const [iso, ra, dec] of [
      [ISO, 248.577, -21.975],
      ["2026-03-11T07:12:00", 351.133, -3.823],
    ] as const) {
      const s = sunDirection(julian(iso));
      expect(Math.abs((deg(Math.atan2(s[1], s[0])) + 360) % 360 - ra)).toBeLessThan(0.03);
      expect(Math.abs(deg(Math.asin(s[2])) - dec)).toBeLessThan(0.03);
    }
  });

  it("finds the ground point under the spacecraft", () => {
    const p = subPoint(R, earthRotationDeg(julian(ISO)));
    // astropy, geocentric: 9.40° N, 94.62° W. The pole's drift since 2000 is ignored, so allow 0.2°.
    expect(Math.abs(p.lat - 9.4)).toBeLessThan(0.2);
    expect(Math.abs(p.lon + 94.62)).toBeLessThan(0.2);
  });

  it("gives the height, speed and the target's angle from the Sun", () => {
    expect(norm(R) - EARTH_RADIUS_KM).toBeCloseTo(652.07, 1);
    expect(norm(V)).toBeCloseTo(7.532, 3);
    const sep = deg(Math.acos(dot(radecVector(161.29678, 2.44824), sunDirection(julian(ISO)))));
    expect(sep).toBeCloseTo(88.4, 0);
  });

  it("reads a frame's state only when it is complete", () => {
    const payload = {
      spacecraft: { frame: "GEOCENTER", positionKm: R, velocityKmS: V },
      time: { isoMid: ISO },
    };
    const target = { ra: 161.29678, dec: 2.44824 };
    expect(whereFrom(payload, target)).toEqual({ positionKm: R, velocityKmS: V, isoTime: ISO, target });
    expect(whereFrom({ ...payload, time: { isoMid: null } }, target)).toBeNull();
    expect(
      whereFrom({ ...payload, spacecraft: { frame: "GEOCENTER", positionKm: [R[0], null, R[2]], velocityKmS: V } }, target),
    ).toBeNull();
    expect(whereFrom({ ...payload, spacecraft: { frame: "GEOCENTER", positionKm: null, velocityKmS: V } }, target)).toBeNull();
  });
});
