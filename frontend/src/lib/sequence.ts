/**
 * Which frames make up the sequence being viewed, and whether two frames can be compared.
 *
 * SPHEREx images a place through a filter whose wavelength changes across the detector, so two
 * frames of the same place usually saw it at different wavelengths. These rules keep the viewer
 * from presenting a spectral difference as a change in time.
 */

import { defineMessages, type Lang, translate } from "./i18n";
import type { Frame, Pass } from "./types";

export type SequenceMode = "pass" | "wavelength";

export interface SequenceSpec {
  mode: SequenceMode;
  detector: number;
  passIndex: number; // for "pass"
  wavelengthUm: number | null; // for "wavelength": the reference wavelength
}

/** Frames of one detector within one pass, in time order. */
export function passSequence(frames: Frame[], passIndex: number, detector: number): Frame[] {
  return frames.filter((f) => f.passIndex === passIndex && f.detector === detector);
}

/**
 * Frames of one detector, from any pass, that saw the target within half a spectral channel of
 * ``wavelengthUm``. Only the closest frame per pointing is kept, so a matched sequence steps
 * through time rather than through the small steps of one pointing.
 */
export function wavelengthSequence(frames: Frame[], detector: number, wavelengthUm: number): Frame[] {
  const best = new Map<string, Frame>();
  for (const f of frames) {
    if (f.detector !== detector || f.wavelengthUm == null || f.bandwidthUm == null) continue;
    const offset = Math.abs(f.wavelengthUm - wavelengthUm);
    if (offset > 0.5 * f.bandwidthUm) continue;
    const current = best.get(f.pointing);
    if (!current || offset < Math.abs(current.wavelengthUm! - wavelengthUm)) best.set(f.pointing, f);
  }
  return [...best.values()].sort((a, b) => a.mjdMid - b.mjdMid);
}

export function buildSequence(frames: Frame[], spec: SequenceSpec): Frame[] {
  if (spec.mode === "wavelength" && spec.wavelengthUm != null) {
    return wavelengthSequence(frames, spec.detector, spec.wavelengthUm);
  }
  return passSequence(frames, spec.passIndex, spec.detector);
}

/** A sensible first view: the most recent pass, and its best-covered detector. */
export function defaultSpec(passes: Pass[]): SequenceSpec {
  const pass = passes[passes.length - 1];
  if (!pass) return { mode: "pass", detector: 1, passIndex: 0, wavelengthUm: null };
  let detector = 1;
  let count = -1;
  for (const [d, n] of Object.entries(pass.detectors)) {
    if (n > count) {
      count = n;
      detector = Number(d);
    }
  }
  return { mode: "pass", detector, passIndex: pass.index, wavelengthUm: null };
}

/** How many frames each detector has in a pass (for the band selector). */
export function detectorCounts(frames: Frame[], passIndex: number | null): Record<number, number> {
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const f of frames) {
    if (passIndex === null || f.passIndex === passIndex) counts[f.detector] = (counts[f.detector] ?? 0) + 1;
  }
  return counts;
}

/** Gaps between consecutive frames, in days, used to label the timeline. */
export function gapsDays(sequence: Frame[]): number[] {
  return sequence.map((f, i) => (i === 0 ? 0 : f.mjdMid - sequence[i - 1]!.mjdMid));
}

export interface Compatibility {
  ok: boolean;
  /** Why a difference image would be misleading, in plain words. */
  reasons: string[];
  /** Things that are allowed but worth knowing. */
  cautions: string[];
  deltaWavelengthUm: number | null;
  deltaDays: number;
}

/**
 * The comparison rules in words. These are the app's validity rules, so the Bangla says exactly what
 * the English says: between frames that saw different wavelengths, a brightness difference mostly
 * shows the sources' colours, not a change in time.
 */
