/**
 * Sonification: hear a spectrum or a light curve. In "spectrum" mode pitch follows wavelength
 * (redder is lower, as with sound and light) and loudness follows brightness; in "series" mode pitch
 * follows brightness through time. Every sound comes with a plain-language summary for screen readers.
 */
import { currentLang, type Lang, translate } from "../../lib/i18n";
import { AXIS_NAMES_BN, SONIFY } from "./messages";

export interface SonifyPoint {
  x: number;
  y: number;
}

export interface SonifySpec {
  mode: "spectrum" | "series";
  points: SonifyPoint[];
  /** For the summary, e.g. { x: "µm", y: "Jy" } and a noun for x, e.g. "wavelength". */
  units: { x: string; y: string };
  xName: string;
  /** Milliseconds per note. */
  noteMs?: number;
}

const LOW_HZ = 196; // G3
const HIGH_HZ = 1046; // C6

function extent(values: number[]): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return [lo, hi];
}

const clean = (points: SonifyPoint[]) =>
  points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)).sort((a, b) => a.x - b.x);

/** Frequencies and gains for each note, in playing order. */
export function score(spec: SonifySpec): Array<{ hz: number; gain: number }> {
  const pts = clean(spec.points);
  if (pts.length === 0) return [];
  const [xlo, xhi] = extent(pts.map((p) => p.x));
  const [ylo, yhi] = extent(pts.map((p) => p.y));
  const norm = (v: number, lo: number, hi: number) => (hi > lo ? (v - lo) / (hi - lo) : 0.5);
  // Pitch on a log scale, which is how we hear it.
  const pitch = (t: number) => LOW_HZ * Math.pow(HIGH_HZ / LOW_HZ, t);
  return pts.map((p) =>
    spec.mode === "spectrum"
      ? { hz: pitch(1 - norm(p.x, xlo, xhi)), gain: 0.15 + 0.85 * norm(p.y, ylo, yhi) }
      : { hz: pitch(norm(p.y, ylo, yhi)), gain: 0.7 },
  );
}

const fmt = (v: number) =>
  Math.abs(v) >= 100 || Math.abs(v) < 0.01 ? v.toPrecision(3) : Number(v.toPrecision(3)).toString();

/** A one-sentence description of the shape of the data. */
export function describeSeries(spec: SonifySpec, lang: Lang = "en"): string {
  const pts = clean(spec.points);
  if (pts.length < 2) return translate(SONIFY, lang, "tooFew");
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  const max = pts.reduce((a, b) => (b.y > a.y ? b : a));
  const min = pts.reduce((a, b) => (b.y < a.y ? b : a));
  // Least-squares slope, for the overall trend.
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p.x, 0) / n;
  const my = pts.reduce((s, p) => s + p.y, 0) / n;
  const slope = pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / pts.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  const span = (last.x - first.x) * slope;
  const trend = Math.abs(span) < 0.1 * Math.abs(max.y - min.y || 1) ? "level" : span > 0 ? "rises" : "falls";
  const toward = spec.mode === "spectrum" ? "longer" : "overTime";
  return translate(SONIFY, lang, "summary", {
    n,
    from: fmt(first.x),
    to: fmt(last.x),
    ux: spec.units.x,
    uy: spec.units.y,
    xName: lang === "bn" ? (AXIS_NAMES_BN[spec.xName] ?? spec.xName) : spec.xName,
    maxX: fmt(max.x),
    maxY: fmt(max.y),
    minX: fmt(min.x),
    trend: translate(SONIFY, lang, trend),
    toward: translate(SONIFY, lang, toward),
  });
}

/** Plays the notes; returns a handle to stop early and a promise that settles when it ends. */
export function play(spec: SonifySpec): { stop: () => void; done: Promise<void> } {
  const AudioCtx =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) throw new Error(translate(SONIFY, currentLang(), "cannotPlay"));
  const ctx = new AudioCtx();
  const master = ctx.createGain();
  master.gain.value = 0.22;
  master.connect(ctx.destination);
  const noteS = (spec.noteMs ?? 170) / 1000;
  const start = ctx.currentTime + 0.05;
  const notes = score(spec);
  notes.forEach((note, i) => {
    const t = start + i * noteS;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(note.hz, t);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(note.gain, t + 0.02);
    env.gain.exponentialRampToValueAtTime(0.001, t + noteS * 0.95);
    osc.connect(env).connect(master);
    osc.start(t);
    osc.stop(t + noteS);
  });
  let timer = 0;
  const done = new Promise<void>((resolve) => {
    timer = window.setTimeout(
      () => {
        void ctx.close();
        resolve();
      },
      (notes.length * noteS + 0.2) * 1000,
    );
  });
  return {
    stop: () => {
      window.clearTimeout(timer);
      void ctx.close();
    },
    done,
  };
}

/**
 * A rough spectrum from catalogue magnitudes, in janskys, using standard zero points (Johnson B, V;
 * Gaia G; 2MASS J, H, Ks). Good enough to hear a star's colour, not for measurement.
 */
const BANDS: Array<{ key: "B" | "V" | "G" | "J" | "H" | "K"; um: number; zeroJy: number }> = [
  { key: "B", um: 0.44, zeroJy: 4063 },
  { key: "V", um: 0.55, zeroJy: 3636 },
  { key: "G", um: 0.64, zeroJy: 3229 },
  { key: "J", um: 1.235, zeroJy: 1594 },
  { key: "H", um: 1.662, zeroJy: 1024 },
  { key: "K", um: 2.159, zeroJy: 666.7 },
];

export function magnitudesToSpectrum(
  mags: Partial<Record<"B" | "V" | "G" | "J" | "H" | "K", number | null>>,
): SonifyPoint[] {
  return BANDS.flatMap((b) => {
    const m = mags[b.key];
    return m === null || m === undefined || !Number.isFinite(m)
      ? []
      : [{ x: b.um, y: b.zeroJy * Math.pow(10, -0.4 * m) }];
  });
}
