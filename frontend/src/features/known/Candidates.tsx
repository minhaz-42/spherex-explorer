import { useQuery } from "@tanstack/react-query";
import { ChevronRight, ScanSearch } from "lucide-react";
import { useEffect, useState } from "react";

import { ApiError, type DataSource } from "../../lib/api";
import { matchCandidate } from "../../lib/matching";
import { candidatesQuery } from "../../lib/queries";
import type { Candidates, Frame, KnownObjects } from "../../lib/types";

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

const DIRECTIONS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];

function direction(pa: number): string {
  return DIRECTIONS[Math.round(pa / 45) % 8]!;
}

/** Our own search of this pass for things that move, compared with JPL's catalogue. */
export function CandidatesPanel({ sequence, target, fov, source, enabled, known, showWeak, onShowWeak, onResult }: Props) {
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
        Moving sources in this pass
      </h2>
      {!enabled ? (
        <p className="text-sm text-muted">Needs one survey pass with at least two pointings.</p>
      ) : !asked ? (
        <>
          <p className="text-sm text-muted">
            Search every frame of this pass for sources that move from one pointing to the next, the way an asteroid or
            a distant planet would. It reads every frame, so it waits for them to load.
          </p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAsked(true)}>
            <ScanSearch size={15} aria-hidden /> Search for moving sources
          </button>
        </>
      ) : query.isPending ? (
        <p className="text-sm text-muted" role="status">
          Searching {keys.length} frames…
        </p>
      ) : query.error ? (
        <div className="space-y-2">
          <p className="text-sm text-danger" role="alert">
            {query.error instanceof ApiError ? query.error.message : "The search failed."}
          </p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => query.refetch()}>
            Try again
          </button>
        </div>
      ) : data ? (
        <>
          <p className="text-sm text-muted">
            {data.stats.detections.toLocaleString("en-US")} sources detected; {data.stats.transient} were not seen again at
            the same place, {data.stats.sightings} of those repeated within a pointing, and{" "}
            {strong.length === 0 ? "none lined up" : `${strong.length} lined up`} across three or more pointings.
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
                        {c.rateArcsecPerHour.toFixed(0)}″/h toward the {direction(c.positionAngleDeg)}
                      </span>
                    </p>
                    <p className="text-xs text-muted">
                      {c.sightings.length} sightings on a straight line (scatter {c.residualArcsec.toFixed(1)}″).
                    </p>
                    <p className="text-xs">
                      {match ? (
                        <span className="text-text">
                          Matches JPL’s prediction for {match.name}, {match.medianOffsetArcsec.toFixed(1)}″ away (known object).
                        </span>
                      ) : known ? (
                        <span className="text-text">No catalogued body brighter than V {known.searched.vmagLimit} matches. Unconfirmed candidate: further analysis required.</span>
                      ) : (
                        <span className="text-faint">Check JPL for known objects above to see whether it is catalogued.</span>
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
              Also show {weak.length} weak {weak.length === 1 ? "candidate" : "candidates"} (two sightings only)
            </label>
          )}
          <p className="note">{data.caution}</p>
          <details className="disclosure">
            <summary>
              <ChevronRight size={16} className="disclosure-chevron" aria-hidden />
              How the search works
            </summary>
            <p className="mt-2 text-sm text-muted">{data.method}</p>
            <p className="mt-2 text-xs text-faint">
              Rates between {data.limits.minRateArcsecPerHour}″ and {data.limits.maxRateArcsecPerHour}″ per hour are
              searched. A body much slower than that, such as a distant planet, would not be separated from the fixed
              sky within one pass.
            </p>
          </details>
        </>
      ) : null}
    </section>
  );
}
