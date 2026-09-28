/**
 * Earth-centred geometry for "Where was SPHEREx?": how far Earth has turned, the Sun's direction,
 * and the ground point under the spacecraft, all in the ICRF-aligned axes of the frame headers.
 * Good to about a tenth of a degree: the drift of Earth's pole since 2000 and nutation are ignored,
 * and UTC stands in for UT1 (they differ by under a second).
 */

export type V3 = [number, number, number];

const DEG = Math.PI / 180;
export const EARTH_RADIUS_KM = 6378.137;

export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const unit = (a: V3): V3 => {
  const n = norm(a) || 1;
  return [a[0] / n, a[1] / n, a[2] / n];
};

export function julian(iso: string): number {
  return Date.parse(iso.endsWith("Z") || /[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`) / 86_400_000 + 2440587.5;
}

/** Earth rotation angle (IAU 2000), in degrees: the angle of the Greenwich meridian from the x-axis. */
export function earthRotationDeg(jd: number): number {
  const turns = 0.779057273264 + 1.0027378119113546 * (jd - 2451545.0);
  return (((turns % 1) + 1) % 1) * 360;
}

/**
 * Unit vector towards the Sun (low-precision solar theory from the Astronomical Almanac), with its
 * longitude carried back from the equinox of date to J2000 so it shares the headers' axes.
 */
export function sunDirection(jd: number): V3 {
  const d = jd - 2451545.0;
  const g = (357.528 + 0.9856003 * d) * DEG;
  const precession = 1.396971 * (d / 36525);
  const lambda = (280.46 + 0.9856474 * d + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g) - precession) * DEG;
  const eps = 23.4392911 * DEG;
  return [Math.cos(lambda), Math.cos(eps) * Math.sin(lambda), Math.sin(eps) * Math.sin(lambda)];
}

/** Unit vector for right ascension and declination in degrees. */
export function radecVector(ra: number, dec: number): V3 {
  return [Math.cos(dec * DEG) * Math.cos(ra * DEG), Math.cos(dec * DEG) * Math.sin(ra * DEG), Math.sin(dec * DEG)];
}

/** Earth-fixed longitude and latitude (degrees) to a unit vector, with Earth turned by `rotation`. */
export function groundVector(lonDeg: number, latDeg: number, rotation: number): V3 {
  const lon = (lonDeg + rotation) * DEG;
  const lat = latDeg * DEG;
  return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
}

/** The point on Earth directly below a geocentric position (geocentric latitude). */
export function subPoint(positionKm: V3, rotation: number): { lat: number; lon: number } {
  const u = unit(positionKm);
  const lat = Math.asin(u[2]) / DEG;
  let lon = Math.atan2(u[1], u[0]) / DEG - rotation;
  lon = ((((lon + 180) % 360) + 360) % 360) - 180;
  return { lat, lon };
}

export function formatLatLon(p: { lat: number; lon: number }): string {
  const ns = p.lat >= 0 ? "N" : "S";
  const ew = p.lon >= 0 ? "E" : "W";
  return `${Math.abs(p.lat).toFixed(1)}° ${ns}, ${Math.abs(p.lon).toFixed(1)}° ${ew}`;
}
