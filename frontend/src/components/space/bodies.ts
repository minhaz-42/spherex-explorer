import type { BodyId } from "./orbits";

export type SelectableId = BodyId | "sun";

export interface BodyStyle {
  id: SelectableId;
  name: string;
  /** Radius in pixels on a 640 px wide drawing. Sizes are for legibility, not to scale. */
  size: number;
  /** Coloured-pencil fill. */
  color: string;
  /** A second pencil for bands, land or dust. */
  detail?: string;
  kind: "star" | "planet" | "asteroid";
  fact: string;
  /** Orbital period, as a person would say it. */
  year?: string;
}

export const BODIES: Record<SelectableId, BodyStyle> = {
  sun: {
    id: "sun",
    name: "The Sun",
    size: 20,
    color: "#f59f00",
    detail: "#e8590c",
    kind: "star",
    fact: "Our star. SPHEREx keeps its telescope turned away from it, behind cone-shaped shields that keep the detectors cold.",
  },
  mercury: {
    id: "mercury",
    name: "Mercury",
    size: 3.6,
    color: "#8d8378",
    kind: "planet",
    fact: "The smallest planet and the closest to the Sun.",
    year: "88 days",
  },
  venus: {
    id: "venus",
    name: "Venus",
    size: 5.8,
    color: "#e0a84a",
    kind: "planet",
    fact: "The hottest planet, wrapped in thick clouds of sulfuric acid.",
    year: "225 days",
  },
  earth: {
    id: "earth",
    name: "Earth",
    size: 6.2,
    color: "#2f7fd9",
    detail: "#2b8a3e",
    kind: "planet",
    fact: "Home, and home base for SPHEREx, which circles it pole to pole every 98 minutes.",
    year: "365 days",
  },
  mars: {
    id: "mars",
    name: "Mars",
    size: 4.6,
    color: "#d9480f",
    kind: "planet",
    fact: "A cold desert world with the tallest volcano in the solar system, Olympus Mons.",
    year: "687 days",
  },
  iris: {
    id: "iris",
    name: "(7) Iris",
    size: 2.6,
    color: "#7a6a55",
    kind: "asteroid",
    fact: "A main-belt asteroid about 200 km across. SPHEREx caught it moving on 2 December 2025.",
    year: "3.7 years",
  },
  jupiter: {
    id: "jupiter",
    name: "Jupiter",
    size: 13.5,
    color: "#d4935a",
    detail: "#9c5a2e",
    kind: "planet",
    fact: "The largest planet, more than twice as massive as all the others combined.",
    year: "11.9 years",
  },
  saturn: {
    id: "saturn",
    name: "Saturn",
    size: 11.5,
    color: "#dcb766",
    detail: "#a8874a",
    kind: "planet",
    fact: "Its rings are mostly water ice, the same molecule SPHEREx traces in space at 3 µm.",
    year: "29.5 years",
  },
  uranus: {
    id: "uranus",
    name: "Uranus",
    size: 8.2,
    color: "#3fb5c4",
    kind: "planet",
    fact: "An ice giant tipped on its side, rolling around the Sun.",
    year: "84 years",
  },
  neptune: {
    id: "neptune",
    name: "Neptune",
    size: 8,
    color: "#3b5bdb",
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
