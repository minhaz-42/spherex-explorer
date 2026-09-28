/**
 * Sky coordinates on the viewer's grid: a gnomonic (TAN) projection centred on the target, north
 * up, east left, as built by the server (backend science/grid.py).
 */

const DEG = Math.PI / 180;

export interface GridSpec {
  ra: number;
  dec: number;
  sizePx: number;
  scaleArcsec: number;
}

/**
 * RA/Dec (degrees) of a point given in screen-oriented grid pixels: ``x`` to the right and ``y``
 * down from the top edge, both measured in pixels from the grid's top-left corner.
 */
export function gridToSky(grid: GridSpec, x: number, yFromTop: number): { ra: number; dec: number } {
  const c = grid.sizePx / 2; // centre of the grid in edge coordinates
  const s = (grid.scaleArcsec / 3600) * DEG;
  const xi = -(x - c) * s; // east is to the left
  const eta = (c - yFromTop) * s; // north is up
  const a0 = grid.ra * DEG;
  const d0 = grid.dec * DEG;
  const rho = Math.hypot(xi, eta);
  const cc = Math.atan(rho);
  const sinc = Math.sin(cc);
  const cosc = Math.cos(cc);
  const dec = rho === 0 ? d0 : Math.asin(cosc * Math.sin(d0) + (eta * sinc * Math.cos(d0)) / rho);
  const ra = a0 + Math.atan2(xi * sinc, rho * Math.cos(d0) * cosc - eta * Math.sin(d0) * sinc);
  return { ra: ((ra / DEG) % 360 + 360) % 360, dec: dec / DEG };
}

/** Screen-oriented grid pixel (x right, y down, from the top-left corner) of an RA/Dec. */
export function skyToGrid(grid: GridSpec, ra: number, dec: number): { x: number; y: number } | null {
  const a = ra * DEG;
  const d = dec * DEG;
  const a0 = grid.ra * DEG;
  const d0 = grid.dec * DEG;
  const cosc = Math.sin(d0) * Math.sin(d) + Math.cos(d0) * Math.cos(d) * Math.cos(a - a0);
  if (cosc <= 0) return null;
  const xi = (Math.cos(d) * Math.sin(a - a0)) / cosc;
  const eta = (Math.cos(d0) * Math.sin(d) - Math.sin(d0) * Math.cos(d) * Math.cos(a - a0)) / cosc;
  const s = (grid.scaleArcsec / 3600) * DEG;
  const c = grid.sizePx / 2;
  return { x: c - xi / s, y: c - eta / s };
}

export function formatRa(ra: number): string {
  const h = ra / 15;
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  const ss = ((h - hh) * 60 - mm) * 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${ss.toFixed(1).padStart(4, "0")}`;
}

export function formatDec(dec: number): string {
  const sign = dec < 0 ? "−" : "+";
  const a = Math.abs(dec);
  const dd = Math.floor(a);
  const mm = Math.floor((a - dd) * 60);
  const ss = ((a - dd) * 60 - mm) * 60;
  return `${sign}${String(dd).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${ss.toFixed(0).padStart(2, "0")}`;
}
