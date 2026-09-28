import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { fitCanvas, observeSize, useInView, usePrefersReducedMotion } from "./motion";
import { graphite, seeded, sketchCircle, sketchPath } from "./sketch";

/*
 * An illustration of how the SPHEREx all-sky survey fills in. Each pointing lies on a great circle
 * through the ecliptic poles; as Earth moves around the Sun the circle turns about a degree a day,
 * so the whole sky is covered about every six months and four times over the mission. The poles,
 * crossed by every circle, collect the most visits — that is where the two deep fields are.
 * Stripe shades stand for the six detector bands; the real pattern is finer than this.
 */

const BANDS: Array<[number, number, number]> = [
  [111, 163, 234],
  [79, 142, 226],
  [53, 122, 214],
  [36, 99, 187],
  [26, 79, 152],
  [17, 62, 122],
];

const MAPS = 4;
const SECONDS_PER_MAP = 11;
const BUFFER = 150;
const DEG = Math.PI / 180;

interface GlobeState {
  /** Survey progress in maps, 0 to MAPS. */
  progress: number;
  /** View longitude and tilt (radians). */
  lon0: number;
  tilt: number;
  playing: boolean;
}

/** Sky point (ecliptic lon/lat, radians) to screen offsets in the unit disc, plus depth. */
function toView(lon: number, lat: number, s: GlobeState) {
  const x1 = Math.cos(lat) * Math.cos(lon - s.lon0);
  const y1 = Math.cos(lat) * Math.sin(lon - s.lon0);
  const z1 = Math.sin(lat);
  const ct = Math.cos(s.tilt);
  const st = Math.sin(s.tilt);
  return { x: y1, y: z1 * ct - x1 * st, depth: x1 * ct + z1 * st };
}

