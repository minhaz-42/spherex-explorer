import { ArrowRight, Check, ChevronDown, Copy, RotateCcw, TriangleAlert } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Link } from "react-router";

import { OrbitMark } from "../../components/Wordmark";
import { plural } from "../../lib/format";
import { defineMessages, useT } from "../../lib/i18n";
import { AnswerText } from "./AnswerText";
import type { Turn } from "./chats";
import type { Grounding } from "./stream";

const M = defineMessages({
  en: {
    about: "About the view of {name}",
    gathering: "Gathering the evidence",
    writing: "Writing",
    stopped: "Stopped.",
    copy: "Copy the answer",
    copied: "Copied",
    again: "Ask again",
    sources: "Sources ({n})",
    sourcesNone: "Sources (none)",
    phrasedBefore: "Phrased by ",
    phrasedAfter: "",
    aModel: "a local model",
    builtIn: "Built-in answer",
    checked: " · {count} checked",
    noEvidence: "No evidence matched this question.",
    notFoundOne: "Not found in the sources: {list}. Check this before relying on it.",
    notFoundMany: "Not found in the sources: {list}. Check these before relying on them.",
    unknownOne: "The answer cites {tags}, which is not among its sources.",
    unknownMany: "The answer cites {tags}, which are not among its sources.",
  },
  bn: {
    about: "{name}-এর দৃশ্য নিয়ে",
    gathering: "প্রমাণ জোগাড় করা হচ্ছে",
    writing: "লেখা হচ্ছে",
    stopped: "থামানো হয়েছে।",
    copy: "উত্তর কপি করুন",
    copied: "কপি হয়েছে",
    again: "আবার জিজ্ঞাসা করুন",
    sources: "উৎস ({n})",
    sourcesNone: "উৎস (নেই)",
    phrasedBefore: "",
    phrasedAfter: " দিয়ে লেখা",
    aModel: "একটি লোকাল মডেল",
    builtIn: "বিল্ট-ইন উত্তর",
    checked: " · {n}টি সংখ্যা যাচাই হয়েছে",
    noEvidence: "এই প্রশ্নের সঙ্গে মেলে এমন কোনো প্রমাণ পাওয়া যায়নি।",
    notFoundOne: "উৎসে পাওয়া যায়নি: {list}। ভরসা করার আগে এটি মিলিয়ে দেখুন।",
    notFoundMany: "উৎসে পাওয়া যায়নি: {list}। ভরসা করার আগে এগুলো মিলিয়ে দেখুন।",
    unknownOne: "উত্তরে {tags} উল্লেখ আছে, যা এর উৎসের মধ্যে নেই।",
    unknownMany: "উত্তরে {tags} উল্লেখ আছে, যেগুলো এর উৎসের মধ্যে নেই।",
  },
});

/** Links in answers are built by the server; only ever follow them inside this app. */
function internal(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//");
}

export function UserMessage({ turn }: { turn: Turn }) {
  const t = useT(M);
  return (
    <div className="flex flex-col items-end gap-1.5">
      <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-[1.4rem] bg-hover px-5 py-3 text-[0.975rem] leading-relaxed text-text">
        {turn.question}
      </p>
      {turn.about && <p className="pr-2 text-xs text-faint">{t("about", { name: turn.about })}</p>}
    </div>
  );
}

