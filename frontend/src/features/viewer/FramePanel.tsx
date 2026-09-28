import { ChevronRight, ExternalLink } from "lucide-react";

import { band, describeWavelength } from "../../lib/bands";
import { formatDate, formatFlux, formatNumber, formatTime, formatWavelength } from "../../lib/format";
import { defineMessages, useLang, useT } from "../../lib/i18n";
import type { DecodedCutout, Frame } from "../../lib/types";
import { whereFrom } from "../spacecraft/where";
import { WhereDisclosure } from "../spacecraft/WhereWasSpherex";

// The flagged-pixel and signal-to-noise notes are validity caveats: the Bangla says exactly what the
// English says ("not a measurement", "nothing clearly detected"). Photometry reasons and method notes
// come from the API and stay in English.
const M = defineMessages({
  en: {
    where: "Where was SPHEREx for this frame?",
    title: "This observation",
    position: "· {n} of {count}",
    wavelength: "Wavelength at the target",
    stop: ".",
    covers: "Detector {detector} covers {min}–{max} µm.",
    estimated: " Estimated from the image footprint until the pixels load.",
    flagged:
      "The pixels at the target are flagged {flags} in this frame. The image there is filled in from its surroundings for display and is not a measurement; do not read a change into it.",
    brightness: "Brightness at the target",
    measuredOnLoad: "Measured when the pixels load.",
    notMeasurable: "Not measurable in this frame.",
    nothing: "Nothing clearly detected at the target (signal-to-noise below 3).",
    snr: "Signal-to-noise {snr}",
    ab: ", AB magnitude {ab}",
    technical: "Technical details",
    observation: "Observation",
    detector: "Detector",
    step: "D{detector} (step {step} of the pointing)",
    collection: "Collection",
    mid: "Mid-exposure",
    exposure: "Exposure",
    targetPixel: "Target pixel",
    background: "Background",
    zodi: "Zodiacal model",
    flags: "Flags at target",
    none: "none",
    pipeline: "Pipeline",
    readVia: "Read via",
    s3: "S3 byte ranges ({n} requests)",
    ibe: "IRSA cutout service",
    original: "Original file at IRSA (about 70 MB)",
  },
  bn: {
    where: "এই ফ্রেমের সময় SPHEREx কোথায় ছিল?",
    title: "এই পর্যবেক্ষণ",
    position: "· {count}টির মধ্যে {n} নম্বর",
    wavelength: "লক্ষ্যে তরঙ্গদৈর্ঘ্য",
    stop: "।",
    covers: "ডিটেক্টর {detector}-এর পরিসর {min}–{max} µm।",
    estimated: " পিক্সেল লোড না হওয়া পর্যন্ত এটি আকাশে ছবিটির সীমানা থেকে অনুমান করা।",
    flagged:
      "এই ফ্রেমে লক্ষ্যের পিক্সেলগুলো {flags} হিসেবে চিহ্নিত। সেখানকার ছবি কেবল দেখানোর জন্য চারপাশ থেকে পূরণ করা, এটি কোনো পরিমাপ নয়; এতে কোনো পরিবর্তন আছে বলে ধরে নেবেন না।",
    brightness: "লক্ষ্যে উজ্জ্বলতা",
    measuredOnLoad: "পিক্সেল লোড হলে মাপা হবে।",
    notMeasurable: "এই ফ্রেমে মাপা যায় না।",
    nothing: "লক্ষ্যে স্পষ্টভাবে কিছু শনাক্ত হয়নি (সংকেত-শব্দ অনুপাত 3-এর কম)।",
    snr: "সংকেত-শব্দ অনুপাত {snr}",
    ab: ", AB ঔজ্জ্বল্য-মান {ab}",
    technical: "প্রযুক্তিগত বিবরণ",
    observation: "পর্যবেক্ষণ",
    detector: "ডিটেক্টর",
    step: "D{detector} (পয়েন্টিংয়ের {step} নম্বর ধাপ)",
    collection: "সংগ্রহ",
    mid: "এক্সপোজারের মাঝামাঝি সময়",
    exposure: "এক্সপোজার",
    targetPixel: "লক্ষ্যের পিক্সেল",
    background: "পটভূমি",
    zodi: "রাশিচক্রীয় আলোর মডেল",
    flags: "লক্ষ্যের পিক্সেলে চিহ্ন",
    none: "নেই",
    pipeline: "পাইপলাইন",
    readVia: "যেভাবে পড়া হয়েছে",
    s3: "S3 বাইট-রেঞ্জ ({n}টি অনুরোধ)",
    ibe: "IRSA কাটআউট সেবা",
    original: "IRSA-তে মূল ফাইল (প্রায় 70 MB)",
  },
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
  const lang = useLang();
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
          {t("title")} <span className="font-normal normal-case tracking-normal text-faint">{t("position", { n: index + 1, count })}</span>
        </h2>
        <p className="mt-2 font-display text-[1.625rem] leading-tight">{formatDate(frame.isoMid)}</p>
        <p className="num text-muted">{formatTime(frame.isoMid)}</p>
      </div>

      <div>
        <p className="panel-title">{t("wavelength")}</p>
        <p className="mt-2 flex items-center gap-2.5">
          <span className="num text-xl text-text">{formatWavelength(wavelength)}</span>
          {bandwidth != null && <span className="num text-sm text-faint">± {(bandwidth / 2).toFixed(3)}</span>}
        </p>
        <p className="mt-1 text-sm text-muted">
          {wavelength != null
            ? `${describeWavelength(wavelength, lang)[0]!.toUpperCase()}${describeWavelength(wavelength, lang).slice(1)}${t("stop")}`
            : ""}{" "}
          {t("covers", { detector: frame.detector, min: b.minUm.toFixed(2), max: b.maxUm.toFixed(2) })}
          {!exact && t("estimated")}
        </p>
      </div>

      {flaggedHere.length > 0 && (
        <p className="note note-warn">
          {t("flagged", { flags: flaggedHere.join(", ") })}
        </p>
      )}

      <div>
        <p className="panel-title">{t("brightness")}</p>
        {!phot ? (
          <p className="mt-2 text-sm text-faint">{t("measuredOnLoad")}</p>
        ) : phot.fluxMicroJy == null ? (
          <p className="mt-2 text-sm text-muted">{phot.reasons[0] ?? t("notMeasurable")}</p>
        ) : (
          <>
            <p className="mt-2">
              <span className="num text-xl text-text">{formatFlux(phot.fluxMicroJy)}</span>
              {phot.errorMicroJy != null && <span className="num ml-2 text-sm text-faint">± {formatFlux(phot.errorMicroJy)}</span>}
            </p>
            <p className="mt-1 text-sm text-muted">
              {phot.snr != null && phot.snr < 3
                ? t("nothing")
                : `${t("snr", { snr: formatNumber(phot.snr, 3) })}${phot.abMag != null ? t("ab", { ab: phot.abMag.toFixed(2) }) : ""}${t("stop")}`}
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
          {t("technical")}
        </summary>
        <dl className="meta-list mt-3">
          <dt>{t("observation")}</dt>
          <dd>{frame.obsId}</dd>
          <dt>{t("detector")}</dt>
          <dd>
            {t("step", { detector: frame.detector, step: frame.step })}
          </dd>
          <dt>{t("collection")}</dt>
          <dd>{frame.collection}</dd>
          <dt>{t("mid")}</dt>
          <dd>
            {frame.isoMid} UTC (MJD {frame.mjdMid.toFixed(5)})
          </dd>
          <dt>{t("exposure")}</dt>
          <dd>{frame.exposureS != null ? `${frame.exposureS.toFixed(1)} s` : "—"}</dd>
          <dt>{t("targetPixel")}</dt>
          <dd>{p ? `${p.target.pixel[0].toFixed(1)}, ${p.target.pixel[1].toFixed(1)}` : frame.targetPixel?.join(", ") ?? "—"}</dd>
          {p && (
            <>
              <dt>{t("background")}</dt>
              <dd>
                {formatNumber(p.background.levelMJySr, 4)} MJy/sr (rms {formatNumber(p.background.rmsMJySr, 3)})
              </dd>
              <dt>{t("zodi")}</dt>
              <dd>{formatNumber(p.background.zodiModelMJySr, 4)} MJy/sr</dd>
              <dt>{t("flags")}</dt>
              <dd>{p.target.flags.length ? p.target.flags.join(", ") : t("none")}</dd>
              <dt>PSF FWHM</dt>
              <dd>{p.quality.psfFwhmArcsec != null ? `${p.quality.psfFwhmArcsec.toFixed(2)}″` : "—"}</dd>
              <dt>{t("pipeline")}</dt>
              <dd>{p.quality.pipeline ?? "—"}</dd>
              <dt>{t("readVia")}</dt>
              <dd>{p.access.via === "s3" ? t("s3", { n: p.access.requests }) : t("ibe")}</dd>
            </>
          )}
        </dl>
        <p className="mt-3 text-sm">
          <a className="link inline-flex items-center gap-1" href={frame.irsaUrl} rel="noreferrer" target="_blank">
            {t("original")} <ExternalLink size={13} aria-hidden />
          </a>
        </p>
        {phot && <p className="mt-2 text-xs text-faint">{phot.method}</p>}
      </details>
    </section>
  );
}
