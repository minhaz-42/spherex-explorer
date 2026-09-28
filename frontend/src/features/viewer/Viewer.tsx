import { AlertTriangle, ChevronRight, LocateFixed, MessageSquareText, Minus, Plus, RefreshCw } from "lucide-react";
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";

import type { DataSource } from "../../lib/api";
import { ApiError } from "../../lib/api";
import { formatDate, formatGap, formatNumber, formatTime, formatWavelength } from "../../lib/format";
import { useLang, useT } from "../../lib/i18n";
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
import { MAX_SEQUENCE_KEYS, publishView } from "../assistant/viewContext";
import { CandidatesPanel } from "../known/Candidates";
import { KnownObjectsPanel } from "../known/KnownObjects";
import { frameCount, VIEWER, type ViewerKey } from "./messages";
import { CandidateTrack, PredictedTrack, ScaleAndCompass, TargetMarker } from "./overlays";
import { SkyCanvas } from "./SkyCanvas";
import { type CompareMode, FIELDS, type ViewerState } from "./state";
import { useSequence } from "./useSequence";
import { fitView, type Rendered, type ViewState } from "./view";

// Below 400 px wide the four modes must fit one row, so "Side by side" shortens to "Side".
const MODES: { id: CompareMode; label: ViewerKey; short?: ViewerKey; hint: ViewerKey }[] = [
  { id: "single", label: "single", hint: "singleHint" },
  { id: "blink", label: "blink", hint: "blinkHint" },
  { id: "side", label: "side", short: "sideShort", hint: "sideHint" },
  { id: "diff", label: "diff", hint: "diffHint" },
];

interface Props {
  observations: Observations;
  target: { ra: number; dec: number; label: string };
  source: DataSource;
  initial?: Partial<ViewerState>;
  onStateChange?: (state: ViewerState) => void;
}

