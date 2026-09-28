import { ArrowRight, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { useLang, useT } from "../../lib/i18n";
import { ATLAS, type AtlasCategory, type AtlasObject, atlasText } from "./atlas";
import { ATLAS_CATEGORIES, ATLAS_UI } from "./messages";
import { imageUrl } from "./queries";

// The filter chips, in this order.
const CATEGORIES: AtlasCategory[] = ["galaxy", "star-forming", "nebula", "cluster", "solar-system", "deep-field"];

function href(o: AtlasObject): string {
  return o.to ?? `/explore?q=${encodeURIComponent(o.query ?? o.name)}`;
}

function Card({ o }: { o: AtlasObject }) {
  const t = useT(ATLAS_UI);
  const lang = useLang();
  const text = atlasText(o, lang);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <li>
      <Link
        to={href(o)}
        className="card group flex h-full flex-col overflow-hidden no-underline transition-[translate,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lg)]"
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-image">
          {failed ? (
            <div className="flex h-full items-center justify-center p-4 text-center text-2xl font-semibold text-on-image/80">
              {text.name}
            </div>
          ) : (
            <img
              src={imageUrl(o.ra, o.dec, o.fovDeg, "dss", 384)}
              alt={t("alt", { name: text.name })}
              loading="lazy"
              decoding="async"
              onLoad={() => setLoaded(true)}
              onError={() => setFailed(true)}
              className={`h-full w-full object-cover transition-[opacity,scale] duration-700 group-hover:scale-105 ${loaded ? "opacity-100" : "opacity-0"}`}
            />
          )}
          <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-on-image backdrop-blur-sm">
            {text.kind}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-2 p-5">
          <h3 className="text-[1.6rem] leading-tight text-text">{text.name}</h3>
          <p className="num text-xs text-faint">
            {text.catalogue} · {text.constellation}
          </p>
          <p className="text-sm text-muted">{text.blurb}</p>
          <p className="flex gap-2 text-xs text-faint">
            <Sparkles size={13} className="mt-0.5 shrink-0 text-accent" aria-hidden />
            <span>{text.infrared}</span>
          </p>
          <p className="mt-auto flex items-center justify-between gap-3 pt-3 text-sm">
            <span className="text-muted">{text.distance}</span>
            <ArrowRight
              size={16}
              className="shrink-0 text-faint transition-transform group-hover:translate-x-1 group-hover:text-accent"
              aria-hidden
            />
          </p>
        </div>
      </Link>
    </li>
  );
}

/** A curated gallery of objects worth exploring, grouped by kind. */
export function ObjectAtlas() {
  const t = useT(ATLAS_UI);
  const category = useT(ATLAS_CATEGORIES);
  const [filter, setFilter] = useState<AtlasCategory | "all">("all");
  const categories = CATEGORIES.filter((c) => ATLAS.some((o) => o.category === c));
  const items = filter === "all" ? ATLAS : ATLAS.filter((o) => o.category === filter);

  return (
    <section aria-labelledby="atlas-title">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="kicker">{t("kicker")}</p>
          <h2 id="atlas-title" className="section-title mt-3">
            {t("titleBefore")}
            <span className="shine">{t("titleShine")}</span>
            {t("titleAfter")}
          </h2>
          <p className="prose-body mt-3">{t("intro")}</p>
        </div>
        <div role="group" aria-label={t("filter")} className="flex flex-wrap gap-2">
          <button type="button" className="chip" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
            {t("all", { n: ATLAS.length })}
          </button>
          {categories.map((c) => (
            <button key={c} type="button" className="chip" aria-pressed={filter === c} onClick={() => setFilter(c)}>
              {category(c)}
            </button>
          ))}
        </div>
      </div>
      <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((o) => (
          <Card key={o.id} o={o} />
        ))}
      </ul>
    </section>
  );
}
