import { SendHorizontal, Square, X } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { ask, clear, isBusy, stop, useConversation } from "../features/assistant/conversation";
import { type AssistantStatus, fetchStatus, isAbort, MAX_QUESTION } from "../features/assistant/stream";
import { TurnView } from "../features/assistant/TurnView";
import { forgetView, useViewStore, type ViewContext } from "../features/assistant/viewContext";
import { ApiError, type DataSource } from "../lib/api";

const GENERAL = [
  "What is SPHEREx?",
  "Show me something that moved",
  "Why can't I always subtract two frames?",
  "Could SPHEREx find Planet Nine?",
  "How does SPHEREx see 102 colours?",
  "What does MJy/sr mean?",
];

function viewQuestions(view: ViewContext): string[] {
  return [
    "What am I looking at?",
    "Did anything move here?",
    ...(view.compare === "single" ? [] : ["Can I compare these two frames?"]),
    "Why do the frames look different?",
  ];
}

const COMPARE: Record<ViewContext["compare"], string> = {
  single: "one frame",
  blink: "blinking A and B",
  side: "A and B side by side",
  diff: "difference of A and B",
};

function describeView(view: ViewContext): string {
  const parts = [
    `frame ${view.frameIndex + 1} of ${view.frameCount}`,
    `detector ${view.detector}`,
    COMPARE[view.compare],
  ];
  if (view.source === "snapshot") parts.push("demo snapshot");
  return parts.join(" · ");
}

type Status =
  | { kind: "checking" }
  | { kind: "ready"; status: AssistantStatus }
  | { kind: "unavailable"; message: string; missing: boolean };

