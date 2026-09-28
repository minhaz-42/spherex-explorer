import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { fitCanvas, observeSize, useInView, usePrefersReducedMotion } from "./motion";
import { PALETTES, useTheme } from "./theme";

/*
 * An illustration of how the SPHEREx all-sky survey fills in. Each pointing lies on a great circle
 * through the ecliptic poles; as Earth moves around the Sun the circle turns about a degree a day,
 * so the whole sky is covered about every six months and four times over the mission. The poles,
 * crossed by every circle, collect the most visits: that is where the two deep fields are. Stripe
 * shades stand for the six detector bands; the real pattern is finer than this.
 */

// The band ramps of both themes (see --band-1…6 in index.css), as RGB.
const BANDS: Record<"light" | "dark", Array<[number, number, number]>> = {
  light: [
    [111, 163, 234],
    [79, 142, 226],
    [53, 122, 214],
    [36, 99, 187],
    [26, 79, 152],
    [17, 62, 122],
  ],
  dark: [
    [207, 226, 252],
    [165, 199, 246],
    [126, 173, 238],
    [94, 147, 228],
    [69, 124, 216],
    [51, 103, 198],
  ],
};

const MAPS = 4;
const SECONDS_PER_MAP = 11;
const DEG = Math.PI / 180;

interface GlobeState {
  /** Survey progress in maps, 0 to MAPS. */
  progress: number;
  /** View longitude and tilt (radians). */
  lon0: number;
  tilt: number;
  playing: boolean;
}

