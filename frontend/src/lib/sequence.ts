/**
 * Which frames make up the sequence being viewed, and whether two frames can be compared.
 *
 * SPHEREx images a place through a filter whose wavelength changes across the detector, so two
 * frames of the same place usually saw it at different wavelengths. These rules keep the viewer
 * from presenting a spectral difference as a change in time.
 */

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
 * Can ``b − a`` be shown as a change? Only when both frames come from the same detector and saw the
 * target within half a spectral channel of each other. Everything is on one grid already.
 */
export function compatibility(
  a: Pick<Frame, "detector" | "wavelengthUm" | "bandwidthUm" | "mjdMid" | "release">,
  b: Pick<Frame, "detector" | "wavelengthUm" | "bandwidthUm" | "mjdMid" | "release">,
): Compatibility {
  const reasons: string[] = [];
  const cautions: string[] = [];
  const deltaDays = Math.abs(b.mjdMid - a.mjdMid);
  let deltaWavelengthUm: number | null = null;
  if (a.detector !== b.detector) {
    reasons.push(`They come from different detectors (D${a.detector} and D${b.detector}), which see different wavelength ranges.`);
  }
  if (a.wavelengthUm == null || b.wavelengthUm == null || a.bandwidthUm == null || b.bandwidthUm == null) {
    reasons.push("The wavelength at the target is not known for both frames.");
  } else {
    deltaWavelengthUm = b.wavelengthUm - a.wavelengthUm;
    const channel = Math.min(a.bandwidthUm, b.bandwidthUm);
    if (Math.abs(deltaWavelengthUm) > 0.5 * channel) {
      reasons.push(
        `They saw the target at ${a.wavelengthUm.toFixed(3)} µm and ${b.wavelengthUm.toFixed(3)} µm, more than half a ` +
          `spectral channel (${(0.5 * channel).toFixed(3)} µm) apart. A difference would mostly show how the ` +
          `sources' brightness varies with wavelength, not a change in time.`,
      );
    }
  }
  if (a.release !== b.release) {
    cautions.push(
      `The frames come from different data releases (${a.release.toUpperCase()} and ${b.release.toUpperCase()}), ` +
        "which were calibrated differently; small brightness differences may be calibration.",
    );
  }
  if (deltaDays < 0.01) {
    cautions.push("The frames are only minutes apart; only fast-moving objects will have moved.");
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
