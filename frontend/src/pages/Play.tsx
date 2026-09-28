import { useQuery } from "@tanstack/react-query";

import { SpotTheMover } from "../features/game/SpotTheMover";
import { getJson } from "../lib/api";
import { useT } from "../lib/i18n";
import { PLAY } from "./play.messages";

/** "Spot the mover": a blink game on real SPHEREx frames, scored against JPL. */
export function Play() {
  const t = useT(PLAY);
  const health = useQuery({
    queryKey: ["health"],
    queryFn: ({ signal }) => getJson<{ snapshotAvailable: boolean }>("/health", {}, signal),
    staleTime: 5 * 60 * 1000,
  });
  const source = health.data?.snapshotAvailable ? "snapshot" : "live";
  return (
    <div className="page flex flex-col gap-10 py-12">
      <header className="max-w-3xl">
        <p className="kicker">{t("kicker")}</p>
        <h1 className="mt-3 text-[length:var(--fs-h1)]">{t("title")}</h1>
        <p className="prose-body mt-4">{t("intro")}</p>
      </header>
      <SpotTheMover source={source} />
    </div>
  );
}
