import { useSyncExternalStore } from "react";

/**
 * Light (the default) or dark, a deep navy night. The choice lives on <html data-theme> and in
 * localStorage; public/theme.js applies a saved choice before the first paint. The default is
 * light whatever the system setting, because the light theme is the product's primary look.
 */
export type ThemeName = "light" | "dark";

export const THEME_KEY = "spherex-theme";
const EVENT = "spherex-theme-change";

export function currentTheme(): ThemeName {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function setTheme(theme: ThemeName): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage can be unavailable (private windows, blocked site data); the choice then lasts for the visit.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

export function useTheme(): ThemeName {
  return useSyncExternalStore(subscribe, currentTheme, () => "light");
}

/** Colours for drawing on canvas, where CSS variables do not reach. RGB triples take an alpha. */
export interface CanvasPalette {
  /** Ink for hairlines, labels and faint stars. */
  ink: string;
  /** Halo drawn behind labels so they read over lines. */
  halo: string;
  ember: string;
  gold: string;
  violet: string;
  blue: string;
  /** Dust in the main belt that catches the light. */
  dust: string;
  /** Star colours for the backdrop and how strongly they show. */
  stars: string[];
  starAlpha: number;
  /** The sky globe's unvisited paint, lit and in shade (0–255). */
  globeLit: [number, number, number];
  globeShade: [number, number, number];
  /** How much the viewer's side fills in planets' night sides, and the night-side floor. */
  fill: number;
  ambient: number;
  /** Strength of hairlines relative to the light theme. */
  lineBoost: number;
}

export const PALETTES: Record<ThemeName, CanvasPalette> = {
  light: {
    ink: "11, 20, 55",
    halo: "255, 255, 255",
    ember: "181, 56, 27",
    gold: "232, 168, 56",
    violet: "91, 63, 208",
    blue: "58, 86, 212",
    dust: "176, 120, 60",
    stars: ["11, 20, 55", "11, 20, 55", "11, 20, 55", "11, 20, 55", "58, 86, 212", "181, 56, 27", "127, 85, 0"],
    starAlpha: 1,
    globeLit: [253, 253, 255],
    globeShade: [222, 225, 246],
    fill: 0.75,
    ambient: 0.3,
    lineBoost: 1,
  },
  dark: {
    ink: "226, 231, 250",
    halo: "17, 23, 51",
    ember: "255, 143, 102",
    gold: "240, 196, 110",
    violet: "170, 155, 255",
    blue: "142, 162, 255",
    dust: "214, 176, 120",
    stars: [
      "236, 239, 249",
      "236, 239, 249",
      "236, 239, 249",
      "196, 214, 255",
      "170, 155, 255",
      "255, 180, 140",
      "240, 196, 110",
    ],
    starAlpha: 1.55,
    globeLit: [58, 70, 122],
    globeShade: [22, 28, 60],
    fill: 0.35,
    ambient: 0.16,
    lineBoost: 1.35,
  },
};

export function usePalette(): CanvasPalette {
  return PALETTES[useTheme()];
}

/**
 * A canvas font in the page's own typeface, read from the `--font-sans` (or `--font-mono`) token,
 * so text drawn on canvases follows the type tokens.
 */
export function canvasFont(weight: number, sizePx: number, family: "sans" | "mono" = "sans"): string {
  const fallback = family === "mono" ? "ui-monospace, monospace" : "system-ui, sans-serif";
  const css =
    typeof document === "undefined"
      ? ""
      : getComputedStyle(document.documentElement).getPropertyValue(`--font-${family}`).trim();
  return `${weight} ${sizePx}px ${css || fallback}`;
}
