import type { BodyId } from "./orbits";
import type { TextureId } from "./textures";

export type SelectableId = BodyId | "sun";

export interface BodyStyle {
  id: SelectableId;
  name: string;
  /** Radius in pixels on a 600 px wide drawing. Sizes are for legibility, not to scale. */
  size: number;
  /** A representative colour for legends, trails and swatches. */
  color: string;
  texture: TextureId;
  /** North pole, J2000 right ascension and declination in degrees (IAU WGCCRE 2015). */
  pole: [number, number];
  /** Axial tilt to the orbit in degrees, for the close-up view. */
  obliquity: number;
  /** Seconds per turn on screen (negative spins backwards). Real days are far too fast to show. */
  spin: number;
  atmosphere?: [number, number, number, number];
  glint?: number;
  rings?: boolean;
  kind: "star" | "planet" | "asteroid";
  fact: string;
  /** Orbital period, as a person would say it. */
  year?: string;
}

export const BODIES: Record<SelectableId, BodyStyle> = {
  sun: {
    id: "sun",
    name: "The Sun",
    size: 21,
    color: "#f2a93b",
    texture: "sun",
    pole: [286.13, 63.87],
    obliquity: 7.25,
    spin: 48,
    kind: "star",
    fact: "Our star. SPHEREx keeps its telescope turned away from it, behind cone-shaped shields that keep the detectors cold.",
  },
  mercury: {
    id: "mercury",
    name: "Mercury",
    size: 3.8,
    color: "#9c958c",
    texture: "mercury",
    pole: [281.01, 61.42],
    obliquity: 0.03,
    spin: 60,
    kind: "planet",
    fact: "The smallest planet and the closest to the Sun.",
    year: "88 days",
  },
  venus: {
    id: "venus",
    name: "Venus",
    size: 6,
    color: "#dcbd82",
    texture: "venus",
    pole: [272.76, 67.16],
    obliquity: 177.4,
    spin: -90,
    atmosphere: [255, 236, 190, 0.5],
    kind: "planet",
    fact: "The hottest planet, wrapped in thick clouds of sulfuric acid.",
    year: "225 days",
  },
  earth: {
    id: "earth",
    name: "Earth",
    size: 6.4,
    color: "#2f86dc",
    texture: "earth",
    pole: [0, 90],
    obliquity: 23.44,
    spin: 14,
    atmosphere: [120, 180, 255, 0.9],
    glint: 0.8,
    kind: "planet",
    fact: "Home, and home base for SPHEREx, which circles it pole to pole every 98 minutes.",
    year: "365 days",
  },
  mars: {
    id: "mars",
    name: "Mars",
    size: 4.8,
    color: "#c9643a",
    texture: "mars",
    pole: [317.27, 54.43],
    obliquity: 25.19,
    spin: 15,
    atmosphere: [255, 190, 150, 0.25],
    kind: "planet",
    fact: "A cold desert world with the tallest volcano in the solar system, Olympus Mons.",
    year: "687 days",
  },
  iris: {
    id: "iris",
    name: "(7) Iris",
    size: 2.8,
    color: "#93846f",
    texture: "iris",
    pole: [20, 30],
    obliquity: 20,
    spin: 9,
    kind: "asteroid",
    fact: "A main-belt asteroid about 200 km across. SPHEREx caught it moving on 2 December 2025.",
    year: "3.7 years",
  },
  jupiter: {
    id: "jupiter",
    name: "Jupiter",
    size: 14,
    color: "#d5a276",
    texture: "jupiter",
    pole: [268.06, 64.5],
    obliquity: 3.13,
    spin: 8,
    atmosphere: [255, 235, 205, 0.35],
    kind: "planet",
    fact: "The largest planet, more than twice as massive as all the others combined.",
    year: "11.9 years",
  },
  saturn: {
    id: "saturn",
    name: "Saturn",
    size: 11.5,
    color: "#d6bd86",
    texture: "saturn",
    pole: [40.59, 83.54],
    obliquity: 26.73,
    spin: 9,
    atmosphere: [255, 240, 205, 0.3],
    rings: true,
    kind: "planet",
    fact: "Its rings are mostly water ice, the same molecule SPHEREx traces in space at 3 µm.",
    year: "29.5 years",
  },
  uranus: {
    id: "uranus",
    name: "Uranus",
    size: 8.4,
    color: "#7fcdd8",
    texture: "uranus",
    pole: [257.31, -15.18],
    obliquity: 97.77,
    spin: -12,
    atmosphere: [210, 250, 255, 0.45],
    kind: "planet",
    fact: "An ice giant tipped on its side, rolling around the Sun.",
    year: "84 years",
  },
  neptune: {
    id: "neptune",
    name: "Neptune",
    size: 8.2,
    color: "#3f68dc",
    texture: "neptune",
    pole: [299.36, 43.46],
    obliquity: 28.32,
    spin: 11,
    atmosphere: [150, 185, 255, 0.5],
    kind: "planet",
    fact: "The windiest planet, with gusts faster than 2,000 km/h.",
    year: "165 years",
  },
};

/** Drawing and list order: out from the Sun. */
export const BODY_ORDER: BodyId[] = [
  "mercury",
  "venus",
  "earth",
  "mars",
  "iris",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
];

/** A lumpy outline for the asteroid: radius factor by angle around it. */
export function irisOutline(angle: number): number {
  return 0.86 + 0.09 * Math.sin(angle * 2 + 0.6) + 0.05 * Math.sin(angle * 3 - 1.1) + 0.03 * Math.cos(angle * 5);
}
