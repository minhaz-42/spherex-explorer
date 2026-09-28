import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { type CSSProperties, type FormEvent, type ReactNode, useState } from "react";
import { Link, useNavigate } from "react-router";

import { ChangeFigure, IrisPlate, WhenFigure, WhereFigure } from "../components/space/Figures";
import { Orrery } from "../components/space/Orrery";
import { Reveal } from "../components/space/Reveal";
import { SkyGlobe } from "../components/space/SkyGlobe";
import { SpectrumExplorer } from "../components/space/SpectrumExplorer";
import { type Stat, StatRow } from "../components/space/Stats";
import { BlinkPreview } from "../features/discover/BlinkPreview";
import { AtlasTeaser } from "../features/objects/AtlasTeaser";
import { getJson } from "../lib/api";
import { caseLink, casesQuery } from "../lib/queries";

const EXAMPLES = [
  { label: "Andromeda Galaxy", to: "/explore?q=M31" },
  { label: "North Ecliptic Pole", to: `/explore?q=${encodeURIComponent("270.0 66.56")}` },
  { label: "Asteroid (7) Iris", to: "/discover" },
];

const QUESTIONS = [
  {
    n: "01",
    title: "Where?",
    text: "Type a name like M31 or paste coordinates. The explorer turns it into a point on the sky and shows which constellation it sits in.",
    Figure: WhereFigure,
    wash: "wash-violet",
  },
  {
    n: "02",
    title: "When?",
    text: "Every SPHEREx image that covers that point, on one timeline. They bunch into survey passes about six months apart.",
    Figure: WhenFigure,
    wash: "wash-gold",
  },
  {
    n: "03",
    title: "What changed?",
    text: "Blink between visits, compare them side by side, or subtract one from another. Moving asteroids and brightness changes stand out.",
    Figure: ChangeFigure,
    wash: "wash-ember",
  },
];

const STATS: Stat[] = [
  { value: 102, label: "spectral channels", note: "17 on each of six detectors" },
  { value: 4, label: "maps of the whole sky", note: "over the two-year survey" },
  { value: 98, suffix: "min", label: "per orbit of Earth", note: "pole to pole, sun-synchronous" },
  {
    value: 1.45,
    decimals: 2,
    suffix: "million",
    label: "images public so far",
    note: "QR2 + QR3 at IRSA, September 2026",
  },
];

const IRIS_CASE = "iris-2025-12";

function SkySearch({ id }: { id: string }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = q.trim();
    navigate(value ? `/explore?q=${encodeURIComponent(value)}` : "/explore");
  };

  return (
    <form
      role="search"
      onSubmit={submit}
      className="glass flex flex-col gap-2 rounded-[28px] p-2 sm:flex-row sm:rounded-full"
    >
      <label htmlFor={id} className="visually-hidden">
        Object name or coordinates
      </label>
      <input
        id={id}
        className="field border-transparent bg-transparent shadow-none hover:border-transparent sm:flex-1"
        placeholder="Try M31, Orion Nebula or 10.68 41.27"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
      <button type="submit" className="btn btn-primary min-h-[2.75rem] px-6">
        Explore <ArrowRight size={16} aria-hidden />
      </button>
    </form>
  );
}

function SectionHead({
  n,
  kicker,
  title,
  children,
}: {
  n: string;
  kicker: string;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Reveal className="max-w-3xl">
      <p className="kicker flex items-center gap-3">
        <span className="text-accent">{n}</span>
        <span aria-hidden="true" className="h-px w-8 bg-rule-strong" />
        {kicker}
      </p>
      <h2 className="section-title mt-4">{title}</h2>
      {children ? <div className="prose-body mt-5">{children}</div> : null}
    </Reveal>
  );
}

function Glows({
  spots,
}: {
  spots: Array<{ left: string; top: string; size: string; color: string; delay?: string }>;
}) {
  return (
    <div className="nebula" aria-hidden="true">
      {spots.map((s) => (
        <span
          key={`${s.left}${s.top}`}
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            background: `radial-gradient(closest-side, ${s.color}, transparent)`,
            animationDelay: s.delay,
          }}
        />
      ))}
    </div>
  );
}

/** Rises in on first paint; the stagger comes from `step`. */
const enter = (step: number) => ({ animationDelay: `${120 + step * 110}ms` }) as CSSProperties;

function useIrisCase() {
  const cases = useQuery(casesQuery());
  const health = useQuery({
    queryKey: ["health"],
    queryFn: ({ signal }) => getJson<{ snapshotAvailable: boolean }>("/health", {}, signal),
    staleTime: 5 * 60 * 1000,
  });
  return { iris: cases.data?.cases.find((c) => c.id === IRIS_CASE), snapshot: !!health.data?.snapshotAvailable };
}

