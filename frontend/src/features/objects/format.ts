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

/**
 * A SIMBAD identifier as people write it, without SIMBAD's own prefixes (NAME, and * ** V* for stars,
 * double stars and variables): "M  31" is "M 31", "NAME Centaurus A" is "Centaurus A", "*  36 Sex" is "36 Sex".
 */
export function displayId(id: string): string {
  const plain = id.replace(/^(NAME|V\*|\*\*|\*)\s+/, "").replace(/\s+/g, " ").trim();
  // Bayer letters: SIMBAD writes "alf CMa" and "ome02 Sco" for α CMa and ω² Sco.
  return plain.replace(/^([a-z]{2,3})\.?(\d\d)?(?= )/, (all, abbr: string, n: string | undefined) => {
    const letter = GREEK[abbr];
    if (!letter) return all;
    return letter + (n ? String(Number(n)).replace(/\d/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(d)]!) : "");
  });
}

const GREEK: Record<string, string> = {
  alf: "α", bet: "β", gam: "γ", del: "δ", eps: "ε", zet: "ζ", eta: "η", tet: "θ",
  iot: "ι", kap: "κ", lam: "λ", mu: "μ", nu: "ν", ksi: "ξ", omi: "ο", pi: "π",
  rho: "ρ", sig: "σ", tau: "τ", ups: "υ", phi: "φ", chi: "χ", psi: "ψ", ome: "ω",
};

/**
 * Plain words for a galaxy's catalogued morphology (de Vaucouleurs type, as SIMBAD gives it), e.g.
 * "SA(s)b" is a spiral, "SB(s)m" a barred Magellanic spiral. Null when the code cannot be read.
 */
export function morphologyWords(code: string | null | undefined): string | null {
  const text = code?.trim() ?? "";
  const family = /^(cE|dE|E|SAB|SA|SB|S|IAB|IB|IA|Irr|I)/.exec(text)?.[1];
  if (!family) return null;
  // The stage after the family, without notes on rings and arms such as "(s)" or "(rs)".
  const stage = text.slice(family.length).replace(/\([^)]*\)/g, "").trim();
  if (family === "dE") return "Dwarf elliptical galaxy";
  if (family === "E" || family === "cE") return "Elliptical galaxy";
  if (family.startsWith("I")) return family.includes("B") ? "Barred irregular galaxy" : "Irregular galaxy";
  if (stage.startsWith("0")) return "Lenticular galaxy";
  const bar = family === "SB" ? "Barred " : family === "SAB" ? "Weakly barred " : "";
  const kind = /^m(?![a-z])|^mpec/.test(stage) ? "Magellanic spiral" : "spiral";
  const words = `${bar}${kind} galaxy`;
  return words.charAt(0).toUpperCase() + words.slice(1);
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
