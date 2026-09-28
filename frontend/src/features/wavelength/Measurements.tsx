import type { UseQueryResult } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import type { DataSource } from "../../lib/api";
import { formatDate, formatTime, formatWavelength, mjdToDate } from "../../lib/format";
import { type Lang, translate, useLang, useT } from "../../lib/i18n";
import { measureQuery } from "../../lib/queries";
import type { DecodedCutout, Frame, Measurement, Photometry } from "../../lib/types";
import { useQueued } from "../../lib/useQueued";
import { type PlotPoint, ScatterPlot } from "../plots/ScatterPlot";
import { frameCount } from "../viewer/messages";
import { WAVELENGTH } from "./messages";

interface Props {
  mode: "pass" | "wavelength";
  sequence: Frame[];
  results: UseQueryResult<DecodedCutout, Error>[];
  current: number;
  /** Every frame of the current pass, all detectors, for the full spectrum. */
  passFrames: Frame[];
  target: { ra: number; dec: number };
  source: DataSource;
  onSelectFrame: (frame: Frame) => void;
}

/** Pick µJy, mJy or Jy so axis numbers stay short. */
function fluxUnit(values: number[]): { unit: string; scale: number } {
  const max = Math.max(...values.map(Math.abs), 0);
  if (max >= 2e6) return { unit: "Jy", scale: 1e-6 };
  if (max >= 2e3) return { unit: "mJy", scale: 1e-3 };
  return { unit: "µJy", scale: 1 };
}

function caveats(p: Photometry, lang: Lang): string[] {
  const notes = [...p.reasons];
  if (p.snr != null && p.snr < 3) notes.push(translate(WAVELENGTH, lang, "lowSnr"));
  return notes;
}

function toPoint(
  frame: Frame,
  phot: Photometry,
  wavelengthUm: number | null,
  x: number,
  scale: number,
  current: boolean,
  lang: Lang,
): PlotPoint | null {
  if (phot.fluxMicroJy == null) return null;
  const notes = caveats(phot, lang);
  return {
    id: frame.id,
    x,
    y: phot.fluxMicroJy * scale,
    yErr: phot.errorMicroJy != null ? phot.errorMicroJy * scale : null,
    caveat: notes.length > 0,
    current,
    details: [
      `${formatDate(frame.isoMid)} ${formatTime(frame.isoMid, false)}`,
      `${formatWavelength(wavelengthUm)} · D${frame.detector}`,
      ...(phot.snr != null ? [translate(WAVELENGTH, lang, "snr", { snr: phot.snr.toFixed(1) })] : []),
      ...notes,
    ],
  };
}

/**
 * Brightness at the target across frames: against wavelength for one pass (the spectrum SPHEREx
 * builds up as its filter steps across the sky), or against time for one matched wavelength.
 */
