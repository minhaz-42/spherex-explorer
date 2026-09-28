import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { DataSource } from "../../lib/api";
import { formatDate, formatWavelength } from "../../lib/format";
import { autoStretch, renderGray } from "../../lib/pixels";
import { cutoutQuery, observationsQuery } from "../../lib/queries";
import { tokenRgb } from "../../lib/theme";
import type { Frame } from "../../lib/types";
import { imageUrl } from "../objects/queries";
import type { BlinkFrame } from "../share/exportBlink";
import { ShareMenu } from "../share/ShareMenu";
import { whereFrom } from "../spacecraft/where";
import { WhereDisclosure } from "../spacecraft/WhereWasSpherex";
import { decimalYear, plateQuery, positionAt, trackField } from "./tiles";

const SIZE = 384;

interface Tile {
  id: string;
  survey: string;
  band: string;
  /** What to call the date: an exact day, or the survey's years when the image is a combination. */
  when: string;
  year: number | null;
  status: "loading" | "ready" | "error";
  /** Drawable source for the stage and for export. */
  src: string | null;
  canvas?: HTMLCanvasElement | null;
  credit: string;
}

/** Whether a sky position lies inside a frame's footprint polygon (small fields, so a flat test is fine). */
function inside(footprint: [number, number][], ra: number, dec: number): boolean {
  let hit = false;
  for (let i = 0, j = footprint.length - 1; i < footprint.length; j = i++) {
    const [xi, yi] = footprint[i]!;
    const [xj, yj] = footprint[j]!;
    // Unwrap RA around the test point so frames that straddle 0h still work.
    const ui = ((xi - ra + 540) % 360) - 180;
    const uj = ((xj - ra + 540) % 360) - 180;
    if (yi > dec !== yj > dec && 0 < ((uj - ui) * (dec - yi)) / (yj - yi) + ui) hit = !hit;
  }
  return hit;
}

/**
 * The SPHEREx frame for the comparison: the latest one on the shortest-wavelength detector
 * (closest to the plates) whose footprint holds the whole field, falling back to partial cover.
 */
function pickFrame(frames: Frame[] | undefined, field: { ra: number; dec: number; fovDeg: number }): Frame | undefined {
  if (!frames?.length) return undefined;
  const h = field.fovDeg / 2;
  const cosd = Math.cos((field.dec * Math.PI) / 180);
  const corners: Array<[number, number]> = [
    [field.ra - h / cosd, field.dec - h],
    [field.ra + h / cosd, field.dec - h],
    [field.ra + h / cosd, field.dec + h],
    [field.ra - h / cosd, field.dec + h],
  ];
  const covers = (f: Frame) => f.footprint.length >= 3 && corners.every(([r, d]) => inside(f.footprint, r, d));
  const latest = (list: Frame[]) => [...list].sort((a, b) => b.mjdMid - a.mjdMid)[0];
  for (const d of [1, 2, 3]) {
    const full = latest(frames.filter((f) => f.detector === d && covers(f)));
    if (full) return full;
  }
  for (const d of [1, 2, 3]) {
    const any = latest(frames.filter((f) => f.detector === d));
    if (any) return any;
  }
  return latest(frames);
}

function useSpherexTile(ra: number, dec: number, fov: number, source: DataSource) {
  const obs = useQuery(observationsQuery(ra, dec, source));
  const frame = pickFrame(obs.data?.frames, { ra, dec, fovDeg: fov });
  const cut = useQuery({ ...cutoutQuery(frame?.key ?? "", ra, dec, fov, source), enabled: !!frame });
  const canvas = useMemo(() => {
    if (!cut.data || typeof document === "undefined") return null;
    const img = cut.data;
    const rgba = renderGray(img, autoStretch(img), { noData: tokenRgb("--bg-image", [15, 21, 48]), flagged: null });
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    c.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(rgba), img.width, img.height), 0, 0);
    return c;
  }, [cut.data]);
  const status: Tile["status"] =
    obs.isError || cut.isError || (obs.data && !frame) ? "error" : canvas ? "ready" : "loading";
  return { frame, canvas, status, payload: cut.data?.payload };
}

/**
 * The same patch of sky from five surveys over 75 years: Palomar plates from the 1950s and around
 * 1990, 2MASS, AllWISE and SPHEREx. For a star with a large proper motion, a ring marks where the
 * catalogue motion puts it at each epoch, so the viewer can check the star is really there.
 */
