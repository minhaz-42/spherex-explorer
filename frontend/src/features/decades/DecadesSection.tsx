import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { useState } from "react";

import type { DataSource } from "../../lib/api";
import { objectQuery } from "../objects/queries";
import { DecadesBlink } from "./DecadesBlink";

// Fast-moving stars open the comparison straight away; for everything else it waits to be asked.
const OPEN_FROM_MAS_PER_YR = 1000;

/** "Across the decades": a collapsible home for the five-survey blink on the Explore page. */
export function DecadesSection({
  ra,
  dec,
  label,
  source,
}: {
  ra: number;
  dec: number;
  label: string;
  source: DataSource;
}) {
  const object = useQuery(objectQuery(ra, dec, source));
  const pm = object.data?.properMotion ?? null;
  const fast = pm ? Math.hypot(pm.raMasYr, pm.decMasYr) >= OPEN_FROM_MAS_PER_YR : false;
  const [asked, setAsked] = useState(false);
  const open = asked || fast;
  const name = object.data?.name ?? label;
  return (
    <details
      className="card group p-5 sm:p-6"
      open={open}
      onToggle={(e) => setAsked((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="kicker block">Across the decades</span>
          <span className="mt-1 block font-display text-[1.6rem] leading-tight text-text">
            {name} from the 1950s to SPHEREx
          </span>
          <span className="mt-1 block text-sm text-muted">
            Five surveys, 75 years: Palomar plates, 2MASS, AllWISE and SPHEREx on one grid
            {fast ? ". This star moves fast enough to see." : "."}
          </span>
        </span>
        <ChevronRight size={20} className="shrink-0 text-faint transition-transform group-open:rotate-90" aria-hidden />
      </summary>
      {open ? (
        <div className="mt-6">
          <DecadesBlink
            ra={object.data?.ra ?? ra}
            dec={object.data?.dec ?? dec}
            name={name}
            source={source}
            properMotion={pm}
          />
        </div>
      ) : null}
    </details>
  );
}
