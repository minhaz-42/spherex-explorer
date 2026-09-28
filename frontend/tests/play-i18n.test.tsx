import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { createMemoryRouter, MemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { routes } from "../src/app/router";
import { DecadesSection } from "../src/features/decades/DecadesSection";
import { SpotTheMover } from "../src/features/game/SpotTheMover";
import { exportName } from "../src/features/share/exportBlink";
import { ShareMenu } from "../src/features/share/ShareMenu";
import { describeSeries } from "../src/features/share/sonify";
import { SonifyButton } from "../src/features/share/SonifyButton";
import { earthRotationDeg, formatLatLon, julian, subPoint } from "../src/features/spacecraft/earth";
import { WhereWasSpherex } from "../src/features/spacecraft/WhereWasSpherex";
import { setLang } from "../src/lib/i18n";
import type { DiscoverCase } from "../src/lib/types";

// SPHEREx's recorded state for the first Iris frame (as in spacecraft.test.ts).
const ISO = "2025-12-02T12:06:59.475";
const R: [number, number, number] = [-6445.162388862119, 2554.7445570790683, 1164.9117928838464];
const V: [number, number, number] = [1.5563548114357402, 0.5259860654002176, 7.350424549924576];
const WHERE = { positionKm: R, velocityKmS: V, isoTime: ISO, target: { ra: 161.29678, dec: 2.44824 } };

const SPECTRUM = {
  mode: "spectrum" as const,
  points: [
    { x: 2.2, y: 1 },
    { x: 0.55, y: 4 },
    { x: 1.2, y: 2 },
  ],
  units: { x: "µm", y: "Jy" },
  xName: "wavelength",
};

const frame = (key: string, isoMid: string) => ({ obsId: key, key, isoMid, wavelengthUm: 1.104 });

const IRIS: DiscoverCase = {
  id: "iris-2025-12",
  kind: "moving",
  title: "Asteroid (7) Iris crosses a field in Sextans",
  summary: "",
  target: { ra: 161.29678, dec: 2.44824, name: "(7) Iris", constellation: "Sextans" },
  viewer: { seq: "", det: 2, f: "", fa: "", cmp: "", fov: 0.1 },
  observed: { start: ISO, end: ISO, frames: 19, pointings: 7, detector: 2, wavelengthUm: [1.1, 1.66] },
  preview: { a: frame("a", ISO), b: frame("b", "2025-12-02T21:48:00") },
  evidence: [],
  caution: "",
};
const M31_CASE: DiscoverCase = { ...IRIS, id: "m31-spectrum", kind: "spectrum", title: "The core of the Andromeda Galaxy" };

const BARNARD = {
  id: "V* V2500 Oph",
  name: "Barnard's Star",
  ra: 269.452083,
  dec: 4.693364,
  properMotion: { raMasYr: -801.551, decMasYr: 10362.394 },
};

/** Answers the API paths given and 404s everything else (images, plates, the coastline file). */
function mockFetch(routes: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const path = new URL(url, "http://localhost").pathname;
      if (!(path in routes)) {
        return new Response(JSON.stringify({ error: { code: "not_found", message: "no" } }), { status: 404 });
      }
      return new Response(JSON.stringify(routes[path]), { status: 200, headers: { "Content-Type": "application/json" } });
    }),
  );
}

function wrap(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>,
  );
}

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const bangla = () => act(() => setLang("bn"));

afterEach(() => {
  act(() => setLang("en"));
  vi.unstubAllGlobals();
});

