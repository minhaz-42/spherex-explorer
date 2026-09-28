/** The product mark: six filter bands stacked like SPHEREx's linear variable filters. */
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

export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <BandMark />
      <span className="font-display text-[1.125rem] font-medium tracking-[-0.01em]">
        SPHEREx <span className="text-muted">Explorer</span>
      </span>
    </span>
  );
}
