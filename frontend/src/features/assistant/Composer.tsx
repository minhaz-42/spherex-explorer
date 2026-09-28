import { ArrowUp, Square, Telescope, X } from "lucide-react";
import { type FormEvent, type KeyboardEvent, type RefObject } from "react";
import { Link } from "react-router";

import { MAX_QUESTION } from "./stream";
import { describeView, type ViewContext } from "./viewContext";

/** The message box: a view the questions are about, the question, and send or stop. */
export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  busy,
  disabled,
  view,
  onForgetView,
  inputRef,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  busy: boolean;
  disabled: boolean;
  view: ViewContext | null;
  onForgetView: () => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  placeholder: string;
}) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSend();
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onSend();
    }
  };
  return (
    <form onSubmit={submit} className="w-full">
      <div className="rounded-[1.6rem] border border-rule-strong bg-raised shadow-[var(--shadow)] transition-colors focus-within:border-rule-control">
        {view && (
          <div className="flex items-center gap-2 px-4 pt-3">
            <span className="inline-flex min-w-0 items-center gap-2 rounded-full border border-rule bg-bg py-1 pl-2.5 pr-1 text-xs text-muted">
              <Telescope size={13} className="shrink-0 text-accent" aria-hidden />
              <span className="truncate">
                Asking about the view of <span className="font-semibold text-text">{view.target.name}</span> ·{" "}
                {describeView(view)}
              </span>
              <Link to={view.href} className="shrink-0 rounded-full px-1.5 font-medium text-text underline-offset-2 hover:underline">
                Open
              </Link>
              <button
                type="button"
                className="grid size-5 shrink-0 place-items-center rounded-full text-faint hover:bg-hover hover:text-text"
                aria-label="Don't ask about this view"
                title="Don't ask about this view"
                onClick={onForgetView}
              >
                <X size={12} aria-hidden />
              </button>
            </span>
          </div>
        )}
        <label htmlFor="chat-question" className="visually-hidden">
          Your question
        </label>
        <textarea
          id="chat-question"
          ref={inputRef}
          rows={1}
          maxLength={MAX_QUESTION}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKey}
          placeholder={placeholder}
          className="block max-h-52 min-h-[3.25rem] w-full resize-none bg-transparent px-5 pb-1 pt-3.5 text-[0.975rem] leading-relaxed text-text outline-none placeholder:text-faint [field-sizing:content] disabled:cursor-not-allowed"
        />
        <div className="flex items-center justify-between gap-3 px-3 pb-3 pt-1">
          <p className="pl-2 text-xs text-faint">Enter to send · Shift + Enter for a new line</p>
          {busy ? (
            <button
              type="button"
              className="grid size-9 place-items-center rounded-full bg-text text-bg transition-opacity hover:opacity-85"
              aria-label="Stop the answer"
              onClick={onStop}
            >
              <Square size={13} fill="currentColor" aria-hidden />
            </button>
          ) : (
            <button
              type="submit"
              className="grid size-9 place-items-center rounded-full bg-accent text-accent-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-rule-strong disabled:text-faint"
              aria-label="Send"
              disabled={disabled || !value.trim()}
            >
              <ArrowUp size={18} strokeWidth={2.4} aria-hidden />
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