describe("plain functions in Bangla", () => {
  it("writes the ground point with Bangla compass letters, and English by default", () => {
    expect(formatLatLon({ lat: 9.4, lon: -94.62 }, "bn")).toBe("9.4° উ, 94.6° প");
    expect(formatLatLon({ lat: -4.42, lon: 164.1 }, "bn")).toBe("4.4° দ, 164.1° পূ");
    expect(formatLatLon({ lat: 9.4, lon: -94.62 })).toBe("9.4° N, 94.6° W");
    expect(formatLatLon({ lat: -4.42, lon: 164.1 }, "en")).toBe("4.4° S, 164.1° E");
  });

  it("describes a spectrum in Bangla, keeping Western digits and the units", () => {
    const text = describeSeries(SPECTRUM, "bn");
    expect(text).toBe(
      "3টি বিন্দু, 0.55 থেকে 2.2 µm পর্যন্ত। সবচেয়ে উজ্জ্বল তরঙ্গদৈর্ঘ্য 0.55 µm-এ (4 Jy), সবচেয়ে ক্ষীণ 2.2 µm-এ। সব মিলিয়ে দীর্ঘতর তরঙ্গদৈর্ঘ্যের দিকে উজ্জ্বলতা কমে।",
    );
    expect(describeSeries({ ...SPECTRUM, points: [{ x: 1, y: 1 }] }, "bn")).toBe("বর্ণনা করার মতো যথেষ্ট বিন্দু নেই।");
  });

  it("describes a flat series over time in Bangla", () => {
    const series = {
      mode: "series" as const,
      points: [
        { x: 1, y: 1 },
        { x: 2, y: 1.2 },
        { x: 3, y: 1 },
      ],
      units: { x: "h", y: "Jy" },
      xName: "time",
    };
    expect(describeSeries(series, "bn")).toBe(
      "3টি বিন্দু, 1 থেকে 3 h পর্যন্ত। সবচেয়ে উজ্জ্বল সময় 2 h-এ (1.2 Jy), সবচেয়ে ক্ষীণ 1 h-এ। সব মিলিয়ে সময়ের সঙ্গে উজ্জ্বলতা মোটামুটি একই থাকে।",
    );
    expect(describeSeries(series)).toBe(
      "3 points from 1 to 3 h. Brightest at time 2 h (1.2 Jy), faintest at 1 h. Overall it stays roughly level over time.",
    );
  });

  it("keeps the English summary word for word by default", () => {
    expect(describeSeries(SPECTRUM)).toBe(
      "3 points from 0.55 to 2.2 µm. Brightest at wavelength 0.55 µm (4 Jy), faintest at 2.2 µm. Overall it falls towards longer wavelengths.",
    );
    expect(describeSeries({ ...SPECTRUM, points: [] })).toBe("Not enough points to describe.");
  });

  it("names a Bangla export in Bangla instead of reducing it to its numbers", () => {
    expect(exportName("76 বছর জুড়ে বার্নার্ডের তারা", "gif")).toBe("spherex-76-বছর-জুড়ে-বার্নার্ডের-তারা.gif".normalize("NFC"));
    expect(exportName("Barnard's Star across 76 years", "gif")).toBe("spherex-barnard-s-star-across-76-years.gif");
  });
});