export function Viewer({ observations, target, source, initial, onStateChange }: Props) {
  const t = useT(VIEWER);
  const lang = useLang();
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

  // Tell the Ask page what is on screen: identifiers only, the server looks up every value. The
  // last view is kept after the viewer closes, so the visitor can ask about it there.
  const sequenceKeys = useMemo(
    () => (sequence.length <= MAX_SEQUENCE_KEYS ? sequence.map((f) => f.key) : []),
    [sequence],
  );
  const frameKey = frame?.key ?? null;
  const refKey = refFrame?.key ?? null;
  const viewHref = useMemo(() => {
    const p = new URLSearchParams({ ra: target.ra.toFixed(6), dec: target.dec.toFixed(6), name: target.label });
    p.set("seq", spec.mode);
    p.set("det", String(spec.detector));
    if (spec.mode === "pass") p.set("pass", String(spec.passIndex));
    else if (spec.wavelengthUm != null) p.set("wl", spec.wavelengthUm.toFixed(4));
    if (frameId) p.set("f", frameId);
    if (refId) p.set("fa", refId);
    p.set("cmp", compare);
    p.set("fov", String(fov));
    if (source === "snapshot") p.set("source", "snapshot");
    return `/explore?${p.toString()}`;
  }, [target.ra, target.dec, target.label, spec, frameId, refId, compare, fov, source]);
  useEffect(() => {
    publishView({
      source,
      target: { ra: target.ra, dec: target.dec, name: target.label },
      frameKey,
      referenceKey: compare === "single" ? null : refKey,
      compare,
      fov,
      sequenceMode: spec.mode,
      sequenceKeys,
      frameIndex: cur,
      frameCount: count,
      detector: spec.detector,
      href: viewHref,
    });
  }, [source, target.ra, target.dec, target.label, frameKey, refKey, compare, fov, spec.mode, spec.detector, sequenceKeys, cur, count, viewHref]);

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

  const compat = frame && refFrame ? compatibility(refFrame, frame, lang) : null;

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
        {tag && <span className="font-semibold text-accent-on-image">{tag}</span>}
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
              {error instanceof ApiError ? error.message : t("frameFailed")}
            </p>
            {retry && (
              <button type="button" className="btn btn-secondary btn-sm !border-on-image !text-on-image" onClick={retry}>
                <RefreshCw size={14} aria-hidden /> {t("tryAgain")}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3 text-sm text-on-image" role="status">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-on-image/25 border-t-on-image motion-reduce:animate-none" />
            <p>{t("reading")}</p>
          </div>
        )}
      </div>
    );

  if (count === 0) {
    return (
      <div className="note">
        {t("noFrames", { detector: spec.detector })}
      </div>
    );
  }

  return (
    <section aria-label={t("viewer")} onKeyDown={onKeyDown} className="grid gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="min-w-0 space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="segmented max-[399px]:[&>button]:px-2.5" role="radiogroup" aria-label={t("comparison")}>
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={compare === m.id}
                aria-label={t(m.label)}
                title={t(m.hint)}
                onClick={() => setCompare(m.id)}
              >
                {m.short ? (
                  <>
                    <span className="min-[400px]:hidden">{t(m.short)}</span>
                    <span className="max-[399px]:hidden">{t(m.label)}</span>
                  </>
                ) : (
                  t(m.label)
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Link to="/ask" className="btn btn-secondary btn-sm">
              <MessageSquareText size={15} aria-hidden /> {t("ask")}
            </Link>
            <div className="flex items-center gap-1" role="group" aria-label={t("zoom")}>
              <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={t("zoomOut")} onClick={() => setView((v) => ({ ...v, zoom: Math.max(1, v.zoom / 1.5) }))}>
                <Minus size={16} aria-hidden />
              </button>
              <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={t("fit")} onClick={() => setView(fitView(size, size))}>
                <LocateFixed size={16} aria-hidden />
              </button>
              <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={t("zoomIn")} onClick={() => setView((v) => ({ ...v, zoom: Math.min(12, v.zoom * 1.5) }))}>
                <Plus size={16} aria-hidden />
              </button>
            </div>
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
                label={t("frameLabel", { tag, when: f ? `${formatDate(f.isoMid)} ${formatTime(f.isoMid)}` : "" })}
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
                ? t("diffLabel")
                : t("imageLabel", {
                    label: target.label,
                    when: mainFrame ? `${formatDate(mainFrame.isoMid)} ${formatTime(mainFrame.isoMid)}` : "",
                  })
            }
          >
            {compare === "diff" ? (
              <>
                <div className="pointer-events-none absolute left-2 top-2 rounded-sm bg-black/60 px-2 py-1 num text-xs text-on-image">
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
                  <p className="font-medium">{t("misleading")}</p>
                  {compat.reasons.map((r) => (
                    <p key={r} className="text-on-image/85">
                      {r}
                    </p>
                  ))}
                  <p className="text-on-image/85">{t("useBlink")}</p>
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
              {t("readout", { ra: formatRa(readoutSky.ra), dec: formatDec(readoutSky.dec) })}
              {readout && compare !== "diff" && (
                <>
                  {"  ·  "}
                  {readout.mask & 2 ? t("noData") : `${formatNumber(readout.value, 3)} MJy/sr`}
                  {readout.mask & 1 ? t("flaggedPixel") : ""}
                </>
              )}
            </>
          ) : touch ? (
            t("touchHint")
          ) : (
            t("mouseHint")
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
            {t("loaded", { frames: frameCount(lang, loaded), n: loaded.toLocaleString("en-US"), count })}
            {touch ? "" : t("keys")}
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
            {t("sequence")}
          </h2>
          <div className="segmented w-full [&>button]:flex-1" role="radiogroup" aria-label={t("sequenceType")}>
            {(
              [
                ["pass", "onePass"],
                ["wavelength", "oneWavelength"],
              ] as [SequenceMode, ViewerKey][]
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
                {t(label)}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted">
            {spec.mode === "pass"
              ? t("passNote")
              : t("wavelengthNote", { wavelength: formatWavelength(spec.wavelengthUm) })}
          </p>
          {spec.mode === "pass" && (
            <PassTrack passes={passes} selected={spec.passIndex} onSelect={(i) => changeSpec({ passIndex: i })} />
          )}
          <div className="space-y-2">
            <p className="text-sm text-muted">{t("band")}</p>
            <BandPicker counts={counts} detector={spec.detector} onChange={(d) => changeSpec({ detector: d, wavelengthUm: spec.mode === "wavelength" ? null : spec.wavelengthUm })} />
          </div>
          {spec.mode === "wavelength" && frame && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => changeSpec({ wavelengthUm: B?.payload.wavelength.atTargetUm ?? frame.wavelengthUm })}>
              {t("matchWavelength", { wavelength: formatWavelength(B?.payload.wavelength.atTargetUm ?? frame.wavelengthUm) })}
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
            {t("display")}
          </h2>
          <label className="flex items-center justify-between gap-3 text-sm text-muted">
            {t("fov")}
            <select className="field !min-h-9 !w-auto" value={fov} onChange={(e) => setFov(Number(e.target.value))}>
              {FIELDS.map((f) => (
                <option key={f} value={f}>
                  {f}° ({Math.round(f * 60)}′)
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center justify-between gap-3 text-sm text-muted">
            {t("stretch")}
            <select className="field !min-h-9 !w-auto" value={stretchKind} onChange={(e) => setStretchKind(e.target.value as StretchKind)}>
              <option value="asinh">{t("asinh")}</option>
              <option value="linear">{t("linear")}</option>
              <option value="log">{t("log")}</option>
            </select>
          </label>
          <label className="block text-sm text-muted">
            <span className="flex justify-between">
              {t("contrast")} <span className="num text-faint">{contrast.toFixed(2)}×</span>
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
            {t("showFlagged")}
          </label>
          <p className="text-xs text-faint">
            {t("sameStretch")}
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
  const t = useT(VIEWER);
  return (
    <div className="pointer-events-none absolute bottom-2 right-2 rounded-sm bg-black/60 px-2 py-1.5 text-[0.6875rem] text-on-image">
      <div className="flex items-center gap-2">
        <span>{t("fainter")}</span>
        <span className="h-2 w-24 rounded-[1px]" style={{ background: "linear-gradient(90deg, rgb(80 200 255), rgb(12 14 17), rgb(255 176 70))" }} />
        <span>{t("brighter")}</span>
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
  const t = useT(VIEWER);
  const lang = useLang();
  return (
    <section aria-label={t("comparison")} className="space-y-3 rounded-sm border border-rule p-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="font-semibold text-accent">A</dt>
        <dd className="num text-muted">
          {formatDate(a.isoMid)} {formatTime(a.isoMid)} · {formatWavelength(a.wavelengthUm)}
        </dd>
        <dt className="font-semibold text-accent">B</dt>
        <dd className="num text-muted">
          {formatDate(b.isoMid)} {formatTime(b.isoMid)} · {formatWavelength(b.wavelengthUm)}
        </dd>
      </dl>
      <p className="text-sm text-muted">
        {isSame ? (
          t("same")
        ) : (
          <>
            {t("apart", { gap: formatGap(compat.deltaDays, lang) })}
            {compat.deltaWavelengthUm != null && t("apartWavelength", { delta: Math.abs(compat.deltaWavelengthUm).toFixed(3) })}
            {t("stop")}{" "}
            {compat.ok ? t("closeEnough") : t("colours")}
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
          {t("how")}
        </summary>
        <p className="mt-2 text-sm text-muted">
          {t("howBody")}
        </p>
      </details>
      {!isSame && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onUseCurrent}>
          {t("useB")}
        </button>
      )}
    </section>
  );
}
