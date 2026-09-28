/**
 * Approximate heliocentric positions for the orrery on the landing page.
 *
 * Planets use JPL's "Keplerian Elements for Approximate Positions of the Major Planets" (Standish),
 * Table 1, valid 1800–2050: https://ssd.jpl.nasa.gov/planets/approx_pos.html
 * (7) Iris uses its osculating elements from the JPL Small-Body Database at epoch JD 2461200.5.
 * Positions are good to a degree or so, plenty for a picture and not meant for pointing a telescope.
 */

export type BodyId = "mercury" | "venus" | "earth" | "mars" | "iris" | "jupiter" | "saturn" | "uranus" | "neptune";

export interface OrbitalElements {
  /** Julian date the elements (and the rates) are referred to. */
  epoch: number;
  /** Semi-major axis (au) and eccentricity. */
  a: number;
  e: number;
  /** Inclination, mean longitude, longitude of perihelion, longitude of ascending node (degrees). */
  i: number;
  L: number;
  peri: number;
  node: number;
  /** Rates per Julian century for the angles above; `a` and `e` are held fixed. */
  iDot: number;
  LDot: number;
  periDot: number;
  nodeDot: number;
}

const J2000 = 2451545.0;
const DEG = Math.PI / 180;

function planet(
  a: number,
  e: number,
  i: number,
  L: number,
  peri: number,
  node: number,
  iDot: number,
  LDot: number,
  periDot: number,
  nodeDot: number,
): OrbitalElements {
  return { epoch: J2000, a, e, i, L, peri, node, iDot, LDot, periDot, nodeDot };
}

export const ELEMENTS: Record<BodyId, OrbitalElements> = {
  mercury: planet(
    0.38709927,
    0.20563593,
    7.00497902,
    252.2503235,
    77.45779628,
    48.33076593,
    -0.00594749,
    149472.67411175,
    0.16047689,
    -0.12534081,
  ),
  venus: planet(
    0.72333566,
    0.00677672,
    3.39467605,
    181.9790995,
    131.60246718,
    76.67984255,
    -0.0007889,
    58517.81538729,
    0.00268329,
    -0.27769418,
  ),
  earth: planet(
    1.00000261,
    0.01671123,
    -0.00001531,
    100.46457166,
    102.93768193,
    0,
    -0.01294668,
    35999.37244981,
    0.32327364,
    0,
  ),
  mars: planet(
    1.52371034,
    0.0933941,
    1.84969142,
    -4.55343205,
    -23.94362959,
    49.55953891,
    -0.00813131,
    19140.30268499,
    0.44441088,
    -0.29257343,
  ),
  jupiter: planet(
    5.202887,
    0.04838624,
    1.30439695,
    34.39644051,
    14.72847983,
    100.47390909,
    -0.00183714,
    3034.74612775,
    0.21252668,
    0.20469106,
  ),
  saturn: planet(
    9.53667594,
    0.05386179,
    2.48599187,
    49.95424423,
    92.59887831,
    113.66242448,
    0.00193609,
    1222.49362201,
    -0.41897216,
    -0.28867794,
  ),
  uranus: planet(
    19.18916464,
    0.04725744,
    0.77263783,
    313.23810451,
    170.9542763,
    74.01692503,
    -0.00242939,
    428.48202785,
    0.40805281,
    0.04240589,
  ),
  neptune: planet(
    30.06992276,
    0.00859048,
    1.77004347,
    -55.12002969,
    44.96476227,
    131.78422574,
    0.00035372,
    218.45945325,
    -0.32241464,
    -0.00508664,
  ),
  // SBDB: e 0.23027, a 2.38575 au, i 5.51857°, Ω 259.48514°, ω 145.40713°, M 115.29167°, n 0.2674654 °/day.
  iris: {
    epoch: 2461200.5,
    a: 2.385746302646938,
    e: 0.2302746853668762,
    i: 5.518567726455019,
    L: 259.4851402183693 + 145.4071283819921 + 115.2916674478007,
    peri: 259.4851402183693 + 145.4071283819921,
    node: 259.4851402183693,
    iDot: 0,
    LDot: 0.2674654469109276 * 36525,
    periDot: 0,
    nodeDot: 0,
  },
};

