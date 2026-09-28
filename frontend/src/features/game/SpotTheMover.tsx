import { useQuery } from "@tanstack/react-query";
import { Check, Eye, Play, RotateCcw, X } from "lucide-react";
import { type PointerEvent, useEffect, useMemo, useRef, useState } from "react";

import { usePrefersReducedMotion } from "../../components/space/motion";
import type { DataSource } from "../../lib/api";
import { formatDate, formatTime } from "../../lib/format";
import { useT } from "../../lib/i18n";
import { autoStretch, renderGray } from "../../lib/pixels";
import { casesQuery, cutoutQuery, knownObjectsQuery, observationsQuery } from "../../lib/queries";
import { passSequence } from "../../lib/sequence";
import { tokenRgb } from "../../lib/theme";
import type { DecodedCutout, DiscoverCase, KnownObjects } from "../../lib/types";
import { skyToGrid } from "../../lib/wcs";
import { whereFrom } from "../spacecraft/where";
import { WhereDisclosure } from "../spacecraft/WhereWasSpherex";
import { GAME } from "./messages";

/** How close a tap must land to JPL's predicted position, in SPHEREx pixels (6.15″ each). */
const TOLERANCE_PX = 4;

type Phase = "hunt" | "hit" | "miss";

interface Truth {
  name: string;
  a: { x: number; y: number };
  b: { x: number; y: number };
  rate: number | null;
}

function draw(
  canvas: HTMLCanvasElement | null,
  img: DecodedCutout | undefined,
  stretch: ReturnType<typeof autoStretch> | null,
) {
  if (!canvas || !img || !stretch) return;
  canvas.width = img.width;
  canvas.height = img.height;
  const rgba = renderGray(img, stretch, { noData: tokenRgb("--bg-image", [15, 21, 48]), flagged: null });
  canvas.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(rgba), img.width, img.height), 0, 0);
}

function findTruth(
  img: DecodedCutout | undefined,
  known: KnownObjects | undefined,
  keyA: string,
  keyB: string,
): Truth | null {
  const grid = img?.payload.grid;
  if (!grid || !known) return null;
  for (const o of known.objects) {
    const pa = o.positions.find((p) => p.key === keyA && p.inField);
    const pb = o.positions.find((p) => p.key === keyB && p.inField);
    if (!pa || !pb) continue;
    const a = skyToGrid(grid, pa.ra, pa.dec);
    const b = skyToGrid(grid, pb.ra, pb.dec);
    if (a && b) return { name: o.name, a, b, rate: o.rateArcsecPerHour };
  }
  return null;
}

