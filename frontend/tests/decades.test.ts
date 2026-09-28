import { describe, expect, it } from "vitest";

import { decimalYear, positionAt, trackField } from "../src/features/decades/tiles";

// Barnard's Star, SIMBAD J2000 position with Gaia DR3 proper motion (mas/yr, pmRA includes cos δ).
const BARNARD = { ra: 269.452083, dec: 4.693364, pmRa: -801.551, pmDec: 10362.394 };

describe("decades maths", () => {
  it("turns dates into decimal years", () => {
    expect(decimalYear("2000-01-01")).toBeCloseTo(2000, 6);
    expect(decimalYear("1950-07-09")).toBeCloseTo(1950.52, 2);
  });

  it("frames the whole 1950–2026 track of Barnard's Star", () => {
    const field = trackField(BARNARD, 1950, 2026, 0.15);
    // 10.39″/yr for 76 years is about 13.2′; the field adds a margin.
    expect(field.fovDeg * 60).toBeGreaterThan(13.2);
    expect(field.fovDeg).toBeLessThanOrEqual(0.5);
    // The track's midpoint (1988) is south of the J2000 position, because the star moves north.
    expect(field.dec).toBeLessThan(BARNARD.dec);
  });

  it("puts the 1950 and 2026 positions symmetrically either side of the centre, north up", () => {
    const field = trackField(BARNARD, 1950, 2026, 0.15);
    const then = positionAt(BARNARD, 1950, field, field.fovDeg, 100);
    const now = positionAt(BARNARD, 2026, field, field.fovDeg, 100);
    expect(then.y).toBeGreaterThan(50); // lower on screen: further south
    expect(now.y).toBeLessThan(50);
    expect(then.y - 50).toBeCloseTo(50 - now.y, 6);
    // It drifts slightly west (to the right on a north-up, east-left image) as it goes north.
    expect(now.x).toBeGreaterThan(then.x);
    for (const p of [then, now]) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(100);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(100);
    }
  });
});
