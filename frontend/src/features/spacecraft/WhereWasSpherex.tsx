import { Orbit } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { fitCanvas, observeSize } from "../../components/space/motion";
import { canvasFont, usePalette } from "../../components/space/theme";
import { translate, useLang, useT } from "../../lib/i18n";
import {
  cross,
  dot,
  EARTH_RADIUS_KM,
  earthRotationDeg,
  formatLatLon,
  groundVector,
  julian,
  norm,
  radecVector,
  subPoint,
  sunDirection,
  unit,
  type V3,
} from "./earth";
import { SPACECRAFT } from "./messages";
import type { Where } from "./where";

const DEG = Math.PI / 180;

interface Land {
  /** Natural Earth 1:110m land outlines (public domain), as flat [lon, lat, lon, lat, …] rings. */
  rings: number[][];
  /** The same outlines filled on a plate carrée grid, one coverage byte per cell (0–255). */
  mask: { width: number; height: number; data: Uint8ClampedArray } | null;
}

function rasterize(rings: number[][]): Land["mask"] {
  const width = 720;
  const height = 360;
  const ctx = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  if (!ctx) return null;
  ctx.canvas.width = width;
  ctx.canvas.height = height;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  for (const ring of rings) {
    for (let j = 0; j + 1 < ring.length; j += 2) {
      const x = ((ring[j]! + 180) / 360) * width;
      const y = ((90 - ring[j + 1]!) / 180) * height;
      if (j === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }
  ctx.fill("evenodd");
  const rgba = ctx.getImageData(0, 0, width, height).data;
  const data = new Uint8ClampedArray(width * height);
  for (let i = 0; i < data.length; i++) data[i] = rgba[i * 4 + 3]!;
  return { width, height, data };
}

let landCache: Promise<Land> | null = null;
function loadLand(): Promise<Land> {
  landCache ??= fetch("/data/land-110m.json")
    .then((r) => (r.ok ? (r.json() as Promise<number[][]>) : []))
    .catch(() => [])
    .then((rings) => ({ rings, mask: rings.length ? rasterize(rings) : null }));
  return landCache;
}

type RGB = [number, number, number];
const OCEAN: RGB = [34, 92, 160];
const LAND: RGB = [118, 142, 98];
const ICE: RGB = [222, 230, 238];
const NIGHT_OCEAN: RGB = [9, 16, 38];
const NIGHT_LAND: RGB = [20, 27, 40];

/**
 * Where SPHEREx was when it took a frame: Earth turned and lit as it was at that moment, the
 * spacecraft on its orbit from the frame's own recorded position and velocity, and its line of
 * sight towards the target. Two frames hours apart are taken from different points on this orbit,
 * which is why nearby asteroids show parallax.
 */
export function WhereWasSpherex({ where }: { where: Where }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pal = usePalette();
  const lang = useLang();
  const t = useT(SPACECRAFT);
  const [land, setLand] = useState<Land | null>(null);

  useEffect(() => {
    let live = true;
    void loadLand().then((l) => live && setLand(l));
    return () => {
      live = false;
    };
  }, []);

  const [rx, ry, rz] = where.positionKm;
  const [vx, vy, vz] = where.velocityKmS;
  const { isoTime } = where;
  const { ra, dec } = where.target;

  const jd = julian(isoTime);
  const altitude = norm(where.positionKm) - EARTH_RADIUS_KM;
  const speed = norm(where.velocityKmS);
  const ground = subPoint(where.positionKm, earthRotationDeg(jd));
  const sunAngle = Math.acos(Math.max(-1, Math.min(1, dot(radecVector(ra, dec), sunDirection(jd))))) / DEG;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const r: V3 = [rx, ry, rz];
    const when = julian(isoTime);
    const spin = earthRotationDeg(when);
    const sun = sunDirection(when);
    const los = radecVector(ra, dec);
    const rhat = unit(r);
    const n = unit(cross(r, [vx, vy, vz]));
    // Look from a little above the orbit plane, over the spacecraft, with celestial north up.
    const toward = unit([rhat[0] + 0.55 * n[0], rhat[1] + 0.55 * n[1], rhat[2] + 0.55 * n[2]]);
    const k = toward[2];
    const up = unit([-k * toward[0], -k * toward[1], 1 - k * toward[2]]);
    const right = cross(up, toward);
    // The line of sight on screen; the globe sits off-centre, away from it, to leave the arrow room.
    const lx = dot(los, right);
    const ly = dot(los, up);
    const ll = Math.hypot(lx, ly) || 1;
    const ux = lx / ll;
    const uy = -ly / ll;

    const draw = () => {
      const { width, height, dpr } = fitCanvas(canvas);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const cx = width / 2 - ux * width * 0.1;
      const cy = height / 2 - uy * height * 0.1;
      const R = Math.min(width, height) * 0.34;
      if (R <= 0) return;
      const scale = R / EARTH_RADIUS_KM;
      const proj = (p: V3) => ({ x: cx + dot(p, right) * scale, y: cy - dot(p, up) * scale, z: dot(p, toward) });

      // A thin atmosphere behind the globe.
      const halo = ctx.createRadialGradient(cx, cy, R * 0.96, cx, cy, R * 1.12);
      halo.addColorStop(0, "rgba(120, 176, 255, 0.45)");
      halo.addColorStop(1, "rgba(120, 176, 255, 0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.12, 0, Math.PI * 2);
      ctx.fill();

      // The globe, a pixel at a time: land or sea at each point, lit by the Sun at that moment.
      const B = Math.max(64, Math.min(420, Math.round(2 * R * dpr)));
      const buf = document.createElement("canvas");
      buf.width = B;
      buf.height = B;
      const bctx = buf.getContext("2d");
      const mask = land?.mask ?? null;
      if (bctx) {
        const img = bctx.createImageData(B, B);
        const half = B / 2;
        for (let py = 0; py < B; py++) {
          for (let px = 0; px < B; px++) {
            const X = (px + 0.5) / half - 1;
            const Y = 1 - (py + 0.5) / half;
            const rr = X * X + Y * Y;
            if (rr > 1) continue;
            const Z = Math.sqrt(1 - rr);
            const w: V3 = [
              X * right[0] + Y * up[0] + Z * toward[0],
              X * right[1] + Y * up[1] + Z * toward[1],
              X * right[2] + Y * up[2] + Z * toward[2],
            ];
            const lat = Math.asin(Math.max(-1, Math.min(1, w[2]))) / DEG;
            let landFrac = 0;
            if (mask) {
              const lon = ((((Math.atan2(w[1], w[0]) / DEG - spin + 180) % 360) + 360) % 360) / 360;
              const mx = Math.min(mask.width - 1, Math.floor(lon * mask.width));
              const my = Math.min(mask.height - 1, Math.max(0, Math.floor(((90 - lat) / 180) * mask.height)));
              landFrac = mask.data[my * mask.width + mx]! / 255;
            }
            const surface = Math.abs(lat) > 62 ? ICE : LAND;
            const cosSun = dot(w, sun);
            const lit = Math.max(0, Math.min(1, (cosSun + 0.07) / 0.14));
            const shade = 0.45 + 0.55 * Math.max(0, cosSun);
            const i = (py * B + px) * 4;
            for (let c = 0; c < 3; c++) {
              const day = (OCEAN[c]! + (surface[c]! - OCEAN[c]!) * landFrac) * shade;
              const night = NIGHT_OCEAN[c]! + (NIGHT_LAND[c]! - NIGHT_OCEAN[c]!) * landFrac;
              img.data[i + c] = night + (day - night) * lit;
            }
            img.data[i + 3] = 255 * Math.min(1, (1 - Math.sqrt(rr)) * half + 0.5);
          }
        }
        bctx.putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(buf, cx - R, cy - R, R * 2, R * 2);
      }

      // Coastlines on the near side, to keep the continents crisp.
      ctx.strokeStyle = "rgba(236, 244, 236, 0.35)";
      ctx.lineWidth = 0.6;
      for (const ring of land?.rings ?? []) {
        ctx.beginPath();
        let pen = false;
        for (let j = 0; j + 1 < ring.length; j += 2) {
          const g = groundVector(ring[j]!, ring[j + 1]!, spin);
          const p = proj([g[0] * EARTH_RADIUS_KM, g[1] * EARTH_RADIUS_KM, g[2] * EARTH_RADIUS_KM]);
          if (p.z > 0) {
            if (pen) ctx.lineTo(p.x, p.y);
            else ctx.moveTo(p.x, p.y);
            pen = true;
          } else pen = false;
        }
        ctx.stroke();
      }

      // The orbit: a circle through the spacecraft in the plane of its motion, faint behind Earth.
      const radius = norm(r);
      const side = cross(n, rhat);
      const pts = Array.from({ length: 241 }, (_, t) => {
        const a = (t / 240) * Math.PI * 2;
        return proj([
          radius * (Math.cos(a) * rhat[0] + Math.sin(a) * side[0]),
          radius * (Math.cos(a) * rhat[1] + Math.sin(a) * side[1]),
          radius * (Math.cos(a) * rhat[2] + Math.sin(a) * side[2]),
        ]);
      });
      ctx.lineWidth = 1.4;
      for (let t = 1; t < pts.length; t++) {
        const a = pts[t - 1]!;
        const b = pts[t]!;
        const hidden = b.z < 0 && Math.hypot(b.x - cx, b.y - cy) < R;
        ctx.strokeStyle = `rgba(${pal.ember}, ${hidden ? 0.16 : 0.85})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // SPHEREx and its line of sight towards the target, kept inside the picture.
      const s = proj(r);
      const room = (p: number, d: number, size: number) => (d > 0 ? (size - 24 - p) / d : d < 0 ? (24 - p) / d : Infinity);
      const L = Math.max(24, Math.min(R * 0.62, room(s.x, ux, width), room(s.y, uy, height)));
      const ex = s.x + ux * L;
      const ey = s.y + uy * L;
      ctx.strokeStyle = `rgba(${pal.ink}, 0.85)`;
      ctx.lineWidth = 1.3;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.setLineDash([]);
      const ang = Math.atan2(ey - s.y, ex - s.x);
      ctx.fillStyle = `rgba(${pal.ink}, 0.85)`;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - 8 * Math.cos(ang - 0.4), ey - 8 * Math.sin(ang - 0.4));
      ctx.lineTo(ex - 8 * Math.cos(ang + 0.4), ey - 8 * Math.sin(ang + 0.4));
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = `rgba(${pal.ember}, 0.25)`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgb(${pal.ember})`;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Labels with a halo, clamped inside the canvas; over the globe they are light on dark in
      // either theme. SPHEREx's label sits opposite its line of sight.
      const label = (text: string, x: number, y: number, weight: number, alpha: number) => {
        ctx.font = canvasFont(weight, weight > 500 ? 13 : 12);
        const w = ctx.measureText(text).width;
        const left = Math.max(6, Math.min(width - w - 6, x - w / 2));
        const top = Math.max(12, Math.min(height - 12, y));
        const overGlobe = Math.hypot(left + w / 2 - cx, top - cy) < R;
        ctx.textBaseline = "middle";
        ctx.lineJoin = "round";
        ctx.lineWidth = 4;
        ctx.strokeStyle = overGlobe ? "rgba(9, 16, 38, 0.8)" : `rgba(${pal.halo}, 0.85)`;
        ctx.strokeText(text, left, top);
        ctx.fillStyle = overGlobe ? `rgba(238, 242, 255, ${alpha})` : `rgba(${pal.ink}, ${alpha})`;
        ctx.fillText(text, left, top);
      };
      label(translate(SPACECRAFT, lang, "spacecraft"), s.x - ux * 34, s.y - uy * 22, 600, 0.95);
      label(translate(SPACECRAFT, lang, "toTarget"), ex + ux * 44, ey + uy * 16, 500, 0.8);
    };

    draw();
    return observeSize(canvas, draw);
  }, [rx, ry, rz, vx, vy, vz, isoTime, ra, dec, land, pal, lang]);

  return (
    <figure className="flex flex-col gap-3">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={t("figure", { time: isoTime, height: Math.round(altitude), place: formatLatLon(ground, lang) })}
        className="aspect-square w-full"
      />
      <figcaption>
        <dl className="num grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-xs text-faint">{t("height")}</dt>
            <dd>{Math.round(altitude)} km</dd>
          </div>
          <div>
            <dt className="text-xs text-faint">{t("speed")}</dt>
            <dd>{speed.toFixed(2)} km/s</dd>
          </div>
          <div>
            <dt className="text-xs text-faint">{t("above")}</dt>
            <dd>{formatLatLon(ground, lang)}</dd>
          </div>
          <div>
            <dt className="text-xs text-faint">{t("sunAngle")}</dt>
            <dd>{sunAngle.toFixed(0)}°</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-faint">{t("note", { speed: speed.toFixed(1) })}</p>
      </figcaption>
    </figure>
  );
}

/** A closed-by-default "Where was SPHEREx?" panel; the globe is only drawn once it is opened. */
export function WhereDisclosure({ where, label }: { where: Where | null; label: string }) {
  const [open, setOpen] = useState(false);
  if (!where) return null;
  return (
    <details
      className="rounded-[12px] border border-rule bg-raised/70 px-3 py-2"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-text">
        <Orbit size={15} aria-hidden className="text-accent" /> {label}
      </summary>
      {open ? (
        <div className="mt-3">
          <WhereWasSpherex where={where} />
        </div>
      ) : null}
    </details>
  );
}
