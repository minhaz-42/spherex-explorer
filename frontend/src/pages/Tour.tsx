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
import { casesQuery, cutoutQuery } from "../lib/queries";

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
  const source = useSnapshot() ? "snapshot" : "live";
  const cases = useQuery(casesQuery());
  const iris = cases.data?.cases.find((c) => c.id === "iris-2025-12");
  // The same request the blink makes for frame A, so this reads the spacecraft's state from the cache.
  const frameA = useQuery({
    ...cutoutQuery(iris?.preview.a.key ?? "", iris?.target.ra ?? 0, iris?.target.dec ?? 0, iris?.viewer.fov ?? 0, source),
    enabled: !!iris,
  });
  if (!iris) return <p className="text-muted">Loading the Iris frames…</p>;
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

interface Scene {
  kicker: string;
  title: string;
  say: string;
  body: ReactNode;
}

const SCENES: Scene[] = [
  {
    kicker: "NASA Space Apps Challenge 2026",
    title: "SPHEREx Explorer",
    say: "NASA's SPHEREx telescope maps the whole sky every six months in 102 colours of infrared light. This app lets anyone see how the sky changes in those images.",
    body: <Orrery />,
  },
  {
    kicker: "The survey",
    title: "A fresh map of the sky, twice a year",
    say: "From a pole-to-pole orbit, SPHEREx sweeps great circles through the ecliptic poles. Every point is revisited about every six months; the poles, its deep fields, far more often.",
    body: (
      <div className="mx-auto w-full max-w-md">
        <SkyGlobe />
      </div>
    ),
  },
  {
    kicker: "Where?",
    title: "Pick any object",
    say: "Search a name or coordinates. The explorer finds every SPHEREx image of that spot, and shows what the catalogues know: type, distance, and the same patch in other light.",
    body: <ObjectProfile ra={M31.ra} dec={M31.dec} label="Andromeda Galaxy" source="live" />,
  },
  {
    kicker: "What changed?",
    title: "An asteroid, caught in the act",
    say: "Two real SPHEREx frames, 9.7 hours apart, on one brightness scale. The stars stay put; the asteroid (7) Iris moves. JPL's orbit, seen from where SPHEREx was, lands within 1 arcsecond of the track the app found.",
    body: <IrisScene />,
  },
  {
    kicker: "Across the decades",
    title: "75 years of one fast star",
    say: "Barnard's Star moves 10.4 arcseconds a year. Palomar plates from 1950, 2MASS, WISE and SPHEREx on one grid show it creeping about 13 arcminutes.",
    body: (
      <DecadesBlink ra={BARNARD.ra} dec={BARNARD.dec} name="Barnard's Star" source="live" properMotion={BARNARD.pm} />
    ),
  },
  {
    kicker: "The colours",
    title: "102 colours of infrared",
    say: "Six detectors from 0.75 to 5 micrometres. Water ice absorbs at 3 µm, carbon dioxide at 4.3 µm: the ices SPHEREx was built to measure.",
    body: <SpectrumExplorer />,
  },
  {
    kicker: "Planet X",
    title: "What it can't find, and why",
    say: "A planet far beyond Neptune would move less than one SPHEREx pixel a day and be near the limit of a single exposure. The app explains that honestly rather than claim a discovery.",
    body: (
      <div className="card mx-auto max-w-2xl p-6 text-center">
        <p className="font-display text-3xl leading-tight">Candidates, never discoveries.</p>
        <p className="mt-3 text-muted">
          Every moving source the app finds is checked against JPL. Unmatched ones are called candidates, and most are
          artefacts.
        </p>
        <Link to="/discover#planet-x" className="btn btn-secondary mt-5">
          Read the Planet X explanation
        </Link>
      </div>
    ),
  },
  {
    kicker: "Your turn",
    title: "Where will you look first?",
    say: "Everything shown is real SPHEREx data from NASA/IPAC's archive, measured by this app with its methods and limits stated.",
    body: (
      <div className="flex flex-wrap justify-center gap-3">
        <Link to="/explore" className="btn btn-primary">
          Explore the sky <ArrowRight size={16} aria-hidden />
        </Link>
        <Link to="/discover" className="btn btn-secondary">
          See the cases
        </Link>
      </div>
    ),
  },
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
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(!reduced);
  const [started, setStarted] = useState(() => performance.now());
  const scene = SCENES[index] ?? SCENES[0]!;

  useEffect(() => {
    if (!playing || index >= SCENES.length - 1) return;
    const t = window.setTimeout(() => {
      setIndex((i) => i + 1);
      setStarted(performance.now());
    }, SCENE_MS);
    return () => window.clearTimeout(t);
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
        <p className="kicker">
          Judge mode · {index + 1} of {SCENES.length}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-secondary btn-sm btn-icon"
            aria-label="Previous"
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
            {playing ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />} {playing ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm btn-icon"
            aria-label="Next"
            onClick={() => go(1)}
            disabled={index === SCENES.length - 1}
          >
            <ChevronRight size={15} aria-hidden />
          </button>
          <Link to="/" className="btn btn-ghost btn-sm" aria-label="Leave the tour">
            <X size={15} aria-hidden /> Exit
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
            key={`${s.title}-${i === index ? started : 0}`}
            state={i < index ? "done" : i === index ? "current" : "todo"}
            playing={playing && !reduced}
            duration={SCENE_MS}
          />
        ))}
      </div>

      <div className="grid flex-1 items-center gap-10 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
        <div key={index} className="motion-safe:animate-[rise_0.7s_cubic-bezier(0.16,1,0.3,1)_both]" aria-live="polite">
          <p className="kicker">{scene.kicker}</p>
          <h1 className="mt-3 text-[length:var(--fs-h1)]">{scene.title}</h1>
          <p className="prose-body mt-4 text-lg">{scene.say}</p>
        </div>
        <div key={`body-${index}`} className="min-w-0 motion-safe:animate-[rise_0.7s_cubic-bezier(0.16,1,0.3,1)_both]">
          {scene.body}
        </div>
      </div>
    </div>
  );
}
