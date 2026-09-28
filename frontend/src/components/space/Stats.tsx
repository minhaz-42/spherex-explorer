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

/** A number that counts up once when it scrolls into view. */
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
    const start = performance.now() + index * 140;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - start) / 1600));
      const eased = 1 - Math.pow(1 - p, 4);
      el.textContent = format(stat.value * eased, decimals);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduced, stat.value, decimals, index]);

  return (
    <div ref={ref} className="relative flex flex-col gap-2 border-t border-rule pt-6">
      <span
        aria-hidden="true"
        className="absolute -top-[2px] left-0 h-[3px] w-10 rounded-full bg-gradient-to-r from-accent to-gold"
      />
      <span className="flex items-baseline gap-1.5">
        <span ref={numRef} className="font-display text-[clamp(3rem,2.2rem+2.6vw,4.6rem)] leading-none text-text">
          {format(stat.value, decimals)}
        </span>
        {stat.suffix ? <span className="text-2xl font-semibold text-muted">{stat.suffix}</span> : null}
      </span>
      <span className="font-medium text-text">{stat.label}</span>
      <span className="text-sm text-faint">{stat.note}</span>
    </div>
  );
}

export function StatRow({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
      {/* Keyed by position: labels change with the language, and a new key would restart the count. */}
      {stats.map((s, i) => (
        <Counter key={i} stat={s} index={i} />
      ))}
    </div>
  );
}
