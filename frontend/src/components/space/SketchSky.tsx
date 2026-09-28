import { useEffect, useRef } from "react";

import { fitCanvas, observeSize, usePrefersReducedMotion } from "./motion";
import { graphite, jitter, type Rand, seeded } from "./sketch";

export type SkyMood = "lively" | "calm";

interface Doodle {
  x: number;
  y: number;
  depth: number;
  size: number;
  kind: "dot" | "plus" | "star" | "sparkle";
  color: string;
  phase: number;
  speed: number;
  spin: number;
}

interface ShootingStar {
  x: number;
  y: number;
  dx: number;
  dy: number;
  length: number;
  born: number;
}

const PENCILS = ["#3b5bdb", "#1098ad", "#2b8a3e", "#e8590c", "#9c36b5", "#b93d12"];

function makeDoodles(width: number, height: number, mood: SkyMood, rand: Rand): Doodle[] {
  const density = mood === "lively" ? 1 / 5200 : 1 / 11000;
  const count = Math.round(Math.min(260, width * height * density));
  const kinds: Doodle["kind"][] = ["dot", "dot", "dot", "plus", "plus", "star", "sparkle"];
  return Array.from({ length: count }, () => {
    const kind = kinds[Math.floor(rand() * kinds.length)] ?? "dot";
    const coloured = rand() < 0.3;
    return {
      x: rand() * width,
      y: rand() * height,
      depth: 0.25 + rand() * 0.75,
      size: kind === "dot" ? 0.8 + rand() * 1.1 : 3 + rand() * 4.5,
      kind,
      color: coloured ? (PENCILS[Math.floor(rand() * PENCILS.length)] ?? "#3b5bdb") : graphite(1),
      phase: rand() * Math.PI * 2,
      speed: 0.4 + rand() * 1.3,
      spin: jitter(rand, 0.4),
    };
  });
}

function drawDoodle(
  ctx: CanvasRenderingContext2D,
  d: Doodle,
  x: number,
  y: number,
  alpha: number,
  rand: Rand,
  t: number,
): void {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = d.color;
  ctx.fillStyle = d.color;
  ctx.lineWidth = 1.1;
  ctx.lineCap = "round";
  const s = d.size;
  if (d.kind === "dot") {
    ctx.fillRect(x - s / 2, y - s / 2, s, s);
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(d.spin * t * 0.2);
  ctx.beginPath();
  if (d.kind === "plus") {
    ctx.moveTo(-s / 2 + jitter(rand, 0.4), jitter(rand, 0.4));
    ctx.lineTo(s / 2 + jitter(rand, 0.4), jitter(rand, 0.4));
    ctx.moveTo(jitter(rand, 0.4), -s / 2 + jitter(rand, 0.4));
    ctx.lineTo(jitter(rand, 0.4), s / 2 + jitter(rand, 0.4));
  } else if (d.kind === "sparkle") {
    // Four curved points, like a twinkle drawn in a margin.
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(
        Math.cos(a + 0.7) * s * 0.18,
        Math.sin(a + 0.7) * s * 0.18,
        Math.cos(a) * s * 0.75,
        Math.sin(a) * s * 0.75,
      );
    }
  } else {
    // A five-point star drawn in one stroke, never quite closing.
    for (let k = 0; k <= 5; k++) {
      const a = -Math.PI / 2 + (k * 4 * Math.PI) / 5;
      const px = Math.cos(a) * s * 0.6 + jitter(rand, 0.35);
      const py = Math.sin(a) * s * 0.6 + jitter(rand, 0.35);
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * The page backdrop: pencil doodles of stars that twinkle, drift with scroll and the pointer, and
 * the odd shooting star sketched across the page and rubbed out again.
 */
export function SketchSky({ mood }: { mood: SkyMood }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const rand = seeded(42);
    let size = fitCanvas(canvas);
    let doodles = makeDoodles(size.width, size.height, mood, rand);
    let pointer = { x: 0, y: 0 };
    let raf = 0;
    let lastDraw = 0;
    let nextShot = performance.now() + 2500;
    const shots: ShootingStar[] = [];
    const lively = mood === "lively" && !reduced;
    const fps = lively ? 30 : 12;

    const draw = (now: number) => {
      const t = now / 1000;
      const boil = Math.floor(t * 5);
      ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
      ctx.clearRect(0, 0, size.width, size.height);
      const scroll = window.scrollY;
      for (const [i, d] of doodles.entries()) {
        const drift = lively ? scroll * d.depth * 0.12 : 0;
        const px = lively ? pointer.x * d.depth * 10 : 0;
        const py = lively ? pointer.y * d.depth * 10 : 0;
        const x = d.x + px;
        const y = (((d.y - drift + py) % size.height) + size.height) % size.height;
        const twinkle = reduced ? 1 : 0.55 + 0.45 * Math.sin(t * d.speed + d.phase);
        const base = d.color.startsWith("rgba") ? 0.34 : 0.5;
        drawDoodle(ctx, d, x, y, base * twinkle * (0.5 + d.depth * 0.5), seeded(boil * 7 + i), reduced ? 0 : t);
      }
      ctx.globalAlpha = 1;

      if (lively) {
        if (now > nextShot) {
          const fromLeft = rand() < 0.5;
          shots.push({
            x: fromLeft ? rand() * size.width * 0.4 : size.width * (0.6 + rand() * 0.4),
            y: rand() * size.height * 0.45,
            dx: fromLeft ? 1 : -1,
            dy: 0.42 + rand() * 0.25,
            length: 160 + rand() * 180,
            born: now,
          });
          nextShot = now + 5000 + rand() * 7000;
        }
        for (let k = shots.length - 1; k >= 0; k--) {
          const s = shots[k];
          if (!s) continue;
          const age = (now - s.born) / 1000;
          if (age > 2.2) {
            shots.splice(k, 1);
            continue;
          }
          // Sketched in over 0.7 s, then rubbed out.
          const drawn = Math.min(1, age / 0.7);
          const fade = age < 1 ? 1 : Math.max(0, 1 - (age - 1) / 1.2);
          const norm = Math.hypot(s.dx, s.dy);
          const hx = s.x + (s.dx / norm) * s.length * drawn;
          const hy = s.y + (s.dy / norm) * s.length * drawn;
          const tail = ctx.createLinearGradient(s.x, s.y, hx, hy);
          tail.addColorStop(0, graphite(0));
          tail.addColorStop(1, graphite(0.55 * fade));
          ctx.strokeStyle = tail;
          ctx.lineWidth = 1.3;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.quadraticCurveTo((s.x + hx) / 2, (s.y + hy) / 2 - 8, hx, hy);
          ctx.stroke();
          ctx.globalAlpha = fade;
          ctx.fillStyle = "#b93d12";
          ctx.beginPath();
          ctx.arc(hx, hy, 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
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
      doodles = makeDoodles(size.width, size.height, mood, seeded(42));
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
    <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 h-dvh w-screen" />
  );
}
