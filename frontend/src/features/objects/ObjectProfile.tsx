import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

import type { DataSource } from "../../lib/api";
import { useLang, useT } from "../../lib/i18n";
import { magnitudesToSpectrum } from "../share/sonify";
import { SonifyButton } from "../share/SonifyButton";
import { deepFieldName, localName } from "./atlas";
import { constellationName } from "./constellations";
import { ContextImages } from "./ContextImages";
import {
  displayId,
  distanceMethod,
  formatDistance,
  formatMag,
  formatSize,
  frameFov,
  infraredNote,
  morphologyWords,
} from "./format";
import { PROFILE } from "./messages";
import { objectQuery, SURVEYS } from "./queries";
import { SkyLocator } from "./SkyLocator";
import type { ObjectInfo } from "./types";

export interface SkyContext {
  constellation: string;
  galactic: { l: number; b: number };
  ecliptic: { lon: number; lat: number };
  deepField?: string | null;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-faint">{label}</dt>
      <dd className="mt-0.5 text-sm text-text">{children}</dd>
    </div>
  );
}

function Facts({ info }: { info: ObjectInfo }) {
  const t = useT(PROFILE);
  const lang = useLang();
  const v = formatMag(info.magnitudes.V);
  const k = formatMag(info.magnitudes.K);
  // SIMBAD classes many famous galaxies by their nuclei ("Active Galaxy Nucleus" for Andromeda), so
  // a galaxy is named by its shape, with SIMBAD's class kept underneath, in SIMBAD's English.
  const galaxy = info.category === "galaxy";
  const shape = galaxy ? morphologyWords(info.morphology) : null;
  const englishType = galaxy ? (shape ?? PROFILE.en.galaxy) : info.typeLabel;
  const type = galaxy ? (morphologyWords(info.morphology, lang) ?? t("galaxy")) : info.typeLabel;
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
      <Fact label={t("type")}>
        {type}
        {englishType !== info.typeLabel ? (
          <span className="block text-xs text-faint">{t("simbadClass", { label: info.typeLabel })}</span>
        ) : null}
      </Fact>
      <Fact label={t("distance")}>
        {info.distance ? (
          <>
            {formatDistance(info.distance, lang)}
            <span className="block text-xs text-faint">{distanceMethod(info.distance.method, lang)}</span>
          </>
        ) : info.redshift !== null && info.redshift > 0.001 ? (
          <>{t("redshift", { z: info.redshift.toFixed(4) })}</>
        ) : (
          <span className="text-faint">{t("notMeasured")}</span>
        )}
      </Fact>
      {info.size ? <Fact label={t("size")}>{formatSize(info.size)}</Fact> : null}
      {v || k ? (
        <Fact label={t("brightness")}>
          <span className="num">
            {v ? `V ${v}` : null}
            {v && k ? " · " : null}
            {k ? `K ${k}` : null}
          </span>
          <span className="block text-xs text-faint">{t("magnitudes")}</span>
        </Fact>
      ) : null}
      {info.spectralType ? <Fact label={t("spectralType")}>{info.spectralType}</Fact> : null}
      {shape ? <Fact label={t("hubbleType")}>{info.morphology}</Fact> : null}
    </dl>
  );
}

