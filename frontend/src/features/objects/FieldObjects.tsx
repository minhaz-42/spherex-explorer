import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";

import type { DataSource } from "../../lib/api";
import { formatMag } from "./format";
import { fieldObjectsQuery } from "./queries";
import type { FieldObject, ObjectCategory } from "./types";

const DOT: Record<ObjectCategory, string> = {
  galaxy: "var(--violet)",
  star: "var(--gold)",
  nebula: "var(--accent)",
  cluster: "var(--band-3)",
  "solar-system": "var(--live)",
  other: "var(--text-faint)",
};

function exploreLink(o: FieldObject, source: DataSource): string {
  const p = new URLSearchParams({
    ra: o.ra.toFixed(6),
    dec: o.dec.toFixed(6),
    name: o.name ?? o.id.replace(/\s+/g, " "),
  });
  if (source === "snapshot") p.set("source", "snapshot");
  return `/explore?${p.toString()}`;
}

/** The most-studied catalogued objects around the target, each a way to explore that object next. */
export function FieldObjects({
  ra,
  dec,
  radiusDeg = 0.15,
  source,
}: {
  ra: number;
  dec: number;
  radiusDeg?: number;
  source: DataSource;
}) {
  const field = useQuery(fieldObjectsQuery(ra, dec, radiusDeg, source));
  const [all, setAll] = useState(false);
  const objects = field.data?.objects ?? [];
  const shown = all ? objects : objects.slice(0, 10);
  const radiusArcmin = Math.round(radiusDeg * 60);

  return (
    <section aria-labelledby="field-objects-title" className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="kicker">In this field</p>
          <h2 id="field-objects-title" className="mt-2 text-[1.75rem] leading-tight">
            Catalogued objects in view
          </h2>
          <p className="mt-1 text-sm text-muted">
            The most-studied objects SIMBAD lists within {radiusArcmin}′ of the target. Pick one to explore it.
          </p>
        </div>
        {field.data ? <p className="num text-xs text-faint">{field.data.credit}</p> : null}
      </div>

      {field.isPending ? (
        <div className="mt-5 space-y-2" aria-busy="true">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="skeleton h-9 w-full rounded-[10px]" />
          ))}
        </div>
      ) : field.error ? (
        <p className="mt-5 text-sm text-muted">
          The catalogue could not be searched right now{source === "snapshot" ? " in the demo snapshot" : ""}.
        </p>
      ) : objects.length === 0 ? (
        <p className="mt-5 text-sm text-muted">SIMBAD lists no objects within {radiusArcmin}′ of this position.</p>
      ) : (
        <>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead>
                <tr className="border-b border-rule text-xs text-faint">
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Object
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Type
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">
                    V
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">
                    K
                  </th>
                  <th scope="col" className="py-2 text-right font-semibold">
                    From target
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((o) => (
                  <tr key={o.id} className="border-b border-rule/70 last:border-0">
                    <td className="py-2 pr-3">
                      <Link to={exploreLink(o, source)} className="link inline-flex items-center gap-2">
                        <span aria-hidden="true" className="swatch" style={{ background: DOT[o.category] }} />
                        {o.name ?? o.id.replace(/\s+/g, " ")}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 text-muted">{o.typeLabel}</td>
                    <td className="num py-2 pr-3 text-right text-muted">{formatMag(o.magnitudes.V) ?? "–"}</td>
                    <td className="num py-2 pr-3 text-right text-muted">{formatMag(o.magnitudes.K) ?? "–"}</td>
                    <td className="num py-2 text-right text-muted">{o.separationArcmin.toFixed(1)}′</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {objects.length > 10 ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm mt-3"
              onClick={() => setAll((v) => !v)}
              aria-expanded={all}
            >
              {all ? "Show fewer" : `Show all ${objects.length}`}
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}
