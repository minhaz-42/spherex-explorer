import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Database, RefreshCw } from "lucide-react";
import { useCallback, useMemo, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { ApiError, type DataSource, getJson } from "../lib/api";
import { formatDate, formatRange } from "../lib/format";
import { useLang, useT } from "../lib/i18n";
import { observationsQuery, resolveQuery } from "../lib/queries";
import type { SequenceSpec } from "../lib/sequence";
import type { Observations, Target } from "../lib/types";
import { ObjectAtlas } from "../features/objects/ObjectAtlas";
import { DecadesSection } from "../features/decades/DecadesSection";
import { FieldObjects } from "../features/objects/FieldObjects";
import { localName } from "../features/objects/atlas";
import { constellationName } from "../features/objects/constellations";
import { morphologyWords } from "../features/objects/format";
import { ObjectProfile, type SkyContext } from "../features/objects/ObjectProfile";
import { objectQuery } from "../features/objects/queries";
import { SearchForm } from "../features/search/SearchForm";
import { type CompareMode, FIELDS, type ViewerState } from "../features/viewer/state";
import { Viewer } from "../features/viewer/Viewer";
import { EXAMPLES } from "../lib/examples";
import { EXPLORE, framesSummary } from "./explore.messages";

function num(v: string | null): number | null {
  if (v === null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: ({ signal }) => getJson<{ snapshotAvailable: boolean }>("/health", {}, signal),
    staleTime: 5 * 60 * 1000,
  });
}

