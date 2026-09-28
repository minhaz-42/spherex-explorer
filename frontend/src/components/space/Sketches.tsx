import { type CSSProperties, type ReactNode, useRef } from "react";

import { useInView } from "./motion";
import { seeded } from "./sketch";

/** Stagger for lines that draw themselves in. */
const order = (i: number) => ({ "--i": i }) as CSSProperties;

/** An SVG whose pencil lines (marked pathLength="1") draw themselves the first time it scrolls into view. */
function DrawOn({
  viewBox,
  label,
  className = "",
  children,
}: {
  viewBox: string;
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const drawn = useInView(ref, { once: true, margin: "-40px" });
  return (
    <svg
      ref={ref}
      viewBox={viewBox}
      className={`draw-on block h-auto w-full overflow-visible ${drawn ? "is-drawn" : ""} ${className}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      fill="none"
      stroke="var(--text)"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

// A fixed scatter of background stars for the sketches, generated once.
const STARS = (() => {
  const rand = seeded(2025);
  return Array.from({ length: 34 }, () => ({ x: rand(), y: rand(), r: 0.6 + rand() * 1.3 }));
})();

function StarDots({
  x,
  y,
  w,
  h,
  count = 18,
  offset = 0,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  count?: number;
  offset?: number;
}) {
  return (
    <g stroke="none" fill="var(--text)" opacity="0.7">
      {STARS.slice(offset, offset + count).map((s, i) => (
        <circle key={i} cx={x + s.x * w} cy={y + s.y * h} r={s.r} />
      ))}
    </g>
  );
}

/** "Where?" — a sketched sky sphere with a target picked out. */
export function WhereSketch() {
  return (
    <DrawOn viewBox="0 0 240 170">
      <g filter="url(#pencil)" strokeWidth="1.4">
        <circle cx="112" cy="90" r="62" pathLength={1} style={order(0)} />
        <ellipse cx="112" cy="90" rx="62" ry="16" pathLength={1} strokeOpacity="0.6" style={order(1)} />
        <ellipse cx="112" cy="90" rx="24" ry="62" pathLength={1} strokeOpacity="0.45" style={order(2)} />
        <ellipse cx="112" cy="90" rx="47" ry="62" pathLength={1} strokeOpacity="0.35" style={order(3)} />
      </g>
      <StarDots x={62} y={40} w={100} h={100} count={16} />
      <g
        className="origin-[146px_62px] motion-safe:animate-[pulse-ring_2.4s_ease-in-out_infinite]"
        stroke="var(--accent)"
        strokeWidth="1.8"
      >
        <circle cx="146" cy="62" r="10" pathLength={1} style={order(4)} />
        <path d="M146 46v8M146 70v8M130 62h8M154 62h8" />
      </g>
      <path d="M204 30c-14 2-30 10-44 24" pathLength={1} stroke="var(--accent)" strokeWidth="1.4" style={order(5)} />
      <path d="M160 54l1-7M160 54l7-1" stroke="var(--accent)" strokeWidth="1.4" />
      <text x="206" y="30" stroke="none" fill="var(--accent)" className="font-hand text-[20px] font-semibold">
        M31?
      </text>
    </DrawOn>
  );
}

/** "When?" — a timeline where images bunch into survey passes months apart. */
export function WhenSketch() {
  const passes = [48, 120, 192];
  const colours = [1, 2, 3, 4, 5, 6];
  return (
    <DrawOn viewBox="0 0 240 170">
      <path
        d="M12 112c40-1.5 80 1.2 120-.4s64 .6 96 .2"
        pathLength={1}
        strokeWidth="1.5"
        filter="url(#pencil)"
        style={order(0)}
      />
      {passes.map((px, p) => (
        <g key={px}>
          {colours.map((c, k) => (
            <line
              key={c}
              x1={px - 14 + k * 5.6}
              x2={px - 14 + k * 5.6}
              y1={112}
              y2={112 - 16 - ((k * 7 + p * 5) % 14)}
              stroke={`var(--band-${c})`}
              strokeWidth="2.6"
            />
          ))}
          <text
            x={px}
            y="136"
            textAnchor="middle"
            stroke="none"
            fill="var(--text-muted)"
            className="font-hand text-[17px] font-semibold"
          >
            pass {p + 1}
          </text>
        </g>
      ))}
      <path
        d="M50 70c0-8 2-10 6-10h56c4 0 6-2 6-8 0 6 2 8 6 8h56c4 0 6 2 6 10"
        pathLength={1}
        strokeWidth="1.2"
        strokeOpacity="0.7"
        style={order(2)}
      />
      <text
        x="120"
        y="44"
        textAnchor="middle"
        stroke="none"
        fill="var(--text)"
        className="font-hand text-[19px] font-semibold"
      >
        ≈ 6 months apart
      </text>
      <g className="motion-safe:animate-[playhead_7s_ease-in-out_infinite]">
        <path d="M30 150l-5 8h10z" fill="var(--accent)" stroke="var(--accent)" strokeWidth="1" />
        <path d="M30 148V88" stroke="var(--accent)" strokeWidth="1.4" strokeDasharray="3 3" />
      </g>
    </DrawOn>
  );
}

/** "What changed?" — one field, two visits, and a dot that moved. */
export function ChangeSketch() {
  return (
    <DrawOn viewBox="0 0 240 170">
      <path d="M52 22h136l1 124-138 1z" pathLength={1} strokeWidth="1.5" filter="url(#pencil)" style={order(0)} />
      <StarDots x={58} y={28} w={124} h={112} count={20} offset={10} />
      <path d="M94 110L146 66" stroke="var(--accent)" strokeWidth="1.2" strokeDasharray="3 4" strokeOpacity="0.7" />
      <g className="motion-safe:animate-[blink-a_1.8s_steps(1)_infinite]">
        <circle cx="94" cy="110" r="4.2" fill="var(--accent)" stroke="var(--text)" strokeWidth="1" />
        <text x="58" y="160" stroke="none" fill="var(--text-muted)" className="font-hand text-[17px] font-semibold">
          visit 1
        </text>
      </g>
      <g className="opacity-0 motion-safe:animate-[blink-b_1.8s_steps(1)_infinite]">
        <circle cx="146" cy="66" r="4.2" fill="var(--accent)" stroke="var(--text)" strokeWidth="1" />
        <text x="58" y="160" stroke="none" fill="var(--text-muted)" className="font-hand text-[17px] font-semibold">
          visit 2
        </text>
      </g>
      <path d="M214 40c-10 0-26 6-40 18" pathLength={1} stroke="var(--accent)" strokeWidth="1.4" style={order(3)} />
      <text x="196" y="30" stroke="none" fill="var(--accent)" className="font-hand text-[21px] font-semibold">
        moved!
      </text>
    </DrawOn>
  );
}

/** The (7) Iris case, drawn as a blink between the two SPHEREx visits. An illustration, not the data. */
export function IrisBlink() {
  return (
    <DrawOn viewBox="0 0 320 220" className="max-w-[26rem]">
      <path d="M16 14h288l2 186-292 2z" pathLength={1} strokeWidth="1.6" filter="url(#pencil)" style={order(0)} />
      <g stroke="none" fill="var(--text)" opacity="0.75">
        {STARS.map((s, i) => (
          <circle key={i} cx={24 + s.x * 272} cy={22 + s.y * 170} r={s.r * 1.1} />
        ))}
      </g>
      {/* 36 Sextantis, the bright star nearby. */}
      <g strokeWidth="1.3">
        <circle cx="228" cy="150" r="4" fill="var(--text)" />
        <path d="M228 138v-6M228 162v6M216 150h-6M240 150h6" />
      </g>
      <text
        x="222"
        y="178"
        textAnchor="end"
        stroke="none"
        fill="var(--text-muted)"
        className="font-hand text-[18px] font-semibold"
      >
        36 Sextantis
      </text>
      <path d="M92 132L170 84" stroke="var(--accent)" strokeWidth="1.3" strokeDasharray="3 4" strokeOpacity="0.75" />
      <g className="motion-safe:animate-[blink-a_2.2s_steps(1)_infinite]">
        <circle cx="92" cy="132" r="5" fill="var(--accent)" stroke="var(--text)" strokeWidth="1" />
        <text x="26" y="192" stroke="none" fill="var(--text)" className="num text-[12px]">
          2 Dec 2025 · 12:07 UTC
        </text>
      </g>
      <g className="opacity-0 motion-safe:animate-[blink-b_2.2s_steps(1)_infinite]">
        <circle cx="170" cy="84" r="5" fill="var(--accent)" stroke="var(--text)" strokeWidth="1" />
        <text x="26" y="192" stroke="none" fill="var(--text)" className="num text-[12px]">
          2 Dec 2025 · 21:49 UTC
        </text>
      </g>
      <path d="M150 50c6 10 12 18 18 26" pathLength={1} stroke="var(--accent)" strokeWidth="1.3" style={order(2)} />
      <text x="112" y="46" stroke="none" fill="var(--accent)" className="font-hand text-[22px] font-semibold">
        (7) Iris
      </text>
    </DrawOn>
  );
}

/** SPHEREx, roughly: three nested cone shields over a small spacecraft, with its solar panel. */
export function SpherexDoodle({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 130 150"
      className={`overflow-visible ${className}`}
      aria-hidden="true"
      fill="none"
      stroke="var(--text)"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g filter="url(#pencil)" strokeWidth="1.5">
        <ellipse cx="58" cy="22" rx="42" ry="9" fill="var(--bg-raised)" />
        <path d="M16 22l22 70M100 22L78 92" />
        <ellipse cx="58" cy="46" rx="34" ry="7.5" strokeOpacity="0.75" />
        <ellipse cx="58" cy="70" rx="27" ry="6" strokeOpacity="0.75" />
        <ellipse cx="58" cy="92" rx="20" ry="4.5" />
        <path d="M44 96h28v22H44z" fill="url(#hatch-graphite)" />
        <path d="M72 104l38-8 4 14-38 8z" fill="url(#hatch-band-1)" />
        <path d="M82 102l3 13M92 100l3 13M102 98l3 13" strokeWidth="0.9" />
      </g>
      <text x="4" y="146" stroke="none" fill="var(--text-muted)" className="font-hand text-[16px] font-semibold">
        SPHEREx, roughly
      </text>
    </svg>
  );
}

/** A ringed planet doodle for the margins. */
export function RingedPlanetDoodle({ className = "", pencil = "band-6" }: { className?: string; pencil?: string }) {
  return (
    <svg
      viewBox="0 0 120 80"
      className={`overflow-visible ${className}`}
      aria-hidden="true"
      fill="none"
      stroke="var(--text)"
      strokeLinecap="round"
    >
      <g filter="url(#pencil)" strokeWidth="1.5">
        <path d="M14 50c-8-7 18-18 46-20 28-2 50 4 46 12" />
        <circle cx="60" cy="40" r="22" fill={`url(#hatch-${pencil})`} />
        <path d="M106 42c-4 8-30 16-58 16-22 0-38-4-34-8" />
      </g>
    </svg>
  );
}
