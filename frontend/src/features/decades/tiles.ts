import { queryOptions } from "@tanstack/react-query";

import { type DataSource, getJson } from "../../lib/api";

/** One photographic survey plate, from /api/plate (STScI Digitized Sky Survey). */
export interface Plate {
  survey: "poss1" | "poss2";
  label: string;
  band: string;
  /** Date the plate was exposed (UTC, ISO date). */
  epoch: string;
  plate: string | null;
  telescope: string | null;
  /** A north-up PNG of the field as a data: URL. */
  png: string;
  credit: string;
}

export function plateQuery(ra: number, dec: number, fovDeg: number, survey: Plate["survey"], source: DataSource) {
  return queryOptions({
    queryKey: ["plate", survey, ra.toFixed(4), dec.toFixed(4), fovDeg.toPrecision(3), source],
    queryFn: ({ signal }) =>
      getJson<Plate>(
        "/plate",
        { ra: ra.toFixed(5), dec: dec.toFixed(5), fov: fovDeg.toPrecision(3), survey, size: 384, source },
        signal,
      ),
    staleTime: Infinity,
    retry: false,
  });
}

/** Decimal year of an ISO date or datetime (UTC). */
export function decimalYear(iso: string): number {
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
  const y = d.getUTCFullYear();
  const start = Date.UTC(y, 0, 1);
  const end = Date.UTC(y + 1, 0, 1);
  return y + (d.getTime() - start) / (end - start);
}

/**
 * Where a star with proper motion (mas/yr, pmRA already multiplied by cos δ) sits at `year`, as
 * pixel offsets in a north-up, east-left tile of `sizePx` covering `fovDeg`, centred on (cRa, cDec).
 * The catalogue position (ra, dec) is for epoch J2000.
 */
export function positionAt(
  star: { ra: number; dec: number; pmRa: number; pmDec: number },
  year: number,
  centre: { ra: number; dec: number },
  fovDeg: number,
  sizePx: number,
): { x: number; y: number } {
  const dt = year - 2000;
  const east = (star.ra - centre.ra) * Math.cos((centre.dec * Math.PI) / 180) * 3600 + (star.pmRa / 1000) * dt;
  const north = (star.dec - centre.dec) * 3600 + (star.pmDec / 1000) * dt;
  const scale = sizePx / (fovDeg * 3600);
  return { x: sizePx / 2 - east * scale, y: sizePx / 2 - north * scale };
}

/**
 * A field that holds a moving star's whole track from `fromYear` to `toYear`: centred on the middle
 * of the track, and at least `minFovDeg` across.
 */
export function trackField(
  star: { ra: number; dec: number; pmRa: number; pmDec: number },
  fromYear: number,
  toYear: number,
  minFovDeg: number,
): { ra: number; dec: number; fovDeg: number } {
  const mid = (fromYear + toYear) / 2 - 2000;
  const cosd = Math.cos((star.dec * Math.PI) / 180);
  const ra = star.ra + ((star.pmRa / 1000) * mid) / 3600 / cosd;
  const dec = star.dec + ((star.pmDec / 1000) * mid) / 3600;
  const lengthDeg = ((Math.hypot(star.pmRa, star.pmDec) / 1000) * (toYear - fromYear)) / 3600;
  return { ra, dec, fovDeg: Math.min(0.5, Math.max(minFovDeg, lengthDeg * 1.5)) };
}
