import { useQuery } from "@tanstack/react-query";
import { Pause, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { DataSource } from "../../lib/api";
import { formatDate, formatTime, formatWavelength } from "../../lib/format";
import { autoStretch, renderGray } from "../../lib/pixels";
import { cutoutQuery } from "../../lib/queries";
import { tokenRgb } from "../../lib/theme";
import type { CasePreviewFrame, DecodedCutout } from "../../lib/types";

interface Props {
  ra: number;
  dec: number;
  fov: number;
  a: CasePreviewFrame;
  b: CasePreviewFrame;
  source?: DataSource;
  label: string;
  /** Milliseconds each frame stays on screen. */
  interval?: number;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

function Thumb({ image, alt }: { image: { rgba: Uint8ClampedArray; width: number; height: number } | null; alt: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !image) return;
    el.width = image.width;
    el.height = image.height;
    el.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(image.rgba), image.width, image.height), 0, 0);
  }, [image]);
  return <canvas ref={ref} role="img" aria-label={alt} className="h-full w-full [image-rendering:pixelated]" />;
}

/**
 * Two real SPHEREx frames of one place, flipping between them with one shared stretch, so what
 * changes on screen changed in the sky. Pauses on hover and focus, and does not animate when the
 * visitor prefers reduced motion (a button flips instead).
 */
export function BlinkPreview({ ra, dec, fov, a, b, source = "live", label, interval = 900 }: Props) {
  // A case file from an older build may lack keys: then there is nothing to load.
  const hasKeys = typeof a?.key === "string" && typeof b?.key === "string";
  const qa = useQuery({ ...cutoutQuery(a?.key ?? "", ra, dec, fov, source), enabled: hasKeys });
  const qb = useQuery({ ...cutoutQuery(b?.key ?? "", ra, dec, fov, source), enabled: hasKeys });
  const reduced = usePrefersReducedMotion();
  const [showB, setShowB] = useState(false);
  const [paused, setPaused] = useState(false);

  const A = qa.data;
  const B = qb.data;
  const ready = !!A && !!B;
  const images = useMemo(() => {
    if (!A || !B) return null;
    const stretch = autoStretch(A);
    const noData = tokenRgb("--bg-image", [27, 29, 51]);
    const draw = (img: DecodedCutout) => ({ rgba: renderGray(img, stretch, { noData, flagged: null }), width: img.width, height: img.height });
    return { a: draw(A), b: draw(B) };
  }, [A, B]);

  useEffect(() => {
    if (!ready || reduced || paused) return;
    const t = window.setInterval(() => setShowB((v) => !v), interval);
    return () => window.clearInterval(t);
  }, [ready, reduced, paused, interval]);

  const shown = showB ? b : a;
  const failed = !hasKeys || qa.isError || qb.isError;
  return (
    <figure
      className="relative aspect-square w-full overflow-hidden rounded-sm bg-image"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {images ? (
        <Thumb image={showB ? images.b : images.a} alt={`${label}: frame ${showB ? "B" : "A"}, ${formatDate(shown.isoMid)} ${formatTime(shown.isoMid)}`} />
      ) : (
        <div className="flex h-full items-center justify-center p-4 text-center text-sm text-on-image/80" role="status">
          {failed ? "These frames could not be loaded right now." : "Loading two SPHEREx frames…"}
        </div>
      )}
      {images && (
        <figcaption className="pointer-events-none absolute inset-x-2 top-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-sm bg-black/60 px-2 py-1 text-[0.75rem] text-on-image">
          <span className="font-mono font-medium text-accent-on-image">{showB ? "B" : "A"}</span>
          <span className="num">
            {formatDate(shown.isoMid)} {formatTime(shown.isoMid, false)}
          </span>
          <span className="num">{formatWavelength(shown.wavelengthUm)}</span>
        </figcaption>
      )}
      {images && (
        <button
          type="button"
          className="absolute bottom-2 right-2 inline-flex h-9 items-center gap-1.5 rounded-sm bg-black/60 px-2.5 text-xs text-on-image hover:bg-black/75"
          onClick={() => (reduced ? setShowB((v) => !v) : setPaused((p) => !p))}
          aria-label={reduced ? "Show the other frame" : paused ? "Resume blinking" : "Pause blinking"}
        >
          {reduced ? (
            `Show ${showB ? "A" : "B"}`
          ) : paused ? (
            <>
              <Play size={13} aria-hidden /> Blink
            </>
          ) : (
            <>
              <Pause size={13} aria-hidden /> Pause
            </>
          )}
        </button>
      )}
    </figure>
  );
}