export interface HelioPosition {
  /** Ecliptic J2000 coordinates in au. */
  x: number;
  y: number;
  z: number;
  /** Distance from the Sun (au) and ecliptic longitude (degrees, 0–360). */
  r: number;
  lon: number;
}

export function julianDate(ms: number): number {
  return ms / 86_400_000 + 2440587.5;
}

export function normDeg(deg: number): number {
  const d = deg % 360;
  return d < 0 ? d + 360 : d;
}

/** Solve Kepler's equation E − e·sin E = M for the eccentric anomaly (radians). */
export function eccentricAnomaly(meanAnomaly: number, e: number): number {
  let E = e < 0.8 ? meanAnomaly : Math.PI;
  for (let k = 0; k < 12; k++) {
    const dE = (E - e * Math.sin(E) - meanAnomaly) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-10) break;
  }
  return E;
}

export function heliocentric(el: OrbitalElements, jd: number): HelioPosition {
  const T = (jd - el.epoch) / 36525;
  const i = (el.i + el.iDot * T) * DEG;
  const L = el.L + el.LDot * T;
  const peri = el.peri + el.periDot * T;
  const node = (el.node + el.nodeDot * T) * DEG;
  const omega = peri * DEG - node;
  const M = normDeg(L - peri) * DEG;
  const E = eccentricAnomaly(M > Math.PI ? M - 2 * Math.PI : M, el.e);

  const xp = el.a * (Math.cos(E) - el.e);
  const yp = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E);

  const cw = Math.cos(omega);
  const sw = Math.sin(omega);
  const cn = Math.cos(node);
  const sn = Math.sin(node);
  const ci = Math.cos(i);
  const si = Math.sin(i);

  const x = (cw * cn - sw * sn * ci) * xp + (-sw * cn - cw * sn * ci) * yp;
  const y = (cw * sn + sw * cn * ci) * xp + (-sw * sn + cw * cn * ci) * yp;
  const z = sw * si * xp + cw * si * yp;
  const r = Math.hypot(x, y, z);
  return { x, y, z, r, lon: normDeg(Math.atan2(y, x) / DEG) };
}

/** Points around the full orbit at `jd`, for drawing its ellipse. */
export function orbitPath(el: OrbitalElements, jd: number, steps = 180): HelioPosition[] {
  const T = (jd - el.epoch) / 36525;
  const current = normDeg(el.L + el.LDot * T - (el.peri + el.periDot * T));
  const period = 36525 * (360 / el.LDot);
  const points: HelioPosition[] = [];
  for (let k = 0; k < steps; k++) {
    // Walk mean anomaly evenly; position spacing follows the real speed along the orbit.
    const dM = (360 * k) / steps - current;
    points.push(heliocentric(el, jd + (dM / 360) * period));
  }
  return points;
}

/** Orbital period in days, from the mean-longitude rate. */
export function periodDays(el: OrbitalElements): number {
  return (360 / el.LDot) * 36525;
}

export interface ScaleView {
  /** Heliocentric distance (au) mapped to the edge of the drawing. */
  maxAu: number;
  /** Compression exponent: 1 is linear, smaller squeezes the outer planets inwards. */
  power: number;
}

export const VIEWS = {
  inner: { maxAu: 3.4, power: 0.85 },
  whole: { maxAu: 31.5, power: 0.42 },
} satisfies Record<string, ScaleView>;

export type ViewId = keyof typeof VIEWS;

/** Screen radius for a distance from the Sun, on a compressed scale so every orbit fits. */
export function displayRadius(au: number, view: ScaleView, edge: number): number {
  return edge * Math.pow(Math.max(au, 0) / view.maxAu, view.power);
}
