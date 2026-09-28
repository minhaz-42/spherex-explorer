import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { useState } from "react";

import type { DataSource } from "../../lib/api";
import { useLang, useT } from "../../lib/i18n";
import { localName } from "../objects/atlas";
import { objectQuery } from "../objects/queries";
import { DecadesBlink } from "./DecadesBlink";
import { DECADES } from "./messages";

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
  const t = useT(DECADES);
  const lang = useLang();
  const object = useQuery(objectQuery(ra, dec, source));
  const pm = object.data?.properMotion ?? null;
  const fast = pm ? Math.hypot(pm.raMasYr, pm.decMasYr) >= OPEN_FROM_MAS_PER_YR : false;
  const [asked, setAsked] = useState(false);
  const open = asked || fast;
  // In Bangla a famous object takes the atlas's name, as its profile above does; SIMBAD's are English.
  const name = (object.data ? localName(object.data, lang) : null) ?? object.data?.name ?? label;
  return (
    <details
      className="card group p-5 sm:p-6"
      open={open}
      onToggle={(e) => setAsked((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="kicker block">{t("kicker")}</span>
          <span className="mt-1 block font-display text-[1.6rem] leading-tight text-text">
            {t("heading", { name })}
          </span>
          <span className="mt-1 block text-sm text-muted">{fast ? t("summaryFast") : t("summary")}</span>
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
