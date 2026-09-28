import type { ObjectCategory, ObjectInfo } from "./types";

function sig(v: number, digits = 2): string {
  return Number(v.toPrecision(digits)).toLocaleString("en-GB");
}

/** "2.5 million light-years" and so on, rounded to two significant figures. */
export function formatLightYears(ly: number): string {
  if (ly < 1_000) return `${sig(ly)} light-years`;
  if (ly < 1_000_000) return `${sig(ly / 1_000)} thousand light-years`;
  if (ly < 1_000_000_000) return `${sig(ly / 1_000_000)} million light-years`;
  return `${sig(ly / 1_000_000_000)} billion light-years`;
}

export function formatDistance(d: NonNullable<ObjectInfo["distance"]>): string {
  return `${formatLightYears(d.lightYears)} (${sig(d.value, 3)} ${d.unit})`;
}

/** An angular size, in degrees, arcminutes or arcseconds as suits it. */
export function formatSize(size: NonNullable<ObjectInfo["size"]>): string {
  const fmt = (arcmin: number) => {
    if (arcmin >= 60) return `${sig(arcmin / 60)}°`;
    if (arcmin >= 1) return `${sig(arcmin)}′`;
    return `${sig(arcmin * 60)}″`;
  };
  return size.minorArcmin ? `${fmt(size.majorArcmin)} × ${fmt(size.minorArcmin)}` : fmt(size.majorArcmin);
}

export function formatMag(v: number | null | undefined): string | null {
  return v === null || v === undefined || !Number.isFinite(v) ? null : v.toFixed(1);
}

/** A field of view that frames the object: a little larger than its catalogued size. */
export function frameFov(info: ObjectInfo | null | undefined, fallback = 0.3): number {
  const major = info?.size?.majorArcmin;
  if (!major || !Number.isFinite(major)) return fallback;
  return Math.min(3, Math.max(0.12, (major / 60) * 1.5));
}

/** What SPHEREx's 0.75–5 µm view brings out, in general terms, for each kind of object. */
export const INFRARED_NOTE: Record<ObjectCategory, string> = {
  galaxy:
    "In SPHEREx's bands most of a galaxy's light comes from older, cooler stars, and the 3.3 µm channels pick up warm dust and organic (PAH) molecules where stars are forming.",
  star: "A star's colour across SPHEREx's 102 channels follows its temperature: cool red stars are brightest in the near-infrared, hot blue stars fade towards longer wavelengths.",
  nebula:
    "Infrared light passes through much of the dust that hides the inside of a nebula, and ices in cold dust absorb at about 3.0, 4.3 and 4.7 µm, all within SPHEREx's range.",
  cluster:
    "In the near-infrared a cluster's light is dominated by its cool giant stars; SPHEREx's 6-arcsecond pixels blend the most crowded parts together.",
  "solar-system":
    "Asteroids reflect sunlight and, further into the infrared, glow with their own warmth; between two SPHEREx visits they move against the fixed stars.",
  other:
    "SPHEREx sees this spot in 102 colours from 0.75 to 5 µm, building a spectrum from many exposures over each survey pass.",
};
