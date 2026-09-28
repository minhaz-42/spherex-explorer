/**
 * Chats on the Ask page, like a chat app's history: several conversations, newest first, kept in
 * this browser's local storage so the visitor can come back to them. They are never sent to or
 * stored on the server, apart from the question being answered, and the visitor can delete them.
 *
 * The store lives outside React, so an answer keeps streaming while the visitor opens another chat
 * or follows one of the answer's links.
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
  id: string;
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
  askedAt: number;
}

export interface Chat {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  turns: Turn[];
}

export const STORAGE_KEY = "spherex-explorer.chats.v1";
const MAX_CHATS = 50;
const TITLE_CHARS = 60;

function newId(): string {
  return globalThis.crypto?.randomUUID?.().slice(0, 12) ?? Math.random().toString(36).slice(2, 14);
}

function titleFor(question: string): string {
  const q = question.replace(/\s+/g, " ").trim();
  return q.length > TITLE_CHARS ? `${q.slice(0, TITLE_CHARS - 1).trimEnd()}…` : q;
}

function isChat(value: unknown): value is Chat {
  const c = value as Chat;
  return !!c && typeof c.id === "string" && typeof c.title === "string" && Array.isArray(c.turns);
}

function load(): Chat[] {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    // An answer that was still arriving when the tab closed is kept as stopped.
    return parsed.filter(isChat).map((c) => ({
      ...c,
      turns: c.turns.map((t) => (t.status === "gathering" || t.status === "writing" ? { ...t, status: "stopped" } : t)),
    }));
  } catch {
    return [];
  }
}

let chats: Chat[] = load();
let controller: AbortController | null = null;
const listeners = new Set<() => void>();

function save(): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(chats.slice(0, MAX_CHATS)));
  } catch {
    // Private windows and full storage: the chats still work for this visit.
  }
}

function emit(next: Chat[], persist = false): void {
  chats = [...next].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_CHATS);
  if (persist) save();
  for (const listener of listeners) listener();
}

function updateTurn(chatId: string, turnId: string, patch: Partial<Turn> | ((t: Turn) => Partial<Turn>), persist = false): void {
  emit(
    chats.map((c) =>
      c.id !== chatId
        ? c
        : {
            ...c,
            turns: c.turns.map((t) => (t.id === turnId ? { ...t, ...(typeof patch === "function" ? patch(t) : patch) } : t)),
          },
    ),
    persist,
  );
}

export function isBusy(list: Chat[] = chats): boolean {
  return list.some((c) => c.turns.some((t) => t.status === "gathering" || t.status === "writing"));
}

/**
 * Ask a question in a chat (a new one when ``chatId`` is null) about the attached view, if any.
 * Returns the chat's id at once; the answer streams into the store.
 */
export function ask(chatId: string | null, text: string, view: ViewContext | null, source: DataSource): string | null {
  const question = text.trim().slice(0, MAX_QUESTION);
  if (!question || isBusy()) return null;
  const now = Date.now();
  let chat = chatId ? chats.find((c) => c.id === chatId) : undefined;
  if (!chat) chat = { id: chatId ?? newId(), title: titleFor(question), createdAt: now, updatedAt: now, turns: [] };
  const messages = historyFor(
    chat.turns.filter((t) => t.status === "done").map((t) => ({ question: t.question, answer: t.answer })),
    question,
  );
  const turn: Turn = {
    id: newId(),
    question,
    about: view?.target.name ?? null,
    answer: "",
    status: "gathering",
    meta: null,
    notice: null,
    error: null,
    grounding: null,
    mode: null,
    askedAt: now,
  };
  const id = chat.id;
  emit([{ ...chat, updatedAt: now, turns: [...chat.turns, turn] }, ...chats.filter((c) => c.id !== id)], true);
  void run(id, turn.id, messages, view, source);
  return id;
}

async function run(
  chatId: string,
  turnId: string,
  messages: ReturnType<typeof historyFor>,
  view: ViewContext | null,
  source: DataSource,
): Promise<void> {
  const mine = new AbortController();
  controller = mine;
  const set = (patch: Partial<Turn> | ((t: Turn) => Partial<Turn>), persist = false) => updateTurn(chatId, turnId, patch, persist);
  try {
    await streamChat(
      messages,
      viewPayload("ask", view),
      source,
      {
        meta: (meta) => set({ meta, mode: meta.mode, status: "writing" }),
        notice: (message) => set({ notice: message }),
        delta: (piece) => set((t) => ({ answer: t.answer + piece })),
        done: (done) => set({ status: "done", grounding: done.grounding, mode: done.mode }, true),
        error: (message) => set({ status: "error", error: message }, true),
      },
      mine.signal,
    );
    set(
      (t) => (t.status === "gathering" || t.status === "writing" ? { status: "error", error: "The answer was cut off. Try asking again." } : {}),
      true,
    );
  } catch (err) {
    if (isAbort(err)) set({ status: "stopped" }, true);
    else set({ status: "error", error: err instanceof ApiError ? err.message : "Something went wrong. Try again." }, true);
  } finally {
    if (controller === mine) controller = null;
  }
}

/** Ask the last question of a chat again, replacing its answer. */
export function regenerate(chatId: string, view: ViewContext | null, source: DataSource): void {
  const chat = chats.find((c) => c.id === chatId);
  const last = chat?.turns.at(-1);
  if (!chat || !last || isBusy()) return;
  emit(chats.map((c) => (c.id === chatId ? { ...c, turns: c.turns.slice(0, -1) } : c)));
  ask(chatId, last.question, view, source);
}

export function stop(): void {
  controller?.abort();
}

export function deleteChat(chatId: string): void {
  const busyHere = chats.find((c) => c.id === chatId)?.turns.some((t) => t.status === "gathering" || t.status === "writing");
  if (busyHere) stop();
  emit(
    chats.filter((c) => c.id !== chatId),
    true,
  );
}

export function clearChats(): void {
  stop();
  emit([], true);
}

/** For tests: forget everything, including what is stored. */
export function resetChats(): void {
  controller?.abort();
  controller = null;
  chats = [];
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  for (const listener of listeners) listener();
}

/** For tests: read what is stored, as a fresh page load would. */
export function reloadChats(): void {
  chats = load();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getChats = () => chats;

export function useChats(): Chat[] {
  return useSyncExternalStore(subscribe, getChats, getChats);
}

const DAY = 24 * 60 * 60 * 1000;

/** Chats grouped the way chat apps do: today, yesterday, this week, this month, earlier. */
export function groupChats(chats: Chat[], now = Date.now()): { label: string; chats: Chat[] }[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const today = start.getTime();
  const groups: { label: string; test: (t: number) => boolean }[] = [
    { label: "Today", test: (t) => t >= today },
    { label: "Yesterday", test: (t) => t >= today - DAY },
    { label: "Previous 7 days", test: (t) => t >= today - 7 * DAY },
    { label: "Previous 30 days", test: (t) => t >= today - 30 * DAY },
    { label: "Earlier", test: () => true },
  ];
  const out = groups.map((g) => ({ label: g.label, chats: [] as Chat[] }));
  for (const chat of chats) {
    const i = groups.findIndex((g) => g.test(chat.updatedAt));
    out[i]!.chats.push(chat);
  }
  return out.filter((g) => g.chats.length > 0);
}
