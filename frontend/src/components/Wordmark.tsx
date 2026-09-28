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

/**
 * The product mark: a pencil-sketched planet banded with the six filter colours, a ring, and a
 * small satellite on its orbit.
 */
export function OrbitMark({ size = 34 }: { size?: number }) {
  const bands = ["--band-1", "--band-2", "--band-3", "--band-4", "--band-5", "--band-6"];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
      className="overflow-visible"
    >
      <defs>
        <clipPath id="orbitmark-planet">
          <circle cx="20" cy="20" r="10.5" />
        </clipPath>
      </defs>
      <g clipPath="url(#orbitmark-planet)">
        {bands.map((b, i) => (
          <rect key={b} x="8" y={9.5 + i * 3.5} width="24" height="3.6" fill={`url(#hatch-${b.slice(2)})`} />
        ))}
      </g>
      <g filter="url(#pencil)" fill="none" stroke="var(--text)" strokeLinecap="round">
        <circle cx="20" cy="20" r="10.5" strokeWidth="1.5" />
        <path d="M4.5 25.5c-3-3.4 5.2-8.8 15.8-11.2 10.2-2.4 17.8-1.6 16.6 2.2" strokeWidth="1.3" />
        <path d="M36.9 16.5c-.9 3.4-8.4 7.3-17.4 9.3-6.7 1.5-12.6 1.4-15-.3" strokeWidth="1.3" strokeDasharray="0" />
      </g>
      <g
        className="origin-center motion-safe:animate-[spin_7s_linear_infinite]"
        style={{ transformOrigin: "20px 20px" }}
      >
        <rect x="18.6" y="0.8" width="2.8" height="2.8" fill="var(--text)" />
        <path d="M15.8 2.2h8.4" stroke="var(--focus)" strokeWidth="1.3" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <OrbitMark />
      <span className="font-display text-[1.3rem] leading-none tracking-[0.01em]">
        SPHEREx <span className="text-muted">Explorer</span>
      </span>
    </span>
  );
}
