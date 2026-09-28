/** The assistant's API: its status, and one answer streamed as server-sent events. */

import { ApiError, buildUrl, type DataSource } from "../../lib/api";
import type { ViewContext } from "./viewContext";

export type AssistantMode = "local-model" | "built-in";
export type Page = "landing" | "explore" | "discover" | "about" | "ask" | "other";

export interface EvidenceSource {
  tag: string;
  kind: "view" | "jpl" | "search" | "case" | "method" | "lookup";
  title: string;
  text: string;
  source: string;
}

export interface AssistantAction {
  label: string;
  href: string;
}

export interface ChatMeta {
  mode: AssistantMode;
  model: string | null;
  sources: EvidenceSource[];
  actions: AssistantAction[];
  notes: string[];
}

export interface Grounding {
  checked: number;
  /** Numbers and dates in the answer that are not in its sources. */
  unverified: string[];
  /** Cited tags that are not among its sources. */
  unknownTags: string[];
}

export interface ChatDone {
  grounding: Grounding;
  mode: AssistantMode;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantStatus {
  mode: AssistantMode;
  provider: "ollama" | "openai" | "off";
  model: string | null;
  local: boolean;
  detail: string;
}

export interface ChatHandlers {
  /** Live data the question needs is being fetched: a frame, catalogue facts, JPL, the search. */
  progress: (message: string) => void;
  meta: (meta: ChatMeta) => void;
  notice: (message: string) => void;
  delta: (text: string) => void;
  done: (done: ChatDone) => void;
  error: (message: string) => void;
}

/** The server's limits (backend/src/spherex_explorer/assistant/chat.py). */
export const MAX_QUESTION = 2000;
const HISTORY_MESSAGES = 6;
const HISTORY_CHARS = 1200;

export interface RawEvent {
  event: string;
  data: string;
}

/** Complete events in a server-sent event buffer, and the unfinished tail to keep for later. */
export function parseEvents(buffer: string): { events: RawEvent[]; rest: string } {
  const blocks = buffer.split(/\r?\n\r?\n/);
  const rest = blocks.pop() ?? "";
  const events: RawEvent[] = [];
  for (const block of blocks) {
    let event = "message";
    const data: string[] = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
    }
    if (data.length > 0) events.push({ event, data: data.join("\n") });
  }
  return { events, rest };
}

function dispatch({ event, data }: RawEvent, on: ChatHandlers): void {
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(data) as Record<string, unknown>;
  } catch {
    return;
  }
  switch (event) {
    case "progress":
      on.progress(String(body.message ?? ""));
      break;
    case "meta":
      on.meta(body as unknown as ChatMeta);
      break;
    case "notice":
      on.notice(String(body.message ?? ""));
      break;
    case "delta":
      on.delta(String(body.text ?? ""));
      break;
    case "done":
      on.done(body as unknown as ChatDone);
      break;
    case "error":
      on.error(String(body.message ?? "The assistant stopped."));
      break;
  }
}

/** The request's ``view``: the viewer's identifiers when a view is attached, else just the page. */
export function viewPayload(page: Page, view: ViewContext | null): Record<string, unknown> {
  if (!view) return { page };
  return {
    page: "explore",
    target: { ...view.target, name: view.target.name?.slice(0, 120) ?? null },
    frameKey: view.frameKey,
    referenceKey: view.referenceKey,
    compare: view.compare,
    fov: view.fov,
    sequenceMode: view.sequenceMode,
    sequenceKeys: view.sequenceKeys,
    frameIndex: view.frameIndex,
    frameCount: view.frameCount,
  };
}

/** Earlier questions and answers to send with a new question, trimmed to what the server keeps. */
export function historyFor(pairs: { question: string; answer: string }[], question: string): ChatMessage[] {
  const history = pairs
    .filter((p) => p.question.trim() && p.answer.trim())
    .flatMap((p): ChatMessage[] => [
      { role: "user", content: p.question.slice(0, MAX_QUESTION) },
      { role: "assistant", content: p.answer.slice(0, HISTORY_CHARS) },
    ])
    .slice(-HISTORY_MESSAGES);
  return [...history, { role: "user", content: question.slice(0, MAX_QUESTION) }];
}

export function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

/** Ask one question; handlers run as events arrive. Rejects with ApiError, or AbortError when stopped. */
export async function streamChat(
  messages: ChatMessage[],
  view: Record<string, unknown>,
  source: DataSource,
  on: ChatHandlers,
  signal: AbortSignal,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(buildUrl("/assistant/chat", { source: source === "snapshot" ? "snapshot" : undefined }), {
      method: "POST",
      signal,
      headers: { Accept: "text/event-stream", "Content-Type": "application/json" },
      body: JSON.stringify({ messages, view }),
    });
  } catch (err) {
    if (isAbort(err)) throw err;
    throw new ApiError(0, "network_error", "Could not reach the SPHEREx Explorer server. Check your connection.");
  }
  if (!response.ok || !response.body) {
    let code = "http_error";
    let message = unavailable(response.status);
    try {
      const body = (await response.json()) as { error?: { code?: string; message?: string } };
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
    } catch {
      // Not JSON; keep the generic message.
    }
    throw new ApiError(response.status, code, message);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
    const { events, rest } = parseEvents(done ? `${buffer}\n\n` : buffer);
    buffer = rest;
    for (const event of events) dispatch(event, on);
    if (done) return;
  }
}

export async function fetchStatus(signal?: AbortSignal): Promise<AssistantStatus> {
  let response: Response;
  try {
    response = await fetch(buildUrl("/assistant/status"), { signal, headers: { Accept: "application/json" } });
  } catch (err) {
    if (isAbort(err)) throw err;
    throw new ApiError(0, "network_error", "Could not reach the SPHEREx Explorer server. Check your connection.");
  }
  if (!response.ok) throw new ApiError(response.status, "http_error", unavailable(response.status));
  return (await response.json()) as AssistantStatus;
}

/** What to tell the visitor when the assistant's routes answer with an error status. */
export function unavailable(status: number): string {
  if (status === 404) {
    return "The assistant is not available on this server. If you run the app yourself, restart its API server so it loads the current version.";
  }
  if (status === 429) return "Too many questions in a short time. Wait a few seconds and try again.";
  if (status >= 500) return "The server had a problem answering. Try again in a moment.";
  return `The server answered with HTTP ${status}.`;
}
