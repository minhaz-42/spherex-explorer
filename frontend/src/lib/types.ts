/** Shapes of the API's JSON responses. Kept in step with backend/src/spherex_explorer/api. */

export interface Target {
  query: string;
  name: string | null;
  kind: string | null;
  otype: string | null;
  resolver: string;
  ra: number;
  dec: number;
  raHms: string;
  decDms: string;
  galactic: { l: number; b: number };
  ecliptic: { lon: number; lat: number };
  constellation: string;
  deepField: string | null;
}

export interface Frame {
  id: string;
  obsId: string;
  pointing: string;
  step: number;
  detector: number;
  collection: string;
  release: string;
  deep: boolean;
  key: string;
  irsaUrl: string;
  mjdStart: number;
  mjdEnd: number;
  mjdMid: number;
  isoMid: string;
  exposureS: number | null;
  bandMinUm: number | null;
  bandMaxUm: number | null;
  resolvingPower: number | null;
  footprint: [number, number][];
  wavelengthUm: number | null;
  bandwidthUm: number | null;
  targetPixel: [number, number] | null;
  passIndex: number;
}

export interface Pass {
  index: number;
  mjdStart: number;
  mjdEnd: number;
  isoStart: string;
  isoEnd: string;
  frames: number;
  pointings: number;
  detectors: Record<string, number>;
  releases: string[];
}

export interface Observations {
  target: Omit<Target, "query" | "name" | "kind" | "otype" | "resolver">;
  collections: string[];
  deepField: { name: string; window: [number, number] | null } | null;
  frames: Frame[];
  passes: Pass[];
  summary: {
    frames: number;
    passes: number;
    detectors: Record<string, number>;
    first: string | null;
    last: string | null;
  };
  retrievedAt: string;
  wavelengthNote: string;
}

export interface Photometry {
  fluxMicroJy: number | null;
  errorMicroJy: number | null;
  abMag: number | null;
  snr: number | null;
  backgroundMJySr: number | null;
  apertureRadiusArcsec: number;
  pixelsUsed: number;
  maskedInAperture: number;
  overflowInAperture: boolean;
  reliable: boolean;
  reasons: string[];
  method: string;
}

export interface CutoutPayload {
  key: string;
  obsId: string;
  detector: number;
  release: string;
  grid: { ra: number; dec: number; sizePx: number; scaleArcsec: number; projection: string };
  time: {
    mjdMid: number | null;
    isoMid: string | null;
    mjdStart: number | null;
    mjdEnd: number | null;
    exposureS: number | null;
  };
  wavelength: { atTargetUm: number | null; bandwidthUm: number | null; method: string };
  target: { pixel: [number, number]; inFrame: boolean; flags: string[] };
  background: {
    levelMJySr: number | null;
    rmsMJySr: number | null;
    zodiModelMJySr: number | null;
    method: string;
  };
  photometry: Photometry;
  image: {
    width: number;
    height: number;
    unit: string;
    dtype: "float32-le";
    data: string;
    stats: { p01: number; p50: number; p99: number; p995: number } | null;
  };
  mask: { dtype: "uint8"; bits: { flagged: number; noData: number }; maskedFlags: string[]; data: string };
  spacecraft: { frame: string; positionKm: (number | null)[]; velocityKmS: (number | null)[] };
  quality: { psfFwhmArcsec: number | null; pipeline: string | null };
  access: { via: "s3" | "ibe"; requests: number; notes: string[] };
  retrievedAt: string;
}

/** A cutout with its arrays decoded, ready to draw. */
export interface DecodedCutout {
  payload: CutoutPayload;
  width: number;
  height: number;
  pixels: Float32Array;
  mask: Uint8Array;
}

/** A frame's brightness and wavelength at the target, without pixels (``/api/measure``). */
export type Measurement = Pick<CutoutPayload, "key" | "obsId" | "detector" | "release" | "time" | "wavelength" | "target" | "photometry" | "background" | "retrievedAt">;

export interface KnownObject {
  name: string;
  vmag: number | null;
  rateArcsecPerHour: number | null;
  positions: { key: string; mjd: number; ra: number; dec: number; inField: boolean; distanceAu: number }[];
}

export interface KnownObjects {
  field: { ra: number; dec: number; sizeDeg: number };
  searched: { referenceKey: string; referenceMjd: number; halfWidthDeg: number; vmagLimit: number; candidates: number };
  objects: KnownObject[];
  framesWithoutState: string[];
  source: string;
  method: string;
  retrievedAt: string;
}
