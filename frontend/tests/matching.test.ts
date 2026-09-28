import { describe, expect, it } from "vitest";

import { matchCandidate, separationArcsec } from "../src/lib/matching";
import type { KnownObject, MovingCandidate } from "../src/lib/types";

const candidate: MovingCandidate = {
  id: "C1",
  strength: "candidate",
  rateArcsecPerHour: 39.3,
  positionAngleDeg: 122.5,
  residualArcsec: 0.4,
  sightings: [
    { mjd: 61011.505, ra: 161.2040, dec: 2.5074, snr: 900, keys: ["a1", "a2"] },
    { mjd: 61011.909, ra: 161.2968, dec: 2.4482, snr: 900, keys: ["b1"] },
  ],
};

function body(name: string, dRa: number): KnownObject {
  return {
    name,
    vmag: 10.2,
    rateArcsecPerHour: 39,
    positions: [
      { key: "a1", mjd: 61011.505, ra: 161.2040 + dRa, dec: 2.5074, inField: true, distanceAu: 2.07 },
      { key: "a2", mjd: 61011.506, ra: 161.2040 + dRa, dec: 2.5074, inField: true, distanceAu: 2.07 },
      { key: "b1", mjd: 61011.909, ra: 161.2968 + dRa, dec: 2.4482, inField: true, distanceAu: 2.07 },
    ],
  };
}

describe("matching candidates with JPL predictions", () => {
  it("measures angles on the sky", () => {
    expect(separationArcsec(10, 0, 10, 1 / 3600)).toBeCloseTo(1, 6);
    expect(separationArcsec(0, 60, 1 / 3600, 60)).toBeCloseTo(0.5, 4);
  });

  it("matches a candidate that follows a predicted track", () => {
    const m = matchCandidate(candidate, [body("7 Iris (A847 PA)", 0.3 / 3600)]);
    expect(m?.name).toBe("7 Iris (A847 PA)");
    expect(m?.medianOffsetArcsec).toBeLessThan(1);
    expect(m?.compared).toBe(2);
  });

  it("leaves a candidate unmatched when no prediction is near", () => {
    expect(matchCandidate(candidate, [body("far away", 60 / 3600)])).toBeNull();
    expect(matchCandidate(candidate, [])).toBeNull();
  });

  it("picks the closest of several bodies", () => {
    const m = matchCandidate(candidate, [body("B", 8 / 3600), body("A", 1 / 3600)]);
    expect(m?.name).toBe("A");
  });
});