export function SkyGlobe() {
  const reduced = usePrefersReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readoutRef = useRef<HTMLParagraphElement>(null);
  const mapRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const inView = useInView(wrapRef);
  const [playing, setPlaying] = useState(!reduced);
  const state = useRef<GlobeState>({ progress: reduced ? 1.6 : 0.05, lon0: 0.6, tilt: 0.42, playing });

  useEffect(() => {
    state.current.playing = playing;
  }, [playing]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // Off screen we draw one still frame; the survey only runs while the globe is visible.
    const animate = inView;
    const s = state.current;
    let size = fitCanvas(canvas);
    const buffer = document.createElement("canvas");
    buffer.width = BUFFER;
    buffer.height = BUFFER;
    const bctx = buffer.getContext("2d");
    if (!bctx) return;
    const image = bctx.createImageData(BUFFER, BUFFER);
    let raf = 0;
    let last = performance.now();
    let lastDraw = 0;
    let drag: { x: number; y: number } | null = null;
    let hover: { x: number; y: number } | null = null;

    const stopSize = observeSize(canvas, () => {
      size = fitCanvas(canvas);
    });

    const geometry = () => {
      const R = Math.min(size.width, size.height) * 0.42;
      return { R, cx: size.width / 2, cy: size.height / 2 };
    };

    const paint = () => {
      const data = image.data;
      const ct = Math.cos(s.tilt);
      const st = Math.sin(s.tilt);
      const full = Math.floor(s.progress);
      const partial = (s.progress - full) * 180;
      for (let py = 0; py < BUFFER; py++) {
        for (let px = 0; px < BUFFER; px++) {
          const i = (py * BUFFER + px) * 4;
          const X = (px + 0.5) / (BUFFER / 2) - 1;
          const Y = 1 - (py + 0.5) / (BUFFER / 2);
          const rr = X * X + Y * Y;
          if (rr > 1) {
            data[i + 3] = 0;
            continue;
          }
          const Z = Math.sqrt(1 - rr);
          // Undo the tilt to find ecliptic longitude. Longitude alone decides coverage, because
          // every scan circle runs from pole to pole.
          const x1 = Z * ct - Y * st;
          const lon = Math.atan2(X, x1) + s.lon0;
          const lonDeg = (((lon / DEG) % 360) + 360) % 360;
          const swept = lonDeg % 180;
          const visits = full + (swept < partial ? 1 : 0);
          const light = 0.72 + 0.28 * (Z * 0.7 + Y * 0.3);
          // Coloured-pencil strokes: a diagonal texture in the buffer's pixel grid.
          const stroke = (px + py) % 3 === 0 ? 1 : 0.55;
          if (visits > 0) {
            const band = BANDS[Math.floor(swept / 5) % 6] ?? [53, 122, 214];
            const a = Math.min(0.92, 0.3 + visits * 0.16) * stroke;
            data[i] = band[0] * light;
            data[i + 1] = band[1] * light;
            data[i + 2] = band[2] * light;
            data[i + 3] = a * 255;
          } else {
            // Unvisited sky: paper with graphite shading on the far side.
            const shade = Math.max(0, 1 - light) * 1.8;
            data[i] = 42;
            data[i + 1] = 41;
            data[i + 2] = 49;
            data[i + 3] = shade * 110 * stroke;
          }
        }
      }
      bctx.putImageData(image, 0, 0);
    };

    const draw = (now: number) => {
      const { R, cx, cy } = geometry();
      const boil = reduced ? 0 : Math.floor(now / 200);
      ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
      ctx.clearRect(0, 0, size.width, size.height);
      paint();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(buffer, cx - R, cy - R, R * 2, R * 2);

      const rand = seeded(boil);
      const toScreen = (lon: number, lat: number) => {
        const v = toView(lon, lat, s);
        return { x: cx + v.x * R, y: cy - v.y * R, depth: v.depth };
      };
      const arc = (pts: Array<{ x: number; y: number; depth: number }>, color: string, width: number) => {
        let run: Array<{ x: number; y: number }> = [];
        for (const p of pts) {
          if (p.depth > 0) run.push(p);
          else if (run.length) {
            sketchPath(ctx, run, rand, { amount: 0.4, color, width });
            run = [];
          }
        }
        if (run.length) sketchPath(ctx, run, rand, { amount: 0.4, color, width });
      };

      // Graticule of ecliptic latitude and longitude.
      for (let lat = -60; lat <= 60; lat += 30) {
        arc(
          Array.from({ length: 73 }, (_, k) => toScreen(k * 5 * DEG, lat * DEG)),
          graphite(lat === 0 ? 0.45 : 0.2),
          lat === 0 ? 1.1 : 0.8,
        );
      }
      for (let lon = 0; lon < 360; lon += 30) {
        arc(
          Array.from({ length: 37 }, (_, k) => toScreen(lon * DEG, (-90 + k * 5) * DEG)),
          graphite(0.18),
          0.8,
        );
      }

      // Today's scan circle, drawn in vermilion.
      const scanLon = (s.progress % 1) * 180 * DEG;
      for (const off of [0, Math.PI]) {
        arc(
          Array.from({ length: 49 }, (_, k) => toScreen(scanLon + off, (-90 + k * 3.75) * DEG)),
          "rgba(185, 61, 18, 0.9)",
          1.8,
        );
      }

      // The deep fields at the ecliptic poles: circled, with a note.
      const visits = Math.min(MAPS, s.progress);
      for (const [lat, label] of [
        [89.9, "north deep field"],
        [-82, "south deep field"],
      ] as const) {
        const p = toScreen(-1.4, lat * DEG);
        if (p.depth <= 0.05) continue;
        const r = 5 + visits * 1.6;
        ctx.fillStyle = `rgba(185, 61, 18, ${0.25 + visits * 0.12})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 0.55, 0, Math.PI * 2);
        ctx.fill();
        sketchCircle(ctx, p.x, p.y, r, rand, { color: "rgba(185, 61, 18, 0.9)", width: 1.3 });
        ctx.font = '600 17px "Caveat Variable", Caveat, cursive';
        ctx.fillStyle = graphite(0.9);
        ctx.fillText(label, p.x + r + 6, p.y + (lat > 0 ? -2 : 12));
      }

      sketchCircle(ctx, cx, cy, R, rand, { color: graphite(0.85), width: 1.5, wobble: 0.02 });

      // The readouts sit outside React state so the numbers can change every frame.
      const mapNo = Math.min(MAPS, Math.floor(s.progress) + 1);
      if (mapRef.current) mapRef.current.textContent = s.progress >= MAPS ? "4 maps done" : `Map ${mapNo} of ${MAPS}`;
      if (barRef.current) barRef.current.style.width = `${Math.min(100, (s.progress / MAPS) * 100)}%`;
      if (readoutRef.current) {
        let text = "Hover the globe to read coordinates";
        if (hover) {
          const X = (hover.x - cx) / R;
          const Y = (cy - hover.y) / R;
          if (X * X + Y * Y <= 1) {
            const Z = Math.sqrt(1 - X * X - Y * Y);
            const z1 = Y * Math.cos(s.tilt) + Z * Math.sin(s.tilt);
            const x1 = Z * Math.cos(s.tilt) - Y * Math.sin(s.tilt);
            const lat = Math.asin(Math.max(-1, Math.min(1, z1))) / DEG;
            const lon = ((((Math.atan2(X, x1) + s.lon0) / DEG) % 360) + 360) % 360;
            const swept = lon % 180;
            const n = Math.min(MAPS, Math.floor(s.progress) + (swept < (s.progress % 1) * 180 ? 1 : 0));
            text = `Ecliptic ${lon.toFixed(0)}°, ${lat >= 0 ? "+" : "−"}${Math.abs(lat).toFixed(0)}° · scanned ${n} of ${MAPS} times`;
          }
        }
        if (readoutRef.current.textContent !== text) readoutRef.current.textContent = text;
      }
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (s.playing) {
        s.progress += dt / SECONDS_PER_MAP;
        // Hold the finished sky for a moment, then start again.
        if (s.progress > MAPS + 0.25) s.progress = 0;
      }
      if (!drag && !reduced) s.lon0 += dt * 0.12;
      if (now - lastDraw > 1000 / 30) {
        draw(now);
        lastDraw = now;
      }
      if (animate) raf = requestAnimationFrame(loop);
    };

    const local = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onDown = (e: PointerEvent) => {
      drag = local(e);
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const p = local(e);
      hover = p;
      if (drag) {
        s.lon0 -= (p.x - drag.x) * 0.01;
        s.tilt = Math.max(-1.2, Math.min(1.2, s.tilt + (p.y - drag.y) * 0.01));
        drag = p;
      }
      if (reduced) draw(performance.now());
    };
    const onUp = () => {
      drag = null;
    };
    const onLeave = () => {
      hover = null;
      if (reduced) draw(performance.now());
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("pointerleave", onLeave);

    if (animate) raf = requestAnimationFrame(loop);
    else draw(performance.now());

    return () => {
      cancelAnimationFrame(raf);
      stopSize();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, [inView, reduced]);

  return (
    <div ref={wrapRef} className="flex flex-col gap-3">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="A pencil globe of the sky, coloured in stripe by stripe as a scan line sweeps around it, building up four complete maps. The two poles, circled, are the deep fields."
        className="mx-auto block aspect-square w-full max-w-[30rem] cursor-grab touch-pan-y select-none active:cursor-grabbing"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn btn-secondary btn-sm btn-icon"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? "Pause the survey" : "Play the survey"}
          aria-pressed={playing}
        >
          {playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
        </button>
        <span ref={mapRef} className="hand text-2xl text-text">
          Map 1 of 4
        </span>
        <span
          aria-hidden="true"
          className="relative h-2 min-w-24 flex-1 overflow-hidden rounded-full border border-text/70"
        >
          <span ref={barRef} className="absolute inset-y-0 left-0 bg-accent/70" style={{ width: "0%" }} />
        </span>
      </div>
      <p ref={readoutRef} className="num text-xs text-faint" aria-live="off">
        Hover the globe to read coordinates
      </p>
    </div>
  );
}