export function Measurements({ mode, sequence, results, current, passFrames, target, source, onSelectFrame }: Props) {
  const t = useT(WAVELENGTH);
  const lang = useLang();
  const [fullSpectrum, setFullSpectrum] = useState(false);
  const measureOptions = useMemo(
    () => passFrames.map((f) => measureQuery(f.key, target.ra, target.dec, source)),
    [passFrames, target.ra, target.dec, source],
  );
  const order = useMemo(() => passFrames.map((_, i) => i), [passFrames]);
  const measured = useQueued(measureOptions, order, 4, fullSpectrum && mode === "pass");

  const byId = useMemo(() => new Map([...sequence, ...passFrames].map((f) => [f.id, f])), [sequence, passFrames]);

  const sequencePoints = useMemo(() => {
    const rows = sequence
      .map((f, i) => ({ f, i, p: results[i]?.data?.payload }))
      .filter((r): r is { f: Frame; i: number; p: NonNullable<typeof r.p> } => !!r.p && r.p.photometry.fluxMicroJy != null);
    const { unit, scale } = fluxUnit(rows.map((r) => r.p.photometry.fluxMicroJy!));
    const points = rows
      .map(({ f, i, p }) => {
        const wl = p.wavelength.atTargetUm ?? f.wavelengthUm;
        const x = mode === "pass" ? wl ?? 0 : f.mjdMid;
        return toPoint(f, p.photometry, wl, x, scale, i === current, lang);
      })
      .filter((p): p is PlotPoint => p !== null);
    return { points, unit };
  }, [sequence, results, current, mode, lang]);

  const spectrumPoints = useMemo(() => {
    if (!fullSpectrum) return null;
    const rows = passFrames
      .map((f, i) => ({ f, m: measured[i]?.data as Measurement | undefined }))
      .filter((r): r is { f: Frame; m: Measurement } => !!r.m && r.m.photometry.fluxMicroJy != null);
    const { unit, scale } = fluxUnit(rows.map((r) => r.m.photometry.fluxMicroJy!));
    const currentId = sequence[current]?.id;
    const points = rows
      .map(({ f, m }) => toPoint(f, m.photometry, m.wavelength.atTargetUm, m.wavelength.atTargetUm ?? f.wavelengthUm ?? 0, scale, f.id === currentId, lang))
      .filter((p): p is PlotPoint => p !== null);
    return { points, unit };
  }, [fullSpectrum, passFrames, measured, sequence, current, lang]);

  const done = measured.filter((m) => m.status === "success" || m.status === "error").length;
  const select = (id: string) => {
    const f = byId.get(id);
    if (f) onSelectFrame(f);
  };

  return (
    <section aria-labelledby="measure-title" className="space-y-4 border-t border-rule pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="measure-title" className="panel-title">
          {t("title")}
        </h2>
        <p className="text-xs text-faint">{t("aperture")}</p>
      </div>

      {mode === "pass" ? (
        <p className="text-sm text-muted">
          {t("passBefore")}
          <strong className="font-medium text-text">{t("passStrong")}</strong>
          {t("passAfter")}
        </p>
      ) : (
        <p className="text-sm text-muted">
          {t("timeBefore")}
          <strong className="font-medium text-text">{t("timeStrong")}</strong>
          {t("timeAfter")}
        </p>
      )}

      {mode === "wavelength" && new Set(sequence.map((f) => f.release)).size > 1 && (
        <p className="note note-warn">
          {t("releases", { releases: [...new Set(sequence.map((f) => f.release.toUpperCase()))].join(t("and")) })}
        </p>
      )}

      {sequencePoints.points.length === 0 ? (
        <p className="text-sm text-faint">{t("pointsAppear")}</p>
      ) : (
        <ScatterPlot
          points={sequencePoints.points}
          xLabel={mode === "pass" ? t("xWavelength") : t("xDate")}
          yLabel={t("y", { unit: sequencePoints.unit })}
          xHeading={mode === "pass" ? t("wavelength") : t("date")}
          yHeading={t("y", { unit: sequencePoints.unit })}
          formatX={mode === "pass" ? (v) => v.toFixed(2) : (v) => formatDate(mjdToDate(v))}
          formatY={(v) => Number(v.toPrecision(3)).toLocaleString("en-US")}
          onSelect={select}
          caption={t("caption", { frames: frameCount(lang, sequencePoints.points.length) })}
        />
      )}

      {mode === "pass" && (
        <div className="space-y-3">
          {!fullSpectrum ? (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFullSpectrum(true)} disabled={passFrames.length === 0}>
                {t("measureAll")}
              </button>
              <span className="text-xs text-faint">
                {t("measureNote", { frames: frameCount(lang, passFrames.length) })}
              </span>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted" aria-live="polite">
                {t("progress", { done, total: passFrames.length })}
              </p>
              {spectrumPoints && spectrumPoints.points.length > 0 && (
                <ScatterPlot
                  points={spectrumPoints.points}
                  xLabel={t("xWavelength")}
                  yLabel={t("y", { unit: spectrumPoints.unit })}
                  xHeading={t("wavelength")}
                  yHeading={t("y", { unit: spectrumPoints.unit })}
                  formatX={(v) => v.toFixed(2)}
                  formatY={(v) => Number(v.toPrecision(3)).toLocaleString("en-US")}
                  xDomain={[0.7, 5.05]}
                  onSelect={select}
                  caption={t("spectrumCaption")}
                />
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
