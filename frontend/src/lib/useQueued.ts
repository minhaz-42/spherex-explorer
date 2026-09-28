import { useQueries, type UseQueryOptions, type UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";

/**
 * Run many queries at most ``maxInFlight`` at a time, in the given order of indices.
 *
 * A first set of disabled observers reads each query's status from the cache; the second set
 * enables finished queries plus the next few in line. Both observe the same cache entries, so a
 * query finishing re-renders the component and lets the next one start.
 */
export function useQueued<T, K extends readonly unknown[]>(
  options: UseQueryOptions<T, Error, T, K>[],
  order: number[],
  maxInFlight: number,
  active = true,
): UseQueryResult<T, Error>[] {
  const probe = useQueries({ queries: options.map((o) => ({ ...o, enabled: false })) });
  const enabled = useMemo(() => {
    const on = new Set<number>();
    if (!active) return on;
    let inFlight = 0;
    for (const i of order) {
      const q = probe[i];
      if (!q) continue;
      if (q.status === "success" || q.status === "error") {
        on.add(i);
      } else if (inFlight < maxInFlight) {
        on.add(i);
        inFlight++;
      }
    }
    return on;
  }, [order, probe, maxInFlight, active]);
  return useQueries({ queries: options.map((o, i) => ({ ...o, enabled: enabled.has(i) })) });
}
