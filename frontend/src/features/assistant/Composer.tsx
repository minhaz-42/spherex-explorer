import { ArrowUp, Square, Telescope, X } from "lucide-react";
import { type FormEvent, type KeyboardEvent, type RefObject } from "react";
import { Link } from "react-router";

import { defineMessages, useLang, useT } from "../../lib/i18n";
import { MAX_QUESTION } from "./stream";
import { describeView, type ViewContext } from "./viewContext";

const M = defineMessages({
  en: {
    askingBefore: "Asking about the view of ",
    askingAfter: "",
    open: "Open",
    forget: "Don't ask about this view",
    question: "Your question",
    hint: "Enter to send · Shift + Enter for a new line",
    stop: "Stop the answer",
    send: "Send",
  },
  bn: {
    askingBefore: "",
    askingAfter: "-এর দৃশ্য নিয়ে জিজ্ঞাসা",
    open: "খুলুন",
    forget: "এই দৃশ্য নিয়ে আর জিজ্ঞাসা নয়",
    question: "আপনার প্রশ্ন",
    hint: "পাঠাতে Enter · নতুন লাইনে Shift + Enter",
    stop: "উত্তর থামান",
    send: "পাঠান",
  },
});

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
  const t = useT(M);
  const lang = useLang();
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
                {t("askingBefore")}
                <span className="font-semibold text-text">{view.target.name}</span>
                {t("askingAfter")} · {describeView(view, lang)}
              </span>
              <Link to={view.href} className="shrink-0 rounded-full px-1.5 font-medium text-text underline-offset-2 hover:underline">
                {t("open")}
              </Link>
              <button
                type="button"
                className="grid size-5 shrink-0 place-items-center rounded-full text-faint hover:bg-hover hover:text-text"
                aria-label={t("forget")}
                title={t("forget")}
                onClick={onForgetView}
              >
                <X size={12} aria-hidden />
              </button>
            </span>
          </div>
        )}
        <label htmlFor="chat-question" className="visually-hidden">
          {t("question")}
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
          <p className="pl-2 text-xs text-faint">{t("hint")}</p>
          {busy ? (
            <button
              type="button"
              className="grid size-9 place-items-center rounded-full bg-text text-bg transition-opacity hover:opacity-85"
              aria-label={t("stop")}
              onClick={onStop}
            >
              <Square size={13} fill="currentColor" aria-hidden />
            </button>
          ) : (
            <button
              type="submit"
              className="grid size-9 place-items-center rounded-full bg-accent text-accent-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-rule-strong disabled:text-faint"
              aria-label={t("send")}
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
