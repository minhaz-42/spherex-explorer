import { queryOptions } from "@tanstack/react-query";

import { ApiError, type DataSource, getJson } from "../../lib/api";
import type { FieldObjects, ObjectInfo, Survey } from "./types";

// Rounded so nearby positions share a cache entry; SIMBAD positions are far more precise than this matters.
const round = (v: number, d = 5) => Number(v.toFixed(d));

/** The most-studied catalogued object at a position, or null when SIMBAD has nothing there. */
export function objectQuery(ra: number, dec: number, source: DataSource = "live") {
  return queryOptions({
    queryKey: ["object", round(ra), round(dec), source],
    queryFn: async ({ signal }) => {
      try {
        // Nothing catalogued there is an ordinary answer, `{ object: null }`; a 404 is a spot the
        // demo snapshot did not record.
        const info = await getJson<ObjectInfo | { object: null }>(
          "/object",
          { ra: round(ra, 6), dec: round(dec, 6), source },
          signal,
        );
        return "id" in info ? info : null;
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });
}

export function fieldObjectsQuery(ra: number, dec: number, radiusDeg: number, source: DataSource = "live") {
  return queryOptions({
    queryKey: ["field-objects", round(ra), round(dec), radiusDeg, source],
    queryFn: ({ signal }) =>
      getJson<FieldObjects>(
        "/field-objects",
        { ra: round(ra, 6), dec: round(dec, 6), radius: radiusDeg, limit: 40, source },
        signal,
      ),
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });
}

/** A JPEG of this patch of sky from another survey, served (and cached) by our own API. */
export function imageUrl(ra: number, dec: number, fovDeg: number, survey: Survey, size = 256): string {
  const p = new URLSearchParams({
    ra: ra.toFixed(4),
    dec: dec.toFixed(4),
    fov: String(Number(Math.min(5, Math.max(0.02, fovDeg)).toPrecision(3))),
    survey,
    size: String(size),
  });
  return `/api/object-image?${p.toString()}`;
}

/**
 * Surveys shown beside SPHEREx, with the light each one records. `bn` holds the label in Bangla and the
 * same light as Bangla says "in visible light" (আলোয়, -রেডে), for the image descriptions; band and
 * credit are names and numbers, the same in both languages.
 */
export const SURVEYS: Array<{ id: Survey; label: string; band: string; credit: string; bn: { label: string; seen: string } }> = [
  {
    id: "dss",
    label: "Visible light",
    band: "0.4–0.7 µm · DSS2",
    credit: "DSS2 (STScI/AURA)",
    bn: { label: "দৃশ্যমান আলো", seen: "দৃশ্যমান আলোয়" },
  },
  {
    id: "2mass",
    label: "Near-infrared",
    band: "1.2–2.2 µm · 2MASS",
    credit: "2MASS (UMass/IPAC-Caltech)",
    bn: { label: "নিকট-ইনফ্রারেড", seen: "নিকট-ইনফ্রারেডে" },
  },
  {
    id: "wise",
    label: "Mid-infrared",
    band: "3.4–22 µm · AllWISE",
    credit: "AllWISE (NASA/JPL-Caltech)",
    bn: { label: "মধ্য-ইনফ্রারেড", seen: "মধ্য-ইনফ্রারেডে" },
  },
];
