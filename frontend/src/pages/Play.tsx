import { useQuery } from "@tanstack/react-query";

import { SpotTheMover } from "../features/game/SpotTheMover";
import { getJson } from "../lib/api";

/** "Spot the mover": a blink game on real SPHEREx frames, scored against JPL. */
export function Play() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: ({ signal }) => getJson<{ snapshotAvailable: boolean }>("/health", {}, signal),
    staleTime: 5 * 60 * 1000,
  });
  const source = health.data?.snapshotAvailable ? "snapshot" : "live";
  return (
    <div className="page flex flex-col gap-10 py-12">
      <header className="max-w-3xl">
        <p className="kicker">Play</p>
        <h1 className="mt-3 text-[length:var(--fs-h1)]">Spot the mover</h1>
        <p className="prose-body mt-4">
          Each round blinks two real SPHEREx images of the same patch of sky, taken hours apart. The stars stay put.
          Find the point of light that jumps, and tap it. JPL's orbit calculations say where the answer is.
        </p>
      </header>
      <SpotTheMover source={source} />
    </div>
  );
}
