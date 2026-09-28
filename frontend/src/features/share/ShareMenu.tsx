import { Check, Download, Film, Link2, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { blinkToGif, blinkToVideo, type BlinkExport, downloadBlob, exportName, videoType } from "./exportBlink";

type Status =
  | { kind: "idle" }
  | { kind: "busy"; what: string }
  | { kind: "done"; what: string }
  | { kind: "error"; message: string };

/**
 * Share or export a blink: download it as a GIF or a video (with its caption and credits burned in),
 * copy a link to this view, or hand it to the system share sheet where there is one.
 * `build` is called only when the visitor asks, so nothing is rendered until then.
 */
export function ShareMenu({ build, disabled = false }: { build: () => BlinkExport | null; disabled?: boolean }) {
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

  const run = async (what: string, job: () => Promise<void> | void) => {
    setStatus({ kind: "busy", what });
    try {
      await job();
      setStatus({ kind: "done", what });
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "That did not work." });
    }
  };

  const gif = () =>
    run("GIF", () => {
      const spec = build();
      if (!spec) throw new Error("The images are still loading.");
      downloadBlob(blinkToGif(spec), exportName(spec.title, "gif"));
    });

  const video = () =>
    run("video", async () => {
      const spec = build();
      if (!spec) throw new Error("The images are still loading.");
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
        <Share2 size={14} aria-hidden /> Share
      </button>
      {open ? (
        <div role="menu" className="card absolute right-0 z-30 mt-2 w-60 p-1.5">
          <button type="button" role="menuitem" className="btn btn-ghost btn-sm w-full justify-start" onClick={gif}>
            <Download size={14} aria-hidden /> Download GIF
          </button>
          {canVideo ? (
            <button type="button" role="menuitem" className="btn btn-ghost btn-sm w-full justify-start" onClick={video}>
              <Film size={14} aria-hidden /> Download video
            </button>
          ) : null}
          <button type="button" role="menuitem" className="btn btn-ghost btn-sm w-full justify-start" onClick={link}>
            <Link2 size={14} aria-hidden />{" "}
            {typeof navigator !== "undefined" && "share" in navigator ? "Share link" : "Copy link"}
          </button>
          <p className="px-3 pb-1.5 pt-1 text-xs text-faint" aria-live="polite">
            {status.kind === "busy" ? (
              `Making the ${status.what}…`
            ) : status.kind === "done" ? (
              <span className="inline-flex items-center gap-1 text-live">
                <Check size={12} aria-hidden /> {status.what === "link" ? "Link ready" : `${status.what} downloaded`}
              </span>
            ) : status.kind === "error" ? (
              <span className="text-danger">{status.message}</span>
            ) : (
              "Exports carry the dates, wavelengths and credits."
            )}
          </p>
        </div>
      ) : null}
    </div>
  );
}
