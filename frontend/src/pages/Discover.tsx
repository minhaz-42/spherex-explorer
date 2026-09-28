import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Crosshair, Database } from "lucide-react";
import { Link } from "react-router";

import { BlinkPreview } from "../features/discover/BlinkPreview";
import { getJson } from "../lib/api";
import { formatDate } from "../lib/format";
import { useLang, useT } from "../lib/i18n";
import { caseLink, casesQuery } from "../lib/queries";
import type { DiscoverCase } from "../lib/types";
import { caseFacts, DISCOVER } from "./discover.messages";

type Key = keyof typeof DISCOVER.en;

const KINDS: { kind: DiscoverCase["kind"]; heading: Key; blurb: Key }[] = [
  { kind: "moving", heading: "movingHeading", blurb: "movingBlurb" },
  { kind: "brightness", heading: "brightnessHeading", blurb: "brightnessBlurb" },
  { kind: "spectrum", heading: "spectrumHeading", blurb: "spectrumBlurb" },
  { kind: "context", heading: "contextHeading", blurb: "contextBlurb" },
];

const KIND_LABEL: Record<DiscoverCase["kind"], Key> = {
  moving: "kindMoving",
  brightness: "kindBrightness",
  spectrum: "kindSpectrum",
  context: "kindContext",
};

/** "Hunt for yourself": each step a bold lead-in and the rest of it. */
const STEPS: [Key, Key][] = [
  ["step1", "step1Text"],
  ["step2", "step2Text"],
  ["step3", "step3Text"],
];

function useSnapshotAvailable(): boolean {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: ({ signal }) => getJson<{ snapshotAvailable: boolean }>("/health", {}, signal),
    staleTime: 5 * 60 * 1000,
  });
  return !!health.data?.snapshotAvailable;
}

function CaseEntry({ c, snapshot }: { c: DiscoverCase; snapshot: boolean }) {
  const t = useT(DISCOVER);
  const lang = useLang();
  // A case's own texts come from the API in English; on a Bangla page they are marked as English.
  const en = lang === "bn" ? "en" : undefined;
  return (
    <article className="grid gap-6 border-t border-rule py-8 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] md:gap-10" aria-labelledby={`case-${c.id}`}>
      <div className="md:pt-1">
        <BlinkPreview
          ra={c.target.ra}
          dec={c.target.dec}
          fov={c.viewer.fov}
          a={c.preview.a}
          b={c.preview.b}
          source={snapshot ? "snapshot" : "live"}
          label={c.title}
        />
        <p className="mt-2 text-xs text-faint">{t("twoOf", { n: c.observed.frames })}</p>
      </div>
      <div className="min-w-0 space-y-4">
        <p className="kicker">{t(KIND_LABEL[c.kind])}</p>
        <h3 id={`case-${c.id}`} className="text-[length:var(--fs-h2)]" lang={en}>
          {c.title}
        </h3>
        <p className="num text-sm text-muted">{caseFacts(lang, c)}</p>
        <p className="prose-body" lang={en}>
          {c.summary}
        </p>
        <div>
          <p className="panel-title">{t("evidence")}</p>
          <ul className="mt-2 space-y-2 text-sm text-muted" lang={en}>
            {c.evidence.map((e) => (
              <li key={e} className="flex gap-2">
                <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--text-faint)]" />
                <span>{e}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="note" lang={en}>
          {c.caution}
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <Link to={caseLink(c)} className="btn btn-primary">
            {t("exploreCase")} <ArrowRight size={16} aria-hidden />
          </Link>
          {snapshot && (
            <Link to={caseLink(c, "snapshot")} className="btn btn-secondary">
              <Database size={15} aria-hidden /> {t("openSnapshot")}
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

export function Discover() {
  const t = useT(DISCOVER);
  const lang = useLang();
  const cases = useQuery(casesQuery());
  const snapshot = useSnapshotAvailable();
  const list = cases.data?.cases ?? [];

  return (
    <div className="page py-12 md:py-16">
      <header className="max-w-3xl space-y-4">
        <p className="kicker">{t("kicker")}</p>
        <h1 className="text-[length:var(--fs-h1)]">{t("title")}</h1>
        <p className="prose-body">{t("intro")}</p>
        {cases.data?.built && (
          <p className="text-sm text-faint">{t("built", { date: formatDate(cases.data.built) })}</p>
        )}
      </header>

      <div className="mt-10">
        {cases.isPending ? (
          <div className="space-y-6" role="status">
            <div className="skeleton h-72 w-full rounded-sm" />
            <p className="text-muted">{t("loading")}</p>
          </div>
        ) : cases.error ? (
          <p className="note note-danger">{t("error")}</p>
        ) : list.length === 0 ? (
          <p className="note">
            {t("emptyBefore")}
            <code className="mono">make snapshot</code>
            {t("emptyAfter")}
          </p>
        ) : (
          <>
            {/* The cases' own texts come from the API in English; a Bangla page says so first. */}
            {lang === "bn" && <p className="mb-6 text-sm text-faint">{t("inEnglish")}</p>}
            {KINDS.filter((k) => list.some((c) => c.kind === k.kind)).map((k) => (
              <section key={k.kind} aria-labelledby={`kind-${k.kind}`} className="mb-14">
                <div className="mb-2 max-w-3xl">
                  <h2 id={`kind-${k.kind}`} className="section-title">
                    {t(k.heading)}
                  </h2>
                  <p className="mt-2 text-muted">{t(k.blurb)}</p>
                </div>
                {list
                  .filter((c) => c.kind === k.kind)
                  .map((c) => (
                    <CaseEntry key={c.id} c={c} snapshot={snapshot} />
                  ))}
              </section>
            ))}
          </>
        )}
      </div>

      <section aria-labelledby="hunt" className="mt-6 grid gap-10 border-t border-rule pt-10 lg:grid-cols-2">
        <div className="space-y-4">
          <h2 id="hunt" className="section-title">
            {t("huntTitle")}
          </h2>
          <ol className="space-y-3 text-muted">
            {STEPS.map(([lead, text]) => (
              <li key={lead}>
                <strong className="font-medium text-text">{t(lead)}</strong> {t(text)}
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link to="/play" className="btn btn-secondary btn-sm">
              <Crosshair size={14} aria-hidden /> {t("practise")}
            </Link>
            <Link to="/explore?q=10.6847+41.2690" className="link text-sm">
              {t("orStart")}
            </Link>
          </div>
        </div>
        <div className="space-y-4" id="planet-x">
          <h2 className="section-title">{t("planetXTitle")}</h2>
          <p className="text-muted">{t("planetX1")}</p>
          <p className="text-muted">{t("planetX2")}</p>
        </div>
      </section>
    </div>
  );
}
