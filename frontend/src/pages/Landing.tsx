import { ArrowRight } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { Link, useNavigate } from "react-router";

import { Orrery } from "../components/space/Orrery";
import {
  ChangeSketch,
  IrisBlink,
  RingedPlanetDoodle,
  SpherexDoodle,
  WhenSketch,
  WhereSketch,
} from "../components/space/Sketches";
import { SkyGlobe } from "../components/space/SkyGlobe";
import { SpectrumExplorer } from "../components/space/SpectrumExplorer";
import { type Stat, StatRow } from "../components/space/Stats";

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
    Sketch: WhereSketch,
    tilt: "-rotate-[0.6deg]",
  },
  {
    n: "02",
    title: "When?",
    text: "Every SPHEREx image that covers that point, on one timeline. They bunch into survey passes about six months apart.",
    Sketch: WhenSketch,
    tilt: "rotate-[0.5deg]",
  },
  {
    n: "03",
    title: "What changed?",
    text: "Blink between visits, compare them side by side, or subtract one from another. Moving asteroids and brightness changes stand out.",
    Sketch: ChangeSketch,
    tilt: "-rotate-[0.3deg]",
  },
];

const STATS: Stat[] = [
  { value: 102, label: "spectral channels", note: "17 per detector × 6" },
  { value: 4, label: "maps of the whole sky", note: "over the two-year survey" },
  { value: 98, suffix: "min", label: "per orbit of Earth", note: "pole to pole" },
  { value: 1.45, decimals: 2, suffix: "million", label: "images public so far", note: "QR2 + QR3 at IRSA, Sept 2026" },
];

function SkySearch({ id }: { id: string }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = q.trim();
    navigate(value ? `/explore?q=${encodeURIComponent(value)}` : "/explore");
  };

  return (
    <form role="search" onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
      <label htmlFor={id} className="visually-hidden">
        Object name or coordinates
      </label>
      <input
        id={id}
        className="field sm:flex-1"
        placeholder="Try M31, Orion Nebula or 10.68 41.27"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
      <button type="submit" className="btn btn-primary min-h-[2.75rem] px-5">
        Explore <ArrowRight size={16} aria-hidden />
      </button>
    </form>
  );
}

function SectionHead({ kicker, title, children }: { kicker: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="max-w-3xl">
      <p className="kicker">{kicker}</p>
      <h2 className="section-title mt-3">{title}</h2>
      {children ? <div className="prose-body mt-4">{children}</div> : null}
    </div>
  );
}

function MarginNote({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`hand pointer-events-none select-none text-[1.45rem] text-muted ${className}`} aria-hidden="true">
      {children}
    </p>
  );
}

