import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play, X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { usePrefersReducedMotion } from "../components/space/motion";
import { Orrery } from "../components/space/Orrery";
import { SkyGlobe } from "../components/space/SkyGlobe";
import { SpectrumExplorer } from "../components/space/SpectrumExplorer";
import { DecadesBlink } from "../features/decades/DecadesBlink";
import { BlinkPreview } from "../features/discover/BlinkPreview";
import { ObjectProfile } from "../features/objects/ObjectProfile";
import { whereFrom } from "../features/spacecraft/where";
import { WhereWasSpherex } from "../features/spacecraft/WhereWasSpherex";
import { getJson } from "../lib/api";
import { useT } from "../lib/i18n";
import { casesQuery, cutoutQuery } from "../lib/queries";
import { TOUR } from "./tour.messages";

const SCENE_MS = 11_500;

// Barnard's Star: SIMBAD J2000 position, Gaia DR3 proper motion (pmRA includes cos δ).
const BARNARD = { ra: 269.452083, dec: 4.693364, pm: { raMasYr: -801.551, decMasYr: 10362.394 } };
const M31 = { ra: 10.684708, dec: 41.26875 };

function useSnapshot(): boolean {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: ({ signal }) => getJson<{ snapshotAvailable: boolean }>("/health", {}, signal),
    staleTime: 5 * 60 * 1000,
  });
  return !!health.data?.snapshotAvailable;
}

function IrisScene() {
  const t = useT(TOUR);
  const source = useSnapshot() ? "snapshot" : "live";
  const cases = useQuery(casesQuery());
  const iris = cases.data?.cases.find((c) => c.id === "iris-2025-12");
  // The same request the blink makes for frame A, so this reads the spacecraft's state from the cache.
  const frameA = useQuery({
    ...cutoutQuery(iris?.preview.a.key ?? "", iris?.target.ra ?? 0, iris?.target.dec ?? 0, iris?.viewer.fov ?? 0, source),
    enabled: !!iris,
  });
  if (!iris) return <p className="text-muted">{t("loadingIris")}</p>;
  const where = frameA.data ? whereFrom(frameA.data.payload, iris.target) : null;
  return (
    <div className="grid items-center gap-6 sm:grid-cols-2">
      <div className="overflow-hidden rounded-[14px] shadow-[var(--shadow-lg)]">
        <BlinkPreview
          ra={iris.target.ra}
          dec={iris.target.dec}
          fov={iris.viewer.fov}
          a={iris.preview.a}
          b={iris.preview.b}
          source={source}
          label={iris.title}
        />
      </div>
      {where ? <WhereWasSpherex where={where} /> : null}
    </div>
  );
}

/** The profile's heading shows this until SIMBAD answers, so it matches the atlas name it then shows. */
function WhereScene() {
  const t = useT(TOUR);
  return <ObjectProfile ra={M31.ra} dec={M31.dec} label={t("andromeda")} source="live" />;
}

function DecadesScene() {
  const t = useT(TOUR);
  return (
    <DecadesBlink ra={BARNARD.ra} dec={BARNARD.dec} name={t("barnard")} source="live" properMotion={BARNARD.pm} />
  );
}

function PlanetXScene() {
  const t = useT(TOUR);
  return (
    <div className="card mx-auto max-w-2xl p-6 text-center">
      <p className="font-display text-3xl leading-tight">{t("candidates")}</p>
      <p className="mt-3 text-muted">{t("checked")}</p>
      <Link to="/discover#planet-x" className="btn btn-secondary mt-5">
        {t("readPlanetX")}
      </Link>
    </div>
  );
}

function YourTurnScene() {
  const t = useT(TOUR);
  return (
    <div className="flex flex-wrap justify-center gap-3">
      <Link to="/explore" className="btn btn-primary">
        {t("exploreSky")} <ArrowRight size={16} aria-hidden />
      </Link>
      <Link to="/discover" className="btn btn-secondary">
        {t("seeCases")}
      </Link>
    </div>
  );
}

/** Each scene's kicker, title and narration are the messages `<id>Kicker`, `<id>Title` and `<id>Say`. */
type SceneId = "intro" | "survey" | "where" | "iris" | "decades" | "colours" | "planetX" | "yours";

interface Scene {
  id: SceneId;
  body: ReactNode;
}

