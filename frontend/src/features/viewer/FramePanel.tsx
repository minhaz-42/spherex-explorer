import { ChevronRight, ExternalLink } from "lucide-react";

import { band, describeWavelength } from "../../lib/bands";
import { formatDate, formatFlux, formatNumber, formatTime, formatWavelength } from "../../lib/format";
import { defineMessages, useT } from "../../lib/i18n";
import type { DecodedCutout, Frame } from "../../lib/types";
import { whereFrom } from "../spacecraft/where";
import { WhereDisclosure } from "../spacecraft/WhereWasSpherex";

const M = defineMessages({
  en: { where: "Where was SPHEREx for this frame?" },
  bn: { where: "এই ফ্রেমের সময় SPHEREx কোথায় ছিল?" },
});

interface Props {
  frame: Frame;
  cutout: DecodedCutout | undefined;
  index: number;
  count: number;
}

/** What the visitor is looking at: when, at what wavelength, and how bright the target was. */
export function FramePanel({ frame, cutout, index, count }: Props) {
  const t = useT(M);
  const p = cutout?.payload;
  const wavelength = p?.wavelength.atTargetUm ?? frame.wavelengthUm;
  const bandwidth = p?.wavelength.bandwidthUm ?? frame.bandwidthUm;
  const exact = p?.wavelength.atTargetUm != null;
  const phot = p?.photometry;
  const b = band(frame.detector);
  const flaggedHere = p ? p.target.flags.filter((f) => p.mask.maskedFlags.includes(f)) : [];

  return (
    <section aria-labelledby="frame-title" className="space-y-5">
      <div>
        <h2 id="frame-title" className="panel-title">
          This observation <span className="font-normal normal-case tracking-normal text-faint">· {index + 1} of {count}</span>
        </h2>
        <p className="mt-2 font-display text-[1.625rem] leading-tight">{formatDate(frame.isoMid)}</p>
        <p className="num text-muted">{formatTime(frame.isoMid)}</p>
      </div>

      <div>
        <p className="panel-title">Wavelength at the target</p>
        <p className="mt-2 flex items-center gap-2.5">
          <span className="num text-xl text-text">{formatWavelength(wavelength)}</span>
          {bandwidth != null && <span className="num text-sm text-faint">± {(bandwidth / 2).toFixed(3)}</span>}
        </p>
        <p className="mt-1 text-sm text-muted">
          {wavelength != null ? `${describeWavelength(wavelength)[0]!.toUpperCase()}${describeWavelength(wavelength).slice(1)}.` : ""}{" "}
          Detector {frame.detector} covers {b.minUm.toFixed(2)}–{b.maxUm.toFixed(2)} µm.
          {!exact && " Estimated from the image footprint until the pixels load."}
        </p>
      </div>

      {flaggedHere.length > 0 && (
        <p className="note note-warn">
          The pixels at the target are flagged {flaggedHere.join(", ")} in this frame. The image there is filled in from
          its surroundings for display and is not a measurement; do not read a change into it.
        </p>
      )}

      <div>
        <p className="panel-title">Brightness at the target</p>
        {!phot ? (
          <p className="mt-2 text-sm text-faint">Measured when the pixels load.</p>
        ) : phot.fluxMicroJy == null ? (
          <p className="mt-2 text-sm text-muted">{phot.reasons[0] ?? "Not measurable in this frame."}</p>
        ) : (
          <>
            <p className="mt-2">
              <span className="num text-xl text-text">{formatFlux(phot.fluxMicroJy)}</span>
              {phot.errorMicroJy != null && <span className="num ml-2 text-sm text-faint">± {formatFlux(phot.errorMicroJy)}</span>}
            </p>
            <p className="mt-1 text-sm text-muted">
              {phot.snr != null && phot.snr < 3
                ? "Nothing clearly detected at the target (signal-to-noise below 3)."
                : `Signal-to-noise ${formatNumber(phot.snr, 3)}${phot.abMag != null ? `, AB magnitude ${phot.abMag.toFixed(2)}` : ""}.`}
            </p>
            {phot.reasons.length > 0 && (
              <ul className="note note-warn mt-2 space-y-1">
                {phot.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {/* Stays open while stepping through frames, so the spacecraft can be followed along its orbit. */}
      <WhereDisclosure where={p ? whereFrom(p, { ra: p.grid.ra, dec: p.grid.dec }) : null} label={t("where")} />

      <details className="disclosure">
        <summary>
          <ChevronRight size={16} className="disclosure-chevron" aria-hidden />
          Technical details
        </summary>
        <dl className="meta-list mt-3">
          <dt>Observation</dt>
          <dd>{frame.obsId}</dd>
          <dt>Detector</dt>
          <dd>
            D{frame.detector} (step {frame.step} of the pointing)
          </dd>
          <dt>Collection</dt>
          <dd>{frame.collection}</dd>
          <dt>Mid-exposure</dt>
          <dd>
            {frame.isoMid} UTC (MJD {frame.mjdMid.toFixed(5)})
          </dd>
          <dt>Exposure</dt>
          <dd>{frame.exposureS != null ? `${frame.exposureS.toFixed(1)} s` : "—"}</dd>
          <dt>Target pixel</dt>
          <dd>{p ? `${p.target.pixel[0].toFixed(1)}, ${p.target.pixel[1].toFixed(1)}` : frame.targetPixel?.join(", ") ?? "—"}</dd>
          {p && (
            <>
              <dt>Background</dt>
              <dd>
                {formatNumber(p.background.levelMJySr, 4)} MJy/sr (rms {formatNumber(p.background.rmsMJySr, 3)})
              </dd>
              <dt>Zodiacal model</dt>
              <dd>{formatNumber(p.background.zodiModelMJySr, 4)} MJy/sr</dd>
              <dt>Flags at target</dt>
              <dd>{p.target.flags.length ? p.target.flags.join(", ") : "none"}</dd>
              <dt>PSF FWHM</dt>
              <dd>{p.quality.psfFwhmArcsec != null ? `${p.quality.psfFwhmArcsec.toFixed(2)}″` : "—"}</dd>
              <dt>Pipeline</dt>
              <dd>{p.quality.pipeline ?? "—"}</dd>
              <dt>Read via</dt>
              <dd>{p.access.via === "s3" ? `S3 byte ranges (${p.access.requests} requests)` : "IRSA cutout service"}</dd>
            </>
          )}
        </dl>
        <p className="mt-3 text-sm">
          <a className="link inline-flex items-center gap-1" href={frame.irsaUrl} rel="noreferrer" target="_blank">
            Original file at IRSA (about 70 MB) <ExternalLink size={13} aria-hidden />
          </a>
        </p>
        {phot && <p className="mt-2 text-xs text-faint">{phot.method}</p>}
      </details>
    </section>
  );
}
