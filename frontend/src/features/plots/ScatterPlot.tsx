import { ChevronRight } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useLayoutEffect, useMemo, useRef, useState } from "react";

export interface PlotPoint {
  id: string;
  x: number;
  y: number;
  yErr?: number | null;
  /** Drawn hollow: measured, but with a caveat (flagged pixels, low signal…). */
  caveat?: boolean;
  current?: boolean;
  /** Tooltip and table rows: the value line is built from ``y``; these follow it. */
  details: string[];
}

interface Props {
  points: PlotPoint[];
  xLabel: string;
  yLabel: string;
  formatX: (v: number) => string;
  formatY: (v: number) => string;
  /** Column heading for x in the table view. */
  xHeading: string;
  yHeading: string;
  onSelect?: (id: string) => void;
  xDomain?: [number, number];
  height?: number;
  caption: ReactNode;
}

const MARGIN = { top: 12, right: 16, bottom: 40, left: 64 };

function niceTicks(lo: number, hi: number, count = 5): number[] {
  if (!(hi > lo)) return [lo];
  const span = hi - lo;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? 10 * mag;
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) ticks.push(Number(v.toPrecision(12)));
  return ticks;
}

/**
 * One series of measurements with error bars. The current frame is the emphasised point;
 * everything else is the de-emphasis grey. Hollow points carry a caveat. The pointer only has to
 * be nearest a point; keyboard users step through points with the arrow keys; a table view holds
 * every value.
 */
