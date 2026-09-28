import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { useLang, useT } from "../../lib/i18n";
import { ATLAS, type AtlasCategory, type AtlasObject, atlasText } from "./atlas";
import { ATLAS_UI } from "./messages";
import { imageUrl } from "./queries";

// One of each kind, so the row shows the range of the atlas.
const FEATURED: AtlasCategory[] = ["galaxy", "star-forming", "nebula", "cluster"];

function pick(): AtlasObject[] {
  return FEATURED.map((c) => ATLAS.find((o) => o.category === c)).filter((o): o is AtlasObject => !!o);
}

function Thumb({ o }: { o: AtlasObject }) {
  const t = useT(ATLAS_UI);
  const lang = useLang();
  const text = atlasText(o, lang);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <li>
      <Link
        to={o.to ?? `/explore?q=${encodeURIComponent(o.query ?? o.name)}`}
        className="group relative block aspect-[4/5] overflow-hidden rounded-[18px] bg-image no-underline shadow-[var(--shadow)]"
      >
        {!failed ? (
          <img
            src={imageUrl(o.ra, o.dec, o.fovDeg, "dss", 384)}
            alt=""
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-[opacity,scale] duration-700 group-hover:scale-105 ${loaded ? "opacity-100" : "opacity-0"}`}
          />
        ) : null}
        <span
          className="absolute inset-0 bg-gradient-to-t from-[#0f1530] via-[#0f1530]/30 to-transparent"
          aria-hidden="true"
        />
        <span className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-4 text-on-image">
          <span className="text-xs font-medium opacity-90">{text.kind}</span>
          <span className="font-display text-2xl leading-tight">{text.name}</span>
          <span className="flex items-center gap-1.5 text-xs opacity-80">
            {t("explore")} <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" aria-hidden />
          </span>
        </span>
      </Link>
    </li>
  );
}

/** A row of featured atlas objects for the landing page. */
export function AtlasTeaser() {
  const items = pick();
  if (items.length === 0) return null;
  return (
    <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {items.map((o) => (
        <Thumb key={o.id} o={o} />
      ))}
    </ul>
  );
}
