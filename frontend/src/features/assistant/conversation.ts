/**
 * The conversation on the Ask page. It lives outside React, so an answer keeps streaming while the
 * visitor follows one of its links, and the conversation is still there when they come back. It is
 * never saved: closing or reloading the tab ends it.
 */

import { useSyncExternalStore } from "react";

import { ApiError, type DataSource } from "../../lib/api";
import {
  type AssistantMode,
  type ChatMeta,
  type Grounding,
  historyFor,
  isAbort,
  MAX_QUESTION,
  streamChat,
  viewPayload,
} from "./stream";
import type { ViewContext } from "./viewContext";

export interface Turn {
  id: number;
  question: string;
  /** The view the question was asked about, if any. */
  about: string | null;
  answer: string;
  status: "gathering" | "writing" | "done" | "error" | "stopped";
  meta: ChatMeta | null;
  notice: string | null;
  error: string | null;
  grounding: Grounding | null;
  mode: AssistantMode | null;
}

let turns: Turn[] = [];
let nextId = 1;
let controller: AbortController | null = null;
const listeners = new Set<() => void>();

function emit(next: Turn[]): void {
  turns = next;
  for (const listener of listeners) listener();
}

function update(id: number, patch: Partial<Turn> | ((t: Turn) => Partial<Turn>)): void {
  emit(turns.map((t) => (t.id === id ? { ...t, ...(typeof patch === "function" ? patch(t) : patch) } : t)));
}

export function isBusy(list: Turn[] = turns): boolean {
  return list.some((t) => t.status === "gathering" || t.status === "writing");
}

/** Ask one question about the attached view (or none), from the given data source. */
export async function ask(text: string, view: ViewContext | null, source: DataSource): Promise<void> {
  const question = text.trim().slice(0, MAX_QUESTION);
  if (!question || isBusy()) return;
  const id = nextId++;
  const messages = historyFor(
    turns.filter((t) => t.status === "done").map((t) => ({ question: t.question, answer: t.answer })),
    question,
  );
  emit([
    ...turns,
    {
      id,
      question,
      about: view?.target.name ?? null,
      answer: "",
      status: "gathering",
      meta: null,
      notice: null,
      error: null,
      grounding: null,
      mode: null,
    },
  ]);
  const mine = new AbortController();
  controller = mine;
  try {
    await streamChat(
      messages,
      viewPayload("ask", view),
      source,
      {
        meta: (meta) => update(id, { meta, mode: meta.mode, status: "writing" }),
        notice: (message) => update(id, { notice: message }),
        delta: (piece) => update(id, (t) => ({ answer: t.answer + piece })),
        done: (done) => update(id, { status: "done", grounding: done.grounding, mode: done.mode }),
        error: (message) => update(id, { status: "error", error: message }),
      },
      mine.signal,
    );
    update(id, (t) =>
      t.status === "gathering" || t.status === "writing"
        ? { status: "error", error: "The answer was cut off. Try asking again." }
        : {},
    );
  } catch (err) {
    if (isAbort(err)) update(id, { status: "stopped" });
    else update(id, { status: "error", error: err instanceof ApiError ? err.message : "Something went wrong. Try again." });
  } finally {
    if (controller === mine) controller = null;
  }
}

export function stop(): void {
  controller?.abort();
}

export function clear(): void {
  if (!isBusy()) emit([]);
}

/** For tests. */
export function resetConversation(): void {
  controller?.abort();
  controller = null;
  emit([]);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getTurns = () => turns;

export function useConversation(): Turn[] {
  return useSyncExternalStore(subscribe, getTurns, getTurns);
}
