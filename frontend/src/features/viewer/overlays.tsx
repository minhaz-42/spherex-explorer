/** Overlays on the sky image. Colours come from the design tokens. */

/** A ring with four ticks around the target, sized in screen pixels. */
export function TargetMarker({ x, y, scale, label = "Target" }: { x: number; y: number; scale: number; label?: string }) {
  const r = 11 / scale;
  const gap = 5 / scale;
  const tick = 6 / scale;
  return (
    <g stroke="var(--accent)" strokeWidth={1.5} fill="none" vectorEffect="non-scaling-stroke">
      <title>{label}</title>
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
    <div className="pointer-events-none absolute bottom-2 left-2 flex items-end gap-4 text-[0.6875rem] text-white/85">
      <svg width={34} height={34} viewBox="0 0 34 34" aria-hidden="true">
        <g stroke="currentColor" strokeWidth={1.25} fill="none">
          <path d="M28 28 V8" />
          <path d="M28 28 H8" />
          <path d="M25 11 L28 7 L31 11" />
          <path d="M11 25 L7 28 L11 31" />
        </g>
        <text x="24" y="6" fill="currentColor" fontSize="8" fontFamily="var(--font-mono)">N</text>
        <text x="0" y="24" fill="currentColor" fontSize="8" fontFamily="var(--font-mono)">E</text>
      </svg>
      <div className="flex flex-col items-start gap-1">
        <span className="font-mono leading-none">{arcsecLabel(arcsec)}</span>
        <span className="block h-[3px] bg-white/85" style={{ width: `${px}px` }} />
      </div>
    </div>
  );
}