export function Landing() {
  return (
    <div className="flex flex-col">
      {/* Hero: the ask on the left, the solar system on the right. */}
      <section className="relative overflow-x-clip">
        <RingedPlanetDoodle
          pencil="accent"
          className="absolute right-[3%] top-4 z-10 hidden w-24 motion-safe:animate-[bob_7s_ease-in-out_infinite] xl:block"
        />
        <div className="mx-auto grid max-w-[88rem] gap-12 px-[var(--gutter)] pb-20 pt-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center lg:gap-10 lg:pt-16">
          <div className="relative flex flex-col gap-7">
            <p className="kicker">Real infrared images · the public SPHEREx archive</p>
            <h1 className="display text-[clamp(2.6rem,1.4rem+3.3vw,4.6rem)]">
              Pick a point in the sky. <span className="highlight">Watch it change.</span>
            </h1>
            <p className="prose-body text-lg">
              SPHEREx Explorer finds every public image NASA's SPHEREx telescope has taken of a place in the sky, lines
              them up in time and lets you slide through <strong>102 colours of infrared light</strong>.
            </p>
            <div className="flex flex-col gap-3">
              <SkySearch id="hero-search" />
              <div className="flex flex-wrap items-center gap-2">
                <span className="hand text-xl text-muted">or try</span>
                {EXAMPLES.map((ex) => (
                  <Link key={ex.label} to={ex.to} className="chip">
                    {ex.label}
                  </Link>
                ))}
              </div>
            </div>
            <MarginNote className="hidden -rotate-3 self-end lg:block">
              the planets, starting from where they are today
              <svg
                viewBox="0 0 90 40"
                className="ms-2 inline-block h-8 w-20 align-middle"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              >
                <path d="M2 10c24-8 52-6 76 16" />
                <path d="M70 18l9 9-11 3" />
              </svg>
            </MarginNote>
          </div>
          <div className="sheet tape p-3 sm:p-5">
            <Orrery />
          </div>
        </div>
      </section>

      {/* The three questions the whole app is organised around. */}
      <section className="page py-20 sm:py-28">
        <SectionHead kicker="How it works" title="Three questions, in order.">
          Everything in the explorer hangs off the same three questions you would ask about any patch of sky.
        </SectionHead>
        <ol className="mt-12 grid gap-8 md:grid-cols-3">
          {QUESTIONS.map(({ n, title, text, Sketch, tilt }) => (
            <li
              key={n}
              className={`sheet ${tilt} p-6 transition-transform duration-300 hover:rotate-0 hover:-translate-y-1`}
            >
              <div className="aspect-[24/17]">
                <Sketch />
              </div>
              <p className="hand mt-4 text-2xl text-accent">{n}</p>
              <h3 className="text-[1.75rem]">{title}</h3>
              <p className="mt-2 text-muted">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* The survey: how the sky gets covered. */}
      <section className="relative overflow-x-clip py-20 sm:py-28">
        <div className="page grid items-center gap-12 lg:grid-cols-2">
          <div className="sheet sheet-alt relative p-4 sm:p-6">
            <SkyGlobe />
            <MarginNote className="absolute -bottom-9 right-4 rotate-2 text-xl">drag the globe to spin it</MarginNote>
          </div>
          <div className="relative flex flex-col gap-6">
            <SectionHead
              kicker="The survey"
              title={
                <>
                  A fresh map of the whole sky, <span className="highlight">twice a year</span>.
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
            <SpherexDoodle className="w-32 self-end motion-safe:animate-[bob_6s_ease-in-out_infinite] sm:w-36" />
          </div>
        </div>
      </section>

      {/* The spectrum: what each band shows. */}
      <section className="page py-20 sm:py-28">
        <SectionHead kicker="The colours" title="Six detectors. 102 colours of infrared.">
          Your eyes stop at red. SPHEREx starts just past it, at 0.75 µm, and splits the light out to 5 µm into 102
          narrow channels. Each band shows something different.
        </SectionHead>
        <div className="mt-10">
          <SpectrumExplorer />
        </div>
      </section>

      {/* By the numbers. */}
      <section className="page py-16 sm:py-20">
        <p className="kicker mb-10">By the numbers</p>
        <StatRow stats={STATS} />
      </section>

      {/* A real case from the archive. */}
      <section className="page py-20 sm:py-28">
        <div className="sheet tape grid items-center gap-10 p-6 sm:p-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <figure className="flex flex-col gap-2">
            <IrisBlink />
            <figcaption className="text-xs text-faint">
              Illustration of the two visits. The real frames are on the Discover page.
            </figcaption>
          </figure>
          <div className="flex flex-col gap-5">
            <SectionHead kicker="Discover" title="An asteroid, caught in the act.">
              <p>
                On 2 December 2025 SPHEREx looked twice at the same patch of sky near the star 36 Sextantis, 9 hours and
                42 minutes apart. In between, the asteroid <strong>(7) Iris</strong> moved against the background stars.
              </p>
              <p className="mt-3">Blink the two frames and compare its position with the one JPL's orbit predicts.</p>
            </SectionHead>
            <div>
              <Link to="/discover" className="btn btn-secondary">
                See the real frames <ArrowRight size={16} aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* One more way in. */}
      <section className="relative overflow-x-clip pb-24 pt-8">
        <RingedPlanetDoodle
          pencil="band-2"
          className="absolute left-[6%] top-0 hidden w-24 -rotate-12 motion-safe:animate-[bob_8s_ease-in-out_infinite] md:block"
        />
        <div className="page flex flex-col items-center gap-6 text-center">
          <h2 className="display text-[clamp(2.2rem,1.6rem+2.6vw,3.8rem)]">
            Where will you <span className="squiggle">look first</span>?
          </h2>
          <div className="w-full max-w-xl text-left">
            <SkySearch id="footer-search" />
          </div>
        </div>
      </section>
    </div>
  );
}
