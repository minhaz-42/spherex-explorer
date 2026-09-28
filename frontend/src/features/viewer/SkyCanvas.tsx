import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { fitView, MAX_ZOOM, MIN_ZOOM, type Rendered, type ViewState } from "./view";


interface Props {
  image: Rendered | null;
  /** Grid size, used before the first image arrives so overlays and fit are stable. */
  size: number;
  view: ViewState;
  onViewChange: (view: ViewState) => void;
  /** Drawn in image pixel coordinates (x right, y down), above the image. */
  overlay?: (scale: number) => ReactNode;
  /** Pointer position in image pixels, or null when it leaves. */
  onHover?: (point: { x: number; y: number } | null) => void;
  label: string;
  /** Drawn in screen space (fixed size), given the current screen pixels per image pixel. */
  hud?: (scale: number) => ReactNode;
  children?: ReactNode;
}

/**
 * A square sky image with zoom (wheel, pinch, buttons, keyboard) and drag to pan.
 *
 * Pixels are drawn without smoothing: each SPHEREx pixel is 6.15″ and the viewer shows it as a
 * square, so nothing finer than the data is implied.
 */
export function SkyCanvas({ image, size, view, onViewChange, overlay, onHover, label, hud, children }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const source = useRef<HTMLCanvasElement | null>(null);
  const [box, setBox] = useState(0);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; dist: number; zoom: number } | null>(null);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => setBox(Math.floor(el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = box > 0 ? (box / size) * view.zoom : 1;

  useEffect(() => {
    if (!image) return;
    let src = source.current;
    if (!src) {
      src = document.createElement("canvas");
      source.current = src;
    }
    src.width = image.width;
    src.height = image.height;
    const sctx = src.getContext("2d");
    if (!sctx) return;
    // Copy into a fresh buffer: ImageData needs an ArrayBuffer-backed array of its own.
    const data = new ImageData(new Uint8ClampedArray(image.rgba), image.width, image.height);
    sctx.putImageData(data, 0, 0);
  }, [image]);

  useEffect(() => {
    const el = canvas.current;
    if (!el || box === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    el.width = Math.round(box * dpr);
    el.height = Math.round(box * dpr);
    const ctx = el.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, el.width, el.height);
    if (!image || !source.current) return;
    ctx.imageSmoothingEnabled = false;
    const s = scale * dpr;
    const ox = (box / 2 - view.cx * scale) * dpr;
    const oy = (box / 2 - view.cy * scale) * dpr;
    ctx.drawImage(source.current, ox, oy, image.width * s, image.height * s);
  }, [image, box, scale, view.cx, view.cy]);

  const clamp = useCallback(
    (v: ViewState): ViewState => {
      const zoom = Math.min(Math.max(v.zoom, MIN_ZOOM), MAX_ZOOM);
      const half = size / (2 * zoom);
      const cx = Math.min(Math.max(v.cx, half), size - half);
      const cy = Math.min(Math.max(v.cy, half), size - half);
      return { zoom, cx, cy };
    },
    [size],
  );

  const toImage = (clientX: number, clientY: number) => {
    const rect = wrap.current!.getBoundingClientRect();
    return {
      x: view.cx + (clientX - rect.left - box / 2) / scale,
      y: view.cy + (clientY - rect.top - box / 2) / scale,
    };
  };

  const zoomAbout = (factor: number, clientX?: number, clientY?: number) => {
    const zoom = Math.min(Math.max(view.zoom * factor, MIN_ZOOM), MAX_ZOOM);
    if (clientX === undefined || clientY === undefined) {
      onViewChange(clamp({ ...view, zoom }));
      return;
    }
    const p = toImage(clientX, clientY);
    const rect = wrap.current!.getBoundingClientRect();
    const newScale = (box / size) * zoom;
    onViewChange(
      clamp({
        zoom,
        cx: p.x - (clientX - rect.left - box / 2) / newScale,
        cy: p.y - (clientY - rect.top - box / 2) / newScale,
      }),
    );
  };

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015));
      zoomAbout(factor, e.clientX, e.clientY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    const dist = pts.length >= 2 ? Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y) : 0;
    drag.current = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy, dist, zoom: view.zoom };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (onHover && box > 0 && e.pointerType === "mouse") {
      const p = toImage(e.clientX, e.clientY);
      onHover(p.x >= 0 && p.y >= 0 && p.x < size && p.y < size ? p : null);
    }
    if (!pointers.current.has(e.pointerId) || !drag.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length >= 2 && drag.current.dist > 0) {
      const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
      onViewChange(clamp({ ...view, zoom: drag.current.zoom * (dist / drag.current.dist) }));
      return;
    }
    const dx = (e.clientX - drag.current.x) / scale;
    const dy = (e.clientY - drag.current.y) / scale;
    onViewChange(clamp({ zoom: view.zoom, cx: drag.current.cx - dx, cy: drag.current.cy - dy }));
  };

  const endPointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) drag.current = null;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = size / (8 * view.zoom);
    const actions: Record<string, () => void> = {
      "+": () => zoomAbout(1.5),
      "=": () => zoomAbout(1.5),
      "-": () => zoomAbout(1 / 1.5),
      "0": () => onViewChange(fitView(size, size)),
      w: () => onViewChange(clamp({ ...view, cy: view.cy - step })),
      s: () => onViewChange(clamp({ ...view, cy: view.cy + step })),
      a: () => onViewChange(clamp({ ...view, cx: view.cx - step })),
      d: () => onViewChange(clamp({ ...view, cx: view.cx + step })),
    };
    const act = actions[e.key];
    if (act) {
      e.preventDefault();
      act();
    }
  };

  return (
    <div
      ref={wrap}
      className="relative aspect-square w-full touch-none select-none overflow-hidden rounded-sm bg-[var(--bg-image,var(--bg-sunk))] outline-offset-2 focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
      style={{ cursor: view.zoom > 1 ? "grab" : "crosshair" }}
      role="img"
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onPointerLeave={() => onHover?.(null)}
      onDoubleClick={(e) => zoomAbout(2, e.clientX, e.clientY)}
    >
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-hidden="true" />
      {overlay && box > 0 && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${box} ${box}`} aria-hidden="true">
          <g transform={`translate(${box / 2 - view.cx * scale} ${box / 2 - view.cy * scale}) scale(${scale})`}>
            {overlay(scale)}
          </g>
        </svg>
      )}
      {hud && box > 0 && hud(scale)}
      {children}
    </div>
  );
}
