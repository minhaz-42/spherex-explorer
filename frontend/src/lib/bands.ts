/** SPHEREx detector bands (IRSA archive user guide) and the colours used for wavelength. */

export interface Band {
  detector: number;
  minUm: number;
  maxUm: number;
  resolvingPower: number;
  color: string;
}

export const BANDS: Band[] = [
  { detector: 1, minUm: 0.75, maxUm: 1.09, resolvingPower: 39, color: "var(--band-1)" },
  { detector: 2, minUm: 1.1, maxUm: 1.62, resolvingPower: 41, color: "var(--band-2)" },
  { detector: 3, minUm: 1.63, maxUm: 2.41, resolvingPower: 41, color: "var(--band-3)" },
  { detector: 4, minUm: 2.42, maxUm: 3.82, resolvingPower: 35, color: "var(--band-4)" },
  { detector: 5, minUm: 3.83, maxUm: 4.41, resolvingPower: 112, color: "var(--band-5)" },
  { detector: 6, minUm: 4.42, maxUm: 5.0, resolvingPower: 128, color: "var(--band-6)" },
];

export function band(detector: number): Band {
  return BANDS[Math.min(Math.max(detector, 1), 6) - 1]!;
}

/** Detectors that look at the same patch of sky at the same moment, through a dichroic. */
export function partner(detector: number): number {
  return detector <= 3 ? detector + 3 : detector - 3;
}

// Hex stops matching --band-1 … --band-6, for places that need a computed colour (canvas, SVG).
const STOPS: [number, [number, number, number]][] = [
  [0.75, [0x7d, 0x97, 0xff]],
  [1.36, [0x4f, 0xb3, 0xd9]],
  [2.02, [0x5c, 0xcf, 0x9d]],
  [3.12, [0xc9, 0xd6, 0x5a]],
  [4.12, [0xf2, 0xa9, 0x3b]],
  [5.0, [0xff, 0x7a, 0x66]],
];

/** A colour for any wavelength between 0.75 and 5 µm, interpolated between the band colours. */
export function wavelengthColor(um: number | null | undefined): string {
  if (um == null || !Number.isFinite(um)) return "rgb(128 128 128)";
  const x = Math.min(Math.max(um, STOPS[0]![0]), STOPS[STOPS.length - 1]![0]);
  for (let i = 1; i < STOPS.length; i++) {
    const [x1, c1] = STOPS[i]!;
    const [x0, c0] = STOPS[i - 1]!;
    if (x <= x1) {
      const t = (x - x0) / (x1 - x0);
      const c = c0.map((v, k) => Math.round(v + (c1[k]! - v) * t));
      return `rgb(${c[0]} ${c[1]} ${c[2]})`;
    }
  }
  return "rgb(255 122 102)";
}

/** Plain description of where a wavelength sits, for visitors. */
export function describeWavelength(um: number): string {
  if (um < 1.0) return "just beyond red light";
  if (um < 2.5) return "near-infrared, where starlight dominates";
  if (um < 3.5) return "infrared where water ice and organic molecules absorb";
  return "infrared where carbon dioxide and carbon monoxide ices absorb";
}
