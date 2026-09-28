import { useEffect, useRef } from "react";

import { useInView, usePrefersReducedMotion } from "./motion";

export interface Stat {
  value: number;
  /** Digits after the decimal point while counting. */
  decimals?: number;
  suffix?: string;
  label: string;
  note: string;
}

function format(v: number, decimals: number): string {
  return v.toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** A number that counts up once when it scrolls into view, circled in pencil. */
function Counter({ stat, index }: { stat: Stat; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduced = usePrefersReducedMotion();
  const decimals = stat.decimals ?? 0;

  useEffect(() => {
    const el = numRef.current;
    if (!el || !inView || reduced) return;
    let raf = 0;
    const start = performance.now() + index * 120;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - start) / 1400));
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = format(stat.value * eased, decimals);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduced, stat.value, decimals, index]);

  const tilt = index % 2 ? "rotate-1" : "-rotate-1";

  return (
    <div ref={ref} className={`flex flex-col items-start gap-1 ${tilt}`}>
      <span className="relative inline-flex items-baseline px-3 py-1">
        <svg
          aria-hidden="true"
          viewBox="0 0 200 90"
          preserveAspectRatio="none"
          className={`draw-on pointer-events-none absolute -inset-x-2 -inset-y-1 h-[calc(100%+0.5rem)] w-[calc(100%+1rem)] ${inView ? "is-drawn" : ""}`}
        >
          <path
            d="M24 16C62 2 150 4 184 24c20 14 10 44-30 56-44 12-112 8-140-12C-6 54 6 26 44 12"
            pathLength={1}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2.4"
            strokeLinecap="round"
            filter="url(#pencil)"
          />
        </svg>
        <span ref={numRef} className="font-display text-[clamp(2.4rem,1.8rem+2.4vw,3.6rem)] leading-none text-text">
          {format(stat.value, decimals)}
        </span>
        {stat.suffix ? <span className="font-display ms-1 text-2xl text-text">{stat.suffix}</span> : null}
      </span>
      <span className="mt-2 font-medium text-text">{stat.label}</span>
      <span className="hand text-lg text-muted">{stat.note}</span>
    </div>
  );
}

export function StatRow({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s, i) => (
        <Counter key={s.label} stat={s} index={i} />
      ))}
    </div>
  );
}
