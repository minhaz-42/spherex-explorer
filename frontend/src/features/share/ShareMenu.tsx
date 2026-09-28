import { Check, Download, Film, Link2, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useT } from "../../lib/i18n";
import { blinkToGif, blinkToVideo, type BlinkExport, downloadBlob, exportName, videoType } from "./exportBlink";
import { SHARE } from "./messages";

type Job = "gif" | "video" | "link";

type Status =
  | { kind: "idle" }
  | { kind: "busy"; what: Job }
  | { kind: "done"; what: Job }
  | { kind: "error"; message: string };

const MAKING = { gif: "makingGif", video: "makingVideo", link: "makingLink" } as const;
const DONE = { gif: "doneGif", video: "doneVideo", link: "linkReady" } as const;

/**
 * Share or export a blink: download it as a GIF or a video (with its caption and credits burned in),
 * copy a link to this view, or hand it to the system share sheet where there is one.
 * `build` is called only when the visitor asks, so nothing is rendered until then.
 */
export function ShareMenu({ build, disabled = false }: { build: () => BlinkExport | null; disabled?: boolean }) {
  const t = useT(SHARE);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const wrapRef = useRef<HTMLDivElement>(null);
  const canVideo = typeof window !== "undefined" && videoType() !== null;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const run = async (what: Job, job: () => Promise<void> | void) => {
    setStatus({ kind: "busy", what });
    try {
      await job();
      setStatus({ kind: "done", what });
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : t("failed") });
    }
  };

  const gif = () =>
    run("gif", () => {
      const spec = build();
      if (!spec) throw new Error(t("stillLoading"));
      downloadBlob(blinkToGif(spec), exportName(spec.title, "gif"));
    });

  const video = () =>
    run("video", async () => {
      const spec = build();
      if (!spec) throw new Error(t("stillLoading"));
      const blob = await blinkToVideo(spec);
      downloadBlob(blob, exportName(spec.title, blob.type.includes("mp4") ? "mp4" : "webm"));
    });

  const link = () =>
    run("link", async () => {
      const url = window.location.href;
      if (navigator.share) await navigator.share({ title: document.title, url });
      else await navigator.clipboard.writeText(url);
    });

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <Share2 size={14} aria-hidden /> {t("share")}
      </button>
      {open ? (
        <div role="menu" className="card absolute right-0 z-30 mt-2 w-60 p-1.5">
          <button type="button" role="menuitem" className="btn btn-ghost btn-sm w-full justify-start" onClick={gif}>
            <Download size={14} aria-hidden /> {t("gif")}
          </button>
          {canVideo ? (
            <button type="button" role="menuitem" className="btn btn-ghost btn-sm w-full justify-start" onClick={video}>
              <Film size={14} aria-hidden /> {t("video")}
            </button>
          ) : null}
          <button type="button" role="menuitem" className="btn btn-ghost btn-sm w-full justify-start" onClick={link}>
            <Link2 size={14} aria-hidden />{" "}
            {typeof navigator !== "undefined" && "share" in navigator ? t("shareLink") : t("copyLink")}
          </button>
          <p className="px-3 pb-1.5 pt-1 text-xs text-faint" aria-live="polite">
            {status.kind === "busy" ? (
              t(MAKING[status.what])
            ) : status.kind === "done" ? (
              <span className="inline-flex items-center gap-1 text-live">
                <Check size={12} aria-hidden /> {t(DONE[status.what])}
              </span>
            ) : status.kind === "error" ? (
              <span className="text-danger">{status.message}</span>
            ) : (
              t("hint")
            )}
          </p>
        </div>
      ) : null}
    </div>
  );
}
