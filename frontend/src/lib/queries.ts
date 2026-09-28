/** TanStack Query definitions for the API, so identical requests are shared and cached. */

import { queryOptions } from "@tanstack/react-query";

import { type DataSource, getJson, postJson } from "./api";
import { decodeCutout } from "./pixels";
import type { Candidates, CasesFile, CutoutPayload, DecodedCutout, KnownObjects, Measurement, Observations, Target } from "./types";

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

export function measureQuery(key: string, ra: number, dec: number, source: DataSource) {
  return queryOptions({
    queryKey: ["measure", key, ra.toFixed(6), dec.toFixed(6), source],
    queryFn: ({ signal }) => getJson<Measurement>("/measure", { key, ra, dec, source }, signal),
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
}

export function knownObjectsQuery(ra: number, dec: number, size: number, keys: string[], source: DataSource) {
  const sorted = [...keys].sort();
  return queryOptions({
    queryKey: ["known", ra.toFixed(6), dec.toFixed(6), size, sorted.join("|"), source],
    queryFn: ({ signal }) => postJson<KnownObjects>("/known-objects", { ra, dec, size, keys: sorted }, { source }, signal),
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
    retry: false,
  });
}

export function candidatesQuery(ra: number, dec: number, size: number, keys: string[], source: DataSource) {
  const sorted = [...keys].sort();
  return queryOptions({
    queryKey: ["candidates", ra.toFixed(6), dec.toFixed(6), size, sorted.join("|"), source],
    queryFn: ({ signal }) => postJson<Candidates>("/candidates", { ra, dec, size, keys: sorted }, { source }, signal),
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
    retry: false,
  });
}

export function casesQuery() {
  return queryOptions({
    queryKey: ["cases"],
    queryFn: ({ signal }) => getJson<CasesFile>("/cases", {}, signal),
    staleTime: 10 * 60 * 1000,
  });
}

/** The explorer link that opens a Discover case. */
export function caseLink(c: { target: { ra: number; dec: number; name: string }; viewer: Record<string, string | number> }, source?: DataSource): string {
  const p = new URLSearchParams({ ra: String(c.target.ra), dec: String(c.target.dec), name: c.target.name });
  for (const [k, v] of Object.entries(c.viewer)) p.set(k, String(v));
  if (source === "snapshot") p.set("source", "snapshot");
  return `/explore?${p.toString()}`;
}