export function Explore() {
  const t = useT(EXPLORE);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const q = params.get("q");
  const ra = num(params.get("ra"));
  const dec = num(params.get("dec"));
  const source: DataSource = params.get("source") === "snapshot" ? "snapshot" : "live";
  const hasPosition = ra !== null && dec !== null && ra >= 0 && ra < 360 && dec >= -90 && dec <= 90;

  const resolved = useQuery({ ...resolveQuery(q ?? "", source), enabled: !!q && !hasPosition });
  const target: Target | undefined = resolved.data;
  const posRa = hasPosition ? ra! : target?.ra;
  const posDec = hasPosition ? dec! : target?.dec;
  const name = params.get("name") ?? target?.name ?? null;

  const observations = useQuery({
    ...observationsQuery(posRa ?? 0, posDec ?? 0, source),
    enabled: posRa !== undefined && posDec !== undefined,
  });

  // A search keeps the data source: in demo mode, a new search stays on the demo snapshot.
  const search = (query: string) =>
    navigate(`/explore?q=${encodeURIComponent(query)}${source === "snapshot" ? "&source=snapshot" : ""}`);

  const setSource = (next: DataSource) => {
    const p = new URLSearchParams(params);
    if (next === "snapshot") p.set("source", "snapshot");
    else p.delete("source");
    setParams(p);
  };

  // Keep the viewer's state in the URL (replace, not push) so any view can be shared.
  const lastWritten = useRef("");
  const onStateChange = useCallback(
    (s: ViewerState) => {
      const p = new URLSearchParams(window.location.search);
      if (posRa !== undefined && posDec !== undefined && !p.has("ra")) {
        p.set("ra", posRa.toFixed(6));
        p.set("dec", posDec.toFixed(6));
        if (name) p.set("name", name);
      }
      p.set("seq", s.spec.mode);
      p.set("det", String(s.spec.detector));
      if (s.spec.mode === "pass") {
        p.set("pass", String(s.spec.passIndex));
        p.delete("wl");
      } else {
        p.delete("pass");
        if (s.spec.wavelengthUm != null) p.set("wl", s.spec.wavelengthUm.toFixed(4));
      }
      if (s.frame) p.set("f", s.frame);
      if (s.reference) p.set("fa", s.reference);
      p.delete("i");
      p.delete("a");
      p.set("cmp", s.compare);
      p.set("fov", String(s.fov));
      const next = p.toString();
      if (next !== lastWritten.current && next !== window.location.search.slice(1)) {
        lastWritten.current = next;
        setParams(p, { replace: true, preventScrollReset: true });
      }
    },
    [posRa, posDec, name, setParams],
  );

  const initial = useMemo((): Partial<ViewerState> | undefined => {
    const det = num(params.get("det"));
    if (det === null) return undefined;
    const seq = params.get("seq") === "wavelength" ? "wavelength" : "pass";
    const spec: SequenceSpec = {
      mode: seq,
      detector: Math.min(Math.max(det, 1), 6),
      passIndex: num(params.get("pass")) ?? 0,
      wavelengthUm: num(params.get("wl")),
    };
    const cmp = params.get("cmp");
    const fov = num(params.get("fov"));
    return {
      spec,
      frame: params.get("f"),
      reference: params.get("fa"),
      compare: (["single", "blink", "side", "diff"].includes(cmp ?? "") ? cmp : "single") as CompareMode,
      fov: fov !== null && FIELDS.includes(fov) ? fov : 0.2,
    };
    // Read once per target; later changes flow from the viewer to the URL, not back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posRa, posDec, source]);

  if (!q && !hasPosition) return <SearchStart onSearch={search} />;

  const resolveError = resolved.error instanceof ApiError ? resolved.error : null;
  if (q && !hasPosition && resolveError) {
    return (
      <SearchStart
        onSearch={search}
        initial={q}
        error={
          resolveError.isUpstream || resolveError.code === "network_error"
            ? t("tryAgainSoon", { message: resolveError.message })
            : resolveError.message
        }
      />
    );
  }

  const label =
    name ?? (posRa !== undefined ? t("position", { ra: posRa.toFixed(4), dec: posDec!.toFixed(4) }) : (q ?? ""));
  const where = observations.data?.target ?? target;
  const sky: SkyContext | undefined = where
    ? {
        constellation: where.constellation,
        galactic: where.galactic,
        ecliptic: where.ecliptic,
        deepField: observations.data?.deepField?.name ?? target?.deepField ?? null,
      }
    : undefined;

  return (
    <div className="mx-auto w-full max-w-[96rem] px-[var(--gutter)] pb-16 pt-6">
      <div className="flex flex-col gap-4 border-b border-rule pb-5 md:flex-row md:items-end md:justify-between">
        <TargetHeading
          label={label}
          target={target}
          observations={observations.data}
          source={source}
          position={posRa !== undefined && posDec !== undefined ? { ra: posRa, dec: posDec } : null}
        />
        <div className="w-full md:max-w-sm">
          <SearchForm size="compact" initial={q ?? ""} onSearch={search} />
        </div>
      </div>

      {posRa !== undefined && posDec !== undefined ? (
        <div className="pt-6">
          <ObjectProfile key={`${posRa}:${posDec}`} ra={posRa} dec={posDec} label={label} source={source} sky={sky} />
        </div>
      ) : null}

      {posRa !== undefined && posDec !== undefined ? (
        <div className="pt-4">
          <DecadesSection key={`${posRa}:${posDec}`} ra={posRa} dec={posDec} label={label} source={source} />
        </div>
      ) : null}

      <div className="pt-6">
        {resolved.isPending && !!q && !hasPosition ? (
          <Working text={t("lookingUp", { q })} />
        ) : observations.isPending ? (
          <Working text={t("searching", { label })} detail={t("usually")} />
        ) : observations.error ? (
          <ObservationsError
            error={observations.error}
            onRetry={() => observations.refetch()}
            source={source}
            onSnapshot={() => setSource("snapshot")}
            onLive={() => setSource("live")}
          />
        ) : observations.data && observations.data.frames.length === 0 ? (
          <Empty label={label} />
        ) : observations.data ? (
          <Viewer
            key={`${posRa}:${posDec}:${source}`}
            observations={observations.data}
            target={{ ra: posRa!, dec: posDec!, label }}
            source={source}
            initial={initial}
            onStateChange={onStateChange}
          />
        ) : null}
      </div>

      {posRa !== undefined && posDec !== undefined ? (
        <div className="pt-8">
          <FieldObjects key={`${posRa}:${posDec}`} ra={posRa} dec={posDec} source={source} />
        </div>
      ) : null}
    </div>
  );
}

function TargetHeading({
  label,
  target,
  observations,
  source,
  position,
}: {
  label: string;
  target: Target | undefined;
  observations: Observations | undefined;
  source: DataSource;
  position: { ra: number; dec: number } | null;
}) {
  const t = useT(EXPLORE);
  const lang = useLang();
  const where = observations?.target ?? target;
  const summary = observations?.summary;
  // The same SIMBAD answer the profile below uses (so no extra request). SIMBAD classes many famous
  // galaxies by their nuclei, so a galaxy is named by its shape, as the profile does.
  const info = useQuery({
    ...objectQuery(position?.ra ?? 0, position?.dec ?? 0, source),
    enabled: position !== null,
  }).data;
  const kind = (info?.category === "galaxy" ? morphologyWords(info.morphology, lang) : null) ?? target?.kind;
  // Famous objects have Bangla names (the atlas's); anything else keeps the name it was searched by.
  const heading = (info ? localName(info, lang) : null) ?? label;
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <DataModeBadge source={source} retrievedAt={observations?.retrievedAt} />
        {kind && <span className="text-muted">{kind}</span>}
      </p>
      <h1 className="text-[length:var(--fs-h1)]">{heading}</h1>
      {where && (
        <p className="num flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          <span>{t("raDec", { ra: where.raHms, dec: where.decDms })}</span>
          <span>{t("inConstellation", { name: constellationName(where.constellation, lang) })}</span>
          {summary && summary.first && summary.last && (
            <span>{framesSummary(lang, summary.frames, summary.passes, formatRange(summary.first, summary.last))}</span>
          )}
        </p>
      )}
    </div>
  );
}

export function DataModeBadge({ source, retrievedAt }: { source: DataSource; retrievedAt?: string }) {
  const t = useT(EXPLORE);
  return source === "snapshot" ? (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-snapshot/50 px-2 py-0.5 text-xs text-snapshot">
      <Database size={12} aria-hidden /> {t("snapshot")}
      {retrievedAt ? t("retrieved", { date: formatDate(retrievedAt) }) : ""}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-live/50 px-2 py-0.5 text-xs text-live">
      <span className="h-1.5 w-1.5 rounded-full bg-live" aria-hidden /> {t("live")}
    </span>
  );
}

function Working({ text, detail }: { text: string; detail?: string }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_21rem]" role="status" aria-live="polite">
      <div className="space-y-4">
        <div className="skeleton aspect-square w-full rounded-sm" />
        <div className="skeleton h-12 w-full rounded-sm" />
      </div>
      <div className="space-y-3">
        <p className="text-muted">{text}</p>
        {detail && <p className="text-sm text-faint">{detail}</p>}
      </div>
    </div>
  );
}

