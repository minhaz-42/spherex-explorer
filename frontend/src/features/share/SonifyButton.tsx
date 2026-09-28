import { Square, Volume2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { useLang, useT } from "../../lib/i18n";
import { SONIFY } from "./messages";
import { describeSeries, play, type SonifySpec } from "./sonify";

/** A "Listen" button that plays data as sound, with the same information written out for screen readers. */
export function SonifyButton({ spec, label }: { spec: SonifySpec; label?: string }) {
  const t = useT(SONIFY);
  const lang = useLang();
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handle = useRef<{ stop: () => void } | null>(null);
  const id = useId();
  const summary = describeSeries(spec, lang);

  useEffect(() => () => handle.current?.stop(), []);

  const toggle = () => {
    if (playing) {
      handle.current?.stop();
      handle.current = null;
      setPlaying(false);
      return;
    }
    try {
      const h = play(spec);
      handle.current = h;
      setPlaying(true);
      setError(null);
      void h.done.then(() => {
        if (handle.current === h) {
          handle.current = null;
          setPlaying(false);
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("noSound"));
    }
  };

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        aria-pressed={playing}
        aria-describedby={`${id}-summary`}
        onClick={toggle}
        disabled={spec.points.length < 2}
      >
        {playing ? <Square size={13} aria-hidden /> : <Volume2 size={14} aria-hidden />}
        {playing ? t("stop") : (label ?? t("listen"))}
      </button>
      <span id={`${id}-summary`} className="visually-hidden">
        {summary}
      </span>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </span>
  );
}
