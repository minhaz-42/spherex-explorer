import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { routes } from "../src/app/router";
import { BANDS } from "../src/components/space/bands";
import { bandWhat, BODY_NAMES, bodyText, GLOBE, joinHyphens, ORRERY } from "../src/components/space/messages";
import { createScene, drawScene } from "../src/components/space/orreryScene";
import { SkyGlobe } from "../src/components/space/SkyGlobe";
import { PALETTES } from "../src/components/space/theme";
import { setLang, translate } from "../src/lib/i18n";
import { LANDING } from "../src/pages/landing.messages";

function renderLanding() {
  // Every API call 404s, so the page shows its offline states (the Iris illustration, no atlas data).
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ error: { code: "not_found", message: "no" } }), { status: 404 })),
  );
  const router = createMemoryRouter(routes, { initialEntries: ["/"] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

/** A 2D context that records the text drawn on it and ignores everything else. */
function recordingContext(texts: string[]): CanvasRenderingContext2D {
  const noop = () => ({ addColorStop() {}, width: 40 });
  return new Proxy({} as CanvasRenderingContext2D, {
    get: (_, prop) => {
      if (prop === "fillText") return (text: string) => texts.push(text);
      if (prop === "createImageData") return (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) });
      return noop;
    },
    set: () => true,
  });
}

afterEach(() => {
  act(() => setLang("en"));
  vi.unstubAllGlobals();
});