describe("where SPHEREx was, in Bangla", () => {
  it("labels the read-outs and the picture in Bangla, and switches back live", () => {
    mockFetch({});
    bangla();
    render(<WhereWasSpherex where={WHERE} />);
    const place = formatLatLon(subPoint(R, earthRotationDeg(julian(ISO))), "bn");
    for (const label of ["উচ্চতা", "গতি", "নিচের ভূমিবিন্দু", "সূর্য থেকে লক্ষ্যের কোণ"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText(place)).toBeInTheDocument();
    expect(screen.getByText("652 km")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAccessibleName(
      `${ISO} UTC-তে পৃথিবী। SPHEREx তখন 652 km উচ্চতায়, ঠিক নিচে ${place}; এটি লক্ষ্যবস্তুর দিকে তাকিয়ে আছে।`,
    );
    expect(screen.getByText(/এটাই লম্বন।/)).toBeInTheDocument();

    act(() => setLang("en"));
    expect(screen.getByText("Height")).toBeInTheDocument();
    expect(screen.getByText("Target from the Sun")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAccessibleName(
      `Earth at ${ISO} UTC, with SPHEREx 652 km up over ${formatLatLon(subPoint(R, earthRotationDeg(julian(ISO))))}, looking towards the target.`,
    );
  });
});

describe("sharing and listening, in Bangla", () => {
  it("offers the exports in Bangla and explains why one cannot be made yet", async () => {
    bangla();
    render(<ShareMenu build={() => null} />);
    await userEvent.click(screen.getByRole("button", { name: "শেয়ার করুন" }));
    expect(screen.getByRole("menuitem", { name: "GIF ডাউনলোড করুন" })).toBeInTheDocument();
    // jsdom has neither a share sheet nor a video recorder.
    expect(screen.getByRole("menuitem", { name: "লিংক কপি করুন" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "ভিডিও ডাউনলোড করুন" })).toBeNull();
    expect(screen.getByText("এক্সপোর্ট করা ফাইলে তারিখ, তরঙ্গদৈর্ঘ্য ও কৃতজ্ঞতা লেখা থাকে।")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("menuitem", { name: "GIF ডাউনলোড করুন" }));
    expect(screen.getByText("ছবিগুলো এখনো লোড হচ্ছে।")).toBeInTheDocument();
  });

  it("keeps the share menu in English by default", async () => {
    render(<ShareMenu build={() => null} />);
    await userEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(screen.getByRole("menuitem", { name: "Download GIF" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Copy link" })).toBeInTheDocument();
    expect(screen.getByText("Exports carry the dates, wavelengths and credits.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("menuitem", { name: "Download GIF" }));
    expect(screen.getByText("The images are still loading.")).toBeInTheDocument();
  });

  it("describes what the Listen button plays in Bangla", () => {
    bangla();
    render(<SonifyButton spec={SPECTRUM} />);
    const button = screen.getByRole("button", { name: "শুনুন" });
    expect(button).toHaveAccessibleDescription(describeSeries(SPECTRUM, "bn"));
  });
});

describe("the game in Bangla", () => {
  it("shows the round, the task and a clear failure when the frames cannot load", async () => {
    mockFetch({ "/api/cases": { built: null, cases: [IRIS, M31_CASE] } });
    bangla();
    wrap(<SpotTheMover source="live" />);
    expect(screen.getByText("রাউন্ডগুলো লোড হচ্ছে…")).toBeInTheDocument();
    expect(await screen.findByText("রাউন্ড 1/1 · স্কোর 0/0")).toBeInTheDocument();
    expect(screen.getByText("2 Dec 2025 · ফ্রেম A ও B")).toBeInTheDocument();
    expect(screen.getByText(/আকাশের এই অংশে কিছু একটা লাফিয়ে সরে যায়।/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "দেখিয়ে দিন" })).toBeDisabled();
    expect(screen.getByRole("application")).toHaveAccessibleName(
      `পালা করে দেখানো দুটি SPHEREx ফ্রেম: ${IRIS.title}। দুই ফ্রেমের মধ্যে যে আলোকবিন্দু লাফিয়ে সরে যায়, সেটিতে ট্যাপ করুন।`,
    );
    expect(await screen.findByText("এই রাউন্ডটি এখন লোড করা যাচ্ছে না।")).toBeInTheDocument();
  });

  it("says so in Bangla when there are no moving-object rounds", async () => {
    mockFetch({ "/api/cases": { built: null, cases: [M31_CASE] } });
    bangla();
    wrap(<SpotTheMover source="live" />);
    expect(await screen.findByText("এই মুহূর্তে চলমান বস্তুর কোনো উদাহরণ পাওয়া যাচ্ছে না।")).toBeInTheDocument();
  });

  it("keeps the game in English by default", async () => {
    mockFetch({ "/api/cases": { built: null, cases: [IRIS] } });
    wrap(<SpotTheMover source="live" />);
    expect(await screen.findByText("Round 1 of 1 · score 0/0")).toBeInTheDocument();
    expect(screen.getByText("2 Dec 2025 · frames A and B")).toBeInTheDocument();
    expect(
      screen.getByText("Stars stay where they are between two visits. Something in this field jumps. Tap it."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show me" })).toBeDisabled();
    expect(await screen.findByText("This round could not be loaded right now.")).toBeInTheDocument();
  });

  it("introduces the game page in Bangla", async () => {
    mockFetch({ "/api/cases": { built: null, cases: [IRIS] } });
    bangla();
    renderAt("/play");
    expect(screen.getByRole("heading", { level: 1, name: "চলমান বস্তুটি খুঁজুন" })).toBeInTheDocument();
    expect(screen.getByText(/উত্তরটি কোথায়, তা বলে দেয় JPL-এর কক্ষপথের হিসাব।/)).toBeInTheDocument();
    expect(await screen.findByText("রাউন্ড 1/1 · স্কোর 0/0")).toBeInTheDocument();
  });
});

describe("across the decades, in Bangla", () => {
  it("opens for a fast star and explains the tiles in Bangla", async () => {
    mockFetch({ "/api/object": BARNARD });
    bangla();
    wrap(<DecadesSection ra={BARNARD.ra} dec={BARNARD.dec} label="Barnard's Star" source="live" />);
    expect(screen.getByText("দশকের পর দশক")).toBeInTheDocument();
    // The name is SIMBAD's, or the atlas's Bangla one if the atlas lists the star.
    const name = "(Barnard's Star|বার্নার্ডের তারা)";
    expect(screen.getByText(new RegExp(`^1950-এর দশক থেকে SPHEREx পর্যন্ত ${name}$`))).toBeInTheDocument();
    // The catalogue's proper motion marks it as fast, which opens the comparison straight away.
    expect(await screen.findByText(/এই তারাটি এত দ্রুত সরে যে ছবিগুলোতেই তা দেখা যায়।$/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "আগের জরিপ" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "পরের জরিপ" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "দশকগুলো ব্লিংক করে দেখুন" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "সময়ের ক্রমে জরিপগুলো" })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${name} প্রতি বছর আকাশে 10.4″ সরে যায়`))).toBeInTheDocument();
    // The plates are not mocked, so the first tile reports that it could not be loaded.
    expect(await screen.findByText("POSS-I-এর ছবিটি এখন লোড করা যাচ্ছে না।")).toBeInTheDocument();
  });
});

describe("the tour and the embed, in Bangla", () => {
  it("narrates the tour in Bangla and steps with the arrow keys", async () => {
    mockFetch({});
    bangla();
    renderAt("/tour");
    expect(screen.getByText("বিচারক মোড · 1/8")).toBeInTheDocument();
    expect(screen.getByText("NASA Space Apps Challenge 2026 · Planet X and SPHEREx")).toBeInTheDocument();
    expect(screen.getByText(/ইনফ্রারেড আলোর 102টি রঙে পুরো আকাশের মানচিত্র/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "আগেরটি" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "ট্যুর ছেড়ে বেরিয়ে যান" })).toHaveAttribute("href", "/");
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByText("বিচারক মোড · 2/8")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "বছরে দুবার আকাশের নতুন মানচিত্র" })).toBeInTheDocument();
  });

  it("names the challenge in the tour's English opening", () => {
    mockFetch({});
    renderAt("/tour");
    expect(screen.getByText("Judge mode · 1 of 8")).toBeInTheDocument();
    expect(screen.getByText("NASA Space Apps Challenge 2026 · Planet X and SPHEREx")).toBeInTheDocument();
    expect(
      screen.getByText(
        "NASA's SPHEREx telescope maps the whole sky every six months in 102 colours of infrared light. This app lets anyone see how the sky changes in those images.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("explains a missing embedded case in Bangla", async () => {
    mockFetch({ "/api/cases": { built: null, cases: [IRIS] } });
    bangla();
    renderAt("/embed/no-such-case");
    expect(await screen.findByText("“no-such-case” নামে কোনো উদাহরণ নেই।")).toBeInTheDocument();
  });
});
