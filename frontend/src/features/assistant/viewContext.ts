import { useSyncExternalStore } from "react";

import type { DataSource } from "../../lib/api";

/**
 * What the visitor has on screen, for the assistant. Identifiers only (a position, archive keys,
 * the comparison mode): the server looks up every measurement itself and never trusts numbers
 * sent by the browser.
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
}

/** The known-object and moving-source routes accept at most this many frames. */
export const MAX_SEQUENCE_KEYS = 60;

let current: ViewContext | null = null;
const listeners = new Set<() => void>();

/** Called by the viewer whenever what is on screen changes, and with null when it goes away. */
export function publishView(view: ViewContext | null): void {
  current = view;
  for (const listener of listeners) listener();
}

export function currentView(): ViewContext | null {
  return current;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useViewContext(): ViewContext | null {
  return useSyncExternalStore(subscribe, currentView, currentView);
}
