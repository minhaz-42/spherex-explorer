/**
 * The six SPHEREx detector bands (SPHEREx Explanatory Supplement, QR) and a few spectral features
 * that fall inside them. Each detector sits behind a linear variable filter split into 17 channels.
 */
export interface Band {
  n: 1 | 2 | 3 | 4 | 5 | 6;
  min: number;
  max: number;
  /** Spectral resolving power λ/Δλ. */
  R: number;
  what: string;
}

export const BANDS: Band[] = [
  {
    n: 1,
    min: 0.75,
    max: 1.09,
    R: 39,
    what: "Just redder than your eyes can see. Mostly the light of ordinary stars.",
  },
  { n: 2, min: 1.1, max: 1.62, R: 41, what: "Up to the 1.6 µm bump, where the light of old stars in galaxies peaks." },
  {
    n: 3,
    min: 1.63,
    max: 2.41,
    R: 41,
    what: "Sees through dust. Glowing hydrogen (Paschen-α, 1.88 µm) marks regions forming stars.",
  },
  { n: 4, min: 2.42, max: 3.82, R: 35, what: "Water ice absorbs at 3.0 µm and sooty PAH molecules glow at 3.3 µm." },
  {
    n: 5,
    min: 3.83,
    max: 4.41,
    R: 112,
    what: "Carbon-dioxide ice (4.27 µm) and hydrogen Brackett-α (4.05 µm), at finer resolution.",
  },
  {
    n: 6,
    min: 4.42,
    max: 5.0,
    R: 128,
    what: "Carbon-monoxide ice (4.67 µm), seen at SPHEREx's finest spectral resolution.",
  },
];

export const CHANNELS_PER_BAND = 17;

export interface Feature {
  wavelength: number;
  label: string;
}

export const FEATURES: Feature[] = [
  { wavelength: 1.875, label: "Paschen-α" },
  { wavelength: 3.0, label: "water ice" },
  { wavelength: 3.3, label: "PAH" },
  { wavelength: 4.05, label: "Brackett-α" },
  { wavelength: 4.27, label: "CO₂ ice" },
  { wavelength: 4.67, label: "CO ice" },
];

export function bandAt(wavelength: number): Band | undefined {
  return BANDS.find((b) => wavelength >= b.min && wavelength <= b.max);
}

/**
 * Channel edges inside a band. The resolving power is constant across a band, so channels are
 * evenly spaced in log wavelength.
 */
export function channelEdges(band: Band): number[] {
  const ratio = band.max / band.min;
  return Array.from({ length: CHANNELS_PER_BAND + 1 }, (_, k) => band.min * Math.pow(ratio, k / CHANNELS_PER_BAND));
}

/** 1-based channel number of a wavelength inside its band. */
export function channelOf(band: Band, wavelength: number): number {
  const k = Math.floor((Math.log(wavelength / band.min) / Math.log(band.max / band.min)) * CHANNELS_PER_BAND);
  return Math.min(CHANNELS_PER_BAND, Math.max(1, k + 1));
}
