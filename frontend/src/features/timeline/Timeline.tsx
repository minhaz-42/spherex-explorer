import { ChevronLeft, ChevronRight, Pause, Play, SkipBack } from "lucide-react";
import { Fragment, useEffect, useRef } from "react";

import { band } from "../../lib/bands";
import { formatDate, formatGap, formatMonth, formatRange, formatTime, formatWavelength, mjdToDate, plural } from "../../lib/format";
import type { Frame, Pass } from "../../lib/types";
import { SPEEDS } from "./speeds";

/** Gap between frames above which the strip shows a labelled break. */
const BREAK_DAYS = 30 / 1440;

interface PassTrackProps {
  passes: Pass[];
  selected: number | null;
  onSelect: (index: number) => void;
  disabled?: boolean;
}

/** Survey passes placed on a real time axis, from the first to the last. */
export function PassTrack({ passes, selected, onSelect, disabled }: PassTrackProps) {
  if (passes.length === 0) return null;
  const t0 = passes[0]!.mjdStart - 10;
  const t1 = passes[passes.length - 1]!.mjdEnd + 10;
  const span = t1 - t0;
  const months: { mjd: number; label: string }[] = [];
  const start = mjdToDate(t0);
  for (let d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)); ; ) {
    const mjd = d.getTime() / 86400000 + 40587;
    if (mjd > t1) break;
    months.push({ mjd, label: d.getUTCMonth() === 0 ? String(d.getUTCFullYear()) : formatMonth(d).slice(0, 3) });
    d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  }
  const step = Math.max(1, Math.ceil(months.length / 10));

  return (
    <div>
      <div className="relative hidden h-14 sm:block" aria-hidden="true">
        {months.map((m, i) =>
          i % step === 0 ? (
            <span
              key={m.mjd}
              className="absolute top-0 -translate-x-1/2 font-mono text-[0.6875rem] text-faint"
              style={{ left: `${((m.mjd - t0) / span) * 100}%` }}
            >
              {m.label}
            </span>
          ) : null,
        )}
        <div className="absolute inset-x-0 top-6 h-px bg-rule" />
        {months.map((m) => (
          <span key={`t${m.mjd}`} className="absolute top-[1.3rem] h-2 w-px bg-rule" style={{ left: `${((m.mjd - t0) / span) * 100}%` }} />
        ))}
        {passes.map((p) => {
          const left = ((p.mjdStart - t0) / span) * 100;
          const width = Math.max(((p.mjdEnd - p.mjdStart) / span) * 100, 0.8);
          return (
            <span
              key={p.index}
              className={`absolute top-[1.1rem] h-3 rounded-[2px] ${p.index === selected ? "bg-accent" : "bg-rule-strong"}`}
              style={{ left: `${left}%`, width: `${width}%` }}
            />
          );
        })}
      </div>
      <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible" aria-label="Survey passes">
        {passes.map((p) => (
          <li key={p.index} className="shrink-0">
            <button
              type="button"
              disabled={disabled}
              aria-pressed={p.index === selected}
              onClick={() => onSelect(p.index)}
              className={`flex min-h-11 flex-col items-start rounded-sm border px-3 py-1.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                p.index === selected
                  ? "border-accent bg-accent-wash text-text"
                  : "border-rule text-muted hover:border-rule-strong hover:text-text"
              }`}
            >
              <span className="text-sm font-medium">{formatRange(p.isoStart, p.isoEnd)}</span>
              <span className="text-xs text-faint">{plural(p.frames, "frame")}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface FrameStripProps {
  frames: Frame[];
  current: number;
  reference: number | null;
  status: ("loading" | "ready" | "error" | "idle")[];
  onSelect: (index: number) => void;
}

/**
 * One column per frame. The dot's height is the wavelength that frame saw at the target, within
 * its detector's band, so the filter stepping through wavelengths is visible as a pattern. Frames
 * within half a spectral channel of the reference A carry a ring: those are the fair comparisons.
 */
export function FrameStrip({ frames, current, reference, status, onSelect }: FrameStripProps) {
  const scroller = useRef<HTMLOListElement>(null);
  // Keep the current tick in view by scrolling the strip itself, never the page.
  useEffect(() => {
    const list = scroller.current;
    const el = list?.querySelector<HTMLElement>(`[data-index="${current}"]`);
    if (!list || !el) return;
    const left = el.offsetLeft - list.offsetLeft;
    if (left < list.scrollLeft + 24) list.scrollLeft = Math.max(left - 24, 0);
    else if (left + el.offsetWidth > list.scrollLeft + list.clientWidth - 24) {
      list.scrollLeft = left + el.offsetWidth - list.clientWidth + 24;
    }
  }, [current]);

  const detector = frames[0]?.detector ?? 1;
  const b = band(detector);
  const lo = Math.min(b.minUm, ...frames.map((f) => f.wavelengthUm ?? b.minUm));
  const hi = Math.max(b.maxUm, ...frames.map((f) => f.wavelengthUm ?? b.maxUm));
  const ref = reference !== null ? frames[reference] : undefined;
  const matchesRef = (f: Frame) =>
    !!ref && ref !== f && f.wavelengthUm != null && ref.wavelengthUm != null && ref.bandwidthUm != null &&
    Math.abs(f.wavelengthUm - ref.wavelengthUm) <= 0.5 * ref.bandwidthUm;

  return (
    <div className="flex gap-2">
      <div className="flex h-14 shrink-0 flex-col justify-between py-1 text-right font-mono text-[0.625rem] leading-none text-faint" aria-hidden="true">
        <span>{hi.toFixed(2)} µm</span>
        <span>{lo.toFixed(2)}</span>
      </div>
      <ol
        ref={scroller}
        className="flex min-w-0 flex-1 items-stretch gap-[2px] overflow-x-auto pb-2 [scrollbar-width:thin]"
        aria-label="Frames in this sequence"
      >
        {frames.map((f, i) => {
          const gap = i === 0 ? 0 : f.mjdMid - frames[i - 1]!.mjdMid;
          const active = i === current;
          const state = status[i] ?? "idle";
          const matched = matchesRef(f);
          const t = f.wavelengthUm == null ? 0.5 : (f.wavelengthUm - lo) / Math.max(hi - lo, 1e-6);
          const label =
            `Frame ${i + 1}: ${formatDate(f.isoMid)}, ${formatTime(f.isoMid)}, ${formatWavelength(f.wavelengthUm)}` +
            `${i === reference ? ", reference A" : ""}${matched ? ", same wavelength as A" : ""}` +
            `${state === "error" ? ", failed to load" : state === "ready" ? "" : ", not loaded yet"}`;
          return (
            <Fragment key={f.id}>
              {i > 0 && gap > BREAK_DAYS && (
                <li aria-hidden="true" className="flex shrink-0 items-end px-1 pb-3">
                  <span className="whitespace-nowrap font-mono text-[0.625rem] text-faint">+{formatGap(gap)}</span>
                </li>
              )}
              <li className="shrink-0">
                <button
                  type="button"
                  data-index={i}
                  aria-label={label}
                  aria-current={active ? "true" : undefined}
                  title={label}
                  onClick={() => onSelect(i)}
                  className={`group relative block h-14 w-5 rounded-[2px] transition-colors ${active ? "bg-accent-wash" : "hover:bg-hover"}`}
                >
                  {i === reference && (
                    <span className="absolute left-1/2 top-0 -translate-x-1/2 font-mono text-[0.625rem] font-medium leading-none text-text">A</span>
                  )}
                  <span className="absolute inset-x-0 bottom-3 top-3" aria-hidden="true">
                    <span
                      className={`absolute left-1/2 block -translate-x-1/2 translate-y-1/2 rounded-full ${
                        state === "error"
                          ? "h-2 w-2 bg-danger"
                          : active
                            ? "h-2.5 w-2.5 bg-accent"
                            : state === "ready"
                              ? "h-2 w-2 bg-muted"
                              : "h-2 w-2 border border-faint"
                      } ${matched ? "ring-2 ring-accent/70 ring-offset-1 ring-offset-[var(--bg)]" : ""}`}
                      style={{ bottom: `${t * 100}%` }}
                    />
                  </span>
                  <span className={`absolute inset-x-1 bottom-0.5 block h-[2px] rounded-full ${active ? "bg-accent" : "bg-transparent"}`} aria-hidden="true" />
                </button>
              </li>
            </Fragment>
          );
        })}
      </ol>
    </div>
  );
}

interface TransportProps {
  index: number;
  count: number;
  playing: boolean;
  speed: number;
  onPlay: () => void;
  onStep: (delta: number) => void;
  onReset: () => void;
  onSpeed: (index: number) => void;
  frame: Frame | undefined;
  disabled?: boolean;
}

export function Transport({ index, count, playing, speed, onPlay, onStep, onReset, onSpeed, frame, disabled }: TransportProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className="flex items-center gap-1" role="group" aria-label="Playback">
        <button type="button" className="btn btn-ghost btn-icon" onClick={onReset} disabled={disabled || count === 0} aria-label="First frame">
          <SkipBack size={18} aria-hidden />
        </button>
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => onStep(-1)} disabled={disabled || count === 0} aria-label="Previous frame">
          <ChevronLeft size={20} aria-hidden />
        </button>
        <button
          type="button"
          className="btn btn-primary btn-icon"
          onClick={onPlay}
          disabled={disabled || count < 2}
          aria-label={playing ? "Pause" : "Play through the frames"}
        >
          {playing ? <Pause size={18} aria-hidden /> : <Play size={18} aria-hidden />}
        </button>
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => onStep(1)} disabled={disabled || count === 0} aria-label="Next frame">
          <ChevronRight size={20} aria-hidden />
        </button>
      </div>
      <div className="segmented" role="radiogroup" aria-label="Playback speed">
        {SPEEDS.map((s, i) => (
          <button key={s.label} type="button" role="radio" aria-checked={speed === i} onClick={() => onSpeed(i)}>
            {s.label}
          </button>
        ))}
      </div>
      <p className="ml-auto text-sm text-muted" aria-live="polite">
        {count > 0 && frame ? (
          <>
            <span className="num text-text">
              {index + 1} / {count}
            </span>
            <span className="mx-2 text-faint">·</span>
            <span className="num">
              {formatDate(frame.isoMid)} {formatTime(frame.isoMid)}
            </span>
          </>
        ) : (
          "No frames"
        )}
      </p>
    </div>
  );
}
