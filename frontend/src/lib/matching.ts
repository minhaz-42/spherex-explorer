/** Compare our moving-source candidates with JPL's predictions for catalogued bodies. */

import type { KnownObject, MovingCandidate } from "./types";

const DEG = Math.PI / 180;

export function separationArcsec(ra1: number, dec1: number, ra2: number, dec2: number): number {
  const a = Math.sin(((dec2 - dec1) * DEG) / 2) ** 2;
  const b = Math.cos(dec1 * DEG) * Math.cos(dec2 * DEG) * Math.sin(((ra2 - ra1) * DEG) / 2) ** 2;
  return (2 * Math.asin(Math.min(1, Math.sqrt(a + b)))) / DEG * 3600;
}

export interface Match {
  name: string;
  medianOffsetArcsec: number;
  compared: number;
}

/** Two SPHEREx pixels: a match must agree with the prediction to about the size of a star. */
export const MATCH_ARCSEC = 12.3;

/**
 * The known body a candidate is, if any: for every sighting, JPL's predicted position in the
 * same frames; the candidate matches when the median offset is under ``MATCH_ARCSEC``.
 */
export function matchCandidate(candidate: MovingCandidate, known: KnownObject[]): Match | null {
  let best: Match | null = null;
  for (const body of known) {
    const byKey = new Map(body.positions.map((p) => [p.key, p]));
    const offsets: number[] = [];
    for (const s of candidate.sightings) {
      const preds = s.keys.map((k) => byKey.get(k)).filter((p) => p !== undefined);
      if (preds.length === 0) continue;
      const ra = preds.reduce((t, p) => t + p.ra, 0) / preds.length;
      const dec = preds.reduce((t, p) => t + p.dec, 0) / preds.length;
      offsets.push(separationArcsec(s.ra, s.dec, ra, dec));
    }
    if (offsets.length === 0) continue;
    offsets.sort((x, y) => x - y);
    const mid = Math.floor(offsets.length / 2);
    const median = offsets.length % 2 ? offsets[mid]! : (offsets[mid - 1]! + offsets[mid]!) / 2;
    if (median <= MATCH_ARCSEC && (!best || median < best.medianOffsetArcsec)) {
      best = { name: body.name, medianOffsetArcsec: median, compared: offsets.length };
    }
  }
  return best;
}
