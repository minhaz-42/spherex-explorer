import { describe, expect, it } from "vitest";

import { formatGap, formatRange, mjdToDate } from "../src/lib/format";
import { buildSequence, compatibility, defaultSpec, gapsDays, loadOrder, wavelengthSequence } from "../src/lib/sequence";
import type { Frame, Pass } from "../src/lib/types";

function frame(over: Partial<Frame>): Frame {
  return {
    id: "id",
    obsId: "2025W49_1A_0332_1",
    pointing: "2025W49_1A_0332",
    step: 1,
    detector: 2,
    collection: "spherex_qr2",
    release: "qr2",
    deep: false,
    key: "k",
    irsaUrl: "u",
    mjdStart: 61011.5,
    mjdEnd: 61011.501,
    mjdMid: 61011.5005,
    isoMid: "2025-12-02T12:00:43.200",
    exposureS: 113.58,
    bandMinUm: 1.1,
    bandMaxUm: 1.65,
    resolvingPower: 41,
    footprint: [],
    wavelengthUm: 1.2,
    bandwidthUm: 0.03,
    targetPixel: [100, 100],
    passIndex: 0,
    ...over,
  };
}

describe("compatibility", () => {
  it("allows a difference within half a spectral channel on one detector", () => {
    const c = compatibility(frame({ wavelengthUm: 1.2 }), frame({ wavelengthUm: 1.21, mjdMid: 61200 }));
    expect(c.ok).toBe(true);
    expect(c.reasons).toEqual([]);
  });

  it("refuses frames that saw different wavelengths and says why", () => {
    const c = compatibility(frame({ wavelengthUm: 1.13 }), frame({ wavelengthUm: 1.51 }));
    expect(c.ok).toBe(false);
    expect(c.reasons[0]).toMatch(/1\.130 µm and 1\.510 µm/);
    expect(c.reasons[0]).toMatch(/not a change in time/);
  });

  it("refuses different detectors and unknown wavelengths", () => {
    expect(compatibility(frame({ detector: 2 }), frame({ detector: 5 })).ok).toBe(false);
    expect(compatibility(frame({ wavelengthUm: null }), frame({})).ok).toBe(false);
  });

  it("cautions about mixing releases without refusing", () => {
    const c = compatibility(frame({ release: "qr2" }), frame({ release: "qr3" }));
    expect(c.ok).toBe(true);
    expect(c.cautions.join(" ")).toMatch(/QR2 and QR3/);
  });
});

describe("sequences", () => {
  const frames: Frame[] = [
    frame({ obsId: "a_1", pointing: "a", mjdMid: 1, wavelengthUm: 1.2, passIndex: 0 }),
    frame({ obsId: "a_2", pointing: "a", mjdMid: 1.001, wavelengthUm: 1.23, passIndex: 0 }),
    frame({ obsId: "b_1", pointing: "b", mjdMid: 1.4, wavelengthUm: 1.5, passIndex: 0 }),
    frame({ obsId: "c_1", pointing: "c", mjdMid: 180, wavelengthUm: 1.205, passIndex: 1 }),
    frame({ obsId: "c_2", pointing: "c", mjdMid: 180.001, wavelengthUm: 1.19, passIndex: 1 }),
    frame({ obsId: "d_1", pointing: "d", detector: 5, mjdMid: 1, wavelengthUm: 4.0, passIndex: 0 }),
  ];

  it("keeps one detector of one pass in time order", () => {
    const seq = buildSequence(frames, { mode: "pass", detector: 2, passIndex: 0, wavelengthUm: null });
    expect(seq.map((f) => f.obsId)).toEqual(["a_1", "a_2", "b_1"]);
  });

  it("matches a wavelength across passes, one frame per pointing", () => {
    const seq = wavelengthSequence(frames, 2, 1.2);
    expect(seq.map((f) => f.obsId)).toEqual(["a_1", "c_1"]);
  });

  it("labels gaps and loads outward from the current frame", () => {
    expect(gapsDays(frames.slice(0, 3)).map((g) => Math.round(g * 1000))).toEqual([0, 1, 399]);
    expect(loadOrder(5, 2)).toEqual([2, 3, 1, 4, 0]);
    expect(loadOrder(3, 0)).toEqual([0, 1, 2]);
    expect(loadOrder(0, 0)).toEqual([]);
  });

  it("starts on the latest pass and its best-covered detector", () => {
    const passes = [
      { index: 0, detectors: { "2": 3, "5": 1 } },
      { index: 1, detectors: { "3": 4, "6": 9 } },
    ] as unknown as Pass[];
    expect(defaultSpec(passes)).toMatchObject({ passIndex: 1, detector: 6, mode: "pass" });
  });
});

describe("formatting", () => {
  it("writes gaps in plain units", () => {
    expect(formatGap(2 / 1440)).toBe("2 min");
    expect(formatGap(9.7 / 24)).toBe("9.7 h");
    expect(formatGap(3.25)).toBe("3.3 days");
    expect(formatGap(180)).toBe("5.9 months");
  });

  it("writes date ranges compactly", () => {
    expect(formatRange("2025-07-09", "2025-07-22")).toBe("9 – 22 Jul 2025");
    expect(formatRange("2025-12-18", "2026-01-04")).toBe("18 Dec 2025 – 4 Jan 2026");
  });

  it("converts MJD to dates", () => {
    expect(mjdToDate(61027.215650564).toISOString()).toBe("2025-12-18T05:10:32.209Z");
  });
});
