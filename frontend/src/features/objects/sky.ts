/** Sky-coordinate helpers for the locator map. Angles in degrees, J2000 / ICRS. */

const DEG = Math.PI / 180;
const OBLIQUITY = 23.4392911;

// The north galactic pole and the galactic longitude of the north celestial pole (J2000).
const NGP_RA = 192.85948;
const NGP_DEC = 27.12825;
const L_NCP = 122.93192;

function wrap360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Galactic (l, b) to equatorial [ra, dec]. */
export function galacticToEquatorial(l: number, b: number): [number, number] {
  const sb = Math.sin(b * DEG);
  const cb = Math.cos(b * DEG);
  const sd = Math.sin(NGP_DEC * DEG);
  const cd = Math.cos(NGP_DEC * DEG);
  const dl = (L_NCP - l) * DEG;
  const dec = Math.asin(sb * sd + cb * cd * Math.cos(dl));
  const ra = NGP_RA * DEG + Math.atan2(cb * Math.sin(dl), sb * cd - cb * sd * Math.cos(dl));
  return [wrap360(ra / DEG), dec / DEG];
}

/** Ecliptic (lon, lat) to equatorial [ra, dec]. */
export function eclipticToEquatorial(lon: number, lat: number): [number, number] {
  const e = OBLIQUITY * DEG;
  const l = lon * DEG;
  const b = lat * DEG;
  const dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
  const ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
  return [wrap360(ra / DEG), dec / DEG];
}

/**
 * Hammer (equal-area) projection of the sky centred on RA 0h, with right ascension increasing to the
 * left as the sky is seen from Earth. Returns x in [−2√2, 2√2] and y in [−√2, √2].
 */
export function hammer(ra: number, dec: number): { x: number; y: number } {
  let lon = wrap360(ra);
  if (lon > 180) lon -= 360;
  const lam = -lon * DEG;
  const phi = dec * DEG;
  const z = Math.sqrt(1 + Math.cos(phi) * Math.cos(lam / 2));
  return { x: (2 * Math.SQRT2 * Math.cos(phi) * Math.sin(lam / 2)) / z, y: (Math.SQRT2 * Math.sin(phi)) / z };
}
