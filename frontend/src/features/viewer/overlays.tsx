/** Overlays on the sky image. Colours come from the design tokens. */

import { useT } from "../../lib/i18n";
import { OVERLAYS } from "./messages";

/** A ring with four ticks around the target, sized in screen pixels. */
export function TargetMarker({ x, y, scale, label }: { x: number; y: number; scale: number; label?: string }) {
  const t = useT(OVERLAYS);
  const r = 11 / scale;
  const gap = 5 / scale;
  const tick = 6 / scale;
  return (
    <g stroke="var(--accent-on-image)" strokeWidth={1.5} fill="none" vectorEffect="non-scaling-stroke">
      <title>{label ?? t("target")}</title>
      <circle cx={x} cy={y} r={r} vectorEffect="non-scaling-stroke" opacity={0.9} />
      <line x1={x} y1={y - r - gap} x2={x} y2={y - r - gap - tick} vectorEffect="non-scaling-stroke" />
      <line x1={x} y1={y + r + gap} x2={x} y2={y + r + gap + tick} vectorEffect="non-scaling-stroke" />
      <line x1={x - r - gap} y1={y} x2={x - r - gap - tick} y2={y} vectorEffect="non-scaling-stroke" />
      <line x1={x + r + gap} y1={y} x2={x + r + gap + tick} y2={y} vectorEffect="non-scaling-stroke" />
    </g>
  );
}

const NICE_ARCSEC = [15, 30, 60, 120, 300, 600, 900, 1800];

function niceLength(scale: number, arcsecPerPixel: number): { arcsec: number; px: number } {
  // Aim for a bar 60–140 screen pixels long.
  for (const arcsec of NICE_ARCSEC) {
    const px = (arcsec / arcsecPerPixel) * scale;
    if (px >= 60) return { arcsec, px };
  }
  const arcsec = NICE_ARCSEC[NICE_ARCSEC.length - 1]!;
  return { arcsec, px: (arcsec / arcsecPerPixel) * scale };
}

function arcsecLabel(arcsec: number): string {
  return arcsec >= 60 ? `${arcsec / 60}′` : `${arcsec}″`;
}

/** Angular scale bar and the north/east directions, in the image's bottom-left corner. */
export function ScaleAndCompass({ scale, arcsecPerPixel }: { scale: number; arcsecPerPixel: number }) {
  const { arcsec, px } = niceLength(scale, arcsecPerPixel);
  return (
    <div className="pointer-events-none absolute bottom-2 left-2 flex items-end gap-4 text-[0.6875rem] text-on-image">
      <svg width={34} height={34} viewBox="0 0 34 34" aria-hidden="true">
        <g stroke="currentColor" strokeWidth={1.25} fill="none">
          <path d="M28 28 V8" />
          <path d="M28 28 H8" />
          <path d="M25 11 L28 7 L31 11" />
          <path d="M11 25 L7 28 L11 31" />
        </g>
        <text x="24" y="6" fill="currentColor" fontSize="8.5" fontWeight="600" fontFamily="var(--font-sans)">N</text>
        <text x="0" y="24" fill="currentColor" fontSize="8.5" fontWeight="600" fontFamily="var(--font-sans)">E</text>
      </svg>
      <div className="flex flex-col items-start gap-1">
        <span className="num leading-none">{arcsecLabel(arcsec)}</span>
        <span className="block h-[3px] bg-on-image" style={{ width: `${px}px` }} />
      </div>
    </div>
  );
}

export interface TrackPoint {
  x: number;
  y: number;
  current: boolean;
}

/** A known body's predicted positions: a faint track through the sequence, a ring now. */
export function PredictedTrack({ name, points, scale }: { name: string; points: TrackPoint[]; scale: number }) {
  const t = useT(OVERLAYS);
  if (points.length === 0) return null;
  const now = points.find((p) => p.current);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
  const r = 8 / scale;
  return (
    <g>
      <title>{t("predicted", { name })}</title>
      <path d={path} fill="none" stroke="var(--track-on-image)" strokeOpacity={0.55} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      {points.map((p) => (
        <circle key={`${p.x},${p.y}`} cx={p.x} cy={p.y} r={1.6 / scale} fill="var(--track-on-image)" fillOpacity={0.7} />
      ))}
      {now && (
        <>
          <circle cx={now.x} cy={now.y} r={r} fill="none" stroke="var(--track-on-image)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          <text
            x={now.x + r * 1.3}
            y={now.y - r * 1.1}
            fontSize={11 / scale}
            fill="var(--track-on-image)"
            stroke="rgb(0 0 0 / 0.6)"
            strokeWidth={3 / scale}
            paintOrder="stroke"
            fontFamily="var(--font-sans)"
          >
            {name.replace(/\s*\(.*\)$/, "")}
          </text>
        </>
      )}
    </g>
  );
}

export interface CandidatePoint {
  x: number;
  y: number;
  current: boolean;
}

/** One of our moving-source candidates: squares at its sightings, joined by its fitted track. */
export function CandidateTrack({ id, points, scale, weak }: { id: string; points: CandidatePoint[]; scale: number; weak: boolean }) {
  const t = useT(OVERLAYS);
  if (points.length === 0) return null;
  const s = 6 / scale;
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
  const label = points[points.length - 1]!;
  return (
    <g opacity={weak ? 0.6 : 1}>
      <title>{`${t("candidate", { id })}${weak ? t("weak") : ""}`}</title>
      <path d={path} fill="none" stroke="var(--candidate-on-image)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      {points.map((p) => (
        <rect
          key={`${p.x},${p.y}`}
          x={p.x - (p.current ? s * 1.4 : s)}
          y={p.y - (p.current ? s * 1.4 : s)}
          width={(p.current ? s * 1.4 : s) * 2}
          height={(p.current ? s * 1.4 : s) * 2}
          fill="none"
          stroke="var(--candidate-on-image)"
          strokeWidth={p.current ? 1.75 : 1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <text
        x={label.x + s * 1.6}
        y={label.y + s * 2.6}
        fontSize={11 / scale}
        fill="var(--candidate-on-image)"
        stroke="rgb(0 0 0 / 0.6)"
        strokeWidth={3 / scale}
        paintOrder="stroke"
        fontFamily="var(--font-sans)"
      >
        {id}
      </text>
    </g>
  );
}
