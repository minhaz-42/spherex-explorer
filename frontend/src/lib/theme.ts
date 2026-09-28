/** Read design tokens at runtime, for drawing on a canvas where CSS variables do not apply. */

const cache = new Map<string, [number, number, number]>();

function parseColor(value: string): [number, number, number] | null {
  const v = value.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (hex) {
    const h = hex[1]!;
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
  }
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(v);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return null;
}

/** An RGB triple for a CSS custom property, e.g. ``tokenRgb("--bg-image", [20, 18, 40])``. */
export function tokenRgb(name: string, fallback: [number, number, number]): [number, number, number] {
  const hit = cache.get(name);
  if (hit) return hit;
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name);
  const parsed = parseColor(raw) ?? fallback;
  if (raw) cache.set(name, parsed);
  return parsed;
}
