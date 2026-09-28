import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Crosshair, Database } from "lucide-react";
import { Link } from "react-router";

import { BlinkPreview } from "../features/discover/BlinkPreview";
import { getJson } from "../lib/api";
import { formatDate, formatRange, plural } from "../lib/format";
import { caseLink, casesQuery } from "../lib/queries";
import type { DiscoverCase } from "../lib/types";

const KINDS: { kind: DiscoverCase["kind"]; heading: string; blurb: string }[] = [
  {
    kind: "moving",
    heading: "Things that move",
    blurb: "Stars keep their places from one visit to the next. Anything that shifts against them is in our Solar System.",
  },
  {
    kind: "brightness",
    heading: "Brightness at one wavelength",
    blurb: "Compared at the same wavelength months apart, a change in brightness is a change in the source.",
  },
  {
    kind: "spectrum",
    heading: "One place in many colours",
    blurb: "Every SPHEREx exposure sees a slightly different wavelength. Together they make a spectrum.",
  },
  {
    kind: "context",
    heading: "Where to look",
    blurb: "Some parts of the sky are watched much more often than others.",
  },
];

const KIND_LABEL: Record<DiscoverCase["kind"], string> = {
  moving: "Moving source · known asteroid",
  brightness: "Brightness change at a matched wavelength",
  spectrum: "Spectrum from many exposures",
  context: "Context",
};

function useSnapshotAvailable(): boolean {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: ({ signal }) => getJson<{ snapshotAvailable: boolean }>("/health", {}, signal),
    staleTime: 5 * 60 * 1000,
  });
  return !!health.data?.snapshotAvailable;
}

function CaseEntry({ c, snapshot }: { c: DiscoverCase; snapshot: boolean }) {
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
        <p className="mt-2 text-xs text-faint">
          Two of the {c.observed.frames} frames, flipped with one shared brightness scale.
        </p>
      </div>
      <div className="min-w-0 space-y-4">
        <p className="kicker">{KIND_LABEL[c.kind]}</p>
        <h3 id={`case-${c.id}`} className="text-[length:var(--fs-h2)]">
          {c.title}
        </h3>
        <p className="num text-sm text-muted">
          {formatRange(c.observed.start, c.observed.end)} · {plural(c.observed.frames, "frame")} in{" "}
          {plural(c.observed.pointings, "pointing")} · detector {c.observed.detector},{" "}
          {c.observed.wavelengthUm[0].toFixed(2)}–{c.observed.wavelengthUm[1].toFixed(2)} µm · in {c.target.constellation}
        </p>
        <p className="prose-body">{c.summary}</p>
        <div>
          <p className="panel-title">The evidence</p>
          <ul className="mt-2 space-y-2 text-sm text-muted">
            {c.evidence.map((e) => (
              <li key={e} className="flex gap-2">
                <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--text-faint)]" />
                <span>{e}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="note">{c.caution}</p>
        <div className="flex flex-wrap gap-3 pt-1">
          <Link to={caseLink(c)} className="btn btn-primary">
            Explore this case <ArrowRight size={16} aria-hidden />
          </Link>
          {snapshot && (
            <Link to={caseLink(c, "snapshot")} className="btn btn-secondary">
              <Database size={15} aria-hidden /> Open the demo snapshot
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

export function Discover() {
  const cases = useQuery(casesQuery());
  const snapshot = useSnapshotAvailable();
  const list = cases.data?.cases ?? [];

  return (
    <div className="page py-12 md:py-16">
      <header className="max-w-3xl space-y-4">
        <p className="kicker">Discover</p>
        <h1 className="text-[length:var(--fs-h1)]">Changes SPHEREx has seen</h1>
        <p className="prose-body">
          Each case comes from real SPHEREx images, measured by this app and checked against an authoritative catalogue.
          The evidence lists what was measured and what the catalogue says; the note under it says what the evidence
          cannot tell you. Open a case to step through every frame yourself.
        </p>
        {cases.data?.built && (
          <p className="text-sm text-faint">Cases built from the archive on {formatDate(cases.data.built)}.</p>
        )}
      </header>

      <div className="mt-10">
        {cases.isPending ? (
          <div className="space-y-6" role="status">
            <div className="skeleton h-72 w-full rounded-sm" />
            <p className="text-muted">Loading cases…</p>
          </div>
        ) : cases.error ? (
          <p className="note note-danger">The cases could not be loaded. Explore still works: try a search.</p>
        ) : list.length === 0 ? (
          <p className="note">No cases have been built yet. Run <code className="mono">make snapshot</code> to build them.</p>
        ) : (
          KINDS.filter((k) => list.some((c) => c.kind === k.kind)).map((k) => (
            <section key={k.kind} aria-labelledby={`kind-${k.kind}`} className="mb-14">
              <div className="mb-2 max-w-3xl">
                <h2 id={`kind-${k.kind}`} className="section-title">
                  {k.heading}
                </h2>
                <p className="mt-2 text-muted">{k.blurb}</p>
              </div>
              {list
                .filter((c) => c.kind === k.kind)
                .map((c) => (
                  <CaseEntry key={c.id} c={c} snapshot={snapshot} />
                ))}
            </section>
          ))
        )}
      </div>

      <section aria-labelledby="hunt" className="mt-6 grid gap-10 border-t border-rule pt-10 lg:grid-cols-2">
        <div className="space-y-4">
          <h2 id="hunt" className="section-title">
            Hunt for yourself
          </h2>
          <ol className="space-y-3 text-muted">
            <li>
              <strong className="font-medium text-text">1. Pick a spot near the ecliptic,</strong> the plane where the
              planets and most asteroids travel. Ecliptic latitude is shown for every search.
            </li>
            <li>
              <strong className="font-medium text-text">2. Choose one survey pass</strong> and blink frames from different
              pointings, hours apart. Stars stay put; asteroids jump.
            </li>
            <li>
              <strong className="font-medium text-text">3. Run the moving-source search,</strong> then ask JPL which known
              objects were there. A match is a known asteroid; no match is an unconfirmed candidate, most often an
              artefact.
            </li>
          </ol>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link to="/play" className="btn btn-secondary btn-sm">
              <Crosshair size={14} aria-hidden /> Practise on Spot the mover
            </Link>
            <Link to="/explore?q=10.6847+41.2690" className="link text-sm">
              Or start from any object name or coordinates
            </Link>
          </div>
        </div>
        <div className="space-y-4" id="planet-x">
          <h2 className="section-title">What about Planet X?</h2>
          <p className="text-muted">
            A large planet far beyond Neptune, often called Planet Nine, has been proposed to explain how some distant
            objects orbit. It has not been found. If it exists at around 500 au, it would move only a few arcseconds a day
            against the stars, less than one SPHEREx pixel, so within a single pass it would look like a star.
          </p>
          <p className="text-muted">
            Six months later, when Earth is on the other side of the Sun, it would appear displaced by about a quarter of
            a degree. So the signature to look for is a faint source present in one pass and missing from the next, not a
            track within a pass. Published estimates put its brightness near or beyond what a single SPHEREx exposure
            can detect, and nothing in this app claims to have found it.
          </p>
        </div>
      </section>
    </div>
  );
}
