import { ArrowRight, ChevronRight, SendHorizontal, Square, X } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router";

import { ApiError, type DataSource } from "../../lib/api";
import { plural } from "../../lib/format";
import { AnswerText } from "./AnswerText";
import {
  type AssistantMode,
  type AssistantStatus,
  type ChatMeta,
  fetchStatus,
  type Grounding,
  historyFor,
  isAbort,
  MAX_QUESTION,
  type Page,
  pageOf,
  streamChat,
  viewPayload,
} from "./stream";
import { currentView, useViewContext, type ViewContext } from "./viewContext";

interface Turn {
  id: number;
  question: string;
  answer: string;
  status: "gathering" | "writing" | "done" | "error" | "stopped";
  meta: ChatMeta | null;
  notice: string | null;
  error: string | null;
  grounding: Grounding | null;
  mode: AssistantMode | null;
}

function suggestionsFor(page: Page, view: ViewContext | null): string[] {
  if (page === "explore" && view) {
    return [
      "What am I looking at?",
      ...(view.compare === "single" ? [] : ["Can I compare these two frames?"]),
      "Did anything move here?",
      "Why do the frames look different?",
    ];
  }
  return [
    "What is SPHEREx?",
    "Show me something that moved",
    "Why can't I always subtract two frames?",
    "Could SPHEREx find Planet Nine?",
  ];
}

/** Links in answers are built by the server; only ever follow them inside this app. */
function internal(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//");
}

let nextId = 1;

