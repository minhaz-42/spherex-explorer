import { useId } from "react";

import { useLang, useT } from "../../lib/i18n";
import { mapLabel } from "./format";
import { LOCATOR } from "./messages";
import { eclipticToEquatorial, galacticToEquatorial, hammer } from "./sky";

const W = 320;
const H = 170;
const PAD = 6;
const SX = (W / 2 - PAD) / (2 * Math.SQRT2);
const SY = (H / 2 - PAD) / Math.SQRT2;

// SPHEREx's deep fields: the north ecliptic pole, and ecliptic (+44.8°, −82°) in the south, where
// IRSA holds the deep-survey images (22,542 QR2 and 1,590 QR3 frames cover that point).
const DEEP_FIELDS = [
  { name: "North deep field", ra: 270, dec: 66.56 },
  { name: "South deep field", ra: 78.4651, dec: -60.4058 },
];

function toXY(ra: number, dec: number) {
  const { x, y } = hammer(ra, dec);
  return { x: W / 2 + x * SX, y: H / 2 - y * SY };
}

/** A path through sky positions, broken wherever it wraps round the edge of the map. */
function curve(points: Array<[number, number]>): string {
  let d = "";
  let prevX: number | null = null;
  for (const [ra, dec] of points) {
    const p = toXY(ra, dec);
    const jump = prevX !== null && Math.abs(p.x - prevX) > W / 3;
    d += `${d === "" || jump ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    prevX = p.x;
  }
  return d;
}

const steps = (n: number) => Array.from({ length: n + 1 }, (_, k) => k / n);

const GRATICULE = [
  ...[-60, -30, 0, 30, 60].map((dec) => curve(steps(120).map((t) => [t * 360, dec] as [number, number]))),
  ...[0, 60, 120, 180, 240, 300].map((ra) => curve(steps(90).map((t) => [ra, -90 + t * 180] as [number, number]))),
];
const GALACTIC = curve(steps(240).map((t) => galacticToEquatorial(t * 360, 0)));
const ECLIPTIC = curve(steps(240).map((t) => eclipticToEquatorial(t * 360, 0)));
const GAL_CENTRE = galacticToEquatorial(0, 0);

/**
 * The whole sky on one equal-area map (Hammer projection, right ascension increasing to the left
 * as seen from Earth), with the Milky Way's plane, the ecliptic, SPHEREx's deep fields and the target.
 */
export function SkyLocator({ ra, dec, label }: { ra: number; dec: number; label: string }) {
  const id = useId().replace(/:/g, "");
  const say = useT(LOCATOR);
  const lang = useLang();
  const t = toXY(ra, dec);
  const gc = toXY(GAL_CENTRE[0], GAL_CENTRE[1]);
  const labelLeft = t.x > W * 0.62;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full"
      role="img"
      aria-label={say("label", { label, ra: ra.toFixed(1), dec: dec.toFixed(1) })}
    >
      <defs>
        <clipPath id={`${id}-sky`}>
          <ellipse cx={W / 2} cy={H / 2} rx={2 * Math.SQRT2 * SX} ry={Math.SQRT2 * SY} />
        </clipPath>
        <radialGradient id={`${id}-bg`} cx="0.5" cy="0.5" r="0.7">
          <stop offset="0" stopColor="var(--bg-raised)" />
          <stop offset="1" stopColor="var(--bg-sunk)" />
        </radialGradient>
      </defs>
      <ellipse cx={W / 2} cy={H / 2} rx={2 * Math.SQRT2 * SX} ry={Math.SQRT2 * SY} fill={`url(#${id}-bg)`} />
      <g clipPath={`url(#${id}-sky)`} fill="none">
        {/* The Milky Way: a soft band along the galactic plane. */}
        <path d={GALACTIC} stroke="var(--violet)" strokeOpacity="0.14" strokeWidth="18" strokeLinecap="round" />
        <path d={GALACTIC} stroke="var(--violet)" strokeOpacity="0.35" strokeWidth="1" />
        {GRATICULE.map((d, i) => (
          <path key={i} d={d} stroke="var(--text)" strokeOpacity="0.1" strokeWidth="0.6" />
        ))}
        <path d={ECLIPTIC} stroke="var(--gold)" strokeOpacity="0.8" strokeWidth="0.9" strokeDasharray="3 3" />
      </g>
      <ellipse
        cx={W / 2}
        cy={H / 2}
        rx={2 * Math.SQRT2 * SX}
        ry={Math.SQRT2 * SY}
        fill="none"
        stroke="var(--text)"
        strokeOpacity="0.35"
        strokeWidth="0.8"
      />
      <circle cx={gc.x} cy={gc.y} r="2" fill="var(--violet)" />
      {DEEP_FIELDS.map((f) => {
        const p = toXY(f.ra, f.dec);
        return <circle key={f.name} cx={p.x} cy={p.y} r="3" fill="none" stroke="var(--text-faint)" strokeWidth="0.8" />;
      })}
      <circle cx={t.x} cy={t.y} r="9" fill="var(--accent)" opacity="0.18" />
      <circle cx={t.x} cy={t.y} r="3.4" fill="var(--accent)" stroke="var(--bg-raised)" strokeWidth="1.2" />
      <text
        x={t.x + (labelLeft ? -9 : 9)}
        y={t.y - 7}
        textAnchor={labelLeft ? "end" : "start"}
        className="fill-text text-[12px] font-semibold"
        paintOrder="stroke"
        stroke="var(--bg-raised)"
        strokeWidth="3"
        strokeLinejoin="round"
      >
        {mapLabel(label, lang)}
      </text>
    </svg>
  );
}