const RULES = defineMessages({
  en: {
    detectors: "They come from different detectors (D{a} and D{b}), which see different wavelength ranges.",
    unknown: "The wavelength at the target is not known for both frames.",
    wavelengths:
      "They saw the target at {a} µm and {b} µm, more than half a spectral channel ({half} µm) apart. A difference would mostly show how the sources' brightness varies with wavelength, not a change in time.",
    releases:
      "The frames come from different data releases ({a} and {b}), which were calibrated differently; small brightness differences may be calibration.",
    minutes: "The frames are only minutes apart; only fast-moving objects will have moved.",
  },
  bn: {
    detectors: "ফ্রেম দুটি ভিন্ন ডিটেক্টরের (D{a} ও D{b}), যেগুলো তরঙ্গদৈর্ঘ্যের ভিন্ন ভিন্ন পরিসর দেখে।",
    unknown: "দুটি ফ্রেমের অন্তত একটির ক্ষেত্রে লক্ষ্যে তরঙ্গদৈর্ঘ্য জানা নেই।",
    wavelengths:
      "ফ্রেম দুটি লক্ষ্যকে দেখেছে {a} µm ও {b} µm-এ, অর্ধেক বর্ণালি-চ্যানেলের ({half} µm) চেয়ে বেশি ব্যবধানে। পার্থক্য নিলে মূলত দেখা যেত তরঙ্গদৈর্ঘ্যভেদে উৎসগুলোর উজ্জ্বলতার তারতম্য, সময়ের সঙ্গে পরিবর্তন নয়।",
    releases:
      "ফ্রেমগুলো ভিন্ন ভিন্ন ডেটা রিলিজের ({a} ও {b}), যেগুলো ভিন্নভাবে ক্যালিব্রেট করা হয়েছিল; উজ্জ্বলতার ছোট পার্থক্য হয়তো ক্যালিব্রেশনের কারণে।",
    minutes: "ফ্রেমগুলোর মধ্যে মাত্র কয়েক মিনিটের ব্যবধান; কেবল দ্রুতগামী বস্তুই সরে থাকবে।",
  },
});

/**
 * Can ``b − a`` be shown as a change? Only when both frames come from the same detector and saw the
 * target within half a spectral channel of each other. Everything is on one grid already.
 */
export function compatibility(
  a: Pick<Frame, "detector" | "wavelengthUm" | "bandwidthUm" | "mjdMid" | "release">,
  b: Pick<Frame, "detector" | "wavelengthUm" | "bandwidthUm" | "mjdMid" | "release">,
  lang: Lang = "en",
): Compatibility {
  const reasons: string[] = [];
  const cautions: string[] = [];
  const deltaDays = Math.abs(b.mjdMid - a.mjdMid);
  let deltaWavelengthUm: number | null = null;
  if (a.detector !== b.detector) {
    reasons.push(translate(RULES, lang, "detectors", { a: a.detector, b: b.detector }));
  }
  if (a.wavelengthUm == null || b.wavelengthUm == null || a.bandwidthUm == null || b.bandwidthUm == null) {
    reasons.push(translate(RULES, lang, "unknown"));
  } else {
    deltaWavelengthUm = b.wavelengthUm - a.wavelengthUm;
    const channel = Math.min(a.bandwidthUm, b.bandwidthUm);
    if (Math.abs(deltaWavelengthUm) > 0.5 * channel) {
      reasons.push(
        translate(RULES, lang, "wavelengths", {
          a: a.wavelengthUm.toFixed(3),
          b: b.wavelengthUm.toFixed(3),
          half: (0.5 * channel).toFixed(3),
        }),
      );
    }
  }
  if (a.release !== b.release) {
    cautions.push(translate(RULES, lang, "releases", { a: a.release.toUpperCase(), b: b.release.toUpperCase() }));
  }
  if (deltaDays < 0.01) {
    cautions.push(translate(RULES, lang, "minutes"));
  }
  return { ok: reasons.length === 0, reasons, cautions, deltaWavelengthUm, deltaDays };
}

/**
 * The order in which to load a sequence: the current frame, then outwards from it, so the frames a
 * visitor is about to see arrive first.
 */
export function loadOrder(length: number, current: number): number[] {
  const order: number[] = [];
  if (length <= 0) return order;
  const c = Math.min(Math.max(current, 0), length - 1);
  order.push(c);
  for (let d = 1; order.length < length; d++) {
    if (c + d < length) order.push(c + d);
    if (c - d >= 0) order.push(c - d);
  }
  return order;
}
