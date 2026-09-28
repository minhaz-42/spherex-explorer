import { useEffect, useRef } from "react";

import { BODIES, irisOutline, type SelectableId } from "./bodies";
import { fitCanvas, observeSize, useInView, usePrefersReducedMotion } from "./motion";
import { cross, normalize, type Vec3 } from "./sphere";
import { SphereSprite } from "./sphere";
import { texture } from "./textures";

const DEG = Math.PI / 180;
/** Light from the upper left, slightly in front: a studio view rather than the real phase. */
const LIGHT: Vec3 = normalize([-0.55, 0.42, 0.72]);

/** The body's pole for a close-up: tilted by its obliquity to the right and a little towards us. */
function portraitPole(obliquity: number): Vec3 {
  const o = obliquity * DEG;
  return normalize([Math.sin(o) * 0.8, Math.cos(o), 0.25 + Math.sin(o) * 0.3]);
}

function spinMeridian(pole: Vec3, spin: number): Vec3 {
  const ref: Vec3 = Math.abs(pole[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const q0 = normalize(cross(ref, pole));
  const r0 = cross(pole, q0);
  return [
    q0[0] * Math.cos(spin) + r0[0] * Math.sin(spin),
    q0[1] * Math.cos(spin) + r0[1] * Math.sin(spin),
    q0[2] * Math.cos(spin) + r0[2] * Math.sin(spin),
  ];
}

/** A slowly turning close-up of one body, for the orrery's information card. */
export function PlanetPortrait({ id, className = "" }: { id: SelectableId; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion();
  const inView = useInView(canvasRef);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const style = BODIES[id];
    const tex = texture(style.texture, true);
    const sprite = new SphereSprite();
    const pole = portraitPole(style.obliquity);
    let size = fitCanvas(canvas);
    let raf = 0;
    let last = 0;
    const t0 = performance.now();

    const draw = (now: number) => {
      const t = reduced ? 8 : (now - t0) / 1000;
      const { width, height, dpr } = size;
      const R = Math.min(width, height) * (style.rings ? 0.26 : id === "sun" ? 0.3 : 0.4);
      const cx = width / 2;
      const cy = height / 2;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      // Keep the glow inside the canvas so its edge never shows as a square.
      const reach = Math.min(R * (id === "sun" ? 2.3 : 1.7), Math.min(width, height) / 2);
      const glow = ctx.createRadialGradient(cx, cy, R * 0.7, cx, cy, reach);
      glow.addColorStop(0, id === "sun" ? "rgba(255, 190, 90, 0.6)" : hexA(style.color, 0.28));
      glow.addColorStop(1, hexA(style.color, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      if (style.rings) rings(ctx, cx, cy, R, pole, "back");
      const prime = spinMeridian(pole, (t / style.spin) * Math.PI * 2);
      const ok = sprite.render(tex, 2 * R * dpr, {
        pole,
        prime,
        light: id === "sun" ? null : LIGHT,
        ambient: 0.12,
        atmosphere: style.atmosphere,
        glint: style.glint,
        limbDarkening: id === "sun" ? 0.5 : 0,
        lumpy: id === "iris" ? irisOutline : undefined,
      });
      if (ok) {
        const s = sprite.size / dpr;
        ctx.drawImage(sprite.canvas, cx - s / 2, cy - s / 2, s, s);
      }
      if (style.rings) rings(ctx, cx, cy, R, pole, "front");
    };

    const loop = (now: number) => {
      if (now - last > 1000 / 30) {
        draw(now);
        last = now;
      }
      raf = requestAnimationFrame(loop);
    };

    const stopSize = observeSize(canvas, () => {
      size = fitCanvas(canvas);
      draw(performance.now());
    });
    if (inView && !reduced) raf = requestAnimationFrame(loop);
    else draw(performance.now());

    return () => {
      cancelAnimationFrame(raf);
      stopSize();
    };
  }, [id, inView, reduced]);

  return <canvas ref={canvasRef} aria-hidden="true" className={`block ${className}`} />;
}

function rings(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, pole: Vec3, half: "back" | "front") {
  const major = normalize([-pole[1], pole[0], 0]);
  const minor = cross(pole, major);
  const zones: Array<[number, number, string]> = [
    [1.24, 1.52, "rgba(160, 140, 112, 0.4)"],
    [1.52, 1.95, "rgba(226, 208, 168, 0.95)"],
    [2.03, 2.27, "rgba(206, 190, 152, 0.8)"],
  ];
  const from = half === "back" ? Math.PI : 0;
  const steps = 72;
  const at = (a: number, k: number) => ({
    x: x + (major[0] * Math.cos(a) + minor[0] * Math.sin(a)) * r * k,
    y: y - (major[1] * Math.cos(a) + minor[1] * Math.sin(a)) * r * k,
  });
  for (const [inner, outer, color] of zones) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let k = 0; k <= steps; k++) {
      const p = at(from + (Math.PI * k) / steps, outer);
      if (k === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    for (let k = steps; k >= 0; k--) {
      const p = at(from + (Math.PI * k) / steps, inner);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fill();
  }
}

function hexA(hex: string, a: number): string {
  return `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, ${a})`;
}