const SCENES: Scene[] = [
  { id: "intro", body: <Orrery /> },
  {
    id: "survey",
    body: (
      <div className="mx-auto w-full max-w-md">
        <SkyGlobe />
      </div>
    ),
  },
  { id: "where", body: <WhereScene /> },
  { id: "iris", body: <IrisScene /> },
  { id: "decades", body: <DecadesScene /> },
  { id: "colours", body: <SpectrumExplorer /> },
  { id: "planetX", body: <PlanetXScene /> },
  { id: "yours", body: <YourTurnScene /> },
];

/** One progress segment; the current scene's fills over its duration (Web Animations, no stylesheet needed). */
function Segment({
  state,
  playing,
  duration,
}: {
  state: "done" | "current" | "todo";
  playing: boolean;
  duration: number;
}) {
  const fill = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = fill.current;
    if (!el || state !== "current" || !playing || typeof el.animate !== "function") return;
    const run = el.animate([{ width: "0%" }, { width: "100%" }], { duration, easing: "linear", fill: "forwards" });
    return () => run.cancel();
  }, [state, playing, duration]);
  return (
    <span className="h-1 overflow-hidden rounded-full bg-sunk">
      <span
        ref={fill}
        className="block h-full rounded-full bg-gradient-to-r from-accent to-gold"
        style={{ width: state === "done" || (state === "current" && !playing) ? "100%" : "0%" }}
      />
    </span>
  );
}

/**
 * Judge mode: a self-running 90-second tour of the app, built from its live components, with the
 * narration on screen. It pauses on reduced motion and can be stepped by hand.
 */
export function Tour() {
  const t = useT(TOUR);
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(!reduced);
  const [started, setStarted] = useState(() => performance.now());
  const scene = SCENES[index] ?? SCENES[0]!;

  useEffect(() => {
    if (!playing || index >= SCENES.length - 1) return;
    const timer = window.setTimeout(() => {
      setIndex((i) => i + 1);
      setStarted(performance.now());
    }, SCENE_MS);
    return () => window.clearTimeout(timer);
  }, [playing, index]);

  const go = (d: number) => {
    setIndex((i) => Math.min(SCENES.length - 1, Math.max(0, i + d)));
    setStarted(performance.now());
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });


  return (
    <div className="page flex flex-1 flex-col gap-8 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="kicker">{t("judge", { n: index + 1, total: SCENES.length })}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-secondary btn-sm btn-icon"
            aria-label={t("previous")}
            onClick={() => go(-1)}
            disabled={index === 0}
          >
            <ChevronLeft size={15} aria-hidden />
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            aria-pressed={playing}
            onClick={() => setPlaying((p) => !p)}
          >
            {playing ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />} {playing ? t("pause") : t("play")}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm btn-icon"
            aria-label={t("next")}
            onClick={() => go(1)}
            disabled={index === SCENES.length - 1}
          >
            <ChevronRight size={15} aria-hidden />
          </button>
          <Link to="/" className="btn btn-ghost btn-sm" aria-label={t("leave")}>
            <X size={15} aria-hidden /> {t("exit")}
          </Link>
        </div>
      </div>

      {/* Progress: one segment per scene, the current one filling as it plays. */}
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${SCENES.length}, minmax(0, 1fr))` }}
        aria-hidden="true"
      >
        {SCENES.map((s, i) => (
          <Segment
            key={`${s.id}-${i === index ? started : 0}`}
            state={i < index ? "done" : i === index ? "current" : "todo"}
            playing={playing && !reduced}
            duration={SCENE_MS}
          />
        ))}
      </div>

      <div className="grid flex-1 items-center gap-10 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
        <div key={index} className="motion-safe:animate-[rise_0.7s_cubic-bezier(0.16,1,0.3,1)_both]" aria-live="polite">
          <p className="kicker">{t(`${scene.id}Kicker`)}</p>
          <h1 className="mt-3 text-[length:var(--fs-h1)]">{t(`${scene.id}Title`)}</h1>
          <p className="prose-body mt-4 text-lg">{t(`${scene.id}Say`)}</p>
        </div>
        <div key={`body-${index}`} className="min-w-0 motion-safe:animate-[rise_0.7s_cubic-bezier(0.16,1,0.3,1)_both]">
          {scene.body}
        </div>
      </div>
    </div>
  );
}
