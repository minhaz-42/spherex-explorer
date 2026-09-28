/**
 * Pencil-drawing helpers for 2D canvas: wobbly outlines, hatching and cross-hatching.
 *
 * Every helper takes a seeded random source, so a stroke looks the same from frame to frame until
 * its seed changes. Re-seeding a few times a second gives the gentle "line boil" of hand-drawn
 * animation without the flicker of fresh randomness on every frame.
 */

export type Rand = () => number;

/** Small, fast, seeded PRNG (mulberry32). Returns numbers in [0, 1). */
export function seeded(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform jitter in [−amount, amount]. */
export function jitter(rand: Rand, amount: number): number {
  return (rand() * 2 - 1) * amount;
}

export const GRAPHITE = "42, 41, 49";

export function graphite(alpha: number): string {
  return `rgba(${GRAPHITE}, ${alpha})`;
}

/** A hand-drawn circle: a couple of loose passes that overshoot where they close. */
export function sketchCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  rand: Rand,
  { passes = 2, wobble = 0.08, color = graphite(0.85), width = 1.2 } = {},
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  for (let p = 0; p < passes; p++) {
    const start = rand() * Math.PI * 2;
    const sweep = Math.PI * 2 + 0.25 + rand() * 0.35;
    const steps = Math.max(14, Math.round(r * 1.6));
    const rx = r * (1 + jitter(rand, wobble * 0.6));
    const ry = r * (1 + jitter(rand, wobble * 0.6));
    const ox = jitter(rand, r * wobble * 0.5);
    const oy = jitter(rand, r * wobble * 0.5);
    ctx.beginPath();
    for (let s = 0; s <= steps; s++) {
      const t = start + (sweep * s) / steps;
      const drift = 1 + Math.sin(t * 3 + p) * wobble * 0.25;
      const px = x + ox + Math.cos(t) * rx * drift;
      const py = y + oy + Math.sin(t) * ry * drift;
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.globalAlpha = p === 0 ? 1 : 0.55;
    ctx.stroke();
  }
  ctx.restore();
}

/** A hand-drawn polyline through screen points, optionally closed. */
export function sketchPath(
  ctx: CanvasRenderingContext2D,
  points: ReadonlyArray<{ x: number; y: number }>,
  rand: Rand,
  { amount = 0.8, color = graphite(0.5), width = 1, closed = false } = {},
): void {
  if (points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  points.forEach((pt, k) => {
    const px = pt.x + jitter(rand, amount);
    const py = pt.y + jitter(rand, amount);
    if (k === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  if (closed) ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

/** One pencil line with slightly uneven ends. */
export function pencilLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rand: Rand,
  amount = 0.6,
): void {
  ctx.moveTo(x1 + jitter(rand, amount), y1 + jitter(rand, amount));
  const mx = (x1 + x2) / 2 + jitter(rand, amount);
  const my = (y1 + y2) / 2 + jitter(rand, amount);
  ctx.quadraticCurveTo(mx, my, x2 + jitter(rand, amount), y2 + jitter(rand, amount));
}

/**
 * Parallel hatching inside a disc. `angle` is the stroke direction in radians and `spacing` the gap
 * between strokes in pixels. Call inside save/restore if you change the clip yourself.
 */
export function hatchDisc(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  rand: Rand,
  {
    color,
    angle = -0.8,
    spacing = 2.2,
    width = 0.9,
    alpha = 0.75,
  }: {
    color: string;
    angle?: number;
    spacing?: number;
    width?: number;
    alpha?: number;
  },
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  hatchLines(ctx, x, y, r, rand, { color, angle, spacing, width, alpha });
  ctx.restore();
}

/** Hatching over a square of half-size `r` around (x, y); the caller sets the clip. */
export function hatchLines(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  rand: Rand,
  {
    color,
    angle,
    spacing,
    width,
    alpha,
  }: { color: string; angle: number; spacing: number; width: number; alpha: number },
): void {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  for (let d = -r; d <= r; d += spacing) {
    // A stroke across the square at offset d, perpendicular to (cos, sin).
    const ox = -sin * d;
    const oy = cos * d;
    pencilLine(
      ctx,
      x + ox - cos * r * 1.2,
      y + oy - sin * r * 1.2,
      x + ox + cos * r * 1.2,
      y + oy + sin * r * 1.2,
      rand,
      0.5,
    );
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/**
 * Graphite cross-hatching over the half of a disc facing away from the light, which sits in the
 * direction `lightAngle` (radians, screen space).
 */
export function shadeDisc(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  lightAngle: number,
  rand: Rand,
  strength = 0.5,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  // Keep only the far side: a big rectangle whose near edge runs through the centre.
  ctx.translate(x, y);
  ctx.rotate(lightAngle);
  ctx.beginPath();
  ctx.rect(-r * 0.15, -r * 1.5, r * 3, r * 3);
  ctx.clip();
  ctx.rotate(-lightAngle);
  ctx.translate(-x, -y);
  const spacing = Math.max(1.6, r / 5);
  hatchLines(ctx, x, y, r, rand, {
    color: graphite(1),
    angle: lightAngle + 0.9,
    spacing,
    width: 0.8,
    alpha: 0.55 * strength,
  });
  hatchLines(ctx, x, y, r, rand, {
    color: graphite(1),
    angle: lightAngle - 0.6,
    spacing: spacing * 1.3,
    width: 0.7,
    alpha: 0.35 * strength,
  });
  ctx.restore();
}