export function Landing() {
  const { iris, snapshot } = useIrisCase();
  const rise = "motion-safe:animate-[rise_0.9s_cubic-bezier(0.16,1,0.3,1)_both]";

  return (
    <div className="flex flex-col">
      {/* Hero: the ask on the left, the solar system on the right. */}
      <section className="relative isolate overflow-x-clip">
        <Glows
          spots={[
            { left: "46%", top: "-6%", size: "48rem", color: "rgb(255 196 102 / 0.7)" },
            { left: "72%", top: "30%", size: "36rem", color: "rgb(141 116 255 / 0.42)", delay: "-9s" },
            { left: "-8%", top: "38%", size: "34rem", color: "rgb(232 104 72 / 0.22)", delay: "-17s" },
          ]}
        />
        <div className="mx-auto grid max-w-[88rem] gap-12 px-[var(--gutter)] pb-24 pt-12 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:items-center lg:gap-12 lg:pt-16">
          <div className="flex flex-col gap-7">
            <p className={`kicker flex items-center gap-2 ${rise}`} style={enter(0)}>
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-live shadow-[0_0_0_4px_rgb(22_115_71_/_0.15)]"
              />
              Real infrared images · the public SPHEREx archive
            </p>
            <h1 className={`display ${rise}`} style={enter(1)}>
              Pick a point in the sky. <span className="shine">Watch it change.</span>
            </h1>
            <p className={`prose-body text-lg ${rise}`} style={enter(2)}>
              SPHEREx Explorer finds every public image NASA's SPHEREx telescope has taken of a place in the sky, lines
              them up in time and lets you slide through <strong>102 colours of infrared light</strong>.
            </p>
            <div className={`flex flex-col gap-4 ${rise}`} style={enter(3)}>
              <SkySearch id="hero-search" />
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-faint">Try</span>
                {EXAMPLES.map((ex) => (
                  <Link key={ex.label} to={ex.to} className="chip">
                    {ex.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
          <div className={`panel p-4 sm:p-6 ${rise}`} style={enter(2)}>
            <Orrery />
          </div>
        </div>
      </section>

      {/* The three questions the whole app is organised around. */}
      <section className="page py-20 sm:py-28">
        <SectionHead
          n="01"
          kicker="How it works"
          title={
            <>
              Three questions, <span className="shine">in order</span>.
            </>
          }
        >
          Everything in the explorer hangs off the same three questions you would ask about any patch of sky.
        </SectionHead>
        <ol className="mt-14 grid gap-6 md:grid-cols-3">
          {QUESTIONS.map(({ n, title, text, Figure, wash }, i) => (
            <Reveal
              as="li"
              key={n}
              delay={i}
              className="card group overflow-hidden transition-[translate,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lg)]"
            >
              <div className={`border-b border-rule px-6 pb-2 pt-5 ${wash}`}>
                <Figure />
              </div>
              <div className="p-6">
                <p className="num text-xs font-semibold text-accent">{n}</p>
                <h3 className="mt-1 text-[2rem]">{title}</h3>
                <p className="mt-2 text-muted">{text}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* The survey: how the sky gets covered. */}
      <section className="relative isolate overflow-x-clip py-20 sm:py-28">
        <Glows
          spots={[
            { left: "-10%", top: "10%", size: "40rem", color: "rgb(141 116 255 / 0.3)" },
            { left: "30%", top: "50%", size: "30rem", color: "rgb(111 163 234 / 0.28)", delay: "-11s" },
          ]}
        />
        <div className="page grid items-center gap-14 lg:grid-cols-2">
          <Reveal className="panel p-5 sm:p-8">
            <SkyGlobe />
          </Reveal>
          <div className="flex flex-col gap-10">
            <SectionHead
              n="02"
              kicker="The survey"
              title={
                <>
                  A fresh map of the whole sky, <span className="shine">twice a year</span>.
                </>
              }
            >
              <p>
                SPHEREx circles Earth pole to pole every 98 minutes. Each pointing lies on a great circle through the
                ecliptic poles, and as Earth travels around the Sun that circle turns about a degree a day. Six months
                later it has swept the whole sky.
              </p>
              <p className="mt-3">
                Over the two-year survey it maps the sky four times. The poles, where every circle crosses, are visited
                again and again: that is where SPHEREx keeps its two <strong>deep fields</strong>.
              </p>
            </SectionHead>
            <Reveal delay={1}>
              <dl className="grid grid-cols-3 gap-6 border-t border-rule pt-6">
                {[
                  ["98 min", "one orbit of Earth"],
                  ["6 months", "to sweep the whole sky"],
                  ["2", "deep fields, at the poles"],
                ].map(([v, l]) => (
                  <div key={l}>
                    <dt className="font-display text-3xl text-text">{v}</dt>
                    <dd className="mt-1 text-sm text-faint">{l}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>
        </div>
      </section>

      {/* The spectrum: what each band shows. */}
      <section className="page py-20 sm:py-28">
        <SectionHead
          n="03"
          kicker="The colours"
          title={
            <>
              Six detectors. <span className="shine">102 colours</span> of infrared.
            </>
          }
        >
          Your eyes stop at red. SPHEREx starts just past it, at 0.75 µm, and splits the light out to 5 µm into 102
          narrow channels. Each band shows something different.
        </SectionHead>
        <Reveal className="mt-12">
          <SpectrumExplorer />
        </Reveal>
      </section>

      {/* By the numbers. */}
      <section className="relative isolate overflow-hidden py-20">
        <div aria-hidden="true" className="wash-band absolute inset-0 -z-10" />
        <div className="page">
          <p className="kicker mb-12">By the numbers</p>
          <StatRow stats={STATS} />
        </div>
      </section>

      {/* Objects to start with, from the Explore atlas. */}
      <section className="page py-20 sm:py-24">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <SectionHead
            n="04"
            kicker="The atlas"
            title={
              <>
                Galaxies, nebulae and clusters, <span className="shine">ready to explore</span>.
              </>
            }
          >
            Each one opens with what the catalogues know about it, the same patch in other light, and every SPHEREx
            image of it.
          </SectionHead>
          <Reveal delay={1}>
            <Link to="/explore" className="btn btn-secondary">
              See the whole atlas <ArrowRight size={16} aria-hidden />
            </Link>
          </Reveal>
        </div>
        <Reveal className="mt-10">
          <AtlasTeaser />
        </Reveal>
      </section>

      {/* A real case from the archive. */}
      <section className="page py-20 sm:py-28">
        <Reveal className="card relative isolate grid items-center gap-10 overflow-hidden p-6 sm:p-10 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <Glows spots={[{ left: "55%", top: "-30%", size: "34rem", color: "rgb(232 104 72 / 0.18)" }]} />
          <figure className="flex flex-col gap-3">
            <div className="overflow-hidden rounded-[14px] shadow-[var(--shadow-lg)]">
              {iris ? (
                <BlinkPreview
                  ra={iris.target.ra}
                  dec={iris.target.dec}
                  fov={iris.viewer.fov}
                  a={iris.preview.a}
                  b={iris.preview.b}
                  source={snapshot ? "snapshot" : "live"}
                  label={iris.title}
                />
              ) : (
                <IrisPlate />
              )}
            </div>
            <figcaption className="text-xs text-faint">
              {iris
                ? "Two real SPHEREx frames, flipped with one shared brightness scale."
                : "Illustration of the two visits. The real frames are on the Discover page."}
            </figcaption>
          </figure>
          <div className="flex flex-col gap-6">
            <SectionHead n="05" kicker="Discover" title="An asteroid, caught in the act.">
              <p>
                On 2 December 2025 SPHEREx looked twice at the same patch of sky near the star 36 Sextantis, 9 hours and
                42 minutes apart. In between, the asteroid <strong>(7) Iris</strong> moved against the background stars.
              </p>
              <p className="mt-3">Blink the two frames and compare its position with the one JPL's orbit predicts.</p>
            </SectionHead>
            <div className="flex flex-wrap gap-3">
              <Link to="/discover" className="btn btn-primary">
                Open the case <ArrowRight size={16} aria-hidden />
              </Link>
              {iris ? (
                <Link to={caseLink(iris, snapshot ? "snapshot" : undefined)} className="btn btn-secondary">
                  See every frame
                </Link>
              ) : null}
            </div>
            <p className="text-sm text-faint">
              Heard about a hidden “Planet X”?{" "}
              <Link to="/discover#planet-x" className="link">
                Here is what SPHEREx can and cannot tell us
              </Link>
              .
            </p>
          </div>
        </Reveal>
      </section>

      {/* One more way in. */}
      <section className="relative isolate overflow-x-clip pb-28 pt-12">
        <Glows
          spots={[
            { left: "18%", top: "0%", size: "30rem", color: "rgb(255 196 102 / 0.45)" },
            { left: "52%", top: "10%", size: "32rem", color: "rgb(141 116 255 / 0.3)", delay: "-12s" },
          ]}
        />
        <Reveal className="page flex flex-col items-center gap-8 text-center">
          <h2 className="display text-[clamp(2.6rem,1.8rem+3.4vw,4.8rem)]">
            Where will you <span className="shine">look first?</span>
          </h2>
          <div className="w-full max-w-xl text-left">
            <SkySearch id="footer-search" />
          </div>
        </Reveal>
      </section>
    </div>
  );
}
