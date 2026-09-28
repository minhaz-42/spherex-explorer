import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Orbit } from "lucide-react";
import { useEffect, useState } from "react";

import { ApiError, type DataSource } from "../../lib/api";
import { useLang, useT } from "../../lib/i18n";
import { knownObjectsQuery } from "../../lib/queries";
import type { Frame, KnownObjects as KnownObjectsResult } from "../../lib/types";
import { frameCount } from "../viewer/messages";
import { KNOWN } from "./messages";

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
  const t = useT(KNOWN);
  const lang = useLang();
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
        {t("knownTitle")}
      </h2>
      {!enabled ? (
        <p className="text-sm text-muted">
          {t("knownDisabled")}
        </p>
      ) : !asked ? (
        <>
          <p className="text-sm text-muted">
            {t("knownIntro")}
          </p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAsked(true)}>
            <Orbit size={15} aria-hidden /> {t("knownButton")}
          </button>
        </>
      ) : query.isPending ? (
        <p className="text-sm text-muted" role="status">
          {t("knownPending")}
        </p>
      ) : query.error ? (
        <div className="space-y-2">
          <p className="text-sm text-danger" role="alert">
            {query.error instanceof ApiError ? query.error.message : t("knownFailed")}
          </p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => query.refetch()}>
            {t("tryAgain")}
          </button>
        </div>
      ) : data && data.objects.length === 0 ? (
        <p className="text-sm text-muted">
          {t("knownNone", { vmag: data.searched.vmagLimit })}
        </p>
      ) : data ? (
        <>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={show} onChange={(e) => onShow(e.target.checked)} className="accent-[var(--accent)]" />
            {t("showPredicted")}
          </label>
          <ul className="divide-y divide-rule border-y border-rule">
            {data.objects.map((o) => (
              <li key={o.name} className="py-2.5">
                <p className="flex items-baseline justify-between gap-3">
                  <span className="text-text">{o.name}</span>
                  {o.vmag != null && <span className="num text-xs text-faint">V {o.vmag.toFixed(1)}</span>}
                </p>
                <p className="text-xs text-muted">
                  {o.rateArcsecPerHour != null && t("moves", { rate: o.rateArcsecPerHour.toFixed(0) })}
                  {t("inField", {
                    k: o.positions.filter((p) => p.inField).length,
                    frames: frameCount(lang, o.positions.length),
                    total: o.positions.length.toLocaleString("en-US"),
                  })}
                  {current && (inCurrent(o.name) ? t("inThisFrame") : t("notInThisFrame"))}
                </p>
              </li>
            ))}
          </ul>
          <details className="disclosure">
            <summary>
              <ChevronRight size={16} className="disclosure-chevron" aria-hidden />
              {t("howPredicted")}
            </summary>
            <p className="mt-2 text-sm text-muted">{data.method}</p>
            <p className="mt-2 text-xs text-faint">
              {t("source", {
                source: data.source,
                n: data.searched.candidates,
                vmag: data.searched.vmagLimit,
                deg: data.searched.halfWidthDeg.toFixed(2),
              })}
            </p>
          </details>
        </>
      ) : null}
    </section>
  );
}
