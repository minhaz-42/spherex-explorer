import { ArrowRight, ChevronRight } from "lucide-react";
import { Link } from "react-router";

import { plural } from "../../lib/format";
import { AnswerText } from "./AnswerText";
import type { Turn } from "./conversation";
import type { Grounding } from "./stream";

/** Links in answers are built by the server; only ever follow them inside this app. */
function internal(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//");
}

/** One question and its answer, with the answer's links, checks and numbered sources. */
export function TurnView({
  turn,
  sourcesShown,
  onSourcesToggle,
  onCite,
}: {
  turn: Turn;
  sourcesShown: boolean;
  onSourcesToggle: (open: boolean) => void;
  onCite: (tag: string) => void;
}) {
  const sources = turn.meta?.sources ?? [];
  const actions = (turn.meta?.actions ?? []).filter((a) => internal(a.href));
  const working = turn.status === "gathering" || turn.status === "writing";
  return (
    <article className="space-y-4" aria-busy={working}>
      <div className="flex flex-col items-end gap-1">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-[var(--radius-lg)] rounded-br-[6px] bg-sunk px-4 py-2.5">
          {turn.question}
        </p>
        {turn.about && <p className="text-xs text-faint">About the view of {turn.about}</p>}
      </div>

      <div className="space-y-4 leading-relaxed">
        {turn.notice && <p className="note note-warn">{turn.notice}</p>}
        {turn.answer ? (
          <AnswerText text={turn.answer} sources={sources} onCite={onCite} />
        ) : working ? (
          <p className="text-muted">{turn.status === "gathering" ? "Gathering the evidence…" : "Writing…"}</p>
        ) : null}
        {turn.error && <p className="note note-danger">{turn.error}</p>}
        {turn.status === "stopped" && <p className="text-sm text-faint">Stopped.</p>}

        {actions.length > 0 && !working && (
          <ul className="flex flex-col items-start gap-2">
            {actions.map((a) => (
              <li key={a.href}>
                <Link to={a.href} className="btn btn-secondary btn-sm h-auto whitespace-normal py-1.5 text-left leading-snug">
                  {a.label}
                  <ArrowRight size={14} className="shrink-0" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {turn.status === "done" && turn.grounding && <GroundingNote grounding={turn.grounding} />}
        {turn.mode === "local-model" && turn.status === "done" && (turn.meta?.notes.length ?? 0) > 0 && (
          <p className="text-sm text-faint">{turn.meta!.notes.join(" ")}</p>
        )}

        {!working && turn.mode && (
          <p className="border-t border-rule pt-3 text-xs text-faint">
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
            <summary>
              <ChevronRight size={15} className="disclosure-chevron" aria-hidden />
              {sources.length > 0 ? `Sources (${sources.length})` : "Sources (none)"}
            </summary>
            {sources.length > 0 ? (
              <ol className="mt-3 space-y-3">
                {sources.map((s) => (
                  <li key={s.tag} id={`src-${turn.id}-${s.tag}`} tabIndex={-1} className="rounded-[8px] px-1 py-1">
                    <p className="flex items-baseline gap-2.5">
                      <span className="num w-7 shrink-0 text-xs font-semibold text-muted">{s.tag}</span>
                      <span className="text-sm font-semibold text-text">{s.title}</span>
                    </p>
                    <p className="mt-1 pl-[2.375rem] text-sm leading-relaxed text-muted">{s.text}</p>
                    {s.source && <p className="mt-0.5 pl-[2.375rem] text-xs text-faint">{s.source}</p>}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-muted">No evidence matched this question.</p>
            )}
          </details>
        )}
      </div>
    </article>
  );
}

function GroundingNote({ grounding }: { grounding: Grounding }) {
  const { unverified, unknownTags } = grounding;
  if (unverified.length === 0 && unknownTags.length === 0) return null;
  return (
    <div className="note note-warn space-y-1">
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
