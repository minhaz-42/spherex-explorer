import { describe, expect, it } from "vitest";

import { exportName, videoType } from "../src/features/share/exportBlink";
import { describeSeries, magnitudesToSpectrum, score } from "../src/features/share/sonify";

describe("export", () => {
  it("names files from their titles", () => {
    expect(exportName("Asteroid (7) Iris near 36 Sextantis", "gif")).toBe(
      "spherex-asteroid-7-iris-near-36-sextantis.gif",
    );
    expect(exportName("", "webm")).toBe("spherex-blink.webm");
  });

  it("knows when the browser cannot record video", () => {
    // jsdom has no MediaRecorder.
    expect(videoType()).toBeNull();
  });
});

describe("sonification", () => {
  const spectrum = {
    mode: "spectrum" as const,
    points: [
      { x: 2.2, y: 1 },
      { x: 0.55, y: 4 },
      { x: 1.2, y: 2 },
    ],
    units: { x: "µm", y: "Jy" },
    xName: "wavelength",
  };

  it("plays longer wavelengths lower, and brighter points louder", () => {
    const notes = score(spectrum);
    // Sorted by wavelength: 0.55, 1.2, 2.2 µm.
    expect(notes[0]!.hz).toBeGreaterThan(notes[1]!.hz);
    expect(notes[1]!.hz).toBeGreaterThan(notes[2]!.hz);
    expect(notes[0]!.gain).toBeGreaterThan(notes[2]!.gain);
  });

  it("describes the shape of the data in words", () => {
    const text = describeSeries(spectrum);
    expect(text).toContain("3 points from 0.55 to 2.2 µm");
    expect(text).toContain("Brightest at wavelength 0.55 µm");
    expect(text).toContain("falls towards longer wavelengths");
  });

  it("turns catalogue magnitudes into a rough spectrum", () => {
    const pts = magnitudesToSpectrum({ V: 0, K: 0, J: null });
    expect(pts).toHaveLength(2);
    expect(pts[0]!.x).toBeCloseTo(0.55);
    expect(pts[0]!.y).toBeCloseTo(3636);
    expect(pts[1]!.y).toBeCloseTo(666.7);
  });
});
