import { useQueries, type UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";

import type { DataSource } from "../../lib/api";
import { cutoutQuery } from "../../lib/queries";
import { loadOrder } from "../../lib/sequence";
import type { DecodedCutout, Frame } from "../../lib/types";

export const MAX_IN_FLIGHT = 4;

export interface SequenceState {
  results: UseQueryResult<DecodedCutout, Error>[];
  loaded: number;
  failed: number;
}

/**
 * Cutouts for every frame of a sequence, fetched at most ``MAX_IN_FLIGHT`` at a time, in the
 * order a visitor needs them: the current frame, then its neighbours, then the rest.
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

  // First pass: which queries already have data or an error (they are cheap to "enable").
  const probe = useQueries({
    queries: frames.map((f) => ({
      ...cutoutQuery(f.key, target.ra, target.dec, size, source),
      enabled: false,
    })),
  });

  const enabled = useMemo(() => {
    const on = new Set<number>();
    let inFlight = 0;
    for (const i of order) {
      const q = probe[i];
      if (!q) continue;
      if (q.status === "success" || q.status === "error") {
        on.add(i);
        continue;
      }
      if (inFlight < MAX_IN_FLIGHT) {
        on.add(i);
        inFlight++;
      }
    }
    return on;
  }, [order, probe]);

  const results = useQueries({
    queries: frames.map((f, i) => ({
      ...cutoutQuery(f.key, target.ra, target.dec, size, source),
      enabled: enabled.has(i),
    })),
  });

  const loaded = results.filter((r) => r.status === "success").length;
  const failed = results.filter((r) => r.status === "error").length;
  return { results, loaded, failed };
}
