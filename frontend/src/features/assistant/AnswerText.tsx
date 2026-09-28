import type { ReactNode } from "react";

import { toBlocks } from "./blocks";
import type { EvidenceSource } from "./stream";

/**
 * A model's answer as safe React elements: paragraphs, bulleted and numbered lists, **bold**,
 * and citation tags like [E2] as buttons that open the source. No HTML is ever injected.
 */

// Evidence tags are E (the app's data and cases) and K (method notes). "C1" is a search candidate's
// name, not a source, so it stays plain text.
const INLINE = /(\*\*[^*\n]+\*\*|\[[EK]\d{1,2}(?:\s*,\s*[EK]\d{1,2})*\])/g;

interface InlineProps {
  sources: Map<string, EvidenceSource>;
  onCite: (tag: string) => void;
}

function inline(text: string, { sources, onCite }: InlineProps): ReactNode[] {
  const out: ReactNode[] = [];
  text.split(INLINE).forEach((part, i) => {
    if (!part) return;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      out.push(<strong key={i}>{part.slice(2, -2)}</strong>);
      return;
    }
    if (/^\[[EK]\d/.test(part)) {
      const tags = part.slice(1, -1).split(/\s*,\s*/);
      tags.forEach((tag, j) => {
        const src = sources.get(tag);
        out.push(
          src ? (
            <button
              key={`${i}-${j}`}
              type="button"
              className="num mx-0.5 inline-flex h-5 items-center rounded-[6px] border border-rule-strong bg-sunk px-1.5 align-[0.1em] text-[0.75rem] font-semibold leading-none text-muted transition-colors hover:border-rule-control hover:text-text"
              title={src.title}
              aria-label={`Source ${tag}: ${src.title}`}
              onClick={() => onCite(tag)}
            >
              {tag}
            </button>
          ) : (
            <span key={`${i}-${j}`} className="num text-[0.75rem] text-faint" title="This source does not exist">
              [{tag}?]
            </span>
          ),
        );
      });
      return;
    }
    out.push(part);
  });
  return out;
}

export function AnswerText({
  text,
  sources,
  onCite,
}: {
  text: string;
  sources: EvidenceSource[];
  onCite: (tag: string) => void;
}) {
  const props: InlineProps = { sources: new Map(sources.map((s) => [s.tag, s])), onCite };
  return (
    <div className="space-y-2.5">
      {toBlocks(text).map((block, i) => {
        if (block.kind === "p") return <p key={i}>{inline(block.text, props)}</p>;
        const items = block.items.map((item, j) => <li key={j}>{inline(item, props)}</li>);
        return block.kind === "ol" ? (
          <ol key={i} className="list-decimal space-y-1 pl-5 marker:text-faint">
            {items}
          </ol>
        ) : (
          <ul key={i} className="list-disc space-y-1 pl-5 marker:text-faint">
            {items}
          </ul>
        );
      })}
    </div>
  );
}
