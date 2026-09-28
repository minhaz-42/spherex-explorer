import { describe, expect, it } from "vitest";

import { bandAt, BANDS, channelEdges, channelOf } from "../src/components/space/bands";

describe("bands", () => {
  it("covers 0.75 to 5 µm with six bands of 17 channels", () => {
    expect(BANDS).toHaveLength(6);
    expect(BANDS[0]?.min).toBe(0.75);
    expect(BANDS[5]?.max).toBe(5.0);
    for (const b of BANDS) expect(channelEdges(b)).toHaveLength(18);
  });

  it("finds the band and channel of a wavelength", () => {
    expect(bandAt(3.0)?.n).toBe(4);
    expect(bandAt(4.27)?.n).toBe(5);
    expect(bandAt(0.6)).toBeUndefined();
    const b4 = BANDS[3]!;
    expect(channelOf(b4, b4.min)).toBe(1);
    expect(channelOf(b4, b4.max)).toBe(17);
  });
});
