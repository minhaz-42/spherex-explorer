import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

import type { DataSource } from "../../lib/api";
import { magnitudesToSpectrum } from "../share/sonify";
import { SonifyButton } from "../share/SonifyButton";
import { ContextImages } from "./ContextImages";
import { formatDistance, formatMag, formatSize, frameFov, INFRARED_NOTE } from "./format";
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
  const v = formatMag(info.magnitudes.V);
  const k = formatMag(info.magnitudes.K);
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
      <Fact label="Type">{info.typeLabel}</Fact>
      <Fact label="Distance">
        {info.distance ? (
          <>
            {formatDistance(info.distance)}
            <span className="block text-xs text-faint">{info.distance.method}</span>
          </>
        ) : info.redshift !== null && info.redshift > 0.001 ? (
          <>Redshift z = {info.redshift.toFixed(4)}</>
        ) : (
          <span className="text-faint">Not measured in SIMBAD</span>
        )}
      </Fact>
      {info.size ? <Fact label="Size on the sky">{formatSize(info.size)}</Fact> : null}
      {v || k ? (
        <Fact label="Brightness">
          <span className="num">
            {v ? `V ${v}` : null}
            {v && k ? " · " : null}
            {k ? `K ${k}` : null}
          </span>
          <span className="block text-xs text-faint">magnitudes: lower is brighter; K is 2.2 µm</span>
        </Fact>
      ) : null}
      {info.spectralType ? <Fact label="Spectral type">{info.spectralType}</Fact> : null}
      {info.morphology ? <Fact label="Shape">{info.morphology}</Fact> : null}
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
  const object = useQuery(objectQuery(ra, dec, source));
  const info = object.data ?? null;
  const fov = frameFov(info);
  const title = info?.name ?? label;
  const nearPlane = sky && Math.abs(sky.galactic.b) < 10;

  return (
    <section aria-labelledby="object-profile-title" className="card overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.3fr)_minmax(0,0.95fr)]">
        <div className="flex flex-col gap-5 p-5 sm:p-6">
          <div>
            <p className="kicker">About this object</p>
            <h2 id="object-profile-title" className="mt-2 text-[2rem] leading-tight">
              {title}
            </h2>
            {info && info.name && info.id !== info.name ? (
              <p className="num mt-1 text-xs text-faint">{info.id.replace(/\s+/g, " ")}</p>
            ) : null}
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
                  <p className="text-xs font-semibold text-faint">Also known as</p>
                  <p className="mt-1 text-sm text-muted">{info.aliases.slice(0, 6).join(" · ")}</p>
                </div>
              ) : null}
              <p className="note">{INFRARED_NOTE[info.category]}</p>
              <div className="flex flex-wrap items-start gap-3">
                <Links info={info} label={label} />
                {magnitudesToSpectrum(info.magnitudes).length >= 3 ? (
                  <SonifyButton
                    label="Listen to its colours"
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
            <p className="text-sm text-muted">
              Catalogue details are not available right now{source === "snapshot" ? " in the demo snapshot" : ""}. The
              images and the map still describe this spot.
            </p>
          ) : (
            <p className="text-sm text-muted">
              No catalogued object sits exactly here. The images show the same field in other light, and the map shows
              where it is.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-4 border-t border-rule p-5 sm:p-6 lg:border-l lg:border-t-0">
          <div>
            <p className="kicker">The same patch in other light</p>
            <p className="mt-2 text-sm text-muted">
              SPHEREx records 0.75–5 µm, between the near- and mid-infrared views below.
            </p>
          </div>
          <ContextImages ra={info?.ra ?? ra} dec={info?.dec ?? dec} fov={fov} />
        </div>

        <div className="flex flex-col gap-4 border-t border-rule p-5 sm:p-6 lg:border-l lg:border-t-0">
          <p className="kicker">Where it is in the sky</p>
          <SkyLocator ra={ra} dec={dec} label={title} />
          {sky ? (
            <dl className="num grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div>
                <dt className="text-faint">Constellation</dt>
                <dd className="text-text">{sky.constellation}</dd>
              </div>
              <div>
                <dt className="text-faint">Galactic latitude</dt>
                <dd className="text-text">{sky.galactic.b.toFixed(1)}°</dd>
              </div>
              <div>
                <dt className="text-faint">Ecliptic latitude</dt>
                <dd className="text-text">{sky.ecliptic.lat.toFixed(1)}°</dd>
              </div>
              <div>
                <dt className="text-faint">Deep field</dt>
                <dd className="text-text">{sky.deepField ?? "No"}</dd>
              </div>
            </dl>
          ) : null}
          <p className="text-xs text-faint">
            {nearPlane
              ? "Close to the Milky Way's plane, so the field is crowded with stars and dust."
              : "Band: the Milky Way's plane. Dashed line: the ecliptic, where the planets travel. Circles: SPHEREx's deep fields."}
          </p>
        </div>
      </div>
      <p className="border-t border-rule px-5 py-2.5 text-xs text-faint sm:px-6">
        Catalogue: {info?.credit ?? "SIMBAD, CDS, Strasbourg"}. Images: {SURVEYS.map((s) => s.credit).join(", ")}, via
        CDS hips2fits.
      </p>
    </section>
  );
}
