import { useSyncExternalStore } from "react";

/**
 * English (the default) or Bangla. The choice lives on <html lang> and in localStorage; public/theme.js
 * applies a saved choice (or `?lang=bn`) before the first paint.
 *
 * Messages sit next to the components that use them, one `defineMessages({ en, bn })` per feature,
 * and TypeScript refuses a Bangla table that misses or adds a key. Numbers and units stay in Western
 * digits in both languages, as data tables in Bangladesh usually print them.
 */
export type Lang = "en" | "bn";

export const LANG_KEY = "spherex-lang";
const EVENT = "spherex-lang-change";

export function currentLang(): Lang {
  return typeof document !== "undefined" && document.documentElement.lang === "bn" ? "bn" : "en";
}

export function setLang(lang: Lang): void {
  document.documentElement.lang = lang;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // Storage can be unavailable (private windows, blocked site data); the choice then lasts for the visit.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, currentLang, () => "en");
}

export type Vars = Record<string, string | number>;

export interface Messages<K extends string> {
  en: Record<K, string>;
  bn: Record<K, string>;
}

/**
 * Bangla attaches case endings with a hyphen ("SPHEREx-এর", "2025-এ"), and browsers may break a line
 * after it, stranding "এর" at the start of the next line. An invisible word joiner (U+2060) after
 * each hyphen that runs into a Bangla letter keeps the two together.
 */
export function joinHyphens(text: string): string {
  return text.replace(/-(?=[\u0980-\u09FF])/g, "-\u2060");
}

/**
 * A feature's messages in both languages; both tables must have exactly the same keys. The Bangla
 * table gets `joinHyphens` once, here, so every feature's line breaks behave the same.
 */
export function defineMessages<K extends string>(messages: Messages<K>): Messages<K> {
  const bn = Object.fromEntries(Object.entries<string>(messages.bn).map(([k, v]) => [k, joinHyphens(v)]));
  return { en: messages.en, bn: bn as Record<K, string> };
}

/** Fills `{name}` placeholders. A missing variable is left visible, so it is caught in review. */
export function format(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (all, name: string) => (name in vars ? String(vars[name]) : all));
}

/** Looks up a message outside React (for canvas labels, exports and plain functions). */
export function translate<K extends string>(messages: Messages<K>, lang: Lang, key: K, vars?: Vars): string {
  return format(messages[lang][key], vars);
}

/** The translator for a feature's messages in the current language; re-renders when it changes. */
export function useT<K extends string>(messages: Messages<K>): (key: K, vars?: Vars) => string {
  const lang = useLang();
  return (key, vars) => format(messages[lang][key], vars);
}
