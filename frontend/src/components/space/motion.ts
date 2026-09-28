import { type RefObject, useEffect, useState, useSyncExternalStore } from "react";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void): () => void {
  const query = typeof window.matchMedia === "function" ? window.matchMedia(REDUCED_MOTION) : null;
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
}

function readReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(REDUCED_MOTION).matches;
}

/** True when the visitor has asked the system for less motion. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, readReducedMotion, () => false);
}

const canObserve = typeof IntersectionObserver !== "undefined";

/**
 * True while the element is on screen. Animations use it to stop drawing when scrolled away.
 * Without IntersectionObserver (old browsers, tests) the element counts as always visible.
 */
export function useInView(ref: RefObject<Element | null>, { once = false, margin = "80px" } = {}): boolean {
  const [inView, setInView] = useState(!canObserve);

  useEffect(() => {
    const el = ref.current;
    if (!el || !canObserve) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        setInView(entry.isIntersecting);
        if (entry.isIntersecting && once) observer.disconnect();
      },
      { rootMargin: margin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, once, margin]);

  return inView;
}

/** Keeps a canvas's backing store matched to its CSS size and the screen's pixel density. */
export function fitCanvas(canvas: HTMLCanvasElement, maxDpr = 2): { width: number; height: number; dpr: number } {
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const w = Math.max(1, Math.round(width * dpr));
  const h = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return { width, height, dpr };
}

/** Calls `onResize` whenever the element changes size (once immediately where unsupported). */
export function observeSize(el: Element, onResize: () => void): () => void {
  if (typeof ResizeObserver === "undefined") {
    onResize();
    return () => {};
  }
  const observer = new ResizeObserver(onResize);
  observer.observe(el);
  return () => observer.disconnect();
}
