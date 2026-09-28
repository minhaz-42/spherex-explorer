import { AlertTriangle, ChevronRight, LocateFixed, Minus, Plus, RefreshCw } from "lucide-react";
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

import type { DataSource } from "../../lib/api";
import { ApiError } from "../../lib/api";
import { formatDate, formatGap, formatNumber, formatTime, formatWavelength, plural } from "../../lib/format";
import { autoStretch, renderDifference, renderGray, sampleAt, type StretchKind } from "../../lib/pixels";
import {
  buildSequence,
  compatibility,
  defaultSpec,
  detectorCounts,
  type SequenceMode,
  type SequenceSpec,
} from "../../lib/sequence";
import { tokenRgb } from "../../lib/theme";
import { useCoarsePointer } from "../../lib/usePointer";
import type { Candidates, DecodedCutout, Frame, KnownObjects, Observations } from "../../lib/types";
import { formatDec, formatRa, gridToSky, skyToGrid } from "../../lib/wcs";
import { SPEEDS } from "../timeline/speeds";
import { FrameStrip, PassTrack, Transport } from "../timeline/Timeline";
import { BandPicker } from "../wavelength/BandPicker";
import { Measurements } from "../wavelength/Measurements";
import { FramePanel } from "./FramePanel";
import { CandidatesPanel } from "../known/Candidates";
import { KnownObjectsPanel } from "../known/KnownObjects";
import { CandidateTrack, PredictedTrack, ScaleAndCompass, TargetMarker } from "./overlays";
import { SkyCanvas } from "./SkyCanvas";
import { type CompareMode, FIELDS, type ViewerState } from "./state";
import { useSequence } from "./useSequence";
import { fitView, type Rendered, type ViewState } from "./view";

const MODES: { id: CompareMode; label: string; hint: string }[] = [
  { id: "single", label: "Single", hint: "One observation at a time" },
  { id: "blink", label: "Blink", hint: "Flip between reference A and the current frame B" },
  { id: "side", label: "Side by side", hint: "A and B next to each other, zoomed together" },
  { id: "diff", label: "Difference", hint: "B minus A, where that is scientifically valid" },
];

interface Props {
  observations: Observations;
  target: { ra: number; dec: number; label: string };
  source: DataSource;
  initial?: Partial<ViewerState>;
  onStateChange?: (state: ViewerState) => void;
}

