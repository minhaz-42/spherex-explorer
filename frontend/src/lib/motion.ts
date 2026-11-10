/** Moving a star along its proper motion, to say where it is on a given date. */

const DEG = Math.PI / 180;
/** MJD of epoch J2000.0 (2000 January 1, 12:00 TT). */
export const J2000_MJD = 51544.5;
const DAYS_PER_YEAR = 365.25;

/** The Julian year of a Modified Julian Date: 2000.0 at J2000. */
export function julianYear(mjd: number): number {
  return 2000 + (mjd - J2000_MJD) / DAYS_PER_YEAR;
}

/**
 * Where a source at (ra, dec) moving `pmRa`, `pmDec` arcsec/yr (the RA part times cos dec) is
 * `years` later. A straight line on the sky, which is exact enough for decades of motion at the
 * arcsecond level SPHEREx resolves; it ignores parallax (under 0.8″ for every star).
 */
export function moved(ra: number, dec: number, pmRa: number, pmDec: number, years: number): { ra: number; dec: number } {
  const d = Math.max(-90, Math.min(90, dec + (pmDec * years) / 3600));
  const cos = Math.cos(dec * DEG);
  const dRa = cos > 1e-9 ? (pmRa * years) / 3600 / cos : 0;
  return { ra: (((ra + dRa) % 360) + 360) % 360, dec: d };
}

/** Total proper motion, mas/yr; zero when there is none. */
export function speedMas(motion: { pmRa: number; pmDec: number } | null | undefined): number {
  return motion ? Math.hypot(motion.pmRa, motion.pmDec) : 0;
}

/** Faster than this (mas/yr), a star has moved by a SPHEREx pixel (6.15″) or more since 2000. */
export const VISIBLE_MOTION_MAS = 200;

/** `pm=-801.55,10362.39` in a URL (mas/yr) → the motion, or null when absent or malformed. */
export function parsePm(value: string | null): { pmRa: number; pmDec: number; epoch: number } | null {
  if (!value) return null;
  const parts = value.split(",").map(Number);
  if (parts.length !== 2 || !parts.every(Number.isFinite)) return null;
  return { pmRa: parts[0]!, pmDec: parts[1]!, epoch: 2000 };
}

export function formatPm(motion: { pmRa: number; pmDec: number }): string {
  return `${motion.pmRa.toFixed(2)},${motion.pmDec.toFixed(2)}`;
}
