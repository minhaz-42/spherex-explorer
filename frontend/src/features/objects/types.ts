/** Answers from /api/object and /api/field-objects (SIMBAD, CDS Strasbourg). */

export type ObjectCategory = "galaxy" | "star" | "nebula" | "cluster" | "solar-system" | "other";

export interface Magnitudes {
  B?: number | null;
  V?: number | null;
  G?: number | null;
  J?: number | null;
  H?: number | null;
  K?: number | null;
}

export interface ObjectInfo {
  id: string;
  name: string | null;
  otype: string;
  typeLabel: string;
  category: ObjectCategory;
  ra: number;
  dec: number;
  separationArcsec: number;
  aliases: string[];
  spectralType: string | null;
  morphology: string | null;
  magnitudes: Magnitudes;
  parallaxMas: number | null;
  distance: { value: number; unit: string; lightYears: number; method: string } | null;
  redshift: number | null;
  radialVelocityKms: number | null;
  size: { majorArcmin: number; minorArcmin: number | null } | null;
  /** SIMBAD proper motion in mas/yr; raMasYr already includes cos δ. */
  properMotion?: { raMasYr: number; decMasYr: number } | null;
  references: number;
  links: { simbad?: string; ned?: string };
  credit: string;
}

export interface FieldObject {
  id: string;
  name: string | null;
  otype: string;
  typeLabel: string;
  category: ObjectCategory;
  ra: number;
  dec: number;
  separationArcmin: number;
  magnitudes: Magnitudes;
  references: number;
}

export interface FieldObjects {
  objects: FieldObject[];
  radiusDeg: number;
  total: number;
  credit: string;
}

export type Survey = "dss" | "2mass" | "wise";