export function ScatterPlot({ points, xLabel, yLabel, formatX, formatY, xHeading, yHeading, onSelect, xDomain, height = 220, caption }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sorted = useMemo(() => [...points].sort((a, b) => a.x - b.x), [points]);
  const { x0, x1, y0, y1 } = useMemo(() => {
    const xs = sorted.map((p) => p.x);
    const lows = sorted.map((p) => p.y - (p.yErr ?? 0));
    const highs = sorted.map((p) => p.y + (p.yErr ?? 0));
    let lo = Math.min(0, ...lows);
    let hi = Math.max(...highs, 0);
    if (!(hi > lo)) {
      hi = lo + 1;
    }
    const pad = (hi - lo) * 0.08;
    lo = lo < 0 ? lo - pad : lo;
    hi += pad;
    const [dx0, dx1] = xDomain ?? [Math.min(...xs), Math.max(...xs)];
    const xpad = dx1 > dx0 ? (dx1 - dx0) * 0.04 : 1;
    return { x0: dx0 - (xDomain ? 0 : xpad), x1: dx1 + (xDomain ? 0 : xpad), y0: lo, y1: hi };
  }, [sorted, xDomain]);

  const innerW = Math.max(width - MARGIN.left - MARGIN.right, 10);
  const innerH = height - MARGIN.top - MARGIN.bottom;
  const sx = (v: number) => MARGIN.left + ((v - x0) / (x1 - x0 || 1)) * innerW;
  const sy = (v: number) => MARGIN.top + innerH - ((v - y0) / (y1 - y0 || 1)) * innerH;
  const xTicks = niceTicks(x0, x1, Math.max(Math.floor(innerW / 90), 2));
  const yTicks = niceTicks(y0, y1, 4);

  const nearest = (clientX: number, clientY: number) => {
    const rect = wrap.current?.querySelector("svg")?.getBoundingClientRect();
    if (!rect) return null;
    let best: number | null = null;
    let bestD = Infinity;
    sorted.forEach((p, i) => {
      const d = Math.hypot(sx(p.x) - (clientX - rect.left), sy(p.y) - (clientY - rect.top));
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return bestD <= 48 ? best : null;
  };

  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (sorted.length === 0) return;
    const moves: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (e.key in moves) {
      e.preventDefault();
      setActive((a) => (a === null ? 0 : (a + moves[e.key]! + sorted.length) % sorted.length));
    } else if ((e.key === "Enter" || e.key === " ") && active !== null && onSelect) {
      e.preventDefault();
      onSelect(sorted[active]!.id);
    }
  };

  const tip = active !== null ? sorted[active] : undefined;
  const tipX = tip ? sx(tip.x) : 0;
  const tipY = tip ? sy(tip.y) : 0;

  return (
    <figure className="space-y-2">
      <div ref={wrap} className="relative w-full">
        {width > 0 && (
          <svg
            width={width}
            height={height}
            role="group"
            aria-label={`${yLabel} against ${xLabel}. Use the arrow keys to read points.`}
            tabIndex={0}
            onKeyDown={onKey}
            onPointerMove={(e) => setActive(nearest(e.clientX, e.clientY))}
            onPointerLeave={() => setActive(null)}
            onBlur={() => setActive(null)}
            onClick={(e) => {
              const i = nearest(e.clientX, e.clientY);
              if (i !== null && onSelect) onSelect(sorted[i]!.id);
            }}
            className="block cursor-crosshair overflow-visible focus-visible:outline-2"
          >
            {/* Grid and axes: solid hairlines, recessive */}
            {yTicks.map((t) => (
              <g key={`y${t}`}>
                <line x1={MARGIN.left} x2={width - MARGIN.right} y1={sy(t)} y2={sy(t)} stroke="var(--rule)" strokeWidth={1} />
                <text x={MARGIN.left - 8} y={sy(t)} dy="0.32em" textAnchor="end" className="num fill-[var(--text-faint)] text-[0.75rem]">
                  {formatY(t)}
                </text>
              </g>
            ))}
            {y0 < 0 && y1 > 0 && (
              <line x1={MARGIN.left} x2={width - MARGIN.right} y1={sy(0)} y2={sy(0)} stroke="var(--rule-strong)" strokeWidth={1} />
            )}
            {xTicks.map((t) => (
              <text key={`x${t}`} x={sx(t)} y={height - MARGIN.bottom + 16} textAnchor="middle" className="num fill-[var(--text-faint)] text-[0.75rem]">
                {formatX(t)}
              </text>
            ))}
            <line x1={MARGIN.left} x2={width - MARGIN.right} y1={MARGIN.top + innerH} y2={MARGIN.top + innerH} stroke="var(--rule-strong)" strokeWidth={1} />
            <text x={MARGIN.left + innerW / 2} y={height - 4} textAnchor="middle" className="fill-[var(--text-muted)] text-[0.75rem]">
              {xLabel}
            </text>
            <text transform={`translate(12 ${MARGIN.top + innerH / 2}) rotate(-90)`} textAnchor="middle" className="fill-[var(--text-muted)] text-[0.75rem]">
              {yLabel}
            </text>

            {/* Error bars, then points; the current point last so it sits on top */}
            {[...sorted.filter((p) => !p.current), ...sorted.filter((p) => p.current)].map((p) => {
              const cx = sx(p.x);
              const cy = sy(p.y);
              const color = p.current ? "var(--accent)" : "var(--text-muted)";
              const err = p.yErr ?? 0;
              return (
                <g key={p.id}>
                  {err > 0 && (
                    <line x1={cx} x2={cx} y1={sy(p.y - err)} y2={sy(p.y + err)} stroke={color} strokeOpacity={0.6} strokeWidth={1} />
                  )}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={p.current ? 5.5 : 4}
                    fill={p.caveat ? "var(--bg)" : color}
                    stroke={p.caveat ? color : "var(--bg)"}
                    strokeWidth={2}
                  />
                </g>
              );
            })}
            {tip && (
              <circle cx={tipX} cy={tipY} r={9} fill="none" stroke="var(--text)" strokeWidth={1} pointerEvents="none" />
            )}
          </svg>
        )}
        {tip && (
          <div
            className="pointer-events-none absolute z-10 w-max max-w-[16rem] rounded-sm border border-rule bg-raised px-3 py-2 text-xs shadow-sm"
            style={{
              left: Math.min(Math.max(tipX + 12, 0), Math.max(width - 200, 0)),
              top: Math.max(tipY - 64, 0),
            }}
            role="status"
          >
            <p className="num text-sm font-medium text-text">{formatY(tip.y)}{tip.yErr ? ` ± ${formatY(tip.yErr)}` : ""}</p>
            <p className="num text-muted">{formatX(tip.x)}</p>
            {tip.details.map((d) => (
              <p key={d} className="text-faint">
                {d}
              </p>
            ))}
          </div>
        )}
      </div>
      <figcaption className="text-xs text-faint">{caption}</figcaption>
      <details className="disclosure">
        <summary>
          <ChevronRight size={16} className="disclosure-chevron" aria-hidden />
          Show the values as a table
        </summary>
        <div className="mt-2 max-h-72 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-bg text-faint">
              <tr>
                <th className="py-1 pr-3 font-medium">{xHeading}</th>
                <th className="py-1 pr-3 font-medium">{yHeading}</th>
                <th className="py-1 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody className="num text-muted">
              {sorted.map((p) => (
                <tr key={p.id} className={`border-t border-rule ${p.current ? "text-text" : ""}`}>
                  <td className="py-1 pr-3">{formatX(p.x)}</td>
                  <td className="py-1 pr-3">
                    {formatY(p.y)}
                    {p.yErr ? ` ± ${formatY(p.yErr)}` : ""}
                  </td>
                  <td className="py-1">{p.details.join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
