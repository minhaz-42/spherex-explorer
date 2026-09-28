import { type Lang, translate } from "../../lib/i18n";
import { INFRARED, SHAPES } from "./messages";
import type { ObjectCategory, ObjectInfo } from "./types";

function sig(v: number, digits = 2): string {
  return Number(v.toPrecision(digits)).toLocaleString("en-GB");
}

/** "2.5 million light-years" and so on, rounded to two significant figures. */
export function formatLightYears(ly: number, lang: Lang = "en"): string {
  if (lang === "bn") return lightYearsBn(ly);
  if (ly < 1_000) return `${sig(ly)} light-years`;
  if (ly < 1_000_000) return `${sig(ly / 1_000)} thousand light-years`;
  if (ly < 1_000_000_000) return `${sig(ly / 1_000_000)} million light-years`;
  return `${sig(ly / 1_000_000_000)} billion light-years`;
}

const NBSP = "\u00a0";

/**
 * The same in Bangla, which counts in হাজার (1,000), লক্ষ (1,00,000) and কোটি (1,00,00,000), and a
 * billion is 100 crore (শত কোটি): 2.53 million light-years is "প্রায় 25 লক্ষ আলোকবর্ষ" and 12 million
 * is "প্রায় 1.2 কোটি আলোকবর্ষ". A rounded distance of a thousand or more says "about" (প্রায়), as
 * Bangla writing does; below 10,000 the number is written out ("প্রায় 1,500 আলোকবর্ষ"). The unit is
 * chosen after rounding, so 99,600 reads "প্রায় 1 লক্ষ", not "100 হাজার". A no-break space keeps each
 * number with its word, so a narrow column never ends a line on "25".
 */
function lightYearsBn(ly: number): string {
  const r = Number(ly.toPrecision(2));
  const n = (unit: number) => sig(r / unit) + NBSP;
  if (r < 1_000) return `${n(1)}আলোকবর্ষ`;
  if (r < 10_000) return `প্রায় ${n(1)}আলোকবর্ষ`;
  if (r < 100_000) return `প্রায় ${n(1_000)}হাজার আলোকবর্ষ`;
  if (r < 10_000_000) return `প্রায় ${n(100_000)}লক্ষ আলোকবর্ষ`;
  if (r < 1_000_000_000) return `প্রায় ${n(10_000_000)}কোটি আলোকবর্ষ`;
  return `প্রায় ${n(1_000_000_000)}শত কোটি আলোকবর্ষ`;
}

/**
 * Bangla text with each number joined to the unit or number word after it by a no-break space
 * ("3.3 µm", "25 লক্ষ", "31 কোটি km"), so a line never ends on the bare number.
 */
export function keepNumbersWithUnits(text: string): string {
  return text
    .replace(/(\d) (?=µm|km\b|au\b|kpc\b|Mpc\b|pc\b|আলোকবর্ষ|লক্ষ|কোটি|হাজার|বর্গডিগ্রি|গুণ|শতাংশ)/g, `$1${NBSP}`)
    .replace(/(লক্ষ|কোটি|হাজার) (?=km\b)/g, `$1${NBSP}`);
}

export function formatDistance(d: NonNullable<ObjectInfo["distance"]>, lang: Lang = "en"): string {
  // In Bangla the parsecs stay together, "(774 kpc)", as the longer Bangla words wrap more often.
  const space = lang === "bn" ? NBSP : " ";
  return `${formatLightYears(d.lightYears, lang)} (${sig(d.value, 3)}${space}${d.unit})`;
}

/**
 * How the API measured a distance, in the reader's language. The API writes "parallax", "1 published
 * measurement" or "median of N published measurements"; anything else is shown as it is.
 */
export function distanceMethod(method: string, lang: Lang = "en"): string {
  if (lang !== "bn") return method;
  if (method === "parallax") return "লম্বন";
  if (method === "1 published measurement") return "1টি প্রকাশিত পরিমাপ";
  const median = /^median of (\d+) published measurements$/.exec(method);
  return median ? `${median[1]}টি প্রকাশিত পরিমাপের মধ্যক` : method;
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
export function morphologyWords(code: string | null | undefined, lang: Lang = "en"): string | null {
  const text = code?.trim() ?? "";
  const family = /^(cE|dE|E|SAB|SA|SB|S|IAB|IB|IA|Irr|I)/.exec(text)?.[1];
  if (!family) return null;
  // The stage after the family, without notes on rings and arms such as "(s)" or "(rs)".
  const stage = text.slice(family.length).replace(/\([^)]*\)/g, "").trim();
  const words = (key: keyof (typeof SHAPES)["en"]) => translate(SHAPES, lang, key);
  if (family === "dE") return words("dwarfElliptical");
  if (family === "E" || family === "cE") return words("elliptical");
  if (family.startsWith("I")) return words(family.includes("B") ? "barredIrregular" : "irregular");
  if (stage.startsWith("0")) return words("lenticular");
  const magellanic = /^m(?![a-z])|^mpec/.test(stage);
  if (family === "SB") return words(magellanic ? "barredMagellanic" : "barredSpiral");
  if (family === "SAB") return words(magellanic ? "weakBarMagellanic" : "weakBarSpiral");
  return words(magellanic ? "magellanic" : "spiral");
}

const MAX_LABEL = 22;
// A Bangla letter is about 1.4 Latin letters wide on the map, so fewer fit.
const MAX_LABEL_BN = 16;

function letters(text: string): number {
  return typeof Intl.Segmenter === "function"
    ? Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)).length
    : text.length;
}

/**
 * A label shortened to fit the sky map. Bangla is cut between words and counted in letters: one
 * Bangla letter is often several characters (a consonant with a vowel sign, or a conjunct), and a cut
 * inside one would show a broken glyph.
 */
export function mapLabel(label: string, lang: Lang = "en"): string {
  if (lang !== "bn") return label.length > MAX_LABEL ? `${label.slice(0, MAX_LABEL - 1)}…` : label;
  if (letters(label) <= MAX_LABEL_BN) return label;
  const words = label.split(" ");
  let short = words[0] ?? label;
  for (const word of words.slice(1)) {
    if (letters(`${short} ${word}`) > MAX_LABEL_BN - 1) break;
    short = `${short} ${word}`;
  }
  return `${short}…`;
}

/** A field of view that frames the object: a little larger than its catalogued size. */
export function frameFov(info: ObjectInfo | null | undefined, fallback = 0.3): number {
  const major = info?.size?.majorArcmin;
  if (!major || !Number.isFinite(major)) return fallback;
  return Math.min(3, Math.max(0.12, (major / 60) * 1.5));
}

/** What SPHEREx's 0.75–5 µm view brings out, in general terms, for each kind of object (in English). */
export const INFRARED_NOTE: Record<ObjectCategory, string> = INFRARED.en;

/** The same note in the reader's language. */
export function infraredNote(category: ObjectCategory, lang: Lang = "en"): string {
  return lang === "bn" ? keepNumbersWithUnits(INFRARED.bn[category]) : INFRARED.en[category];
}