/** The assistant's answer: text, links, checks, its sources, and actions (copy, ask again). */
export function AssistantMessage({
  turn,
  last,
  sourcesOpen,
  onSourcesOpen,
  onCite,
  onRegenerate,
  canRegenerate,
}: {
  turn: Turn;
  last: boolean;
  sourcesOpen: boolean;
  onSourcesOpen: (open: boolean) => void;
  onCite: (tag: string) => void;
  onRegenerate: () => void;
  canRegenerate: boolean;
}) {
  const t = useT(M);
  const [copied, setCopied] = useState(false);
  const sources = turn.meta?.sources ?? [];
  const actions = (turn.meta?.actions ?? []).filter((a) => internal(a.href));
  const working = turn.status === "gathering" || turn.status === "writing";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(turn.answer);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // No clipboard access (an insecure page or a denied permission): nothing to report.
    }
  };

  return (
    <div className="flex gap-4" aria-busy={working}>
      <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border border-rule bg-raised">
        <OrbitMark size={20} />
      </div>
      <div className="min-w-0 flex-1 space-y-4">
        {turn.notice && <p className="note note-warn">{turn.notice}</p>}

        {turn.answer ? (
          <div className="text-[0.975rem] leading-[1.75] text-text">
            <AnswerText text={turn.answer} sources={sources} onCite={onCite} />
            {turn.status === "writing" && (
              <span aria-hidden="true" className="ml-0.5 inline-block h-[1.05em] w-[0.45em] translate-y-[0.18em] animate-pulse rounded-[2px] bg-text/70" />
            )}
          </div>
        ) : working ? (
          <p className="flex items-start gap-2.5 text-[0.975rem] text-muted">
            <span className="mt-[0.6em]">
              <Dots />
            </span>
            <span>{turn.progress ?? (turn.status === "gathering" ? t("gathering") : t("writing"))}</span>
          </p>
        ) : null}

        {turn.error && (
          <p className="note note-danger flex items-start gap-2">
            <TriangleAlert size={16} className="mt-0.5 shrink-0 text-danger" aria-hidden />
            {turn.error}
          </p>
        )}
        {turn.status === "stopped" && <p className="text-sm text-faint">{t("stopped")}</p>}

        {actions.length > 0 && !working && (
          <ul className="flex flex-wrap gap-2">
            {actions.map((a) => (
              <li key={a.href}>
                <Link
                  to={a.href}
                  className="group inline-flex items-center gap-2 rounded-[var(--radius)] border border-rule-strong bg-raised px-3.5 py-2 text-sm font-medium text-text no-underline shadow-[var(--shadow-sm)] transition-colors hover:border-rule-control"
                >
                  {a.label}
                  <ArrowRight size={14} className="shrink-0 text-faint transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {turn.status === "done" && turn.grounding && <GroundingNote grounding={turn.grounding} t={t} />}
        {turn.mode === "local-model" && turn.status === "done" && (turn.meta?.notes.length ?? 0) > 0 && (
          <p className="text-sm text-faint">{turn.meta!.notes.join(" ")}</p>
        )}

        {!working && turn.meta && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-1 text-faint">
              {turn.answer && (
                <IconButton label={copied ? t("copied") : t("copy")} onClick={copy}>
                  {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
                </IconButton>
              )}
              {last && (
                <IconButton label={t("again")} onClick={onRegenerate} disabled={!canRegenerate}>
                  <RotateCcw size={15} aria-hidden />
                </IconButton>
              )}
              <button
                type="button"
                aria-expanded={sourcesOpen}
                onClick={() => onSourcesOpen(!sourcesOpen)}
                className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted transition-colors hover:bg-hover hover:text-text"
              >
                {sources.length > 0 ? t("sources", { n: sources.length }) : t("sourcesNone")}
                <ChevronDown size={14} className={`transition-transform ${sourcesOpen ? "rotate-180" : ""}`} aria-hidden />
              </button>
              <span className="ml-auto text-xs">
                {turn.mode === "local-model" ? (
                  <>
                    {t("phrasedBefore")}
                    <span className="mono">{turn.meta.model ?? t("aModel")}</span>
                    {t("phrasedAfter")}
                  </>
                ) : (
                  t("builtIn")
                )}
                {turn.status === "done" && turn.grounding && turn.grounding.checked > 0 && turn.grounding.unverified.length === 0
                  ? t("checked", { count: plural(turn.grounding.checked, "number"), n: turn.grounding.checked })
                  : ""}
              </span>
            </div>
            {sourcesOpen && (
              <div className="rounded-[var(--radius-lg)] border border-rule bg-bg p-4">
                {sources.length > 0 ? (
                  <ol className="space-y-3">
                    {sources.map((s) => (
                      <li key={s.tag} id={`src-${turn.id}-${s.tag}`} tabIndex={-1} className="rounded-[8px] outline-offset-4">
                        <p className="flex items-baseline gap-2.5">
                          <span className="num inline-flex h-5 min-w-7 items-center justify-center rounded-[6px] border border-rule-strong bg-raised px-1 text-xs font-semibold text-muted">
                            {s.tag}
                          </span>
                          <span className="text-sm font-semibold text-text">{s.title}</span>
                        </p>
                        <p className="mt-1 pl-[2.375rem] text-sm leading-relaxed text-muted">{s.text}</p>
                        {s.source && <p className="mt-0.5 pl-[2.375rem] text-xs text-faint">{s.source}</p>}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-muted">{t("noEvidence")}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="grid size-8 place-items-center rounded-full transition-colors hover:bg-hover hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Dots() {
  return (
    <span aria-hidden="true" className="inline-flex gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 animate-pulse rounded-full bg-current"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </span>
  );
}

function GroundingNote({
  grounding,
  t,
}: {
  grounding: Grounding;
  t: (key: keyof (typeof M)["en"], vars?: Record<string, string | number>) => string;
}) {
  const { unverified, unknownTags } = grounding;
  if (unverified.length === 0 && unknownTags.length === 0) return null;
  const tags = unknownTags.map((tag) => `[${tag}]`).join(", ");
  return (
    <div className="note note-warn space-y-1">
      {unverified.length > 0 && (
        <p>{t(unverified.length === 1 ? "notFoundOne" : "notFoundMany", { list: unverified.join(", ") })}</p>
      )}
      {unknownTags.length > 0 && <p>{t(unknownTags.length === 1 ? "unknownOne" : "unknownMany", { tags })}</p>}
    </div>
  );
}
