import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { BODIES, BODY_ORDER, type SelectableId } from "./bodies";
import { fitCanvas, observeSize, useInView, usePrefersReducedMotion } from "./motion";
import { ELEMENTS, heliocentric, julianDate, type ViewId } from "./orbits";
import { type Camera, createScene, drawScene, type Hit } from "./orreryScene";

const SPEEDS = [
  { id: "day", label: "1 day/s", days: 1 },
  { id: "week", label: "1 week/s", days: 7 },
  { id: "month", label: "1 month/s", days: 30.44 },
  { id: "year", label: "1 year/s", days: 365.25 },
] as const;

type SpeedId = (typeof SPEEDS)[number]["id"];

const VIEW_OPTIONS: Array<{ id: ViewId; label: string }> = [
  { id: "inner", label: "Inner planets" },
  { id: "whole", label: "Whole system" },
];

// The planetary elements are valid from 1800 to 2050; past that, time wraps back to today.
const JD_MAX = julianDate(Date.UTC(2050, 0, 1));

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatJd(jd: number): string {
  return dateFormat.format(new Date((jd - 2440587.5) * 86_400_000));
}

function distanceText(id: SelectableId, jd: number): string {
  if (id === "sun") return "At the centre, holding everything else in orbit.";
  const r = heliocentric(ELEMENTS[id], jd).r;
  return `${r.toFixed(2)} au from the Sun on this date`;
}

