import { ImageOff } from "lucide-react";
import { useState } from "react";

import { useLang, useT } from "../../lib/i18n";
import { IMAGES } from "./messages";
import { imageUrl, SURVEYS } from "./queries";
import type { Survey } from "./types";

function Tile({
  ra,
  dec,
  fov,
  survey,
  label,
  alt,
  band,
}: {
  ra: number;
  dec: number;
  fov: number;
  survey: Survey;
  label: string;
  alt: string;
  band: string;
}) {
  const t = useT(IMAGES);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <figure className="min-w-0">
      <div className="relative aspect-square overflow-hidden rounded-[12px] bg-image shadow-[var(--shadow-sm)]">
        {failed ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-on-image/70">
            <ImageOff size={18} aria-hidden />
            <span className="text-xs">{t("notAvailable")}</span>
          </div>
        ) : (
          <img
            src={imageUrl(ra, dec, fov, survey, 256)}
            alt={alt}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={`h-full w-full object-cover transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
          />
        )}
        {/* The target sits at the centre of every tile. */}
        <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          <path
            d="M50 38v6M50 56v6M38 50h6M56 50h6"
            stroke="var(--accent-on-image)"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/55 px-1.5 py-0.5 text-xs text-on-image">
          {t("across", { size: fov >= 1 ? `${fov.toFixed(1)}°` : `${Math.round(fov * 60)}′` })}
        </span>
      </div>
      <figcaption className="mt-2 leading-tight">
        <span className="block text-sm font-medium text-text">{label}</span>
        <span className="num block text-xs text-faint">{band}</span>
      </figcaption>
    </figure>
  );
}

/** The same patch of sky in visible, near-infrared and mid-infrared light from other surveys. */
export function ContextImages({ ra, dec, fov }: { ra: number; dec: number; fov: number }) {
  const t = useT(IMAGES);
  const lang = useLang();
  return (
    <div className="grid grid-cols-3 gap-3">
      {SURVEYS.map((s) => {
        const label = lang === "bn" ? s.bn.label : s.label;
        return (
          <Tile
            key={s.id}
            ra={ra}
            dec={dec}
            fov={fov}
            survey={s.id}
            label={label}
            alt={t("alt", { label, seen: s.bn.seen, band: s.band })}
            band={s.band}
          />
        );
      })}
    </div>
  );
}