function Links({ info, label }: { info: ObjectInfo; label: string }) {
  const wiki = `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(info.name ?? label)}`;
  const items = [
    info.links.simbad ? { href: info.links.simbad, text: "SIMBAD" } : null,
    info.links.ned && info.category === "galaxy" ? { href: info.links.ned, text: "NED" } : null,
    { href: wiki, text: "Wikipedia" },
  ].filter((x): x is { href: string; text: string } => x !== null);
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((l) => (
        <li key={l.text}>
          <a className="chip" href={l.href} target="_blank" rel="noreferrer">
            {l.text} <ExternalLink size={12} aria-hidden />
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * The line under the heading: the catalogue id when the heading is a common name, and SIMBAD's English
 * name as well when the heading is the atlas's Bangla one ("Andromeda Galaxy · M 31").
 */
function subtitle(info: ObjectInfo | null, local: string | null): string | null {
  if (!info) return null;
  const id = displayId(info.id);
  if (local) return [...new Set([info.name ?? id, id])].join(" · ");
  return info.name && id !== info.name ? id : null;
}

/**
 * "About this object": what SIMBAD knows about the target, how the same patch of sky looks to
 * other surveys, and where it sits on the whole sky.
 */
export function ObjectProfile({
  ra,
  dec,
  label,
  source,
  sky,
}: {
  ra: number;
  dec: number;
  label: string;
  source: DataSource;
  sky?: SkyContext;
}) {
  const t = useT(PROFILE);
  const lang = useLang();
  const object = useQuery(objectQuery(ra, dec, source));
  const info = object.data ?? null;
  const fov = frameFov(info);
  // A famous object takes the atlas's name in Bangla; SIMBAD's names are English.
  const local = info ? localName(info, lang) : null;
  const title = local ?? info?.name ?? label;
  const sub = subtitle(info, local);
  const nearPlane = sky && Math.abs(sky.galactic.b) < 10;

  return (
    <section aria-labelledby="object-profile-title" className="card overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.3fr)_minmax(0,0.95fr)]">
        <div className="flex flex-col gap-5 p-5 sm:p-6">
          <div>
            <p className="kicker">{t("kicker")}</p>
            <h2 id="object-profile-title" className="mt-2 text-[2rem] leading-tight">
              {title}
            </h2>
            {sub ? <p className="num mt-1 text-xs text-faint">{sub}</p> : null}
          </div>

          {object.isPending ? (
            <div className="space-y-3" aria-busy="true">
              <div className="skeleton h-4 w-3/4 rounded-full" />
              <div className="skeleton h-4 w-1/2 rounded-full" />
              <div className="skeleton h-4 w-2/3 rounded-full" />
            </div>
          ) : info ? (
            <>
              <Facts info={info} />
              {info.aliases.length ? (
                <div>
                  <p className="text-xs font-semibold text-faint">{t("aliases")}</p>
                  <p className="mt-1 text-sm text-muted">{info.aliases.slice(0, 6).map(displayId).join(" · ")}</p>
                </div>
              ) : null}
              <p className="note">{infraredNote(info.category, lang)}</p>
              <div className="flex flex-wrap items-start gap-3">
                <Links info={info} label={label} />
                {magnitudesToSpectrum(info.magnitudes).length >= 3 ? (
                  <SonifyButton
                    label={t("listen")}
                    spec={{
                      mode: "spectrum",
                      points: magnitudesToSpectrum(info.magnitudes),
                      units: { x: "µm", y: "Jy" },
                      xName: "wavelength",
                    }}
                  />
                ) : null}
              </div>
            </>
          ) : object.error ? (
            <p className="text-sm text-muted">{t(source === "snapshot" ? "unavailableSnapshot" : "unavailable")}</p>
          ) : (
            <p className="text-sm text-muted">{t("nothingHere")}</p>
          )}
        </div>

        <div className="flex flex-col gap-4 border-t border-rule p-5 sm:p-6 lg:border-l lg:border-t-0">
          <div>
            <p className="kicker">{t("otherLight")}</p>
            <p className="mt-2 text-sm text-muted">{t("spherexRange")}</p>
          </div>
          <ContextImages ra={info?.ra ?? ra} dec={info?.dec ?? dec} fov={fov} />
        </div>

        <div className="flex flex-col gap-4 border-t border-rule p-5 sm:p-6 lg:border-l lg:border-t-0">
          <p className="kicker">{t("where")}</p>
          <SkyLocator ra={ra} dec={dec} label={title} />
          {sky ? (
            <dl className="num grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div>
                <dt className="text-faint">{t("constellation")}</dt>
                <dd className="text-text">{constellationName(sky.constellation, lang)}</dd>
              </div>
              <div>
                <dt className="text-faint">{t("galacticLatitude")}</dt>
                <dd className="text-text">{sky.galactic.b.toFixed(1)}°</dd>
              </div>
              <div>
                <dt className="text-faint">{t("eclipticLatitude")}</dt>
                <dd className="text-text">{sky.ecliptic.lat.toFixed(1)}°</dd>
              </div>
              <div>
                <dt className="text-faint">{t("deepField")}</dt>
                <dd className="text-text">
                  {typeof sky.deepField === "string" ? deepFieldName(sky.deepField, lang) : t("no")}
                </dd>
              </div>
            </dl>
          ) : null}
          <p className="text-xs text-faint">{nearPlane ? t("nearPlane") : t("mapKey")}</p>
        </div>
      </div>
      <p className="border-t border-rule px-5 py-2.5 text-xs text-faint sm:px-6">
        {t("credits", {
          catalogue: info?.credit ?? "SIMBAD, CDS, Strasbourg",
          images: SURVEYS.map((s) => s.credit).join(", "),
        })}
      </p>
    </section>
  );
}
