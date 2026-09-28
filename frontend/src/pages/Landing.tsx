import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Crosshair, PlayCircle } from "lucide-react";
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
import { type Lang, useLang, useT } from "../lib/i18n";
import { caseLink, casesQuery } from "../lib/queries";
import { LANDING } from "./landing.messages";

type T = (key: keyof typeof LANDING.en) => string;

const EXAMPLES = [
  { label: "exAndromeda", to: "/explore?q=M31" },
  { label: "exPole", to: `/explore?q=${encodeURIComponent("270.0 66.56")}` },
  { label: "exIris", to: "/discover" },
] as const;

const QUESTIONS = [
  { n: "01", title: "whereTitle", text: "whereText", Figure: WhereFigure, wash: "wash-violet" },
  { n: "02", title: "whenTitle", text: "whenText", Figure: WhenFigure, wash: "wash-gold" },
  { n: "03", title: "changeTitle", text: "changeText", Figure: ChangeFigure, wash: "wash-ember" },
] as const;

const SURVEY_FACTS = [
  ["factOrbit", "factOrbitLabel"],
  ["factSweep", "factSweepLabel"],
  ["factFields", "factFieldsLabel"],
] as const;

function stats(t: T, lang: Lang): Stat[] {
  return [
    { value: 102, label: t("statChannels"), note: t("statChannelsNote") },
    { value: 4, label: t("statMaps"), note: t("statMapsNote") },
    { value: 98, suffix: t("statMinutes"), label: t("statOrbit"), note: t("statOrbitNote") },
    {
      // Bangla counts large numbers in lakh: 1.45 million is 14.5 lakh.
      ...(lang === "bn" ? { value: 14.5, decimals: 1 } : { value: 1.45, decimals: 2 }),
      suffix: t("statMillion"),
      label: t("statImages"),
      note: t("statImagesNote"),
    },
  ];
}

const IRIS_CASE = "iris-2025-12";

function SkySearch({ id }: { id: string }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const t = useT(LANDING);

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
        {t("searchLabel")}
      </label>
      <input
        id={id}
        className="field border-transparent bg-transparent shadow-none hover:border-transparent sm:flex-1"
        placeholder={t("searchPlaceholder")}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
      <button type="submit" className="btn btn-primary min-h-[2.75rem] px-6">
        {t("searchButton")} <ArrowRight size={16} aria-hidden />
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
  const t = useT(LANDING);
  const lang = useLang();
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
              {t("heroKicker")}
            </p>
            <h1 className={`display ${rise}`} style={enter(1)}>
              {t("heroBefore")}
              <span className="shine">{t("heroShine")}</span>
            </h1>
            <p className={`prose-body text-lg ${rise}`} style={enter(2)}>
              {t("heroLead")}
              <strong>{t("heroLeadStrong")}</strong>
              {t("heroLeadEnd")}
            </p>
            <div className={`flex flex-col gap-4 ${rise}`} style={enter(3)}>
              <SkySearch id="hero-search" />
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-faint">{t("try")}</span>
                {EXAMPLES.map((ex) => (
                  <Link key={ex.label} to={ex.to} className="chip">
                    {t(ex.label)}
                  </Link>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <Link to="/tour" className="link inline-flex items-center gap-1.5">
                  <PlayCircle size={15} aria-hidden /> {t("tour")}
                </Link>
                <Link to="/play" className="link inline-flex items-center gap-1.5">
                  <Crosshair size={15} aria-hidden /> {t("play")}
                </Link>
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
          kicker={t("howKicker")}
          title={
            <>
              {t("howBefore")}
              <span className="shine">{t("howShine")}</span>
              {t("howAfter")}
            </>
          }
        >
          {t("howText")}
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
                <h3 className="mt-1 text-[2rem]">{t(title)}</h3>
                <p className="mt-2 text-muted">{t(text)}</p>
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
              kicker={t("surveyKicker")}
              title={
                <>
                  {t("surveyBefore")}
                  <span className="shine">{t("surveyShine")}</span>
                  {t("surveyAfter")}
                </>
              }
            >
              <p>{t("surveyP1")}</p>
              <p className="mt-3">
                {t("surveyP2")}
                <strong>{t("surveyP2Strong")}</strong>
                {t("surveyP2End")}
              </p>
            </SectionHead>
            <Reveal delay={1}>
              <dl className="grid grid-cols-3 gap-6 border-t border-rule pt-6">
                {SURVEY_FACTS.map(([v, l]) => (
                  <div key={l}>
                    <dt className="font-display text-3xl text-text">{t(v)}</dt>
                    <dd className="mt-1 text-sm text-faint">{t(l)}</dd>
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
          kicker={t("coloursKicker")}
          title={
            <>
              {t("coloursBefore")}
              <span className="shine">{t("coloursShine")}</span>
              {t("coloursAfter")}
            </>
          }
        >
          {t("coloursText")}
        </SectionHead>
        <Reveal className="mt-12">
          <SpectrumExplorer />
        </Reveal>
      </section>

      {/* By the numbers. */}
      <section className="relative isolate overflow-hidden py-20">
        <div aria-hidden="true" className="wash-band absolute inset-0 -z-10" />
        <div className="page">
          <p className="kicker mb-12">{t("numbersKicker")}</p>
          <StatRow stats={stats(t, lang)} />
        </div>
      </section>

      {/* Objects to start with, from the Explore atlas. */}
      <section className="page py-20 sm:py-24">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <SectionHead
            n="04"
            kicker={t("atlasKicker")}
            title={
              <>
                {t("atlasBefore")}
                <span className="shine">{t("atlasShine")}</span>
                {t("atlasAfter")}
              </>
            }
          >
            {t("atlasText")}
          </SectionHead>
          <Reveal delay={1}>
            <Link to="/explore" className="btn btn-secondary">
              {t("atlasButton")} <ArrowRight size={16} aria-hidden />
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
              {iris ? t("irisFrames") : t("irisIllustration")}
            </figcaption>
          </figure>
          <div className="flex flex-col gap-6">
            <SectionHead n="05" kicker={t("caseKicker")} title={t("caseTitle")}>
              <p>
                {t("caseP1")}
                <strong>{t("caseP1Strong")}</strong>
                {t("caseP1End")}
              </p>
              <p className="mt-3">{t("caseP2")}</p>
            </SectionHead>
            <div className="flex flex-wrap gap-3">
              <Link to="/discover" className="btn btn-primary">
                {t("openCase")} <ArrowRight size={16} aria-hidden />
              </Link>
              {iris ? (
                <Link to={caseLink(iris, snapshot ? "snapshot" : undefined)} className="btn btn-secondary">
                  {t("everyFrame")}
                </Link>
              ) : null}
            </div>
            <p className="text-sm text-faint">
              {t("planetX")}{" "}
              <Link to="/discover#planet-x" className="link">
                {t("planetXLink")}
              </Link>
              {t("planetXEnd")}
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
            {t("lookBefore")}
            <span className="shine">{t("lookShine")}</span>
          </h2>
          <div className="w-full max-w-xl text-left">
            <SkySearch id="footer-search" />
          </div>
        </Reveal>
      </section>
    </div>
  );
}
