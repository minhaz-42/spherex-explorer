import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { KnownObjectsPanel } from "../src/features/known/KnownObjects";
import { setLang } from "../src/lib/i18n";
import type { Frame, KnownObjects } from "../src/lib/types";

const KEYS = ["qr2/level2/a_0001_1D2.fits", "qr2/level2/a_0002_1D2.fits"];
const frames = KEYS.map((key) => ({ key }) as unknown as Frame);

function answer(objects: KnownObjects["objects"], incomplete?: KnownObjects["incomplete"]): KnownObjects {
  return {
    field: { ra: 326.891, dec: -7.683, sizeDeg: 0.3 },
    searched: { referenceKey: KEYS[0]!, referenceMjd: 60809.36, halfWidthDeg: 0.741, vmagLimit: 20, candidates: 15 },
    objects,
    framesWithoutState: [],
    source: "JPL Small-Body Identification (two-pass) and JPL Horizons",
    method: "Predictions for catalogued objects, not detections.",
    retrievedAt: "2026-09-28T10:00:00Z",
    ...(incomplete ? { incomplete } : {}),
  };
}

const HEBE = {
  name: "6 Hebe (A847 NA)",
  vmag: 10,
  rateArcsecPerHour: 40,
  instantRateArcsecPerHour: 41,
  positions: KEYS.map((key, i) => ({ key, mjd: 60809 + i / 24, ra: 326.89, dec: -7.68, inField: true, distanceAu: 1.9 })),
} as unknown as KnownObjects["objects"][number];

const PARTIAL = {
  horizonsFailed: ["6 Hebe (A847 NA)"],
  message:
    "JPL Horizons did not answer for 1 of 15 catalogued bodies near this field, so this list may be incomplete. Try again in a moment.",
};

function serve(...bodies: KnownObjects[]) {
  const fetch = vi.fn(async () => {
    const body = bodies.length > 1 ? bodies.shift()! : bodies[0]!;
    return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

function panel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <KnownObjectsPanel
        sequence={frames}
        current={frames[0]}
        target={{ ra: 326.891, dec: -7.683 }}
        fov={0.3}
        source="live"
        enabled
        show
        onShow={() => {}}
        onResult={() => {}}
      />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  act(() => setLang("en"));
});

describe("an incomplete answer from JPL", () => {
  it("never reads as 'JPL knows no asteroid here', and offers a fresh lookup", async () => {
    const fetch = serve(answer([], PARTIAL), answer([HEBE]));
    panel();
    await userEvent.click(screen.getByRole("button", { name: /Check JPL for known objects/ }));
    expect(await screen.findByText(PARTIAL.message)).toBeInTheDocument();
    expect(screen.queryByText(/JPL knows no asteroid/)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("6 Hebe (A847 NA)")).toBeInTheDocument();
    expect(screen.queryByText(PARTIAL.message)).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("shows what is known with the warning above it", async () => {
    serve(answer([HEBE], { ...PARTIAL, horizonsFailed: ["2 Pallas (A802 FA)"] }));
    panel();
    await userEvent.click(screen.getByRole("button", { name: /Check JPL for known objects/ }));
    expect(await screen.findByText("6 Hebe (A847 NA)")).toBeInTheDocument();
    expect(screen.getByText(PARTIAL.message)).toBeInTheDocument();
  });

  it("says it in Bangla too", async () => {
    act(() => setLang("bn"));
    serve(answer([], PARTIAL));
    panel();
    await userEvent.click(screen.getByRole("button", { name: /JPL/ }));
    expect(await screen.findByText(/1টি পরিচিত বস্তুর অবস্থান জানায়নি/)).toBeInTheDocument();
  });
});