/** The assistant's own page: questions about the last view, SPHEREx and the app's methods. */
export function Ask() {
  const [params] = useSearchParams();
  const turns = useConversation();
  const { view, source: lastSource } = useViewStore();
  const source: DataSource = view?.source ?? (params.get("source") === "snapshot" ? "snapshot" : lastSource);
  const [status, setStatus] = useState<Status>({ kind: "checking" });
  const [draft, setDraft] = useState(() => (params.get("q") ?? "").slice(0, MAX_QUESTION));
  const [shownSources, setShownSources] = useState<Record<number, boolean>>({});
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const busy = isBusy(turns);
  const missing = status.kind === "unavailable" && status.missing;

  useEffect(() => {
    const controller = new AbortController();
    fetchStatus(controller.signal).then(
      (s) => setStatus({ kind: "ready", status: s }),
      (err: unknown) => {
        if (isAbort(err)) return;
        setStatus({
          kind: "unavailable",
          message: err instanceof ApiError ? err.message : "The assistant could not be reached.",
          missing: err instanceof ApiError && err.status === 404,
        });
      },
    );
    return () => controller.abort();
  }, []);

  // A keyboard is there already on a desktop; on a phone, focusing would pop one up uninvited.
  useEffect(() => {
    if (window.matchMedia?.("(pointer: fine)").matches) inputRef.current?.focus();
  }, []);

  // Follow the answer as it streams in, unless the visitor has scrolled up to read. The welcome
  // text is read from the top.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stick.current && turns.length > 0) el.scrollTop = el.scrollHeight;
  }, [turns]);

  const onScroll = () => {
    const el = listRef.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 64;
  };

  const send = (text: string) => {
    if (!text.trim() || busy || missing) return;
    stick.current = true;
    setDraft("");
    void ask(text, view, source);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    send(draft);
  };

  const onInputKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(draft);
    }
  };

  const cite = (turnId: number, tag: string) => {
    setShownSources((s) => ({ ...s, [turnId]: true }));
    requestAnimationFrame(() => {
      const item = document.getElementById(`src-${turnId}-${tag}`);
      const list = listRef.current;
      if (!item || !list) return;
      list.scrollTop += item.getBoundingClientRect().top - list.getBoundingClientRect().top - 24;
      item.focus({ preventScroll: true });
    });
  };

  const last = turns.at(-1);
  const liveText = busy ? "Answering…" : last?.status === "done" ? "Answer ready." : "";

  return (
    <div className="flex h-[calc(100dvh-var(--header-h))] flex-col">
      <div className="border-b border-rule">
        <div className="mx-auto flex w-full max-w-[46rem] items-center justify-between gap-4 px-[var(--gutter)] py-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-[-0.012em]">Ask about the sky</h1>
            <ModeLine status={status} />
          </div>
          {turns.length > 0 && (
            <button
              type="button"
              className="btn btn-ghost btn-sm shrink-0"
              disabled={busy}
              onClick={() => {
                clear();
                setShownSources({});
                inputRef.current?.focus();
              }}
            >
              New conversation
            </button>
          )}
        </div>
      </div>

      <div ref={listRef} onScroll={onScroll} className="flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-[46rem] px-[var(--gutter)] py-8">
          {status.kind === "unavailable" && <p className="note note-danger mb-6">{status.message}</p>}
          {turns.length === 0 ? (
            <div className="space-y-8">
              <div className="space-y-3">
                <p className="text-[1.375rem] font-semibold leading-snug tracking-[-0.014em] text-text">
                  Questions about what you saw, about SPHEREx, or about how this app measures things.
                </p>
                <p className="prose-body">
                  Answers use only the app&apos;s own measurements, JPL&apos;s predictions and short method notes, and
                  list their sources. They can still be wrong, so check the sources under each answer.
                </p>
              </div>

              {view && (
                <section aria-label="The view you had open" className="card flex items-start gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">Asking about the view you had open</p>
                    <p className="mt-0.5 text-sm text-muted">
                      {view.target.name} · {describeView(view)}
                    </p>
                    <Link to={view.href} className="btn btn-secondary btn-sm mt-3">
                      Back to the view
                    </Link>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon btn-sm shrink-0"
                    aria-label="Don't ask about this view"
                    title="Don't ask about this view"
                    onClick={forgetView}
                  >
                    <X size={16} aria-hidden />
                  </button>
                </section>
              )}

              <Suggestions title={view ? "About this view" : "Try"} questions={view ? viewQuestions(view) : GENERAL} onPick={send} disabled={missing} />
              {view && <Suggestions title="About SPHEREx" questions={GENERAL.slice(0, 4)} onPick={send} disabled={missing} />}
            </div>
          ) : (
            <ol className="space-y-10">
              {turns.map((t) => (
                <li key={t.id}>
                  <TurnView
                    turn={t}
                    sourcesShown={!!shownSources[t.id]}
                    onSourcesToggle={(v) => setShownSources((s) => ({ ...s, [t.id]: v }))}
                    onCite={(tag) => cite(t.id, tag)}
                  />
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className="border-t border-rule bg-bg">
        <form onSubmit={submit} className="mx-auto w-full max-w-[46rem] px-[var(--gutter)] pb-3 pt-3">
          {view && turns.length > 0 && (
            <p className="mb-2 flex items-center gap-1.5 text-xs text-muted">
              <span className="truncate">Asking about the view of {view.target.name}</span>
              <button
                type="button"
                className="shrink-0 rounded-full p-0.5 text-faint hover:bg-hover hover:text-text"
                aria-label="Don't ask about this view"
                title="Don't ask about this view"
                onClick={forgetView}
              >
                <X size={13} aria-hidden />
              </button>
            </p>
          )}
          <label htmlFor="ask-question" className="visually-hidden">
            Your question
          </label>
          <div className="flex items-end gap-2">
            <textarea
              id="ask-question"
              ref={inputRef}
              rows={1}
              maxLength={MAX_QUESTION}
              value={draft}
              disabled={missing}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onInputKey}
              placeholder={view ? "Ask about this view, or anything else…" : "Ask about SPHEREx or the sky…"}
              className="field max-h-40 min-h-[2.875rem] resize-none rounded-[var(--radius-lg)] px-4 py-3 leading-snug [field-sizing:content]"
            />
            {busy ? (
              <button type="button" className="btn btn-secondary btn-icon h-[2.875rem] w-[2.875rem] shrink-0" aria-label="Stop the answer" onClick={stop}>
                <Square size={15} aria-hidden />
              </button>
            ) : (
              <button
                type="submit"
                className="btn btn-primary btn-icon h-[2.875rem] w-[2.875rem] shrink-0"
                aria-label="Send"
                disabled={!draft.trim() || missing}
              >
                <SendHorizontal size={18} aria-hidden />
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-faint">{privacyNote(status)}</p>
        </form>
      </div>
      <p className="visually-hidden" role="status" aria-live="polite">
        {liveText}
      </p>
    </div>
  );
}

function Suggestions({
  title,
  questions,
  onPick,
  disabled,
}: {
  title: string;
  questions: string[];
  onPick: (q: string) => void;
  disabled: boolean;
}) {
  return (
    <section>
      <h2 className="panel-title">{title}</h2>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {questions.map((q) => (
          <li key={q}>
            <button
              type="button"
              className="w-full rounded-[var(--radius)] border border-rule bg-raised px-4 py-3 text-left text-[0.9375rem] text-text shadow-[var(--shadow-sm)] transition-colors hover:border-rule-control disabled:cursor-not-allowed disabled:opacity-50"
              disabled={disabled}
              onClick={() => onPick(q)}
            >
              {q}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function privacyNote(status: Status): string {
  if (status.kind === "ready" && status.status.mode === "local-model") {
    return status.status.local
      ? "Questions go only to this app's server, where the language model runs on the same machine. Nothing is saved."
      : "Questions go to this app's server and the model server it is set up with. Nothing is saved by this app.";
  }
  return "Answers are put together from the app's own data; no language model is running. Nothing is saved.";
}

function ModeLine({ status }: { status: Status }) {
  if (status.kind === "checking") return <p className="text-sm text-faint">Checking the assistant…</p>;
  if (status.kind === "unavailable") return <p className="text-sm text-danger">Not available on this server</p>;
  const s = status.status;
  if (s.mode === "local-model") {
    return (
      <p className="flex min-w-0 items-center gap-1.5 text-sm text-muted">
        <span className="size-1.5 shrink-0 rounded-full bg-live" aria-hidden />
        <span className="shrink-0">{s.local ? "Local model" : "Model server"}</span>
        <span className="mono truncate text-xs text-faint" title={s.model ?? undefined}>
          {s.model}
        </span>
      </p>
    );
  }
  return (
    <p className="text-sm text-muted" title={s.provider === "off" ? undefined : s.detail}>
      Built-in answers{s.provider === "off" ? "" : " · the local model is not running"}
    </p>
  );
}