describe("landing page in Bangla", () => {
  it("translates the hero, the three questions and the search", () => {
    act(() => setLang("bn"));
    renderLanding();
    expect(screen.getByRole("heading", { level: 1, name: /আকাশের একটি বিন্দু বেছে\sনিন।\sবদলটা\sদেখুন।/ })).toBeInTheDocument();
    for (const q of ["কোথায়?", "কখন?", "কী বদলেছে?"]) {
      expect(screen.getByRole("heading", { name: q })).toBeInTheDocument();
    }
    expect(screen.getByRole("heading", { name: /তিনটি প্রশ্ন, ধাপে ধাপে/ })).toBeInTheDocument();
    expect(screen.getAllByLabelText("বস্তুর নাম বা স্থানাঙ্ক")).toHaveLength(2);
    expect(screen.getAllByPlaceholderText("যেমন M31, Orion Nebula বা 10.68 41.27")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "খুঁজুন" })).toHaveLength(2);
    expect(screen.getByRole("link", { name: "অ্যান্ড্রোমিডা গ্যালাক্সি" })).toHaveAttribute("href", "/explore?q=M31");
    expect(screen.getByRole("link", { name: /গ্রহাণু \(7\)\sIris/ })).toHaveAttribute("href", "/discover");
    expect(screen.getByRole("link", { name: "খেলুন: চলমান বস্তুটি খুঁজুন" })).toHaveAttribute("href", "/play");
    expect(screen.getByRole("link", { name: "90 সেকেন্ডের ট্যুর দেখুন" })).toHaveAttribute("href", "/tour");
    // Numbers stay in Western digits, units in their usual symbols.
    expect(screen.getByText(/আপনার চোখ লাল রং পর্যন্তই দেখতে পায়। SPHEREx শুরু করে ঠিক তার পর থেকে, 0.75\sµm/)).toBeInTheDocument();
    expect(screen.getByText("লাখ")).toBeInTheDocument();
    expect(screen.getByText("এ পর্যন্ত উন্মুক্ত ছবি")).toBeInTheDocument();
    expect(screen.queryByText(/Pick a point in the sky/)).not.toBeInTheDocument();
  });

  it("translates the orrery, the survey globe and the spectrum", async () => {
    act(() => setLang("bn"));
    renderLanding();
    expect(screen.getByRole("img", { name: /^সূর্য, আটটি গ্রহ, গ্রহাণু বলয়/ })).toBeInTheDocument();
    expect(screen.getByText("সৌরজগৎ, এই তারিখে")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "প্রতি সেকেন্ডে কতটা সময় পেরোবে" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "পুরো সৌরজগৎ" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "শনি" }));
    expect(screen.getByRole("button", { name: "শনি" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/বলয়গুলো মূলত পানির বরফ/)).toBeInTheDocument();
    expect(screen.getByText(/সূর্যকে একবার প্রদক্ষিণ করতে লাগে 29.5\sবছর/)).toBeInTheDocument();

    expect(screen.getByText("মানচিত্র 1 / 4")).toBeInTheDocument();
    expect(screen.getByText("স্থানাঙ্ক দেখতে গোলকের ওপর পয়েন্টার রাখুন")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "জরিপ থামান" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /ব্যান্ড 6/ }));
    expect(screen.getByText(/মনোক্সাইডের বরফ \(4.67\sµm\)/)).toBeInTheDocument();
    expect(screen.getByText("4.42–5.00 µm · R ≈ 128 · 17টি চ্যানেল")).toBeInTheDocument();
    expect(screen.getByText("পানির বরফ")).toBeInTheDocument();
  });

  it("labels the (7) Iris illustration and its caption", () => {
    act(() => setLang("bn"));
    renderLanding();
    expect(screen.getByRole("img", { name: /^আঁকা ছবি: স্থির তারাদের পটভূমিতে গ্রহাণু \(7\) Iris/ })).toBeInTheDocument();
    expect(screen.getByText(/আসল ফ্রেমগুলো আছে ‘পরিবর্তন’ পাতায়/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "একটি গ্রহাণু, হাতেনাতে ধরা।" })).toBeInTheDocument();
    expect(screen.getByText("প্রায় ছয় মাস")).toBeInTheDocument();
    expect(screen.getByText("বিষুবাংশ 00h 42m 44s")).toBeInTheDocument();
  });

  it("is English by default, and switches both ways while open", async () => {
    renderLanding();
    expect(screen.getByRole("heading", { level: 1, name: "Pick a point in the sky. Watch it change." })).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText("Try M31, Orion Nebula or 10.68 41.27")).toHaveLength(2);
    expect(screen.getByText("Map 1 of 4")).toBeInTheDocument();
    expect(screen.getByText("Hover the globe to read coordinates")).toBeInTheDocument();
    expect(screen.getByText("million")).toBeInTheDocument();
    expect(screen.getByText("One orbit: 365 days.", { exact: false })).toBeInTheDocument();

    act(() => setLang("bn"));
    expect(screen.getByRole("heading", { name: "কোথায়?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "পৃথিবী" })).toHaveAttribute("aria-pressed", "true");

    act(() => setLang("en"));
    expect(screen.getByRole("heading", { name: "Where?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Earth" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("কোথায়?")).not.toBeInTheDocument();
  });
});

describe("space messages", () => {
  it("keeps the English of the canvas readouts as it was", () => {
    expect(translate(GLOBE, "en", "readout", { lon: 120, lat: "+30", n: 2, total: 4 })).toBe(
      "Ecliptic 120°, +30° · scanned 2 of 4 times",
    );
    expect(translate(ORRERY, "en", "distance", { r: "1.00" })).toBe("1.00 au from the Sun on this date.");
    expect(translate(GLOBE, "bn", "north")).toBe("উত্তরের গভীর ক্ষেত্র");
  });

  it("reads bodies and bands in either language", () => {
    expect(bodyText("saturn", "en").name).toBe("Saturn");
    expect(bodyText("saturn", "bn")).toMatchObject({ name: "শনি", year: "29.5 বছর" });
    expect(bodyText("iris", "bn").name).toBe("(7) Iris");
    const six = BANDS[5]!;
    expect(bandWhat(six, "en")).toBe(six.what);
    expect(bandWhat(six, "bn")).toContain("কার্বন-⁠মনোক্সাইডের");
  });

  it("keeps Bangla case endings on the line of the word they follow", () => {
    expect(joinHyphens("JPL-এর কক্ষপথ")).toBe("JPL-⁠এর কক্ষপথ");
    expect(joinHyphens("Paschen-α")).toBe("Paschen-α");
    expect(translate(LANDING, "bn", "caseP2")).toContain("JPL-⁠এর");
    // English never gets the joiner.
    for (const table of [LANDING.en, ORRERY.en, GLOBE.en]) {
      for (const text of Object.values(table)) expect(text).not.toContain("⁠");
    }
  });

  it("draws the orrery's labels in the language it is given", () => {
    const jd = 2461300.5;
    const cam = { az: -1.95, el: 0.9, mix: 1 };
    const base = { jd, t: 0, dpr: 1, pal: PALETTES.light, selected: "saturn" as const, hovered: null };

    const english: string[] = [];
    drawScene(recordingContext(english), createScene(jd), 900, 560, cam, base);
    expect(english).toEqual(expect.arrayContaining(["Saturn", "Earth · SPHEREx"]));

    const bangla: string[] = [];
    drawScene(recordingContext(bangla), createScene(jd), 900, 560, cam, { ...base, names: BODY_NAMES.bn });
    expect(bangla).toEqual(expect.arrayContaining(["শনি", "পৃথিবী · SPHEREx"]));
    expect(bangla).not.toContain("Saturn");
  });

  it("redraws the survey globe's canvas labels when the language switches", async () => {
    const texts: string[] = [];
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = (() => recordingContext(texts)) as unknown as typeof original;
    try {
      render(<SkyGlobe />);
      await waitFor(() => expect(texts).toContain("North deep field"));
      act(() => setLang("bn"));
      await waitFor(() => expect(texts).toContain("উত্তরের গভীর ক্ষেত্র"));
      expect(screen.getByRole("img", { name: /^আকাশের একটি গোলক/ })).toBeInTheDocument();
    } finally {
      HTMLCanvasElement.prototype.getContext = original;
    }
  });
});
