import type { V3 } from "./earth";

/** One frame's view: SPHEREx's recorded geocentric state at mid-exposure, and what it looked at. */
export interface Where {
  positionKm: V3;
  velocityKmS: V3;
  isoTime: string;
  target: { ra: number; dec: number };
}

interface StateFields {
  spacecraft: {
    frame?: string;
    positionKm: ReadonlyArray<number | null> | null;
    velocityKmS: ReadonlyArray<number | null> | null;
  };
  time: { isoMid: string | null };
}

const vector = (xs: ReadonlyArray<number | null> | null): V3 | null =>
  xs?.length === 3 && xs.every((x) => typeof x === "number" && Number.isFinite(x)) ? (xs as V3) : null;

/** A frame's state as a `Where`, or null when its header lacks a time, position or velocity. */
export function whereFrom(payload: StateFields, target: { ra: number; dec: number }): Where | null {
  const positionKm = vector(payload.spacecraft.positionKm);
  const velocityKmS = vector(payload.spacecraft.velocityKmS);
  const isoTime = payload.time.isoMid;
  return positionKm && velocityKmS && isoTime ? { positionKm, velocityKmS, isoTime, target } : null;
}