/** Sky point (ecliptic lon/lat, radians) to offsets in the unit disc (y up) plus depth. */
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
  const theme = useTheme();
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
    const pal = PALETTES[theme];
    const ramp = BANDS[theme];
    const ink = (a: number) => `rgba(${pal.ink}, ${Math.min(1, a * pal.lineBoost)})`;
    const ember = (a: number) => `rgba(${pal.ember}, ${a})`;
    const s = state.current;
    let size = fitCanvas(canvas);
    // The sphere is painted pixel by pixel into a buffer about 70% of its size on screen.
    const BUFFER = Math.round(Math.min(340, Math.max(180, Math.min(size.width, size.height) * 0.8 * size.dpr * 0.7)));
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
      const R = Math.min(size.width, size.height) * 0.4;
      return { R, cx: size.width / 2, cy: size.height / 2 };
    };

    const paint = () => {
      const data = image.data;
      const ct = Math.cos(s.tilt);
      const st = Math.sin(s.tilt);
      const full = Math.floor(s.progress);
      const partial = (s.progress - full) * 180;
      const half = BUFFER / 2;
      for (let py = 0; py < BUFFER; py++) {
        for (let px = 0; px < BUFFER; px++) {
          const i = (py * BUFFER + px) * 4;
          const X = (px + 0.5) / half - 1;
          const Y = 1 - (py + 0.5) / half;
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
          // Fractional coverage at the scan front keeps its edge smooth.
          const visits = full + Math.min(1, Math.max(0, (partial - swept) / 1.5));
          // Soft light from the upper left; the far side sinks to lavender, never grey.
          const shade = Math.min(1, Math.max(0, 0.55 + 0.5 * (Z * 0.5 + Y * 0.35 - X * 0.3)));
          const edge = Math.min(1, (1 - Math.sqrt(rr)) * half + 0.5);
          const [sr, sg, sb] = pal.globeShade;
          const [lr, lg, lb] = pal.globeLit;
          let r = sr + (lr - sr) * shade;
          let g = sg + (lg - sg) * shade;
          let b = sb + (lb - sb) * shade;
          if (visits > 0) {
            // Blend into the next stripe over its last few tenths so boundaries don't stair-step.
            const f = swept / 5;
            const idx = Math.floor(f);
            const w = Math.min(1, Math.max(0, (f - idx - 0.82) / 0.18));
            const b0 = ramp[idx % 6] ?? [53, 122, 214];
            const b1 = ramp[(idx + 1) % 6] ?? b0;
            const cover = Math.min(1, visits);
            const k = Math.min(0.95, 0.45 + visits * 0.14) * cover;
            const lit = 0.84 + 0.16 * shade;
            r = r * (1 - k) + (b0[0] * (1 - w) + b1[0] * w) * k * lit;
            g = g * (1 - k) + (b0[1] * (1 - w) + b1[1] * w) * k * lit;
            b = b * (1 - k) + (b0[2] * (1 - w) + b1[2] * w) * k * lit;
          }
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
          data[i + 3] = 255 * edge;
        }
      }
      bctx.putImageData(image, 0, 0);
    };

    const toScreen = (lon: number, lat: number, R: number, cx: number, cy: number) => {
      const v = toView(lon, lat, s);
      return { x: cx + v.x * R, y: cy - v.y * R, depth: v.depth };
    };

    /** Strokes the visible (front) part of a sampled curve. */
    const front = (pts: Array<{ x: number; y: number; depth: number }>) => {
      ctx.beginPath();
      let pen = false;
      for (const p of pts) {
        if (p.depth > 0) {
          if (pen) ctx.lineTo(p.x, p.y);
          else ctx.moveTo(p.x, p.y);
          pen = true;
        } else pen = false;
      }
      ctx.stroke();
    };

    const draw = (now: number) => {
      const { R, cx, cy } = geometry();
      ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
      ctx.clearRect(0, 0, size.width, size.height);

      // A violet glow around the sphere.
      // The glow ends inside the canvas (half-width 1.25 R) so its edge never shows as a square.
      const glow = ctx.createRadialGradient(cx, cy, R * 0.95, cx, cy, R * 1.22);
      glow.addColorStop(0, `rgba(${pal.violet}, 0.2)`);
      glow.addColorStop(1, `rgba(${pal.violet}, 0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size.width, size.height);

      paint();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(buffer, cx - R, cy - R, R * 2, R * 2);

      // Graticule of ecliptic latitude and longitude.
      ctx.lineWidth = 0.8;
      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.strokeStyle = lat === 0 ? ink(0.4) : ink(0.14);
        front(Array.from({ length: 97 }, (_, k) => toScreen(k * 3.75 * DEG, lat * DEG, R, cx, cy)));
      }
      ctx.strokeStyle = ink(0.12);
      for (let lon = 0; lon < 360; lon += 30) {
        front(Array.from({ length: 49 }, (_, k) => toScreen(lon * DEG, (-90 + k * 3.75) * DEG, R, cx, cy)));
      }

      // Today's scan circle, glowing ember.
      const scanLon = (s.progress % 1) * 180 * DEG;
      for (const [width, alpha] of [
        [6, 0.14],
        [1.6, 0.95],
      ] as const) {
        ctx.lineWidth = width;
        ctx.strokeStyle = ember(alpha);
        for (const off of [0, Math.PI]) {
          front(Array.from({ length: 61 }, (_, k) => toScreen(scanLon + off, (-90 + k * 3) * DEG, R, cx, cy)));
        }
      }

      // The deep fields at the ecliptic poles, brighter with every visit.
      const visits = Math.min(MAPS, s.progress);
      const pulse = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(now / 500);
      ctx.font = '600 11px "Plus Jakarta Sans Variable", system-ui, sans-serif';
      for (const [lat, label] of [
        [89.9, "North deep field"],
        [-82, "South deep field"],
      ] as const) {
        const p = toScreen(-1.4, lat * DEG, R, cx, cy);
        if (p.depth <= 0.05) continue;
        const r = 3 + visits * 0.8;
        const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4);
        halo.addColorStop(0, `rgba(255, 140, 90, ${0.55 + visits * 0.08})`);
        halo.addColorStop(1, "rgba(255, 140, 90, 0)");
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = ember(1);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = ember(0.35 + 0.4 * pulse);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * (1.8 + pulse), 0, Math.PI * 2);
        ctx.stroke();
        // A pale halo keeps the label legible over the stripes.
        const lx = p.x + r * 2.6 + 6;
        const ly = p.y + (lat > 0 ? -4 : 12);
        ctx.strokeStyle = `rgba(${pal.halo}, 0.85)`;
        ctx.lineWidth = 3;
        ctx.lineJoin = "round";
        ctx.strokeText(label, lx, ly);
        ctx.fillStyle = ink(0.8);
        ctx.fillText(label, lx, ly);
      }

      // Crisp limb.
      ctx.strokeStyle = ink(0.45);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();

      // The readouts sit outside React state so the numbers can change every frame.
      const mapNo = Math.min(MAPS, Math.floor(s.progress) + 1);
      if (mapRef.current) mapRef.current.textContent = s.progress >= MAPS ? "All four maps" : `Map ${mapNo} of ${MAPS}`;
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
      if (!animate || reduced) draw(performance.now());
    };
    const onUp = () => {
      drag = null;
    };
    const onLeave = () => {
      hover = null;
      if (!animate || reduced) draw(performance.now());
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
  }, [inView, reduced, theme]);

  return (
    <div ref={wrapRef} className="flex flex-col gap-4">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="A globe of the sky filling in stripe by stripe as a scan circle sweeps around it, building up four complete maps. The two poles, marked, are the deep fields."
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
          {playing ? <Pause size={15} aria-hidden /> : <Play size={15} aria-hidden />}
        </button>
        <span ref={mapRef} className="font-display text-2xl text-text">
          Map 1 of 4
        </span>
        <span aria-hidden="true" className="relative h-1 min-w-24 flex-1 overflow-hidden rounded-full bg-sunk">
          <span
            ref={barRef}
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-gold to-accent"
            style={{ width: "0%" }}
          />
        </span>
      </div>
      <p ref={readoutRef} className="num text-xs text-faint" aria-live="off">
        Hover the globe to read coordinates
      </p>
    </div>
  );
}