function ObservationsError({
  error,
  onRetry,
  source,
  onSnapshot,
  onLive,
}: {
  error: Error;
  onRetry: () => void;
  source: DataSource;
  onSnapshot: () => void;
  onLive: () => void;
}) {
  const t = useT(EXPLORE);
  const health = useHealth();
  const api = error instanceof ApiError ? error : null;
  const notInSnapshot = api?.code === "not_in_snapshot";
  return (
    <div className="max-w-2xl space-y-4 py-10">
      <p className="flex items-center gap-2 text-lg">
        <AlertTriangle size={20} className="text-warn" aria-hidden />
        {notInSnapshot ? t("notInSnapshot") : t("archiveFailed")}
      </p>
      <p className="text-muted">{api?.message ?? error.message}</p>
      {!notInSnapshot && (
        <p className="text-sm text-faint">{t("nothingSubstituted")}</p>
      )}
      <div className="flex flex-wrap gap-3">
        {notInSnapshot ? (
          <button type="button" className="btn btn-primary" onClick={onLive}>
            {t("useLive")}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={onRetry}>
            <RefreshCw size={16} aria-hidden /> {t("tryAgain")}
          </button>
        )}
        {source === "live" && health.data?.snapshotAvailable && (
          <button type="button" className="btn btn-secondary" onClick={onSnapshot}>
            <Database size={16} aria-hidden /> {t("useSnapshot")}
          </button>
        )}
        <Link to="/discover" className="btn btn-ghost">
          {t("browseDiscover")}
        </Link>
      </div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  const t = useT(EXPLORE);
  return (
    <div className="max-w-2xl space-y-3 py-10">
      <p className="text-lg">{t("emptyTitle", { label })}</p>
      <p className="text-muted">{t("emptyBody")}</p>
      <Link to="/explore" className="btn btn-secondary">
        {t("newSearch")}
      </Link>
    </div>
  );
}

function SearchStart({
  onSearch,
  initial,
  error,
}: {
  onSearch: (q: string) => void;
  initial?: string;
  error?: string | null;
}) {
  const t = useT(EXPLORE);
  const lang = useLang();
  return (
    <div className="flex flex-col">
      <section className="relative isolate overflow-x-clip">
        <div className="nebula" aria-hidden="true">
          <span
            style={{
              left: "55%",
              top: "-20%",
              width: "40rem",
              height: "40rem",
              background: "radial-gradient(closest-side, rgb(141 116 255 / 0.4), transparent)",
            }}
          />
          <span
            style={{
              left: "-5%",
              top: "10%",
              width: "32rem",
              height: "32rem",
              background: "radial-gradient(closest-side, rgb(255 196 102 / 0.45), transparent)",
              animationDelay: "-10s",
            }}
          />
        </div>
        <div className="page grid gap-12 py-12 md:py-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16">
          <div className="space-y-6">
            <p className="kicker">{t("kicker")}</p>
            <h1 className="text-[length:var(--fs-h1)]">{t("title")}</h1>
            <p className="prose-body">{t("intro")}</p>
            <SearchForm initial={initial} error={error} onSearch={onSearch} />
          </div>
          <div>
            <h2 className="panel-title">{t("startWith")}</h2>
            <ul className="mt-3 grid gap-2">
              {EXAMPLES.map((ex) => (
                <li key={ex.to}>
                  <Link
                    to={ex.to}
                    className="glass group flex items-center justify-between gap-4 rounded-[14px] px-4 py-3.5 no-underline transition-[translate] hover:-translate-y-0.5"
                  >
                    <span>
                      <span className="block text-text group-hover:text-accent-strong">{ex[lang].label}</span>
                      <span className="block text-sm text-faint">{ex[lang].detail}</span>
                    </span>
                    <ArrowRight
                      size={18}
                      className="shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-text"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <div className="page pb-24 pt-4">
        <ObjectAtlas />
      </div>
    </div>
  );
}
