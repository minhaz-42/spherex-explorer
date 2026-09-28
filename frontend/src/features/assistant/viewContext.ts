import { useSyncExternalStore } from "react";

import type { DataSource } from "../../lib/api";

/**
 * What the visitor has, or last had, on screen in the viewer, for the Ask page. Identifiers only
 * (a position, archive keys, the comparison mode): the server looks up every measurement itself
 * and never trusts numbers sent by the browser.
 */
export interface ViewContext {
  source: DataSource;
  target: { ra: number; dec: number; name: string | null };
  frameKey: string | null;
  referenceKey: string | null;
  compare: "single" | "blink" | "side" | "diff";
  fov: number;
  sequenceMode: "pass" | "wavelength";
  /** The frames of the sequence on screen; empty when there are more than the server accepts. */
  sequenceKeys: string[];
  frameIndex: number;
  frameCount: number;
  /** Detector of the sequence, for the label on the Ask page. */
  detector: number;
  /** A link back to exactly this view. */
  href: string;
}

/** The known-object and moving-source routes accept at most this many frames. */
export const MAX_SEQUENCE_KEYS = 60;

interface Store {
  /** The most recent view, kept after the viewer closes so the Ask page can ask about it. */
  view: ViewContext | null;
  /** The data source the visitor was last using, kept even when the view is set aside. */
  source: DataSource;
}

let store: Store = { view: null, source: "live" };
const listeners = new Set<() => void>();

function emit(next: Store): void {
  store = next;
  for (const listener of listeners) listener();
}

/** Called by the viewer whenever what is on screen changes. */
export function publishView(view: ViewContext): void {
  emit({ view, source: view.source });
}

/** The visitor chose not to ask about the last view. */
export function forgetView(): void {
  emit({ ...store, view: null });
}

export function currentView(): ViewContext | null {
  return store.view;
}

export function lastSource(): DataSource {
  return store.source;
}

/** For tests. */
export function resetViewContext(): void {
  emit({ view: null, source: "live" });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getStore = () => store;

export function useViewStore(): Store {
  return useSyncExternalStore(subscribe, getStore, getStore);
}

const COMPARE: Record<ViewContext["compare"], string> = {
  single: "one frame",
  blink: "blinking A and B",
  side: "A and B side by side",
  diff: "difference of A and B",
};

/** "frame 10 of 19 · detector 2 · blinking A and B · demo snapshot" */
export function describeView(view: ViewContext): string {
  const parts = [`frame ${view.frameIndex + 1} of ${view.frameCount}`, `detector ${view.detector}`, COMPARE[view.compare]];
  if (view.source === "snapshot") parts.push("demo snapshot");
  return parts.join(" · ");
}
