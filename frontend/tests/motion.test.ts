import { describe, expect, it } from "vitest";

import { J2000_MJD, formatPm, julianYear, moved, parsePm, speedMas } from "../src/lib/motion";

describe("proper motion", () => {
  it("moves Barnard's Star about 4.4′ north by 2026", () => {
    // SIMBAD: J2000 position and Gaia motion of Barnard's Star.
    const now = moved(269.4520769, 4.6933650, -801.551 / 1000, 10362.394 / 1000, 26);
    expect((now.dec - 4.693365) * 3600).toBeCloseTo(269.4, 0);
    expect((now.ra - 269.4520769) * 3600 * Math.cos((4.6934 * Math.PI) / 180)).toBeCloseTo(-20.8, 0);
  });

  it("converts MJD to Julian years", () => {
    expect(julianYear(J2000_MJD)).toBe(2000);
    expect(julianYear(57170)).toBeCloseTo(2015.402, 3);
  });

  it("wraps RA and keeps dec on the sphere", () => {
    expect(moved(359.9999, 0, 10, 0, 1).ra).toBeLessThan(1);
    expect(moved(10, 89.99999, 0, 100, 10).dec).toBe(90);
  });

  it("reads and writes the URL form", () => {
    expect(parsePm("-801.55,10362.39")).toEqual({ pmRa: -801.55, pmDec: 10362.39, epoch: 2000 });
    expect(parsePm("abc")).toBeNull();
    expect(parsePm(null)).toBeNull();
    expect(formatPm({ pmRa: -801.551, pmDec: 10362.394 })).toBe("-801.55,10362.39");
    expect(speedMas({ pmRa: 3, pmDec: 4 })).toBe(5);
    expect(speedMas(null)).toBe(0);
  });
});
