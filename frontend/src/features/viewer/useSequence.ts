import type { UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";

import type { DataSource } from "../../lib/api";
import { cutoutQuery } from "../../lib/queries";
import { loadOrder } from "../../lib/sequence";
import type { DecodedCutout, Frame } from "../../lib/types";
import { useQueued } from "../../lib/useQueued";

export const MAX_IN_FLIGHT = 4;

export interface SequenceState {
  results: UseQueryResult<DecodedCutout, Error>[];
  loaded: number;
  failed: number;
}

/**
 * Cutouts for every frame of a sequence, fetched at most ``MAX_IN_FLIGHT`` at a time, in the
 * order a visitor needs them: pinned frames (the reference), the current frame, then outwards.
 */
export function useSequence(
  frames: Frame[],
  current: number,
  target: { ra: number; dec: number },
  size: number,
  source: DataSource,
  pinned: number[] = [],
): SequenceState {
  const order = useMemo(() => {
    const base = loadOrder(frames.length, current);
    const first = pinned.filter((i) => i >= 0 && i < frames.length);
    return [...new Set([...first, ...base])];
  }, [frames.length, current, pinned]);
  const options = useMemo(
    () => frames.map((f) => cutoutQuery(f.key, target.ra, target.dec, size, source)),
    [frames, target.ra, target.dec, size, source],
  );
  const results = useQueued(options, order, MAX_IN_FLIGHT);
  const loaded = results.filter((r) => r.status === "success").length;
  const failed = results.filter((r) => r.status === "error").length;
  return { results, loaded, failed };
}
