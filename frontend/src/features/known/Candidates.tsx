import { useQuery } from "@tanstack/react-query";
import { ChevronRight, ScanSearch } from "lucide-react";
import { useEffect, useState } from "react";

import { ApiError, type DataSource } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { matchCandidate } from "../../lib/matching";
import { candidatesQuery } from "../../lib/queries";
import type { Candidates, Frame, KnownObjects } from "../../lib/types";
import { KNOWN } from "./messages";

interface Props {
  sequence: Frame[];
  target: { ra: number; dec: number };
  fov: number;
  source: DataSource;
  enabled: boolean;
  known: KnownObjects | undefined;
  showWeak: boolean;
  onShowWeak: (show: boolean) => void;
  onResult: (result: Candidates | undefined) => void;
}

const DIRECTIONS = ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const;

function direction(pa: number): (typeof DIRECTIONS)[number] {
  return DIRECTIONS[Math.round(pa / 45) % 8]!;
}

/** Our own search of this pass for things that move, compared with JPL's catalogue. */
export function CandidatesPanel({ sequence, target, fov, source, enabled, known, showWeak, onShowWeak, onResult }: Props) {
  const t = useT(KNOWN);
  const [asked, setAsked] = useState(false);
  const keys = sequence.map((f) => f.key);
  const query = useQuery({ ...candidatesQuery(target.ra, target.dec, fov, keys, source), enabled: asked && enabled && keys.length >= 2 });
  const data = query.data;
  useEffect(() => onResult(data), [data, onResult]);

  const strong = data?.candidates.filter((c) => c.strength === "candidate") ?? [];
  const weak = data?.candidates.filter((c) => c.strength !== "candidate") ?? [];

  return (
    <section aria-labelledby="moving-title" className="space-y-3 border-t border-rule pt-6">
      <h2 id="moving-title" className="panel-title">
        {t("movingTitle")}
      </h2>
      {!enabled ? (
        <p className="text-sm text-muted">{t("movingDisabled")}</p>
      ) : !asked ? (
        <>
          <p className="text-sm text-muted">
            {t("movingIntro")}
          </p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAsked(true)}>
            <ScanSearch size={15} aria-hidden /> {t("movingButton")}
          </button>
        </>
      ) : query.isPending ? (
        <p className="text-sm text-muted" role="status">
          {t("searching", { n: keys.length })}
        </p>
      ) : query.error ? (
        <div className="space-y-2">
          <p className="text-sm text-danger" role="alert">
            {query.error instanceof ApiError ? query.error.message : t("searchFailed")}
          </p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => query.refetch()}>
            {t("tryAgain")}
          </button>
        </div>
      ) : data ? (
        <>
          <p className="text-sm text-muted">
            {t("stats", {
              detections: data.stats.detections.toLocaleString("en-US"),
              transient: data.stats.transient,
              sightings: data.stats.sightings,
              lined: strong.length === 0 ? t("linedNone") : t("linedSome", { n: strong.length }),
            })}
          </p>
          {strong.length > 0 && (
            <ul className="divide-y divide-rule border-y border-rule">
              {strong.map((c) => {
                const match = known ? matchCandidate(c, known.objects) : null;
                return (
                  <li key={c.id} className="space-y-1 py-2.5">
                    <p className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold text-text">{c.id}</span>
                      <span className="num text-xs text-faint">
                        {t("rate", { rate: c.rateArcsecPerHour.toFixed(0), direction: t(direction(c.positionAngleDeg)) })}
                      </span>
                    </p>
                    <p className="text-xs text-muted">
                      {t("sightings", { n: c.sightings.length, scatter: c.residualArcsec.toFixed(1) })}
                    </p>
                    <p className="text-xs">
                      {match ? (
                        <span className="text-text">
                          {t("matches", { name: match.name, offset: match.medianOffsetArcsec.toFixed(1) })}
                        </span>
                      ) : known ? (
                        <span className="text-text">{t("unmatched", { vmag: known.searched.vmagLimit })}</span>
                      ) : (
                        <span className="text-faint">{t("checkFirst")}</span>
                      )}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
          {weak.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={showWeak} onChange={(e) => onShowWeak(e.target.checked)} className="accent-[var(--accent)]" />
              {t("showWeak", { n: weak.length, noun: t(weak.length === 1 ? "candidate" : "candidates") })}
            </label>
          )}
          <p className="note">{data.caution}</p>
          <details className="disclosure">
            <summary>
              <ChevronRight size={16} className="disclosure-chevron" aria-hidden />
              {t("howSearch")}
            </summary>
            <p className="mt-2 text-sm text-muted">{data.method}</p>
            <p className="mt-2 text-xs text-faint">
              {t("rates", { min: data.limits.minRateArcsecPerHour, max: data.limits.maxRateArcsecPerHour })}
            </p>
          </details>
        </>
      ) : null}
    </section>
  );
}
