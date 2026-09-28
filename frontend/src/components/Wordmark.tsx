import { useId } from "react";

import { usePrefersReducedMotion } from "./space/motion";

/** The six filter bands stacked like SPHEREx's linear variable filters. */
export function BandMark({ size = 18 }: { size?: number }) {
  const bands = ["var(--band-1)", "var(--band-2)", "var(--band-3)", "var(--band-4)", "var(--band-5)", "var(--band-6)"];
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      {bands.map((fill, i) => (
        <rect key={fill} x="0" y={i * 3} width="18" height="3" fill={fill} />
      ))}
    </svg>
  );
}

const ORBIT = "M30.5 16A14.5 5.2 0 1 1 1.5 16A14.5 5.2 0 1 1 30.5 16";

/**
 * The product mark: a planet shaded in the six filter blues inside a tilted orbit that carries a
 * small ember satellite.
 */
export function OrbitMark({ size = 30 }: { size?: number }) {
  const reduced = usePrefersReducedMotion();
  // Gradient ids must be unique on the page: a mark inside a hidden element (the chat sidebar on a
  // phone) would otherwise take the others' planet with it.
  const id = useId().replace(/:/g, "");
  const bands = `mark-bands-${id}`;
  const shade = `mark-shade-${id}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      className="overflow-visible"
    >
      <defs>
        <linearGradient id={bands} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--band-1)" />
          <stop offset="1" stopColor="var(--band-6)" />
        </linearGradient>
        <radialGradient id={shade} cx="0.32" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#0b1437" stopOpacity="0.45" />
        </radialGradient>
      </defs>
      <g transform="rotate(-24 16 16)">
        <ellipse
          cx="16"
          cy="16"
          rx="14.5"
          ry="5.2"
          fill="none"
          stroke="var(--text)"
          strokeOpacity="0.25"
          strokeWidth="1"
        />
      </g>
      <circle cx="16" cy="16" r="8" fill={`url(#${bands})`} />
      <circle cx="16" cy="16" r="8" fill={`url(#${shade})`} />
      <g transform="rotate(-24 16 16)">
        {/* The near half of the orbit passes in front of the planet. */}
        <path d="M1.5 16A14.5 5.2 0 0 0 30.5 16" fill="none" stroke="var(--text)" strokeWidth="1.1" />
        {reduced ? (
          <circle cx="30.5" cy="16" r="1.9" fill="var(--accent)" />
        ) : (
          <circle r="1.9" fill="var(--accent)">
            <animateMotion dur="10s" repeatCount="indefinite" path={ORBIT} />
          </circle>
        )}
      </g>
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <OrbitMark />
      <span className="font-display text-[1.0625rem] leading-none tracking-[-0.02em] text-text">
        <span className="font-semibold">SPHEREx</span> <span className="font-light text-muted">Explorer</span>
      </span>
    </span>
  );
}