export function Orrery() {
  const reduced = usePrefersReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dateRef = useRef<HTMLSpanElement>(null);
  const distRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const inView = useInView(wrapRef);

  const [playing, setPlaying] = useState(!reduced);
  const [speed, setSpeed] = useState<SpeedId>("month");
  const [view, setView] = useState<ViewId>("whole");
  const [selected, setSelected] = useState<SelectableId | null>("earth");
  const [hovered, setHovered] = useState<SelectableId | null>(null);
  const [startJd] = useState(() => julianDate(Date.now()));

  // Everything the animation loop reads lives here, so the loop never restarts on a control change.
  const sim = useRef({
    jd: startJd,
    cam: { yaw: -0.6, elev: 0.95, mix: 1 } as Camera,
    playing,
    days: 30.44,
    view,
    selected,
    hovered,
    reduced,
  });

  useEffect(() => {
    const s = sim.current;
    s.playing = playing;
    s.days = SPEEDS.find((o) => o.id === speed)?.days ?? 30.44;
    s.view = view;
    s.selected = selected;
    s.hovered = hovered;
    s.reduced = reduced;
  }, [playing, speed, view, selected, hovered, reduced]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // Off screen we draw one still frame so the sketch is there when it scrolls in.
    const animate = inView;
    const s = sim.current;
    const scene = createScene(s.jd);
    let size = fitCanvas(canvas);
    let hits: Hit[] = [];
    let hoverId: SelectableId | null = null;
    let drag: { x: number; y: number; moved: number } | null = null;
    let raf = 0;
    let last = performance.now();
    const t0 = last;

    const stopSize = observeSize(canvas, () => {
      size = fitCanvas(canvas);
    });

    const hitAt = (px: number, py: number): SelectableId | null => {
      let best: SelectableId | null = null;
      let bestD = Infinity;
      for (const h of hits) {
        const d = Math.hypot(h.x - px, h.y - py);
        if (d < h.r + 10 && d < bestD) {
          best = h.id;
          bestD = d;
        }
      }
      return best;
    };

    const local = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onDown = (e: PointerEvent) => {
      drag = { ...local(e), moved: 0 };
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = "grabbing";
    };

    const onMove = (e: PointerEvent) => {
      const p = local(e);
      if (drag) {
        const dx = p.x - drag.x;
        const dy = p.y - drag.y;
        drag.moved += Math.abs(dx) + Math.abs(dy);
        s.cam.yaw += dx * 0.006;
        s.cam.elev = Math.min(1.45, Math.max(0.28, s.cam.elev - dy * 0.005));
        drag.x = p.x;
        drag.y = p.y;
        return;
      }
      const id = hitAt(p.x, p.y);
      canvas.style.cursor = id ? "pointer" : "grab";
      if (id !== hoverId) {
        hoverId = id;
        setHovered(id);
      }
    };

    const onUp = (e: PointerEvent) => {
      if (drag && drag.moved < 6) {
        const p = local(e);
        const id = hitAt(p.x, p.y);
        if (id) setSelected(id);
      }
      drag = null;
      canvas.style.cursor = hoverId ? "pointer" : "grab";
    };

    const onLeave = () => {
      if (drag) return;
      hoverId = null;
      setHovered(null);
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("pointerleave", onLeave);

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = (now - t0) / 1000;

      if (s.playing) {
        s.jd += dt * s.days;
        if (s.jd > JD_MAX) s.jd = julianDate(Date.now());
      }
      if (!drag && !s.reduced) s.cam.yaw += dt * 0.025;
      const target = s.view === "inner" ? 0 : 1;
      s.cam.mix += (target - s.cam.mix) * Math.min(1, dt * (s.reduced ? 60 : 3.5));

      ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
      hits = drawScene(ctx, scene, size.width, size.height, s.cam, {
        jd: s.jd,
        t: s.reduced ? 0 : t,
        boil: s.reduced ? 0 : Math.floor(t * 6),
        selected: s.selected,
        hovered: s.hovered,
      });

      const date = formatJd(s.jd);
      if (dateRef.current && dateRef.current.textContent !== date) dateRef.current.textContent = date;
      const dist = s.selected ? distanceText(s.selected, s.jd) : "";
      if (distRef.current && distRef.current.textContent !== dist) distRef.current.textContent = dist;
      const tip = tipRef.current;
      const h = s.hovered ? hits.find((x) => x.id === s.hovered) : undefined;
      if (tip) {
        tip.style.opacity = h ? "1" : "0";
        if (h) tip.style.transform = `translate(${Math.round(h.x + h.r + 10)}px, ${Math.round(h.y + h.r + 4)}px)`;
      }

      if (animate && !document.hidden) raf = requestAnimationFrame(frame);
    };

    const onVisibility = () => {
      if (animate && !document.hidden) {
        cancelAnimationFrame(raf);
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    if (animate) raf = requestAnimationFrame(frame);
    else frame(performance.now());

    return () => {
      cancelAnimationFrame(raf);
      stopSize();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, [inView]);

  const resetToToday = () => {
    sim.current.jd = julianDate(Date.now());
  };

  const info = selected ? BODIES[selected] : null;

  return (
    <div ref={wrapRef} className="flex flex-col gap-4">
      <div className="relative">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="An animated pencil sketch of the Sun, the eight planets, the asteroid belt and the asteroid (7) Iris on their orbits, shown at their approximate positions for the date above. Drag to turn the view."
          className="block h-[clamp(20rem,52vw,34rem)] w-full cursor-grab touch-pan-y select-none"
        />
        <div className="pointer-events-none absolute left-3 top-2 flex flex-col">
          <span className="hand text-[1.6rem] text-text" ref={dateRef} aria-live="off">
            {formatJd(startJd)}
          </span>
          <span className="text-xs text-faint">Planet positions for this date · sizes not to scale</span>
        </div>
        <div
          ref={tipRef}
          aria-hidden="true"
          className="hand pointer-events-none absolute left-0 top-0 rounded-md bg-raised/90 px-2 py-0.5 text-lg text-text opacity-0 shadow-sketch-sm transition-opacity"
        >
          {hovered ? `${BODIES[hovered].name} · click to learn more` : ""}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-secondary btn-sm btn-icon"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? "Pause the planets" : "Play the planets"}
          aria-pressed={playing}
        >
          {playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
        </button>
        <div className="segmented" role="group" aria-label="Speed">
          {SPEEDS.map((o) => (
            <button key={o.id} type="button" aria-pressed={speed === o.id} onClick={() => setSpeed(o.id)}>
              {o.label}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={resetToToday}>
          <RotateCcw size={14} aria-hidden /> Today
        </button>
        <div className="segmented sm:ms-auto" role="group" aria-label="Zoom">
          {VIEW_OPTIONS.map((o) => (
            <button key={o.id} type="button" aria-pressed={view === o.id} onClick={() => setView(o.id)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_minmax(0,17rem)]">
        <div role="group" aria-label="Pick a body to read about" className="flex flex-wrap content-start gap-2">
          {(["sun", ...BODY_ORDER] as SelectableId[]).map((id) => (
            <button
              key={id}
              type="button"
              className="chip"
              aria-pressed={selected === id}
              onClick={() => setSelected(id)}
            >
              <span
                aria-hidden="true"
                className="inline-block size-2.5 rounded-full border border-text/70"
                style={{ background: BODIES[id].color }}
              />
              {BODIES[id].name}
            </button>
          ))}
        </div>
        <div aria-live="polite" className="sheet sheet-alt px-4 py-3">
          {info ? (
            <>
              <p className="font-display text-xl text-text">{info.name}</p>
              <p className="mt-1 text-sm text-muted">{info.fact}</p>
              <p className="mt-2 text-xs text-faint">
                {info.year ? <>One orbit: {info.year}. </> : null}
                <span ref={distRef} />
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">Pick a planet to read about it.</p>
          )}
        </div>
      </div>
    </div>
  );
}