export function AssistantPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const page = pageOf(pathname);
  const view = useViewContext();
  const source: DataSource = view?.source ?? (params.get("source") === "snapshot" ? "snapshot" : "live");

  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [shownSources, setShownSources] = useState<Record<number, boolean>>({});
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const abort = useRef<AbortController | null>(null);
  const busy = turns.some((t) => t.status === "gathering" || t.status === "writing");

  // What the assistant can do right now, checked each time the panel opens.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const controller = new AbortController();
    fetchStatus(controller.signal).then(setStatus, () => undefined);
    return () => controller.abort();
  }, [open]);

  useEffect(() => () => abort.current?.abort(), []);

  // Follow the answer as it streams in, unless the visitor has scrolled up to read.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [turns]);

  const onScroll = () => {
    const el = listRef.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  };

  const ask = async (text: string) => {
    const question = text.trim().slice(0, MAX_QUESTION);
    if (!question || busy) return;
    const id = nextId++;
    const messages = historyFor(
      turns.filter((t) => t.status === "done").map((t) => ({ question: t.question, answer: t.answer })),
      question,
    );
    const blank: Turn = {
      id,
      question,
      answer: "",
      status: "gathering",
      meta: null,
      notice: null,
      error: null,
      grounding: null,
      mode: null,
    };
    setTurns((ts) => [...ts, blank]);
    setDraft("");
    stick.current = true;
    const update = (patch: Partial<Turn> | ((t: Turn) => Partial<Turn>)) =>
      setTurns((ts) => ts.map((t) => (t.id === id ? { ...t, ...(typeof patch === "function" ? patch(t) : patch) } : t)));

    const controller = new AbortController();
    abort.current = controller;
    try {
      await streamChat(
        messages,
        viewPayload(page, currentView()),
        source,
        {
          meta: (meta) => update({ meta, mode: meta.mode, status: "writing" }),
          notice: (message) => update({ notice: message }),
          delta: (piece) => update((t) => ({ answer: t.answer + piece })),
          done: (done) => update({ status: "done", grounding: done.grounding, mode: done.mode }),
          error: (message) => update({ status: "error", error: message }),
        },
        controller.signal,
      );
      update((t) =>
        t.status === "gathering" || t.status === "writing"
          ? { status: "error", error: "The answer was cut off. Try asking again." }
          : {},
      );
    } catch (err) {
      if (isAbort(err)) update({ status: "stopped" });
      else update({ status: "error", error: err instanceof ApiError ? err.message : "Something went wrong. Try again." });
    } finally {
      if (abort.current === controller) abort.current = null;
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void ask(draft);
  };

  const onInputKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void ask(draft);
    }
  };

  const onPanelKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
  };

  const cite = (turnId: number, tag: string) => {
    setShownSources((s) => ({ ...s, [turnId]: true }));
    requestAnimationFrame(() => {
      const item = document.getElementById(`src-${turnId}-${tag}`);
      const list = listRef.current;
      if (!item || !list) return;
      list.scrollTop += item.getBoundingClientRect().top - list.getBoundingClientRect().top - 16;
      item.focus({ preventScroll: true });
    });
  };

  // On a phone the panel covers the page, so following a link closes it.
  const onAction = () => {
    if (window.matchMedia?.("(max-width: 639px)").matches) onClose();
  };

  const liveText = busy ? "Answering…" : turns.at(-1)?.status === "done" ? "Answer ready." : "";

  return (
    <aside
      id="assistant"
      aria-labelledby="assistant-title"
      hidden={!open}
      onKeyDown={onPanelKey}
      className="fixed inset-x-0 bottom-0 top-[var(--header-h)] z-30 flex flex-col bg-raised sm:left-auto sm:w-[27rem] sm:border-l sm:border-rule sm:shadow-[var(--shadow-lg)]"
    >
      <div className="flex items-start justify-between gap-3 border-b border-rule px-4 py-3">
        <div className="min-w-0 space-y-1">
          <h2 id="assistant-title" className="text-[1.6rem] leading-none">
            Ask about the sky
          </h2>
          <ModeLine status={status} />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {turns.length > 0 && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={busy}
              onClick={() => {
                setTurns([]);
                setShownSources({});
                inputRef.current?.focus();
              }}
            >
              Clear
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-icon" aria-label="Close the assistant" onClick={onClose}>
            <X size={18} aria-hidden />
          </button>
        </div>
      </div>

      <div ref={listRef} onScroll={onScroll} className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {turns.length === 0 ? (
          <div className="space-y-4">
            <p className="text-[0.9375rem] text-muted">
              {page === "explore" && view
                ? "Ask about the view on screen, or about SPHEREx and how this app works."
                : "Ask about SPHEREx, how this app works, or what to look at."}{" "}
              Answers use only the app&apos;s own measurements, JPL&apos;s predictions and the method notes, and name
              their sources. They can still be wrong, so check the sources.
            </p>
            <div>
              <h3 className="panel-title">Try</h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {suggestionsFor(page, view).map((s) => (
                  <li key={s}>
                    <button type="button" className="chip" onClick={() => void ask(s)}>
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <ol className="space-y-7">
            {turns.map((t) => (
              <li key={t.id}>
                <TurnView
                  turn={t}
                  sourcesShown={!!shownSources[t.id]}
                  onSourcesToggle={(v) => setShownSources((s) => ({ ...s, [t.id]: v }))}
                  onCite={(tag) => cite(t.id, tag)}
                  onAction={onAction}
                />
              </li>
            ))}
          </ol>
        )}
      </div>

      <form onSubmit={submit} className="border-t border-rule px-3 pb-3 pt-2.5">
        <label htmlFor="assistant-question" className="visually-hidden">
          Your question
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id="assistant-question"
            ref={inputRef}
            rows={2}
            maxLength={MAX_QUESTION}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onInputKey}
            placeholder={page === "explore" && view ? "Ask about this view…" : "Ask about SPHEREx or the sky…"}
            className="field resize-none rounded-[var(--radius-lg)] px-3.5 py-2.5 text-[0.9375rem] leading-snug"
          />
          {busy ? (
            <button
              type="button"
              className="btn btn-secondary btn-icon shrink-0"
              aria-label="Stop the answer"
              onClick={() => abort.current?.abort()}
            >
              <Square size={15} aria-hidden />
            </button>
          ) : (
            <button type="submit" className="btn btn-primary btn-icon shrink-0" aria-label="Send" disabled={!draft.trim()}>
              <SendHorizontal size={18} aria-hidden />
            </button>
          )}
        </div>
        <p className="mt-2 text-[0.75rem] leading-snug text-faint">{privacyNote(status)}</p>
      </form>
      <p className="visually-hidden" role="status" aria-live="polite">
        {liveText}
      </p>
    </aside>
  );
}

function GroundingNote({ grounding }: { grounding: Grounding }) {
  const { unverified, unknownTags } = grounding;
  if (unverified.length === 0 && unknownTags.length === 0) return null;
  return (
    <div className="note note-warn space-y-1 text-[0.8125rem]">
      {unverified.length > 0 && (
        <p>
          Not found in the sources: {unverified.join(", ")}. Check {unverified.length === 1 ? "this" : "these"} before
          relying on {unverified.length === 1 ? "it" : "them"}.
        </p>
      )}
      {unknownTags.length > 0 && (
        <p>
          The answer cites {unknownTags.map((t) => `[${t}]`).join(", ")}, which {unknownTags.length === 1 ? "is" : "are"}{" "}
          not among its sources.
        </p>
      )}
    </div>
  );
}

function privacyNote(status: AssistantStatus | null): string {
  if (status?.mode === "local-model") {
    return status.local
      ? "Questions go only to this app's server, where the language model runs on the same machine. Nothing is saved."
      : "Questions go to this app's server and the model server it is set up with. Nothing is saved by this app.";
  }
  return "Answers are put together from the app's own data; no language model is running. Nothing is saved.";
}

function ModeLine({ status }: { status: AssistantStatus | null }) {
  if (!status) return <p className="text-[0.8125rem] text-faint">Checking the assistant…</p>;
  if (status.mode === "local-model") {
    return (
      <p className="flex min-w-0 items-center gap-1.5 text-[0.8125rem] text-muted">
        <span className="size-1.5 shrink-0 rounded-full bg-live" aria-hidden />
        <span className="shrink-0">{status.local ? "Local model" : "Model server"}</span>
        <span className="mono truncate text-faint" title={status.model ?? undefined}>
          {status.model}
        </span>
      </p>
    );
  }
  return (
    <p className="text-[0.8125rem] text-muted" title={status.provider === "off" ? undefined : status.detail}>
      Built-in answers{status.provider === "off" ? "" : " · the local model is not running"}
    </p>
  );
}

function TurnView({
  turn,
  sourcesShown,
  onSourcesToggle,
  onCite,
  onAction,
}: {
  turn: Turn;
  sourcesShown: boolean;
  onSourcesToggle: (open: boolean) => void;
  onCite: (tag: string) => void;
  onAction: () => void;
}) {
  const sources = turn.meta?.sources ?? [];
  const actions = (turn.meta?.actions ?? []).filter((a) => internal(a.href));
  const working = turn.status === "gathering" || turn.status === "writing";
  return (
    <article className="space-y-3" aria-busy={working}>
      <p className="ml-auto w-fit max-w-[88%] whitespace-pre-wrap rounded-[var(--radius-lg)] rounded-br-[4px] bg-sunk px-3.5 py-2 text-[0.9375rem]">
        {turn.question}
      </p>
      <div className="space-y-3 text-[0.9375rem] leading-relaxed">
        {turn.notice && <p className="note note-warn text-[0.8125rem]">{turn.notice}</p>}
        {turn.answer ? (
          <AnswerText text={turn.answer} sources={sources} onCite={onCite} />
        ) : working ? (
          <p className="text-muted">{turn.status === "gathering" ? "Gathering the evidence…" : "Writing…"}</p>
        ) : null}
        {turn.error && <p className="note note-danger text-[0.8125rem]">{turn.error}</p>}
        {turn.status === "stopped" && <p className="text-[0.8125rem] text-faint">Stopped.</p>}

        {actions.length > 0 && !working && (
          <ul className="flex flex-col items-start gap-2">
            {actions.map((a) => (
              <li key={a.href}>
                <Link
                  to={a.href}
                  onClick={onAction}
                  className="btn btn-secondary btn-sm h-auto whitespace-normal py-1.5 text-left leading-snug"
                >
                  {a.label}
                  <ArrowRight size={14} className="shrink-0" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {turn.status === "done" && turn.grounding && <GroundingNote grounding={turn.grounding} />}
        {turn.mode === "local-model" && turn.status === "done" && (turn.meta?.notes.length ?? 0) > 0 && (
          <p className="text-[0.8125rem] text-faint">{turn.meta!.notes.join(" ")}</p>
        )}

        {!working && turn.mode && (
          <p className="border-t border-rule pt-2 text-[0.75rem] leading-snug text-faint">
            {turn.mode === "local-model" ? (
              <>
                Phrased by <span className="mono">{turn.meta?.model ?? "a local model"}</span> from the sources below
              </>
            ) : (
              "Built-in answer, put together from the sources below"
            )}
            {turn.status === "done" && turn.grounding && turn.grounding.checked > 0 && turn.grounding.unverified.length === 0
              ? `; ${plural(turn.grounding.checked, "number")} checked against them.`
              : "."}
          </p>
        )}
        {!working && turn.meta && (
          <details className="disclosure" open={sourcesShown} onToggle={(e) => onSourcesToggle(e.currentTarget.open)}>
            <summary className="text-[0.8125rem]">
              <ChevronRight size={14} className="disclosure-chevron" aria-hidden />
              {sources.length > 0 ? `Sources (${sources.length})` : "Sources (none)"}
            </summary>
            {sources.length > 0 ? (
              <ol className="mt-2 space-y-1">
                {sources.map((s) => (
                  <li key={s.tag} id={`src-${turn.id}-${s.tag}`} tabIndex={-1} className="rounded-[6px] px-1 py-1.5">
                    <p className="flex items-baseline gap-2">
                      <span className="font-mono text-[0.68rem] text-muted">{s.tag}</span>
                      <span className="text-[0.8125rem] font-medium text-text">{s.title}</span>
                    </p>
                    <p className="mt-0.5 pl-7 text-[0.8125rem] leading-snug text-muted">{s.text}</p>
                    {s.source && <p className="mt-0.5 pl-7 text-[0.75rem] text-faint">{s.source}</p>}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-[0.8125rem] text-muted">No evidence matched this question.</p>
            )}
          </details>
        )}
      </div>
    </article>
  );
}
