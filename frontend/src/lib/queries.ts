/** TanStack Query definitions for the API, so identical requests are shared and cached. */

import { queryOptions } from "@tanstack/react-query";

import { type DataSource, getJson } from "./api";
import { decodeCutout } from "./pixels";
import type { CutoutPayload, DecodedCutout, Observations, Target } from "./types";

export function resolveQuery(q: string, source: DataSource) {
  return queryOptions({
    queryKey: ["resolve", q.trim().toLowerCase(), source],
    queryFn: ({ signal }) => getJson<Target>("/resolve", { q: q.trim(), source }, signal),
    staleTime: Infinity,
  });
}

export function observationsQuery(ra: number, dec: number, source: DataSource) {
  return queryOptions({
    queryKey: ["observations", ra.toFixed(6), dec.toFixed(6), source],
    queryFn: ({ signal }) => getJson<Observations>("/observations", { ra, dec, source }, signal),
    staleTime: 60 * 60 * 1000,
  });
}

export function cutoutQuery(key: string, ra: number, dec: number, size: number, source: DataSource) {
  return queryOptions({
    queryKey: ["cutout", key, ra.toFixed(6), dec.toFixed(6), size, source],
    queryFn: async ({ signal }): Promise<DecodedCutout> => {
      const payload = await getJson<CutoutPayload>("/cutout", { key, ra, dec, size, source }, signal);
      return decodeCutout(payload);
    },
    staleTime: Infinity,
    gcTime: 20 * 60 * 1000,
    retry: 1,
  });
}
