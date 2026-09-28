import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Orbit } from "lucide-react";
import { useEffect, useState } from "react";

import { ApiError, type DataSource } from "../../lib/api";
import { plural } from "../../lib/format";
import { knownObjectsQuery } from "../../lib/queries";
import type { Frame, KnownObjects as KnownObjectsResult } from "../../lib/types";

interface Props {
  sequence: Frame[];
  current: Frame | undefined;
  target: { ra: number; dec: number };
  fov: number;
  source: DataSource;
  enabled: boolean;
  show: boolean;
  onShow: (show: boolean) => void;
  onResult: (result: KnownObjectsResult | undefined) => void;
}

/**
 * Ask JPL which catalogued asteroids and comets crossed the field during this pass. Their
 * predicted positions are drawn on the image; they are predictions, not detections.
 */
export function KnownObjectsPanel({ sequence, current, target, fov, source, enabled, show, onShow, onResult }: Props) {
  const [asked, setAsked] = useState(false);
  const keys = sequence.map((f) => f.key);
  const query = useQuery({
    ...knownObjectsQuery(target.ra, target.dec, fov, keys, source),
    enabled: asked && enabled && keys.length > 0,
  });
  const data = query.data;

  useEffect(() => {
    onResult(data);
  }, [data, onResult]);

  const inCurrent = (name: string) =>
    data?.objects.find((o) => o.name === name)?.positions.find((p) => p.key === current?.key)?.inField ?? false;

  return (
    <section aria-labelledby="known-title" className="space-y-3 border-t border-rule pt-6">
      <h2 id="known-title" className="panel-title">
        Known Solar System objects
      </h2>
      {!enabled ? (
        <p className="text-sm text-muted">
          Available for one survey pass: asteroids cross a field in hours to days, so a sequence spanning months cannot
          follow one.
        </p>
      ) : !asked ? (
        <>
          <p className="text-sm text-muted">
            Ask JPL which catalogued asteroids and comets were in this field during the pass, as seen from SPHEREx, and
            draw where each should be in every frame.
          </p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAsked(true)}>
            <Orbit size={15} aria-hidden /> Check JPL for known objects
          </button>
        </>
      ) : query.isPending ? (
        <p className="text-sm text-muted" role="status">
          Asking JPL… it integrates each orbit, so the first answer for a field takes 30 seconds to 2 minutes.
        </p>
      ) : query.error ? (
        <div className="space-y-2">
          <p className="text-sm text-danger" role="alert">
            {query.error instanceof ApiError ? query.error.message : "JPL could not be reached."}
          </p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => query.refetch()}>
            Try again
          </button>
        </div>
      ) : data && data.objects.length === 0 ? (
        <p className="text-sm text-muted">
          JPL knows no asteroid or comet brighter than V = {data.searched.vmagLimit} in this field during this pass.
          Anything that moves here is not in its catalogue, or is fainter, or is an artefact.
        </p>
      ) : data ? (
        <>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={show} onChange={(e) => onShow(e.target.checked)} className="accent-[var(--accent)]" />
            Show predicted positions on the image
          </label>
          <ul className="divide-y divide-rule border-y border-rule">
            {data.objects.map((o) => (
              <li key={o.name} className="py-2.5">
                <p className="flex items-baseline justify-between gap-3">
                  <span className="text-text">{o.name}</span>
                  {o.vmag != null && <span className="num text-xs text-faint">V {o.vmag.toFixed(1)}</span>}
                </p>
                <p className="text-xs text-muted">
                  {o.rateArcsecPerHour != null && `Moves ${o.rateArcsecPerHour.toFixed(0)}″ per hour · `}
                  in the field in {o.positions.filter((p) => p.inField).length} of {plural(o.positions.length, "frame")}
                  {current && (inCurrent(o.name) ? " · in this frame" : " · not in this frame")}
                </p>
              </li>
            ))}
          </ul>
          <details className="disclosure">
            <summary>
              <ChevronRight size={16} className="disclosure-chevron" aria-hidden />
              How these positions are predicted
            </summary>
            <p className="mt-2 text-sm text-muted">{data.method}</p>
            <p className="mt-2 text-xs text-faint">
              Source: {data.source}. {data.searched.candidates} catalogued bodies brighter than V {data.searched.vmagLimit}{" "}
              were within {data.searched.halfWidthDeg.toFixed(2)}° of the field at the middle frame’s time.
            </p>
          </details>
        </>
      ) : null}
    </section>
  );
}