export function Viewer({ observations, target, source, initial, onStateChange }: Props) {
  const { frames, passes } = observations;
  const [start] = useState(() => initialPosition(frames, passes, initial));
  const [spec, setSpec] = useState<SequenceSpec>(start.spec);
  const [index, setIndex] = useState(start.index);
  const [reference, setReference] = useState(start.reference);
  const [compare, setCompare] = useState<CompareMode>(initial?.compare ?? "single");
  const [fov, setFov] = useState(initial?.fov ?? 0.2);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [stretchKind, setStretchKind] = useState<StretchKind>("asinh");
  const [contrast, setContrast] = useState(1);
  const [showFlagged, setShowFlagged] = useState(false);
  const [showA, setShowA] = useState(false);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const touch = useCoarsePointer();
  const [known, setKnown] = useState<KnownObjects | undefined>(undefined);
  const [showKnown, setShowKnown] = useState(true);
  const [moving, setMoving] = useState<Candidates | undefined>(undefined);
  const [showWeak, setShowWeak] = useState(false);

  const sequence = useMemo(() => buildSequence(frames, spec), [frames, spec]);
  const count = sequence.length;
  const cur = Math.min(index, Math.max(count - 1, 0));
  const ref = Math.min(reference, Math.max(count - 1, 0));
  const frame = sequence[cur];
  const refFrame = sequence[ref];

  const size = useMemo(() => {
    const n = Math.max(Math.round((fov * 3600) / 6.15), 9);
    return n % 2 === 0 ? n + 1 : n;
  }, [fov]);
  const [view, setView] = useState<ViewState>(() => fitView(size, size));

  const pinned = useMemo(() => (compare === "single" ? [] : [ref]), [compare, ref]);
  const { results, loaded } = useSequence(sequence, cur, target, fov, source, pinned);
  const status = results.map((r) =>
    r.status === "success" ? "ready" : r.status === "error" ? "error" : r.fetchStatus === "fetching" ? "loading" : "idle",
  ) as ("loading" | "ready" | "error" | "idle")[];
  const B = results[cur]?.data;
  const A = results[ref]?.data;

  const frameId = frame?.obsId ?? null;
  const refId = refFrame?.obsId ?? null;
  useEffect(() => {
    if (playing) return; // write the URL when playback stops, not on every frame
    onStateChange?.({ spec, frame: frameId, reference: refId, compare, fov });
  }, [spec, frameId, refId, compare, fov, playing, onStateChange]);

  // One stretch for the whole sequence, taken from the reference frame (or the first to arrive).
  const stretchSource = A ?? B;
  const stretchKey = stretchSource?.payload.key;
  const stretch = useMemo(
    () => (stretchSource ? autoStretch(stretchSource, stretchKind, contrast) : null),
    // Recompute only when the reference frame or the stretch settings change, never per frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stretchKey, stretchKind, contrast],
  );
  const noData = tokenRgb("--bg-image", [20, 22, 38]);
  const flagTint = showFlagged ? tokenRgb("--accent-on-image", [255, 179, 92]) : null;

  const render = (img: DecodedCutout | undefined): Rendered | null =>
    img && stretch ? { rgba: renderGray(img, stretch, { noData, flagged: flagTint }), width: img.width, height: img.height } : null;

  const compat = frame && refFrame ? compatibility(refFrame, frame) : null;

  const renderedB = useMemo(() => render(B), [B, stretch, showFlagged]); // eslint-disable-line react-hooks/exhaustive-deps
  const renderedA = useMemo(() => render(A), [A, stretch, showFlagged]); // eslint-disable-line react-hooks/exhaustive-deps
  const renderedDiff = useMemo(() => {
    if (compare !== "diff" || !A || !B || !compat?.ok || A.width !== B.width) return null;
    const ra = A.payload.background.rmsMJySr ?? 0.01;
    const rb = B.payload.background.rmsMJySr ?? 0.01;
    const limit = 6 * Math.hypot(ra, rb);
    return { rgba: renderDifference(A, B, limit, noData), width: A.width, height: A.height, limit };
  }, [compare, A, B, compat?.ok]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset zoom when the field of view changes.
  const lastSize = useRef(size);
  useEffect(() => {
    if (lastSize.current !== size) {
      lastSize.current = size;
      setView(fitView(size, size));
    }
  }, [size]);

  // Playback: advance when the next frame is ready; wrap at the end.
  useEffect(() => {
    if (!playing || count < 2) return;
    const next = (cur + 1) % count;
    if (status[next] !== "ready") return;
    const t = window.setTimeout(() => setIndex(next), SPEEDS[speed]!.ms);
    return () => window.clearTimeout(t);
  }, [playing, cur, count, status, speed]);

  // Blink: flip between A and B.
  useEffect(() => {
    if (compare !== "blink") return;
    const t = window.setInterval(() => setShowA((v) => !v), Math.max(SPEEDS[speed]!.ms * 0.75, 250));
    return () => window.clearInterval(t);
  }, [compare, speed]);

  const step = (delta: number) => {
    if (count === 0) return;
    setPlaying(false);
    setIndex((i) => (Math.min(i, count - 1) + delta + count) % count);
  };

  const passFrames = useMemo(
    () => (frame ? frames.filter((f) => f.passIndex === frame.passIndex) : []),
    [frames, frame],
  );

  /** Show any frame: within this sequence if it is in it, otherwise switch to its detector's pass. */
  const goToFrame = (f: Frame) => {
    setPlaying(false);
    const here = sequence.findIndex((x) => x.id === f.id);
    if (here >= 0) {
      setIndex(here);
      return;
    }
    const next: SequenceSpec = { mode: "pass", detector: f.detector, passIndex: f.passIndex, wavelengthUm: spec.wavelengthUm };
    setSpec(next);
    setIndex(Math.max(buildSequence(frames, next).findIndex((x) => x.id === f.id), 0));
    setReference(0);
  };

  const changeSpec = (next: Partial<SequenceSpec>) => {
    setPlaying(false);
    setSpec((s) => ({ ...s, ...next }));
    setIndex(0);
    setReference(0);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest("input, select, textarea")) return;
    const keys: Record<string, () => void> = {
      ArrowRight: () => step(1),
      ArrowLeft: () => step(-1),
      " ": () => setPlaying((p) => !p),
      Home: () => {
        setPlaying(false);
        setIndex(0);
      },
      End: () => {
        setPlaying(false);
        setIndex(Math.max(count - 1, 0));
      },
      r: () => setReference(cur),
    };
    const action = keys[e.key];
    if (action && !(e.key === " " && (e.target as HTMLElement).closest("button"))) {
      e.preventDefault();
      action();
    }
  };

  const counts = useMemo(() => detectorCounts(frames, spec.mode === "pass" ? spec.passIndex : null), [frames, spec]);
  const shown: "A" | "B" = compare === "blink" && showA ? "A" : "B";
  const mainImage = compare === "diff" ? renderedDiff : compare === "blink" && showA ? renderedA : renderedB;
  const mainCutout = compare === "blink" && showA ? A : B;
  const mainFrame = compare === "blink" && showA ? refFrame : frame;
  const centre = size / 2;
  const grid = { ra: target.ra, dec: target.dec, sizePx: size, scaleArcsec: 6.15 };
  const readout = hover && mainCutout ? sampleAt(mainCutout, hover.x, hover.y) : null;
  const readoutSky = hover ? gridToSky(grid, hover.x, hover.y) : null;
  const currentError = results[cur]?.error;

  // Known bodies are drawn only for the sequence they were computed for (same frames, same field).
  const knownFor = (shownFrame: Frame | undefined) => {
    if (!known || !showKnown || !shownFrame || known.field.sizeDeg !== fov) return [];
    const keys = new Set(sequence.map((f) => f.key));
    return known.objects.map((o) => ({
      name: o.name,
      points: o.positions
        .filter((p) => keys.has(p.key))
        .map((p) => ({ ...skyToGrid(grid, p.ra, p.dec)!, current: p.key === shownFrame.key }))
        .filter((p) => Number.isFinite(p.x)),
    }));
  };
  const candidatesFor = (shownFrame: Frame | undefined) => {
    if (!moving || !shownFrame || moving.field.sizePx !== size) return [];
    return moving.candidates
      .filter((c) => showWeak || c.strength === "candidate")
      .map((c) => ({
        id: c.id,
        weak: c.strength !== "candidate",
        points: c.sightings
          .map((s) => ({ ...skyToGrid(grid, s.ra, s.dec)!, current: s.keys.includes(shownFrame.key) }))
          .filter((p) => Number.isFinite(p.x)),
      }));
  };
  const overlayFor = (shownFrame: Frame | undefined) => (scale: number) => (
    <>
      <TargetMarker x={centre} y={centre} scale={scale} label={target.label} />
      {knownFor(shownFrame).map((t) => (
        <PredictedTrack key={t.name} name={t.name} points={t.points} scale={scale} />
      ))}
      {candidatesFor(shownFrame).map((c) => (
        <CandidateTrack key={c.id} id={c.id} points={c.points} scale={scale} weak={c.weak} />
      ))}
    </>
  );
  const overlay = overlayFor(compare === "blink" && showA ? refFrame : frame);
  const hud = (scale: number) => <ScaleAndCompass scale={scale} arcsecPerPixel={6.15} />;

  const caption = (f: Frame | undefined, tag: "A" | "B" | null, img: DecodedCutout | undefined) =>
    f ? (
      <div className="pointer-events-none absolute left-2 top-2 flex max-w-[calc(100%-1rem)] flex-wrap items-center gap-x-2 gap-y-1 rounded-sm bg-black/60 px-2 py-1 text-[0.75rem] text-on-image">
        {tag && <span className="font-mono font-medium text-accent-on-image">{tag}</span>}
        <span className="num">
          {formatDate(f.isoMid)} {formatTime(f.isoMid, false)}
        </span>
        <span className="num">{formatWavelength(img?.payload.wavelength.atTargetUm ?? f.wavelengthUm)}</span>
      </div>
    ) : null;

  const loadingOverlay = (state: string | undefined, error: Error | null | undefined, retry?: () => void) =>
    state === "ready" ? null : (
      <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
        {state === "error" ? (
          <div className="max-w-xs space-y-3 rounded-sm bg-black/70 p-4 text-sm text-on-image">
            <p>
              <AlertTriangle size={16} className="mr-1.5 inline text-accent-on-image" aria-hidden />
              {error instanceof ApiError ? error.message : "This frame could not be loaded."}
            </p>
            {retry && (
              <button type="button" className="btn btn-secondary btn-sm !border-on-image !text-on-image" onClick={retry}>
                <RefreshCw size={14} aria-hidden /> Try again
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3 text-sm text-on-image" role="status">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-on-image/25 border-t-on-image motion-reduce:animate-none" />
            <p>Reading this frame from the SPHEREx archive…</p>
          </div>
        )}
      </div>
    );

  if (count === 0) {
    return (
      <div className="note">
        No frames from detector {spec.detector} in this selection. Choose another band or pass.
      </div>
    );
  }

  return (
    <section aria-label="Sky viewer" onKeyDown={onKeyDown} className="grid gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="min-w-0 space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="segmented" role="radiogroup" aria-label="Comparison">
            {MODES.map((m) => (
              <button key={m.id} type="button" role="radio" aria-checked={compare === m.id} title={m.hint} onClick={() => setCompare(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1" role="group" aria-label="Zoom">
            <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Zoom out" onClick={() => setView((v) => ({ ...v, zoom: Math.max(1, v.zoom / 1.5) }))}>
              <Minus size={16} aria-hidden />
            </button>
            <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Fit to view" onClick={() => setView(fitView(size, size))}>
              <LocateFixed size={16} aria-hidden />
            </button>
            <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Zoom in" onClick={() => setView((v) => ({ ...v, zoom: Math.min(12, v.zoom * 1.5) }))}>
              <Plus size={16} aria-hidden />
            </button>
          </div>
        </div>

        {/* Image(s) */}
        {compare === "side" ? (
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                [refFrame, renderedA, A, status[ref], "A", ref],
                [frame, renderedB, B, status[cur], "B", cur],
              ] as const
            ).map(([f, img, cut, st, tag, i]) => (
              <SkyCanvas
                key={tag}
                image={img}
                size={size}
                view={view}
                onViewChange={setView}
                overlay={overlayFor(f)}
                onHover={setHover}
                label={`Frame ${tag}: ${f ? `${formatDate(f.isoMid)} ${formatTime(f.isoMid)}` : ""}`}
              >
                {caption(f, tag, cut)}
                {loadingOverlay(st, results[i]?.error, () => results[i]?.refetch())}
              </SkyCanvas>
            ))}
          </div>
        ) : (
          <SkyCanvas
            image={mainImage}
            size={size}
            view={view}
            onViewChange={setView}
            overlay={overlay}
            hud={hud}
            onHover={setHover}
            label={
              compare === "diff"
                ? "Difference image, current frame minus reference"
                : `SPHEREx image of ${target.label}, ${mainFrame ? `${formatDate(mainFrame.isoMid)} ${formatTime(mainFrame.isoMid)}` : ""}`
            }
          >
            {compare === "diff" ? (
              <>
                <div className="pointer-events-none absolute left-2 top-2 rounded-sm bg-black/60 px-2 py-1 font-mono text-[0.75rem] text-on-image">
                  B − A
                </div>
                {renderedDiff && <DifferenceLegend limit={renderedDiff.limit} />}
              </>
            ) : (
              caption(mainFrame, compare === "blink" ? shown : null, mainCutout)
            )}
            {compare === "diff" && compat && !compat.ok ? (
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <div className="max-w-sm space-y-2 rounded-sm bg-black/75 p-4 text-sm text-on-image">
                  <p className="font-medium">A difference image would be misleading here.</p>
                  {compat.reasons.map((r) => (
                    <p key={r} className="text-on-image/85">
                      {r}
                    </p>
                  ))}
                  <p className="text-on-image/85">Use Blink to compare positions, or pick a matched-wavelength sequence.</p>
                </div>
              </div>
            ) : (
              loadingOverlay(compare === "diff" ? (status[ref] === "ready" ? status[cur] : status[ref]) : shown === "A" ? status[ref] : status[cur], currentError, () => results[cur]?.refetch())
            )}
          </SkyCanvas>
        )}

        {/* Pixel readout */}
        <p className="num min-h-5 text-xs text-faint" aria-live="off">
          {hover && readoutSky ? (
            <>
              RA {formatRa(readoutSky.ra)} Dec {formatDec(readoutSky.dec)}
              {readout && compare !== "diff" && (
                <>
                  {"  ·  "}
                  {readout.mask & 2 ? "no data" : `${formatNumber(readout.value, 3)} MJy/sr`}
                  {readout.mask & 1 ? " (flagged pixel, filled for display)" : ""}
                </>
              )}
            </>
          ) : touch ? (
            "Pinch to zoom, drag to pan, double-tap to zoom in."
          ) : (
            "Scroll or pinch to zoom, drag to pan. Hover for coordinates and pixel values."
          )}
        </p>

        {/* Time machine */}
        <div className="space-y-3 border-t border-rule pt-4">
          <Transport
            index={cur}
            count={count}
            playing={playing}
            speed={speed}
            frame={frame}
            onPlay={() => setPlaying((p) => !p)}
            onStep={step}
            onReset={() => {
              setPlaying(false);
              setIndex(0);
            }}
            onSpeed={setSpeed}
          />
          <FrameStrip frames={sequence} current={cur} reference={compare === "single" ? null : ref} status={status} onSelect={(i) => {
            setPlaying(false);
            setIndex(i);
          }} />
          <p className="text-xs text-faint">
            {plural(loaded, "frame")} of {count} loaded. Each dot’s height is the wavelength that frame saw at the target;
            a ring marks frames at the same wavelength as A.{touch ? "" : " Keys: ← → step, space play, R set reference."}
          </p>
        </div>

        {compare !== "single" && frame && refFrame && compat && (
          <ComparisonNote a={refFrame} b={frame} compat={compat} onUseCurrent={() => setReference(cur)} isSame={cur === ref} />
        )}

        <Measurements
          mode={spec.mode}
          sequence={sequence}
          results={results}
          current={cur}
          passFrames={passFrames}
          target={target}
          source={source}
          onSelectFrame={goToFrame}
        />
      </div>

      <aside className="space-y-8 lg:border-l lg:border-rule lg:pl-8">
        {frame && <FramePanel frame={frame} cutout={B} index={cur} count={count} />}

        <section aria-labelledby="seq-title" className="space-y-4 border-t border-rule pt-6">
          <h2 id="seq-title" className="panel-title">
            Sequence
          </h2>
          <div className="segmented w-full [&>button]:flex-1" role="radiogroup" aria-label="Sequence type">
            {(
              [
                ["pass", "One survey pass"],
                ["wavelength", "One wavelength"],
              ] as [SequenceMode, string][]
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={spec.mode === m}
                onClick={() =>
                  changeSpec(
                    m === "wavelength"
                      ? { mode: m, wavelengthUm: B?.payload.wavelength.atTargetUm ?? frame?.wavelengthUm ?? null }
                      : { mode: m, passIndex: frame?.passIndex ?? spec.passIndex },
                  )
                }
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted">
            {spec.mode === "pass"
              ? "Frames from one visit of the survey, minutes to days apart. Stars stay put; anything that moves is in the Solar System."
              : `Frames from every pass that saw the target within half a spectral channel of ${formatWavelength(spec.wavelengthUm)}, one per pointing. This is the fair way to compare brightness over months.`}
          </p>
          {spec.mode === "pass" && (
            <PassTrack passes={passes} selected={spec.passIndex} onSelect={(i) => changeSpec({ passIndex: i })} />
          )}
          <div className="space-y-2">
            <p className="text-sm text-muted">Wavelength band</p>
            <BandPicker counts={counts} detector={spec.detector} onChange={(d) => changeSpec({ detector: d, wavelengthUm: spec.mode === "wavelength" ? null : spec.wavelengthUm })} />
          </div>
          {spec.mode === "wavelength" && frame && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => changeSpec({ wavelengthUm: B?.payload.wavelength.atTargetUm ?? frame.wavelengthUm })}>
              Match this frame’s wavelength ({formatWavelength(B?.payload.wavelength.atTargetUm ?? frame.wavelengthUm)})
            </button>
          )}
        </section>

        <KnownObjectsPanel
          key={`${spec.mode}:${spec.detector}:${spec.passIndex}:${fov}`}
          sequence={sequence}
          current={frame}
          target={target}
          fov={fov}
          source={source}
          enabled={spec.mode === "pass" && count > 0 && sequence[count - 1]!.mjdMid - sequence[0]!.mjdMid < 20}
          show={showKnown}
          onShow={setShowKnown}
          onResult={setKnown}
        />

        <CandidatesPanel
          key={`c:${spec.mode}:${spec.detector}:${spec.passIndex}:${fov}`}
          sequence={sequence}
          target={target}
          fov={fov}
          source={source}
          enabled={spec.mode === "pass" && new Set(sequence.map((f) => f.pointing)).size >= 2}
          known={known}
          showWeak={showWeak}
          onShowWeak={setShowWeak}
          onResult={setMoving}
        />

        <section aria-labelledby="display-title" className="space-y-3 border-t border-rule pt-6">
          <h2 id="display-title" className="panel-title">
            Display
          </h2>
          <label className="flex items-center justify-between gap-3 text-sm text-muted">
            Field of view
            <select className="field !min-h-9 !w-auto" value={fov} onChange={(e) => setFov(Number(e.target.value))}>
              {FIELDS.map((f) => (
                <option key={f} value={f}>
                  {f}° ({Math.round(f * 60)}′)
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center justify-between gap-3 text-sm text-muted">
            Stretch
            <select className="field !min-h-9 !w-auto" value={stretchKind} onChange={(e) => setStretchKind(e.target.value as StretchKind)}>
              <option value="asinh">Asinh (faint and bright)</option>
              <option value="linear">Linear</option>
              <option value="log">Logarithmic</option>
            </select>
          </label>
          <label className="block text-sm text-muted">
            <span className="flex justify-between">
              Contrast <span className="num text-faint">{contrast.toFixed(2)}×</span>
            </span>
            <input
              type="range"
              min={-2}
              max={2}
              step={0.1}
              value={Math.log2(contrast)}
              onChange={(e) => setContrast(2 ** Number(e.target.value))}
              className="mt-2 w-full accent-[var(--accent)]"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={showFlagged} onChange={(e) => setShowFlagged(e.target.checked)} className="accent-[var(--accent)]" />
            Show flagged pixels (filled in for display, not measured)
          </label>
          <p className="text-xs text-faint">
            Every frame uses the same stretch, taken from the reference frame, so brightness changes you see are in the data.
            The local background (zodiacal light and airglow) is removed from each frame.
          </p>
        </section>
      </aside>
    </section>
  );
}

/** The sequence and frames to open with: from the URL's observation IDs if given, else defaults. */
function initialPosition(
  frames: Frame[],
  passes: Observations["passes"],
  initial: Partial<ViewerState> | undefined,
): { spec: SequenceSpec; index: number; reference: number } {
  const detector = initial?.spec?.detector;
  const find = (obsId: string | null | undefined) =>
    obsId ? frames.find((f) => f.obsId === obsId && (detector === undefined || f.detector === detector)) : undefined;
  const target = find(initial?.frame);
  let spec: SequenceSpec = initial?.spec ?? defaultSpec(passes);
  if (target && spec.mode === "pass") spec = { ...spec, detector: target.detector, passIndex: target.passIndex };
  if (spec.mode === "pass" && !passes.some((p) => p.index === spec.passIndex)) spec = defaultSpec(passes);
  const sequence = buildSequence(frames, spec);
  const indexOf = (obsId: string | null | undefined) => {
    const i = obsId ? sequence.findIndex((f) => f.obsId === obsId) : -1;
    return i >= 0 ? i : 0;
  };
  return { spec, index: indexOf(initial?.frame), reference: indexOf(initial?.reference) };
}

function DifferenceLegend({ limit }: { limit: number }) {
  return (
    <div className="pointer-events-none absolute bottom-2 right-2 rounded-sm bg-black/60 px-2 py-1.5 text-[0.6875rem] text-on-image">
      <div className="flex items-center gap-2">
        <span>fainter</span>
        <span className="h-2 w-24 rounded-[1px]" style={{ background: "linear-gradient(90deg, rgb(80 200 255), rgb(12 14 17), rgb(255 176 70))" }} />
        <span>brighter</span>
      </div>
      <p className="num mt-1 text-center text-on-image/80">±{formatNumber(limit, 2)} MJy/sr</p>
    </div>
  );
}

function ComparisonNote({
  a,
  b,
  compat,
  onUseCurrent,
  isSame,
}: {
  a: Frame;
  b: Frame;
  compat: ReturnType<typeof compatibility>;
  onUseCurrent: () => void;
  isSame: boolean;
}) {
  return (
    <section aria-label="Comparison" className="space-y-3 rounded-sm border border-rule p-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="font-mono text-accent">A</dt>
        <dd className="num text-muted">
          {formatDate(a.isoMid)} {formatTime(a.isoMid)} · {formatWavelength(a.wavelengthUm)}
        </dd>
        <dt className="font-mono text-accent">B</dt>
        <dd className="num text-muted">
          {formatDate(b.isoMid)} {formatTime(b.isoMid)} · {formatWavelength(b.wavelengthUm)}
        </dd>
      </dl>
      <p className="text-sm text-muted">
        {isSame ? (
          "A and B are the same frame. Step to another frame to compare."
        ) : (
          <>
            {formatGap(compat.deltaDays)} apart
            {compat.deltaWavelengthUm != null && `, ${Math.abs(compat.deltaWavelengthUm).toFixed(3)} µm apart in wavelength`}.{" "}
            {compat.ok
              ? "Close enough in wavelength to compare brightness directly."
              : "Positions can be compared (stars stay put, moving objects shift), but brightness differences may just be the sources’ colours."}
          </>
        )}
      </p>
      {compat.cautions.map((c) => (
        <p key={c} className="note note-warn">
          {c}
        </p>
      ))}
      <details className="disclosure">
        <summary>
          <ChevronRight size={16} className="disclosure-chevron" aria-hidden />
          How the comparison works
        </summary>
        <p className="mt-2 text-sm text-muted">
          Both frames are resampled onto the same north-up grid using their own astrometric solutions, flagged pixels are
          masked, and each frame’s local background is subtracted. A difference is shown only when both saw the target
          within half a spectral channel of each other, on the same detector. Differences near bright stars include
          residuals from the changing shape of the telescope’s point-spread function.
        </p>
      </details>
      {!isSame && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onUseCurrent}>
          Use B as the new reference
        </button>
      )}
    </section>
  );
}
