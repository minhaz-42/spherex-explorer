import { useEffect, useRef } from "react";

import { fitCanvas, observeSize, usePrefersReducedMotion } from "./motion";
import { type Rand, seeded } from "./noise";

export type SkyMood = "lively" | "calm";

interface Star {
  x: number;
  y: number;
  depth: number;
  r: number;
  color: string;
  phase: number;
  speed: number;
  spikes: boolean;
}

interface Meteor {
  x: number;
  y: number;
  dx: number;
  dy: number;
  length: number;
  born: number;
}

// Mostly midnight ink, like a printed star atlas, with a few warm and cool stars.
const TINTS = ["11, 20, 55", "11, 20, 55", "11, 20, 55", "11, 20, 55", "58, 86, 212", "181, 56, 27", "127, 85, 0"];

function makeStars(width: number, height: number, mood: SkyMood, rand: Rand): Star[] {
  const density = mood === "lively" ? 1 / 4200 : 1 / 9000;
  const count = Math.round(Math.min(320, width * height * density));
  return Array.from({ length: count }, () => {
    // Many faint stars and few bright ones, as in the real sky.
    const mag = Math.pow(rand(), 3);
    return {
      x: rand() * width,
      y: rand() * height,
      depth: 0.2 + rand() * 0.8,
      r: 0.35 + mag * 1.5,
      color: TINTS[Math.floor(rand() * TINTS.length)] ?? TINTS[0]!,
      phase: rand() * Math.PI * 2,
      speed: 0.5 + rand() * 1.4,
      spikes: mag > 0.55,
    };
  });
}

/**
 * The page backdrop: a fine field of stars that twinkle and drift with scroll and the pointer, and
 * on the landing page the occasional meteor. Nothing moves under reduced motion.
 */
export function AtlasSky({ mood }: { mood: SkyMood }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const rand = seeded(42);
    let size = fitCanvas(canvas);
    let stars = makeStars(size.width, size.height, mood, seeded(42));
    let pointer = { x: 0, y: 0 };
    let raf = 0;
    let lastDraw = 0;
    let nextMeteor = performance.now() + 3000;
    const meteors: Meteor[] = [];
    const lively = mood === "lively" && !reduced;
    const fps = lively ? 30 : 12;

    const draw = (now: number) => {
      const t = now / 1000;
      ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
      ctx.clearRect(0, 0, size.width, size.height);
      const scroll = window.scrollY;
      for (const s of stars) {
        const drift = lively ? scroll * s.depth * 0.1 : 0;
        const x = s.x + (lively ? pointer.x * s.depth * 12 : 0);
        const y = (((s.y - drift + (lively ? pointer.y * s.depth * 12 : 0)) % size.height) + size.height) % size.height;
        const twinkle = reduced ? 1 : 0.6 + 0.4 * Math.sin(t * s.speed + s.phase);
        const a = (0.18 + s.r * 0.22) * twinkle * (0.55 + s.depth * 0.45);
        ctx.fillStyle = `rgba(${s.color}, ${a})`;
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fill();
        if (s.spikes) {
          // Four fine diffraction spikes, as a telescope draws a bright star.
          const len = s.r * (4 + 2 * twinkle);
          ctx.strokeStyle = `rgba(${s.color}, ${a * 0.55})`;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(x - len, y);
          ctx.lineTo(x + len, y);
          ctx.moveTo(x, y - len);
          ctx.lineTo(x, y + len);
          ctx.stroke();
        }
      }

      if (lively) {
        if (now > nextMeteor) {
          const fromLeft = rand() < 0.5;
          meteors.push({
            x: fromLeft ? rand() * size.width * 0.45 : size.width * (0.55 + rand() * 0.45),
            y: rand() * size.height * 0.4,
            dx: fromLeft ? 1 : -1,
            dy: 0.36 + rand() * 0.2,
            length: 180 + rand() * 160,
            born: now,
          });
          nextMeteor = now + 7000 + rand() * 8000;
        }
        for (let k = meteors.length - 1; k >= 0; k--) {
          const m = meteors[k];
          if (!m) continue;
          const age = (now - m.born) / 1000;
          if (age > 1.6) {
            meteors.splice(k, 1);
            continue;
          }
          const travel = Math.min(1, age / 0.9);
          const fade = age < 0.9 ? 1 : Math.max(0, 1 - (age - 0.9) / 0.7);
          const norm = Math.hypot(m.dx, m.dy);
          const hx = m.x + (m.dx / norm) * m.length * travel;
          const hy = m.y + (m.dy / norm) * m.length * travel;
          const tx = hx - (m.dx / norm) * 120;
          const ty = hy - (m.dy / norm) * 120;
          const tail = ctx.createLinearGradient(tx, ty, hx, hy);
          tail.addColorStop(0, "rgba(181, 56, 27, 0)");
          tail.addColorStop(1, `rgba(181, 56, 27, ${0.55 * fade})`);
          ctx.strokeStyle = tail;
          ctx.lineWidth = 1.1;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(hx, hy);
          ctx.stroke();
          ctx.fillStyle = `rgba(232, 168, 56, ${0.9 * fade})`;
          ctx.beginPath();
          ctx.arc(hx, hy, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    const loop = (now: number) => {
      if (now - lastDraw >= 1000 / fps) {
        draw(now);
        lastDraw = now;
      }
      raf = requestAnimationFrame(loop);
    };

    const stopSize = observeSize(canvas, () => {
      size = fitCanvas(canvas);
      stars = makeStars(size.width, size.height, mood, seeded(42));
      if (reduced) draw(performance.now());
    });

    const onPointer = (e: PointerEvent) => {
      pointer = { x: e.clientX / window.innerWidth - 0.5, y: e.clientY / window.innerHeight - 0.5 };
    };

    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduced) raf = requestAnimationFrame(loop);
    };

    if (reduced) {
      draw(performance.now());
    } else {
      raf = requestAnimationFrame(loop);
      window.addEventListener("pointermove", onPointer, { passive: true });
      document.addEventListener("visibilitychange", onVisibility);
    }

    return () => {
      cancelAnimationFrame(raf);
      stopSize();
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [mood, reduced]);

  return (
    <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 h-full w-full" />
  );
}