export function DecadesBlink({
  ra,
  dec,
  name,
  source,
  properMotion,
}: {
  ra: number;
  dec: number;
  name: string;
  source: DataSource;
  properMotion?: { raMasYr: number; decMasYr: number } | null;
}) {
  const moving = properMotion && Math.hypot(properMotion.raMasYr, properMotion.decMasYr) >= 300 ? properMotion : null;
  const star = moving ? { ra, dec, pmRa: moving.raMasYr, pmDec: moving.decMasYr } : null;
  const field = star ? trackField(star, 1950, 2026, 0.15) : { ra, dec, fovDeg: 0.15 };

  const p1 = useQuery(plateQuery(field.ra, field.dec, field.fovDeg, "poss1", source));
  const p2 = useQuery(plateQuery(field.ra, field.dec, field.fovDeg, "poss2", source));
  const sx = useSpherexTile(field.ra, field.dec, field.fovDeg, source);

  const tiles: Tile[] = [
    {
      id: "poss1",
      survey: "POSS-I",
      band: "Photographic red plate · about 0.65 µm",
      when: p1.data ? formatDate(p1.data.epoch) : "1949–1958",
      year: p1.data ? decimalYear(p1.data.epoch) : null,
      status: p1.data ? "ready" : p1.isError ? "error" : "loading",
      src: p1.data?.png ?? null,
      credit: "DSS: STScI/AURA, Palomar/Caltech",
    },
    {
      id: "poss2",
      survey: "POSS-II / UK Schmidt",
      band: "Photographic red plate · about 0.65 µm",
      when: p2.data ? formatDate(p2.data.epoch) : "1985–2000",
      year: p2.data ? decimalYear(p2.data.epoch) : null,
      status: p2.data ? "ready" : p2.isError ? "error" : "loading",
      src: p2.data?.png ?? null,
      credit: "DSS: STScI/AURA, Palomar/Caltech, UK Schmidt",
    },
    {
      id: "2mass",
      survey: "2MASS",
      band: "Near-infrared · 1.2–2.2 µm",
      when: "1997–2001",
      year: 1999,
      status: "ready",
      src: imageUrl(field.ra, field.dec, field.fovDeg, "2mass", SIZE),
      credit: "2MASS: UMass/IPAC-Caltech, NASA/NSF",
    },
    {
      id: "wise",
      survey: "AllWISE",
      band: "Mid-infrared · 3.4–22 µm (many visits combined)",
      when: "2010–2011",
      year: 2010.5,
      status: "ready",
      src: imageUrl(field.ra, field.dec, field.fovDeg, "wise", SIZE),
      credit: "AllWISE: NASA/JPL-Caltech",
    },
    {
      id: "spherex",
      survey: "SPHEREx",
      band: sx.frame ? `${formatWavelength(sx.frame.wavelengthUm)} · detector ${sx.frame.detector}` : "0.75–5 µm",
      when: sx.frame ? formatDate(sx.frame.isoMid) : "2025–2026",
      year: sx.frame ? decimalYear(sx.frame.isoMid) : null,
      status: sx.status,
      src: null,
      canvas: sx.canvas,
      credit: "SPHEREx: NASA/IPAC IRSA",
    },
  ];

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const imgs = useRef(new Map<string, HTMLImageElement>());
  const stageCanvas = useRef<HTMLCanvasElement>(null);
  const tile = tiles[index] ?? tiles[0]!;

  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % tiles.length), 1400);
    return () => window.clearInterval(t);
  }, [playing, tiles.length]);

  // Paint the SPHEREx frame onto the stage canvas when it is the tile on show.
  useEffect(() => {
    const c = stageCanvas.current;
    if (!c || tile.id !== "spherex" || !tile.canvas) return;
    c.width = SIZE;
    c.height = SIZE;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tile.canvas, 0, 0, SIZE, SIZE);
  }, [tile.id, tile.canvas]);

  // Five positions: cheap enough to work out on every render.
  const marks = star
    ? tiles.map((t) => (t.year !== null ? { id: t.id, ...positionAt(star, t.year, field, field.fovDeg, 100) } : null))
    : [];
  const here = marks.find((m) => m?.id === tile.id) ?? null;

  const years = tiles.map((t) => t.year).filter((y): y is number => y !== null);
  const span = years.length ? Math.max(...years) - Math.min(...years) : 0;
  const moved = moving ? (Math.hypot(moving.raMasYr, moving.decMasYr) / 1000) * span : 0;

  /** A composite of one tile with its marker, for export. */
  const composite = (t: Tile): HTMLCanvasElement | null => {
    const source = t.canvas ?? (t.src ? imgs.current.get(t.id) : undefined);
    if (!source || (source instanceof HTMLImageElement && !source.complete)) return null;
    const c = document.createElement("canvas");
    c.width = SIZE;
    c.height = SIZE;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, 0, 0, SIZE, SIZE);
    const m = marks.find((x) => x?.id === t.id);
    if (m) {
      ctx.strokeStyle = "#ffb35c";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc((m.x / 100) * SIZE, (m.y / 100) * SIZE, 12, 0, Math.PI * 2);
      ctx.stroke();
    }
    return c;
  };

  const build = () => {
    const frames: BlinkFrame[] = [];
    for (const t of tiles) {
      const c = t.status === "ready" ? composite(t) : null;
      if (c) frames.push({ image: c, caption: `${t.survey} · ${t.when} · ${t.band}` });
    }
    if (frames.length < 2) return null;
    return {
      title: `${name} across ${Math.round(span) || 75} years`,
      credit: `${tiles.map((t) => t.credit).join(" · ")} · SPHEREx Explorer`,
      frames,
      delayMs: 1100,
    };
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
      <div className="flex flex-col gap-3">
        <div className="relative aspect-square w-full overflow-hidden rounded-[14px] bg-image shadow-[var(--shadow)]">
          {tiles.map((t) =>
            t.src ? (
              <img
                key={t.id}
                ref={(el) => {
                  if (el) imgs.current.set(t.id, el);
                }}
                src={t.src}
                alt={`${name}: ${t.survey}, ${t.when}`}
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 [image-rendering:pixelated] ${t.id === tile.id ? "opacity-100" : "opacity-0"}`}
                onError={() => imgs.current.delete(t.id)}
              />
            ) : null,
          )}
          <canvas
            ref={stageCanvas}
            className={`absolute inset-0 h-full w-full transition-opacity duration-500 [image-rendering:pixelated] ${tile.id === "spherex" && tile.canvas ? "opacity-100" : "opacity-0"}`}
            role="img"
            aria-label={`${name}: SPHEREx, ${tiles[4]!.when}`}
          />
          {tile.status !== "ready" || (!tile.src && !tile.canvas) ? (
            <div
              className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-on-image/80"
              role="status"
            >
              {tile.status === "error"
                ? `The ${tile.survey} image could not be loaded right now.`
                : `Loading the ${tile.survey} image…`}
            </div>
          ) : null}
          {star ? (
            <svg
              viewBox="0 0 100 100"
              className="pointer-events-none absolute inset-0 h-full w-full"
              aria-hidden="true"
            >
              <polyline
                points={marks
                  .filter((m): m is NonNullable<typeof m> => m !== null)
                  .map((m) => `${m.x},${m.y}`)
                  .join(" ")}
                fill="none"
                stroke="var(--accent-on-image)"
                strokeOpacity="0.45"
                strokeWidth="0.4"
                strokeDasharray="1 1.2"
              />
              {here ? (
                <circle cx={here.x} cy={here.y} r="3.4" fill="none" stroke="var(--accent-on-image)" strokeWidth="0.6" />
              ) : null}
            </svg>
          ) : null}
          <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-3">
            <span className="rounded-[10px] bg-black/60 px-3 py-2 text-on-image">
              <span className="block font-display text-3xl leading-none">{tile.when}</span>
              <span className="mt-1 block text-xs opacity-85">
                {tile.survey} · {tile.band}
              </span>
            </span>
            <span className="rounded-full bg-black/60 px-2 py-1 text-xs text-on-image">
              {Math.round(field.fovDeg * 60)}′ across
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-secondary btn-sm btn-icon"
            aria-label="Earlier survey"
            onClick={() => setIndex((i) => (i + tiles.length - 1) % tiles.length)}
          >
            <ChevronLeft size={15} aria-hidden />
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            aria-pressed={playing}
            onClick={() => setPlaying((p) => !p)}
          >
            {playing ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />}{" "}
            {playing ? "Pause" : "Blink through the decades"}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm btn-icon"
            aria-label="Later survey"
            onClick={() => setIndex((i) => (i + 1) % tiles.length)}
          >
            <ChevronRight size={15} aria-hidden />
          </button>
          <span className="ms-auto">
            <ShareMenu build={build} />
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <ol className="grid grid-cols-5 gap-2 lg:grid-cols-1" aria-label="Surveys in time order">
          {tiles.map((t, i) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => {
                  setIndex(i);
                  setPlaying(false);
                }}
                aria-pressed={i === index}
                className={`flex w-full flex-col items-start rounded-[12px] border px-2.5 py-2 text-left transition-colors lg:flex-row lg:items-baseline lg:justify-between ${
                  i === index ? "border-accent bg-accent-wash" : "border-rule hover:border-rule-strong"
                }`}
              >
                <span className="text-sm font-medium text-text">{t.survey}</span>
                <span className="num text-xs text-faint">{t.when}</span>
              </button>
            </li>
          ))}
        </ol>
        <p className="text-sm text-muted">
          The same {Math.round(field.fovDeg * 60)}′ of sky, photographed by five surveys
          {span ? ` over ${Math.round(span)} years` : ""}.
          {moving
            ? ` ${name} moves ${(Math.hypot(moving.raMasYr, moving.decMasYr) / 1000).toFixed(1)}″ a year across the sky, so between the first and last images it has shifted about ${(moved / 60).toFixed(1)}′. The ring marks where its catalogued motion puts it at each date.`
            : " Stars stay put over these decades; what changes is the light each survey records."}
        </p>
        <p className="text-xs text-faint">
          2MASS and AllWISE combine exposures from their survey years, so they are dated by those years. Each survey
          sees a different wavelength, so brightnesses differ between the tiles.
        </p>
        <WhereDisclosure
          where={sx.payload ? whereFrom(sx.payload, { ra: field.ra, dec: field.dec }) : null}
          label={`Where was SPHEREx on ${tiles[4]!.when}?`}
        />
      </div>
    </div>
  );
}
