import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { type Lang, translate, useLang, useT } from "../../lib/i18n";
import { BODIES, BODY_ORDER, type SelectableId } from "./bodies";
import { BODY_NAMES, bodyText, ORRERY } from "./messages";
import { fitCanvas, observeSize, useInView, usePrefersReducedMotion } from "./motion";
import { ELEMENTS, heliocentric, julianDate, type ViewId } from "./orbits";
import { type Camera, createScene, drawScene, type Hit } from "./orreryScene";
import { PlanetPortrait } from "./PlanetPortrait";
import { usePalette } from "./theme";

const SPEEDS = [
  { id: "day", days: 1 },
  { id: "week", days: 7 },
  { id: "month", days: 30.44 },
  { id: "year", days: 365.25 },
] as const;

type SpeedId = (typeof SPEEDS)[number]["id"];

// Each view's label is the message of the same name.
const VIEW_OPTIONS: ViewId[] = ["inner", "whole"];

// The planetary elements are valid from 1800 to 2050; past that, time wraps back to today.
const JD_MAX = julianDate(Date.UTC(2050, 0, 1));

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function formatJd(jd: number): string {
  return dateFormat.format(new Date((jd - 2440587.5) * 86_400_000));
}

function distanceText(id: SelectableId, jd: number, lang: Lang = "en"): string {
  if (id === "sun") return translate(ORRERY, lang, "sunCentre");
  const r = heliocentric(ELEMENTS[id], jd).r;
  return translate(ORRERY, lang, "distance", { r: r.toFixed(2) });
}

export function Orrery() {
  const reduced = usePrefersReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dateRef = useRef<HTMLSpanElement>(null);
  const distRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const inView = useInView(wrapRef);
  const pal = usePalette();
  const lang = useLang();
  const t = useT(ORRERY);

  const [playing, setPlaying] = useState(!reduced);
  const [speed, setSpeed] = useState<SpeedId>("month");
  const [view, setView] = useState<ViewId>("whole");
  const [selected, setSelected] = useState<SelectableId>("earth");
  const [hovered, setHovered] = useState<SelectableId | null>(null);
  const [startJd] = useState(() => julianDate(Date.now()));

  // Everything the animation loop reads lives here, so the loop never restarts on a control change.
  const sim = useRef({
    jd: startJd,
    cam: { az: -1.95, el: 0.9, mix: 1 } as Camera,
    playing,
    days: 30.44,
    view,
    selected: selected as SelectableId | null,
    hovered,
    reduced,
    pal,
    lang,
  });

  useEffect(() => {
    const s = sim.current;
    s.playing = playing;
    s.days = SPEEDS.find((o) => o.id === speed)?.days ?? 30.44;
    s.view = view;
    s.selected = selected;
    s.hovered = hovered;
    s.reduced = reduced;
    s.pal = pal;
    s.lang = lang;
  }, [playing, speed, view, selected, hovered, reduced, pal, lang]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // Off screen we draw one still frame so the picture is there when it scrolls in.
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
        s.cam.az -= dx * 0.006;
        s.cam.el = Math.min(1.45, Math.max(0.25, s.cam.el - dy * 0.005));
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
      if (!drag && !s.reduced) s.cam.az -= dt * 0.015;
      const target = s.view === "inner" ? 0 : 1;
      s.cam.mix += (target - s.cam.mix) * Math.min(1, dt * (s.reduced ? 60 : 3.5));

      ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
      hits = drawScene(ctx, scene, size.width, size.height, s.cam, {
        jd: s.jd,
        t: s.reduced ? 4 : t,
        dpr: size.dpr,
        pal: s.pal,
        selected: s.selected,
        hovered: s.hovered,
        names: BODY_NAMES[s.lang],
      });

      const date = formatJd(s.jd);
      if (dateRef.current && dateRef.current.textContent !== date) dateRef.current.textContent = date;
      const dist = s.selected ? distanceText(s.selected, s.jd, s.lang) : "";
      if (distRef.current && distRef.current.textContent !== dist) distRef.current.textContent = dist;
      const tip = tipRef.current;
      const h = s.hovered ? hits.find((x) => x.id === s.hovered) : undefined;
      if (tip) {
        tip.style.opacity = h ? "1" : "0";
        if (h) tip.style.transform = `translate(${Math.round(h.x + h.r + 12)}px, ${Math.round(h.y + h.r + 6)}px)`;
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
    // `pal` and `lang` are read through the ref every frame; they are listed so an off-screen still
    // frame redraws too.
  }, [inView, pal, lang]);

  const resetToToday = () => {
    sim.current.jd = julianDate(Date.now());
  };

  const info = bodyText(selected, lang);

  return (
    <div ref={wrapRef} className="flex flex-col gap-5">
      <div className="relative">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={t("canvas")}
          className="block h-[clamp(18rem,50vw,36rem)] w-full cursor-grab touch-pan-y select-none"
        />
        <div className="pointer-events-none absolute left-1 top-0 flex flex-col gap-1">
          <span className="kicker">{t("on")}</span>
          <span className="font-display text-[1.9rem] leading-none text-text" ref={dateRef} aria-live="off">
            {formatJd(startJd)}
          </span>
        </div>
        <p className="pointer-events-none absolute right-1 top-0 hidden max-w-[13rem] text-right text-xs text-faint sm:block">
          {t("note")}
        </p>
        <div
          ref={tipRef}
          aria-hidden="true"
          className="glass pointer-events-none absolute left-0 top-0 rounded-full px-3 py-1 text-xs font-medium text-text opacity-0 transition-opacity"
        >
          {hovered ? t("tip", { name: bodyText(hovered, lang).name }) : ""}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-secondary btn-sm btn-icon"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? t("pause") : t("play")}
          aria-pressed={playing}
        >
          {playing ? <Pause size={15} aria-hidden /> : <Play size={15} aria-hidden />}
        </button>
        <div className="flex items-center gap-2">
          <div className="segmented" role="group" aria-label={t("speeds")}>
            {SPEEDS.map((o) => (
              <button key={o.id} type="button" aria-pressed={speed === o.id} onClick={() => setSpeed(o.id)}>
                {t(o.id)}
              </button>
            ))}
          </div>
          <span className="text-xs text-faint">{t("perSecond")}</span>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={resetToToday}>
          <RotateCcw size={14} aria-hidden /> {t("today")}
        </button>
        <div className="segmented sm:ms-auto" role="group" aria-label={t("zoom")}>
          {VIEW_OPTIONS.map((o) => (
            <button key={o} type="button" aria-pressed={view === o} onClick={() => setView(o)}>
              {t(o)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,21rem)] md:items-start">
        <div role="group" aria-label={t("pick")} className="flex flex-wrap content-start gap-2">
          {(["sun", ...BODY_ORDER] as SelectableId[]).map((id) => (
            <button
              key={id}
              type="button"
              className="chip"
              aria-pressed={selected === id}
              onClick={() => setSelected(id)}
            >
              <span aria-hidden="true" className="swatch" style={{ background: BODIES[id].color }} />
              {bodyText(id, lang).name}
            </button>
          ))}
        </div>
        <div aria-live="polite" className="card flex items-center gap-4 p-4">
          <PlanetPortrait key={selected} id={selected} className="size-28 shrink-0" />
          <div className="min-w-0">
            <p className="font-display text-2xl leading-tight text-text">{info.name}</p>
            <p className="mt-1 text-sm text-muted">{info.fact}</p>
            <p className="mt-2 text-xs text-faint">
              {info.year ? t("oneOrbit", { year: info.year }) : null}
              <span ref={distRef} />
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
