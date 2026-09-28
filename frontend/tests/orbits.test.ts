import { describe, expect, it } from "vitest";

import {
  displayRadius,
  eccentricAnomaly,
  ELEMENTS,
  heliocentric,
  julianDate,
  periodDays,
  VIEWS,
} from "../src/components/space/orbits";

const angleGap = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

describe("orbits", () => {
  it("converts Unix time to Julian date", () => {
    expect(julianDate(Date.UTC(2000, 0, 1, 12))).toBeCloseTo(2451545.0, 6);
  });

  it("solves Kepler's equation", () => {
    for (const e of [0, 0.2, 0.6]) {
      for (const M of [0.1, 1, 2.5, -2]) {
        const E = eccentricAnomaly(M, e);
        expect(E - e * Math.sin(E)).toBeCloseTo(M, 9);
      }
    }
  });

  it("puts Earth where the Sun's longitude says it should be", () => {
    // Earth's heliocentric longitude is the Sun's geocentric longitude plus 180°.
    // J2000.0: the Sun is at 280.46°. At the September equinox 2026 (23 Sep, 00:05 UTC) it is at
    // 180° of date, which is about 0.37° less in the J2000 frame the elements use (precession).
    expect(angleGap(heliocentric(ELEMENTS.earth, 2451545.0).lon, 100.46)).toBeLessThan(0.5);
    expect(angleGap(heliocentric(ELEMENTS.earth, julianDate(Date.UTC(2026, 8, 23, 0, 5))).lon, 359.63)).toBeLessThan(
      0.5,
    );
  });

  it("keeps each body at a sensible distance from the Sun", () => {
    const jd = julianDate(Date.UTC(2026, 8, 28));
    for (const [id, el] of Object.entries(ELEMENTS)) {
      const r = heliocentric(el, jd).r;
      expect(r, id).toBeGreaterThanOrEqual(el.a * (1 - el.e) - 1e-6);
      expect(r, id).toBeLessThanOrEqual(el.a * (1 + el.e) + 1e-6);
    }
  });

  it("gives the known orbital periods", () => {
    expect(periodDays(ELEMENTS.earth)).toBeCloseTo(365.25, 0);
    expect(periodDays(ELEMENTS.mars)).toBeCloseTo(687, 0);
    expect(periodDays(ELEMENTS.iris)).toBeCloseTo(1346, 0);
  });

  it("maps distances onto the drawing so every orbit fits", () => {
    expect(displayRadius(VIEWS.whole.maxAu, VIEWS.whole, 300)).toBeCloseTo(300);
    expect(displayRadius(ELEMENTS.neptune.a, VIEWS.whole, 300)).toBeLessThanOrEqual(300);
    expect(displayRadius(ELEMENTS.mars.a, VIEWS.inner, 300)).toBeLessThan(300);
  });
});
