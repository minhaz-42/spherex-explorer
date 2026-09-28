import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";

import { BlinkPreview } from "../features/discover/BlinkPreview";
import { getJson } from "../lib/api";
import { useT } from "../lib/i18n";
import { caseLink, casesQuery } from "../lib/queries";
import { EMBED } from "./embed.messages";

/**
 * A chrome-free view of one Discover case, for embedding in a classroom page or slide:
 * /embed/<case id>. It shows the real blink with its caption and credits, and links back.
 */
export function Embed() {
  const t = useT(EMBED);
  const { caseId } = useParams();
  const cases = useQuery(casesQuery());
  const health = useQuery({
    queryKey: ["health"],
    queryFn: ({ signal }) => getJson<{ snapshotAvailable: boolean }>("/health", {}, signal),
    staleTime: 5 * 60 * 1000,
  });
  const snapshot = !!health.data?.snapshotAvailable;
  const found = cases.data?.cases.find((c) => c.id === caseId);
  const home = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <main className="flex min-h-dvh flex-col gap-3 bg-bg p-3 text-text">
      {found ? (
        <>
          <div className="overflow-hidden rounded-[12px]">
            <BlinkPreview
              ra={found.target.ra}
              dec={found.target.dec}
              fov={found.viewer.fov}
              a={found.preview.a}
              b={found.preview.b}
              source={snapshot ? "snapshot" : "live"}
              label={found.title}
            />
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium">{found.title}</p>
            <a
              className="link text-sm"
              href={`${home}${caseLink(found, snapshot ? "snapshot" : undefined)}`}
              target="_top"
              rel="noreferrer"
            >
              {t("open")}
            </a>
          </div>
          <p className="text-xs text-faint">{t("credit")}</p>
        </>
      ) : (
        <p className="m-auto text-sm text-muted">
          {cases.isPending ? t("loading") : t("missing", { id: caseId ?? "" })}
        </p>
      )}
    </main>
  );
}
