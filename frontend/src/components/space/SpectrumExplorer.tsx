import { type CSSProperties, type PointerEvent, useRef, useState } from "react";

import { type Band, bandAt, BANDS, channelEdges, channelOf, FEATURES } from "./bands";
import { useInView } from "./motion";

const W = 1000;
const X0 = 110;
const X1 = 985;
const LMIN = 0.75;
const LMAX = 5.0;
const BAR_TOP = 116;
const BAR_H = 52;

const x = (wavelength: number) => X0 + ((wavelength - LMIN) / (LMAX - LMIN)) * (X1 - X0);
const wavelengthAt = (px: number) => LMIN + ((px - X0) / (X1 - X0)) * (LMAX - LMIN);

/** Stagger for lines that draw themselves in. */
const order = (i: number) => ({ "--i": i }) as CSSProperties;

// Pencil colours for the visible rainbow that the eye can see, for contrast with SPHEREx's range.
const VISIBLE = ["#7b2cbf", "#3b5bdb", "#2b8a3e", "#eda100", "#e8590c", "#e03131"];

export function SpectrumExplorer() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drawn = useInView(wrapRef, { once: true, margin: "-60px" });
  const [selected, setSelected] = useState<Band["n"]>(4);
  const [cursor, setCursor] = useState<number | null>(null);

  const band: Band = BANDS.find((b) => b.n === selected) ?? (BANDS[3] as Band);
  const hoverBand = cursor !== null ? bandAt(cursor) : undefined;

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const wl = wavelengthAt(px);
    setCursor(wl >= LMIN && wl <= LMAX ? wl : null);
  };

  return (
    <div ref={wrapRef} className="flex flex-col gap-5">
      <div className="sheet overflow-hidden px-2 py-3 sm:px-4">
        {/* On narrow screens the spectrum keeps a readable size and scrolls sideways. */}
        <div className="overflow-x-auto overscroll-x-contain">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} 232`}
            className={`draw-on block w-full min-w-[42rem] select-none ${drawn ? "is-drawn" : ""}`}
            role="img"
            aria-label="The six SPHEREx bands laid along the infrared spectrum from 0.75 to 5 micrometres, next to the visible light the eye can see."
            onPointerMove={onMove}
            onPointerLeave={() => setCursor(null)}
            onClick={() => {
              const b = cursor !== null ? bandAt(cursor) : undefined;
              if (b) setSelected(b.n);
            }}
          >
            {/* Visible light, squeezed into a stub on the left. */}
            <g>
              {VISIBLE.map((c, i) => (
                <rect
                  key={c}
                  x={8 + i * 13.5}
                  y={BAR_TOP + 10}
                  width="13.5"
                  height={BAR_H - 20}
                  fill={c}
                  opacity="0.5"
                />
              ))}
              <rect
                x="8"
                y={BAR_TOP + 10}
                width="81"
                height={BAR_H - 20}
                fill="url(#crosshatch-graphite)"
                opacity="0.4"
              />
              <text x="48" y={BAR_TOP - 2} textAnchor="middle" className="fill-muted font-hand text-[22px]">
                what eyes see
              </text>
              <path
                d="M92 144c4-3 8-3 12 0"
                pathLength={1}
                fill="none"
                stroke="var(--text)"
                strokeWidth="1.4"
                strokeLinecap="round"
                style={order(1)}
              />
            </g>

            {BANDS.map((b, i) => {
              const bx = x(b.min);
              const bw = x(b.max) - bx;
              const isSel = b.n === selected;
              return (
                <g
                  key={b.n}
                  className="cursor-pointer transition-transform duration-300"
                  style={{ transform: isSel ? "translateY(-5px)" : undefined }}
                >
                  <rect
                    x={bx}
                    y={BAR_TOP}
                    width={bw}
                    height={BAR_H}
                    fill={`var(--band-${b.n})`}
                    opacity={isSel ? 0.22 : 0.1}
                  />
                  <rect
                    x={bx}
                    y={BAR_TOP}
                    width={bw}
                    height={BAR_H}
                    fill={`url(#hatch-band-${b.n})`}
                    opacity={isSel ? 1 : 0.7}
                  />
                  <path
                    d={`M${bx + 1} ${BAR_TOP + 1}h${bw - 2}v${BAR_H - 2}h${-(bw - 2)}z`}
                    pathLength={1}
                    fill="none"
                    stroke="var(--text)"
                    strokeWidth={isSel ? 2.2 : 1.3}
                    filter="url(#pencil)"
                    style={order(i + 2)}
                  />
                  {channelEdges(b).map((edge) => (
                    <line
                      key={edge}
                      x1={x(edge)}
                      x2={x(edge)}
                      y1={BAR_TOP + BAR_H}
                      y2={BAR_TOP + BAR_H + 7}
                      stroke="var(--text)"
                      strokeWidth="0.8"
                      strokeOpacity="0.55"
                    />
                  ))}
                  <circle cx={bx + bw / 2} cy={BAR_TOP + BAR_H / 2} r="13" fill="var(--bg-raised)" opacity="0.92" />
                  <text
                    x={bx + bw / 2}
                    y={BAR_TOP + BAR_H / 2 + 7}
                    textAnchor="middle"
                    className="fill-text font-display text-[20px]"
                  >
                    {b.n}
                  </text>
                  {isSel ? (
                    <ellipse
                      cx={bx + bw / 2}
                      cy={BAR_TOP + BAR_H / 2}
                      rx="18"
                      ry="16"
                      pathLength={1}
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth="1.8"
                      filter="url(#pencil-rough)"
                    />
                  ) : null}
                </g>
              );
            })}

            {/* Spectral features, pinned above the bar like margin notes. */}
            {FEATURES.map((f, i) => {
              const fx = x(f.wavelength);
              const top = i % 2 ? 50 : 80;
              return (
                <g key={f.label}>
                  <path
                    d={`M${fx} ${BAR_TOP - 4}C${fx - 3} ${(BAR_TOP + top) / 2} ${fx + 3} ${top + 14} ${fx} ${top + 6}`}
                    pathLength={1}
                    fill="none"
                    stroke="var(--text)"
                    strokeWidth="1.1"
                    strokeOpacity="0.7"
                    style={order(i + 8)}
                  />
                  <text x={fx} y={top} textAnchor="middle" className="fill-text font-hand text-[21px] font-semibold">
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
                  y1={BAR_TOP + BAR_H + 10}
                  y2={BAR_TOP + BAR_H + 17}
                  stroke="var(--text)"
                  strokeWidth="1.2"
                />
                <text x={x(t)} y={BAR_TOP + BAR_H + 38} textAnchor="middle" className="num fill-muted text-[15px]">
                  {t} µm
                </text>
              </g>
            ))}
            <text x={x(0.75)} y={BAR_TOP + BAR_H + 38} textAnchor="middle" className="num fill-muted text-[15px]">
              0.75
            </text>

            {cursor !== null ? (
              <g pointerEvents="none">
                <line
                  x1={x(cursor)}
                  x2={x(cursor)}
                  y1={BAR_TOP - 16}
                  y2={BAR_TOP + BAR_H + 8}
                  stroke="var(--accent)"
                  strokeWidth="1.6"
                  strokeDasharray="4 3"
                />
                <circle cx={x(cursor)} cy={BAR_TOP - 16} r="3" fill="var(--accent)" />
              </g>
            ) : null}
          </svg>
        </div>
        <p className="num mt-1 min-h-5 px-2 text-xs text-muted" aria-live="off">
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
              <span
                aria-hidden="true"
                className="inline-block size-2.5 rounded-full border border-text/70"
                style={{ background: `var(--band-${b.n})` }}
              />
              Band {b.n}
              <span className="num text-faint">
                {b.min.toFixed(2)}–{b.max.toFixed(2)} µm
              </span>
            </button>
          ))}
        </div>
        <div aria-live="polite" className="sheet sheet-alt px-5 py-4">
          <p className="flex flex-wrap items-baseline gap-x-3">
            <span className="font-display text-2xl">Band {band.n}</span>
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