function Round({ c, source, onDone }: { c: DiscoverCase; source: DataSource; onDone: (hit: boolean) => void }) {
  const t = useT(GAME);
  const reduced = usePrefersReducedMotion();
  const qa = useQuery(cutoutQuery(c.preview.a.key, c.target.ra, c.target.dec, c.viewer.fov, source));
  const qb = useQuery(cutoutQuery(c.preview.b.key, c.target.ra, c.target.dec, c.viewer.fov, source));
  // JPL answers for the whole pass the case viewer shows (that is what the snapshot recorded), so
  // ask for that sequence and read frames A and B out of it.
  const observations = useQuery(observationsQuery(c.target.ra, c.target.dec, source));
  const frameA = observations.data?.frames.find((f) => f.key === c.preview.a.key);
  const passKeys = frameA
    ? passSequence(observations.data!.frames, frameA.passIndex, Number(c.viewer.det) || frameA.detector).map(
        (f) => f.key,
      )
    : [];
  const known = useQuery({
    ...knownObjectsQuery(c.target.ra, c.target.dec, c.viewer.fov, passKeys, source),
    enabled: passKeys.length > 0,
  });
  const canvasA = useRef<HTMLCanvasElement>(null);
  const canvasB = useRef<HTMLCanvasElement>(null);
  const [showB, setShowB] = useState(false);
  const [phase, setPhase] = useState<Phase>("hunt");
  const [tap, setTap] = useState<{ x: number; y: number } | null>(null);

  const stretch = useMemo(() => (qa.data ? autoStretch(qa.data) : null), [qa.data]);
  useEffect(() => draw(canvasA.current, qa.data, stretch), [qa.data, stretch]);
  useEffect(() => draw(canvasB.current, qb.data, stretch), [qb.data, stretch]);

  useEffect(() => {
    if (reduced || !qa.data || !qb.data) return;
    const timer = window.setInterval(() => setShowB((v) => !v), 650);
    return () => window.clearInterval(timer);
  }, [reduced, qa.data, qb.data]);

  // Ground truth: the catalogued body JPL places inside both frames (cheap, so worked out each render).
  const truth = findTruth(qa.data, known.data, c.preview.a.key, c.preview.b.key);

  const size = qa.data?.payload.grid.sizePx ?? 1;
  const ready = !!qa.data && !!qb.data && !!truth;
  const failed = qa.isError || qb.isError || observations.isError || known.isError || (known.data && !truth);

  const onTap = (e: PointerEvent<HTMLDivElement>) => {
    if (phase !== "hunt" || !truth) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * size;
    const y = ((e.clientY - rect.top) / rect.height) * size;
    setTap({ x, y });
    const near = (p: { x: number; y: number }) => Math.hypot(p.x - x, p.y - y) <= TOLERANCE_PX;
    const hit = near(truth.a) || near(truth.b);
    setPhase(hit ? "hit" : "miss");
    onDone(hit);
  };

  const reveal = () => {
    if (phase !== "hunt") return;
    setPhase("miss");
    onDone(false);
  };

  const pct = (v: number) => `${(v / size) * 100}%`;
  const shown = showB ? c.preview.b : c.preview.a;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
      <div
        className={`relative aspect-square w-full overflow-hidden rounded-[14px] bg-image shadow-[var(--shadow)] ${phase === "hunt" && ready ? "cursor-crosshair" : ""}`}
        onPointerUp={onTap}
        role="application"
        aria-label={t("stage", { title: c.title })}
      >
        <canvas
          ref={canvasA}
          className={`absolute inset-0 h-full w-full [image-rendering:pixelated] ${showB ? "opacity-0" : "opacity-100"}`}
        />
        <canvas
          ref={canvasB}
          className={`absolute inset-0 h-full w-full [image-rendering:pixelated] ${showB ? "opacity-100" : "opacity-0"}`}
        />
        {!ready ? (
          <div
            className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-on-image/80"
            role="status"
          >
            {failed ? t("failed") : t("loading")}
          </div>
        ) : null}
        {ready ? (
          <span className="pointer-events-none absolute left-2 top-2 rounded-[8px] bg-black/60 px-2 py-1 text-xs text-on-image">
            <span className="font-semibold text-accent-on-image">{showB ? "B" : "A"}</span>{" "}
            <span className="num">
              {formatDate(shown.isoMid)} {formatTime(shown.isoMid, false)}
            </span>
          </span>
        ) : null}
        {tap ? (
          <span
            className="pointer-events-none absolute size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/80"
            style={{ left: pct(tap.x), top: pct(tap.y) }}
            aria-hidden="true"
          />
        ) : null}
        {phase !== "hunt" && truth ? (
          <svg
            viewBox={`0 0 ${size} ${size}`}
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            <line
              x1={truth.a.x}
              y1={truth.a.y}
              x2={truth.b.x}
              y2={truth.b.y}
              stroke="var(--track-on-image)"
              strokeWidth="0.8"
              strokeDasharray="2 2"
            />
            {[truth.a, truth.b].map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={TOLERANCE_PX}
                fill="none"
                stroke="var(--track-on-image)"
                strokeWidth="1"
              />
            ))}
          </svg>
        ) : null}
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <p className="kicker">{c.target.constellation}</p>
          <h3 className="mt-1 text-xl font-semibold text-text">{c.title}</h3>
          <p className="num mt-1 text-sm text-muted">{t("framesAB", { date: formatDate(c.preview.a.isoMid) })}</p>
        </div>
        {phase === "hunt" ? (
          <>
            <p className="text-muted">{t("hunt")}</p>
            <div className="flex flex-wrap gap-2">
              {reduced ? (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowB((v) => !v)}>
                  {t("showFrame", { frame: showB ? "A" : "B" })}
                </button>
              ) : null}
              <button type="button" className="btn btn-ghost btn-sm" onClick={reveal} disabled={!ready}>
                <Eye size={14} aria-hidden /> {t("showMe")}
              </button>
            </div>
          </>
        ) : (
          <div aria-live="polite" className="flex flex-col gap-3">
            <p
              className={`inline-flex items-center gap-2 font-semibold ${phase === "hit" ? "text-live" : "text-danger"}`}
            >
              {phase === "hit" ? <Check size={18} aria-hidden /> : <X size={18} aria-hidden />}
              {phase === "hit" ? t("found") : t("here")}
            </p>
            {truth ? (
              <p className="text-sm text-muted">
                {t("moverIs")}
                <strong className="text-text">{truth.name}</strong>
                {truth.rate ? t("rate", { rate: Math.round(truth.rate) }) : ""}
                {t("rings")}
              </p>
            ) : null}
            <WhereDisclosure
              where={qa.data ? whereFrom(qa.data.payload, c.target) : null}
              label={t("where")}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * "Spot the mover": blink two real SPHEREx frames and tap what moves. JPL's predicted positions are
 * the ground truth. The rounds are the moving-object cases on the Discover page.
 */
export function SpotTheMover({ source }: { source: DataSource }) {
  const t = useT(GAME);
  const cases = useQuery(casesQuery());
  const rounds = (cases.data?.cases ?? []).filter((c) => c.kind === "moving");
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const round = rounds[index];
  const score = Object.values(results).filter(Boolean).length;
  const finished = rounds.length > 0 && Object.keys(results).length === rounds.length;

  if (cases.isPending) return <p className="text-muted">{t("loadingRounds")}</p>;
  if (!rounds.length) return <p className="text-muted">{t("noRounds")}</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="num text-sm text-muted">
          {t("progress", { round: index + 1, rounds: rounds.length, score, played: Object.keys(results).length })}
        </p>
        <div className="flex gap-2">
          {results[round!.id] !== undefined && index < rounds.length - 1 ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setIndex((i) => i + 1)}>
              <Play size={14} aria-hidden /> {t("next")}
            </button>
          ) : null}
          {finished ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setResults({});
                setIndex(0);
              }}
            >
              <RotateCcw size={14} aria-hidden /> {t("again")}
            </button>
          ) : null}
        </div>
      </div>
      {round ? (
        <Round
          key={round.id}
          c={round}
          source={source}
          onDone={(hit) => setResults((r) => (r[round.id] === undefined ? { ...r, [round.id]: hit } : r))}
        />
      ) : null}
      {finished ? (
        <p className="card p-5 text-muted">
          {t("endBefore", { score, rounds: rounds.length })}
          <a
            className="link"
            href="https://www.zooniverse.org/projects/marckuchner/backyard-worlds-planet-9"
            target="_blank"
            rel="noreferrer"
          >
            Backyard Worlds: Planet 9
          </a>
          {t("endAfter")}
        </p>
      ) : null}
    </div>
  );
}
