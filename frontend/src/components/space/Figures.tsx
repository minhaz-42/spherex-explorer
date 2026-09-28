import { type CSSProperties, type ReactNode, useId, useRef } from "react";

import { useInView } from "./motion";
import { seeded } from "./noise";

/** Stagger for lines that draw themselves in. */
const order = (i: number) => ({ "--i": i }) as CSSProperties;

/** An SVG whose hairlines (marked pathLength="1") draw themselves the first time it scrolls into view. */
function Figure({ label, className = "", children }: { label?: string; className?: string; children: ReactNode }) {
  const ref = useRef<SVGSVGElement>(null);
  const drawn = useInView(ref, { once: true, margin: "-40px" });
  return (
    <svg
      ref={ref}
      viewBox="0 0 240 170"
      className={`draw-on block h-auto w-full overflow-visible ${drawn ? "is-drawn" : ""} ${className}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

// A fixed scatter of faint stars for the figures, generated once.
const STARS = (() => {
  const rand = seeded(2025);
  return Array.from({ length: 40 }, () => ({ x: rand(), y: rand(), r: 0.5 + Math.pow(rand(), 2) * 1.5 }));
})();

function Stars({
  x,
  y,
  w,
  h,
  from = 0,
  count = 18,
  opacity = 0.55,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  from?: number;
  count?: number;
  opacity?: number;
}) {
  return (
    <g fill="var(--text)" opacity={opacity}>
      {STARS.slice(from, from + count).map((s, i) => (
        <circle key={i} cx={x + s.x * w} cy={y + s.y * h} r={s.r} />
      ))}
    </g>
  );
}

const INK = "var(--text)";
const EMBER = "var(--accent)";

/** "Where?": the sky as a sphere, with one point picked out by its coordinates. */
export function WhereFigure() {
  const id = useId().replace(/:/g, "");
  return (
    <Figure>
      <defs>
        <radialGradient id={`${id}-sphere`} cx="0.36" cy="0.3" r="0.85">
          <stop offset="0" stopColor="var(--fig-sphere-hi)" />
          <stop offset="0.55" stopColor="var(--fig-sphere-mid)" />
          <stop offset="1" stopColor="var(--fig-sphere-lo)" />
        </radialGradient>
        <radialGradient id={`${id}-target`}>
          <stop offset="0" stopColor="#ff9a6b" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ff9a6b" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="104" cy="92" r="62" fill={`url(#${id}-sphere)`} />
      <g stroke={INK} strokeWidth="0.8">
        <circle cx="104" cy="92" r="62" pathLength={1} strokeOpacity="0.55" style={order(0)} />
        <ellipse cx="104" cy="92" rx="62" ry="16" pathLength={1} strokeOpacity="0.3" style={order(1)} />
        <ellipse cx="104" cy="70" rx="55" ry="12" pathLength={1} strokeOpacity="0.18" style={order(2)} />
        <ellipse cx="104" cy="114" rx="55" ry="12" pathLength={1} strokeOpacity="0.18" style={order(2)} />
        <ellipse cx="104" cy="92" rx="24" ry="62" pathLength={1} strokeOpacity="0.22" style={order(3)} />
        <ellipse cx="104" cy="92" rx="47" ry="62" pathLength={1} strokeOpacity="0.16" style={order(4)} />
      </g>
      <Stars x={56} y={42} w={96} h={100} count={16} opacity={0.45} />
      <circle cx="136" cy="64" r="16" fill={`url(#${id}-target)`} />
      <g className="origin-[136px_64px] motion-safe:animate-[pulse-ring_2.6s_ease-in-out_infinite]">
        <circle cx="136" cy="64" r="8" stroke={EMBER} strokeWidth="1.3" />
      </g>
      <circle cx="136" cy="64" r="2.6" fill={EMBER} />
      <path d="M136 50v6M136 72v6M122 64h6M144 64h6" stroke={EMBER} strokeWidth="1.1" />
      <path d="M146 55l24-24h46" stroke={INK} strokeOpacity="0.55" strokeWidth="0.8" pathLength={1} style={order(5)} />
      <text x="172" y="27" className="fill-text text-[13.5px] font-semibold">
        Andromeda
      </text>
      <text x="172" y="43" className="num fill-muted text-[7.5px]">
        RA 00h 42m 44s
      </text>
      <text x="172" y="53" className="num fill-muted text-[7.5px]">
        Dec +41° 16′ 08″
      </text>
    </Figure>
  );
}

/** "When?": every image of the point on one timeline, bunched into survey passes. */
export function WhenFigure() {
  const passes = [52, 120, 188];
  const bands = [1, 2, 3, 4, 5, 6];
  const heights = [26, 38, 22, 44, 30, 36, 20, 40, 28, 34, 46, 24, 32, 42, 26, 38, 22, 30];
  return (
    <Figure>
      <path d="M14 116H226" stroke={INK} strokeOpacity="0.5" strokeWidth="0.9" pathLength={1} style={order(0)} />
      {Array.from({ length: 13 }, (_, k) => (
        <line
          key={k}
          x1={20 + k * 16.6}
          x2={20 + k * 16.6}
          y1={116}
          y2={120}
          stroke={INK}
          strokeOpacity="0.3"
          strokeWidth="0.7"
        />
      ))}
      {passes.map((px, p) => (
        <g key={px}>
          {bands.map((b, k) => (
            <rect
              key={b}
              x={px - 15 + k * 5.2}
              y={116 - (heights[p * 6 + k] ?? 30)}
              width="3.2"
              height={heights[p * 6 + k] ?? 30}
              rx="1.2"
              fill={`var(--band-${b})`}
            />
          ))}
          <text x={px} y="135" textAnchor="middle" className="num fill-muted text-[7.5px] font-medium">
            Pass {p + 1}
          </text>
        </g>
      ))}
      <path
        d="M52 62v-6h68v6M120 56v-6"
        stroke={INK}
        strokeOpacity="0.45"
        strokeWidth="0.8"
        pathLength={1}
        style={order(2)}
      />
      <text x="86" y="46" textAnchor="middle" className="fill-text text-[13.5px] font-semibold">
        about six months
      </text>
      <g className="motion-safe:animate-[playhead_8s_ease-in-out_infinite]">
        <line x1="32" x2="32" y1="70" y2="124" stroke={EMBER} strokeWidth="1.2" />
        <circle cx="32" cy="70" r="3" fill={EMBER} />
      </g>
      <text x="226" y="152" textAnchor="end" className="num fill-faint text-[7px] font-medium">
        Time →
      </text>
    </Figure>
  );
}

/** "What changed?": the same field on two visits, and a point of light that moved. */
export function ChangeFigure() {
  const id = useId().replace(/:/g, "");
  return (
    <Figure>
      <defs>
        <linearGradient id={`${id}-plate`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--fig-plate-a)" />
          <stop offset="1" stopColor="var(--fig-plate-b)" />
        </linearGradient>
      </defs>
      <g transform="rotate(-5 120 88)">
        <rect
          x="58"
          y="26"
          width="124"
          height="118"
          rx="6"
          fill="var(--fig-plate-a)"
          stroke={INK}
          strokeOpacity="0.14"
        />
      </g>
      <rect
        x="62"
        y="30"
        width="124"
        height="118"
        rx="6"
        fill={`url(#${id}-plate)`}
        stroke={INK}
        strokeOpacity="0.3"
        strokeWidth="0.9"
      />
      <Stars x={70} y={38} w={108} h={102} from={12} count={22} opacity={0.6} />
      <path d="M98 118L150 72" stroke={EMBER} strokeOpacity="0.55" strokeWidth="0.9" strokeDasharray="2 3" />
      <path d="M150 72l-7 1.6M150 72l-2.2 6.8" stroke={EMBER} strokeWidth="0.9" />
      <g className="motion-safe:animate-[blink-a_1.8s_steps(1)_infinite]">
        <circle cx="98" cy="118" r="4" fill={EMBER} />
        <text x="70" y="161" className="num fill-muted text-[7.5px] font-medium">
          Visit 1
        </text>
      </g>
      <g className="opacity-0 motion-safe:animate-[blink-b_1.8s_steps(1)_infinite]">
        <circle cx="150" cy="72" r="4" fill={EMBER} />
        <text x="70" y="161" className="num fill-muted text-[7.5px] font-medium">
          Visit 2
        </text>
      </g>
      <text x="196" y="52" className="fill-accent text-[14.5px] font-semibold">
        moved
      </text>
      <path d="M194 55c-10 4-20 9-30 14" stroke={EMBER} strokeWidth="0.8" pathLength={1} style={order(3)} />
    </Figure>
  );
}

/**
 * The (7) Iris case as an illustration, used until the real frames load: one field near
 * 36 Sextantis on two visits 9 h 42 min apart.
 */
export function IrisPlate() {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 240 240"
      className="block h-auto w-full"
      role="img"
      aria-label="Illustration: the asteroid (7) Iris in two positions against fixed stars, 9 hours 42 minutes apart."
    >
      <defs>
        <radialGradient id={`${id}-well`} cx="0.5" cy="0.45" r="0.75">
          <stop offset="0" stopColor="#1b2350" />
          <stop offset="1" stopColor="#0f1530" />
        </radialGradient>
        <radialGradient id={`${id}-star`}>
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.35" stopColor="#dfe6ff" stopOpacity="0.8" />
          <stop offset="1" stopColor="#dfe6ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="240" height="240" rx="14" fill={`url(#${id}-well)`} />
      <g fill="#e8ebf7">
        {STARS.map((s, i) => (
          <circle key={i} cx={10 + s.x * 220} cy={10 + s.y * 220} r={s.r * 0.9} opacity={0.35 + s.r * 0.3} />
        ))}
      </g>
      {/* 36 Sextantis, the bright star nearby. */}
      <circle cx="170" cy="160" r="16" fill={`url(#${id}-star)`} />
      <path d="M170 146v28M156 160h28" stroke="#e8ebf7" strokeOpacity="0.5" strokeWidth="0.7" />
      <text
        x="170"
        y="192"
        textAnchor="middle"
        className="num fill-on-image text-[8px] font-medium"
        opacity="0.8"
      >
        36 Sextantis
      </text>
      <path
        d="M64 150L124 92"
        stroke="var(--accent-on-image)"
        strokeOpacity="0.6"
        strokeWidth="0.9"
        strokeDasharray="2 3"
        fill="none"
      />
      <g className="motion-safe:animate-[blink-a_2.2s_steps(1)_infinite]">
        <circle cx="64" cy="150" r="3.4" fill="var(--accent-on-image)" />
        <text x="14" y="226" className="num fill-on-image text-[8.5px]">
          2 Dec 2025 · 12:07 UTC
        </text>
      </g>
      <g className="opacity-0 motion-safe:animate-[blink-b_2.2s_steps(1)_infinite]">
        <circle cx="124" cy="92" r="3.4" fill="var(--accent-on-image)" />
        <text x="14" y="226" className="num fill-on-image text-[8.5px]">
          2 Dec 2025 · 21:49 UTC
        </text>
      </g>
      <text x="132" y="80" className="fill-accent-on-image text-[13.5px] font-semibold">
        (7) Iris
      </text>
    </svg>
  );
}
