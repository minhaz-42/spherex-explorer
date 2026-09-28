import { type PointerEvent, useId, useState } from "react";

import { type Band, bandAt, BANDS, channelEdges, channelOf, FEATURES } from "./bands";

const W = 1000;
const X0 = 120;
const X1 = 986;
const LMIN = 0.75;
const LMAX = 5.0;
const BAR_TOP = 118;
const BAR_H = 56;

const x = (wavelength: number) => X0 + ((wavelength - LMIN) / (LMAX - LMIN)) * (X1 - X0);
const wavelengthAt = (px: number) => LMIN + ((px - X0) / (X1 - X0)) * (LMAX - LMIN);

// The rainbow the eye can see, 0.38–0.75 µm, for scale.
const VISIBLE = ["#6a3fd6", "#3a62f0", "#16a37a", "#e9c21d", "#f0831e", "#e2402c"];

export function SpectrumExplorer() {
  const id = useId().replace(/:/g, "");
  const [selected, setSelected] = useState<Band["n"]>(4);
  const [cursor, setCursor] = useState<number | null>(null);

  const band: Band = BANDS.find((b) => b.n === selected) ?? (BANDS[3] as Band);
  const hoverBand = cursor !== null ? bandAt(cursor) : undefined;

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const wl = wavelengthAt(((e.clientX - rect.left) / rect.width) * W);
    setCursor(wl >= LMIN && wl <= LMAX ? wl : null);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="card overflow-hidden px-3 pb-3 pt-5 sm:px-6">
        {/* On narrow screens the spectrum keeps a readable size and scrolls sideways. */}
        <div className="overflow-x-auto overscroll-x-contain">
          <svg
            viewBox={`0 0 ${W} 250`}
            className="block w-full min-w-[42rem] select-none"
            role="img"
            aria-label="The six SPHEREx bands laid along the infrared spectrum from 0.75 to 5 micrometres, next to the visible light the eye can see."
            onPointerMove={onMove}
            onPointerLeave={() => setCursor(null)}
            onClick={() => {
              const b = cursor !== null ? bandAt(cursor) : undefined;
              if (b) setSelected(b.n);
            }}
          >
            <defs>
              <linearGradient id={`${id}-visible`} x1="0" x2="1">
                {VISIBLE.map((c, i) => (
                  <stop key={c} offset={i / (VISIBLE.length - 1)} stopColor={c} />
                ))}
              </linearGradient>
              <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
                <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Visible light, squeezed into a stub on the left. */}
            <text x="14" y={BAR_TOP - 12} className="num fill-muted text-[12px] font-medium">
              Visible
            </text>
            <rect x="14" y={BAR_TOP + 10} width="80" height={BAR_H - 20} rx="6" fill={`url(#${id}-visible)`} />
            <text x="14" y={BAR_TOP + BAR_H + 30} className="num fill-faint text-[12px]">
              0.38–0.75
            </text>
            <path d={`M98 ${BAR_TOP + BAR_H / 2}h12`} stroke="var(--text)" strokeOpacity="0.4" strokeDasharray="2 3" />

            {BANDS.map((b) => {
              const bx = x(b.min) + 1;
              const bw = x(b.max) - x(b.min) - 2;
              const isSel = b.n === selected;
              return (
                <g
                  key={b.n}
                  className="cursor-pointer transition-transform duration-300"
                  style={{
                    transform: isSel ? "translateY(-6px)" : undefined,
                    filter: isSel ? "drop-shadow(0 8px 12px rgb(11 20 55 / 0.28))" : undefined,
                  }}
                >
                  <rect
                    x={bx}
                    y={BAR_TOP}
                    width={bw}
                    height={BAR_H}
                    rx="6"
                    fill={`var(--band-${b.n})`}
                    opacity={isSel ? 1 : 0.82}
                  />
                  <rect x={bx} y={BAR_TOP} width={bw} height={BAR_H} rx="6" fill={`url(#${id}-sheen)`} />
                  {isSel ? (
                    <rect
                      x={bx - 2}
                      y={BAR_TOP - 2}
                      width={bw + 4}
                      height={BAR_H + 4}
                      rx="8"
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth="2"
                    />
                  ) : null}
                  <text
                    x={bx + bw / 2}
                    y={BAR_TOP + BAR_H / 2 + 8}
                    textAnchor="middle"
                    fill={`var(--band-ink-${b.n})`}
                    className="font-display text-[24px]"
                  >
                    {b.n}
                  </text>
                </g>
              );
            })}

            {/* 17 channels per band, as ticks under the bar. */}
            {BANDS.flatMap((b) =>
              channelEdges(b).map((edge) => (
                <line
                  key={`${b.n}-${edge}`}
                  x1={x(edge)}
                  x2={x(edge)}
                  y1={BAR_TOP + BAR_H + 4}
                  y2={BAR_TOP + BAR_H + 10}
                  stroke="var(--text)"
                  strokeWidth="0.7"
                  strokeOpacity="0.45"
                />
              )),
            )}

            {/* Spectral features, pinned above the bar. */}
            {FEATURES.map((f, i) => {
              const fx = x(f.wavelength);
              const top = i % 2 ? 56 : 86;
              return (
                <g key={f.label}>
                  <line
                    x1={fx}
                    x2={fx}
                    y1={top + 8}
                    y2={BAR_TOP - 4}
                    stroke="var(--text)"
                    strokeOpacity="0.35"
                    strokeWidth="0.9"
                  />
                  <circle cx={fx} cy={BAR_TOP - 4} r="2.2" fill="var(--text)" />
                  <text x={fx} y={top} textAnchor="middle" className="fill-text text-[17px] font-semibold">
                    {f.label}
                  </text>
                </g>
              );
            })}

            {/* Wavelength axis in micrometres. */}
            {[1, 2, 3, 4, 5].map((t) => (
              <g key={t}>
                <line
                  x1={x(t)}
                  x2={x(t)}
                  y1={BAR_TOP + BAR_H + 14}
                  y2={BAR_TOP + BAR_H + 20}
                  stroke="var(--text)"
                  strokeWidth="1"
                />
                <text x={x(t)} y={BAR_TOP + BAR_H + 38} textAnchor="middle" className="num fill-muted text-[13px]">
                  {t} µm
                </text>
              </g>
            ))}
            <text x={x(0.75)} y={BAR_TOP + BAR_H + 38} textAnchor="middle" className="num fill-muted text-[13px]">
              0.75
            </text>

            {cursor !== null ? (
              <g pointerEvents="none">
                <line
                  x1={x(cursor)}
                  x2={x(cursor)}
                  y1={BAR_TOP - 22}
                  y2={BAR_TOP + BAR_H + 10}
                  stroke="var(--accent)"
                  strokeWidth="1.4"
                />
                <circle cx={x(cursor)} cy={BAR_TOP - 22} r="3.4" fill="var(--accent)" />
              </g>
            ) : null}
          </svg>
        </div>
        <p className="num mt-2 min-h-5 px-1 text-xs text-muted" aria-live="off">
          {cursor !== null
            ? `${cursor.toFixed(2)} µm${hoverBand ? ` · band ${hoverBand.n} · channel ${channelOf(hoverBand, cursor)} of 17` : " · between bands"}`
            : "Hover the spectrum to read a wavelength · click a band to read about it"}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-start">
        <div role="group" aria-label="Choose a band" className="flex flex-wrap gap-2">
          {BANDS.map((b) => (
            <button
              key={b.n}
              type="button"
              className="chip"
              aria-pressed={b.n === selected}
              onClick={() => setSelected(b.n)}
            >
              <span aria-hidden="true" className="swatch" style={{ background: `var(--band-${b.n})` }} />
              Band {b.n}
              <span className="num opacity-75">
                {b.min.toFixed(2)}–{b.max.toFixed(2)} µm
              </span>
            </button>
          ))}
        </div>
        <div aria-live="polite" className="card px-6 py-5">
          <p className="flex flex-wrap items-baseline gap-x-3">
            <span className="font-display text-3xl">Band {band.n}</span>
            <span className="num text-sm text-muted">
              {band.min.toFixed(2)}–{band.max.toFixed(2)} µm · R ≈ {band.R} · 17 channels
            </span>
          </p>
          <p className="mt-2 text-muted">{band.what}</p>
        </div>
      </div>
    </div>
  );
}
