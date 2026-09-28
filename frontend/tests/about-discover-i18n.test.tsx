import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setLang } from "../src/lib/i18n";
import type { CasesFile, DiscoverCase } from "../src/lib/types";
import { About } from "../src/pages/About";
import { ABOUT } from "../src/pages/about.messages";
import { Discover } from "../src/pages/Discover";
import { caseFacts, DISCOVER } from "../src/pages/discover.messages";

/** Text as a reader sees it: word joiners (U+2060) dropped, non-breaking spaces read as spaces. */
const plain = (text: string | null | undefined) => (text ?? "").replace(/\u2060/g, "").replace(/\u00a0/g, " ");
const BANGLA = /[\u0980-\u09FF]/;

const frame = (key: string, isoMid: string) => ({ obsId: key, key, isoMid, wavelengthUm: 1.104 });

const IRIS: DiscoverCase = {
  id: "iris-2025-12",
  kind: "moving",
  title: "Asteroid (7) Iris crosses a field in Sextans",
  summary: "Over 32 hours SPHEREx pointed at this patch of Sextans seven times.",
  target: { ra: 161.29678, dec: 2.44824, name: "Asteroid (7) Iris near 36 Sextantis", constellation: "Sextans" },
  viewer: { seq: "pass", det: 2, f: "2025W49_1A_0423_1", fa: "2025W49_1A_0332_1", cmp: "blink", fov: 0.3 },
  observed: {
    start: "2025-12-01T21:32:06.202",
    end: "2025-12-03T06:00:25.013",
    frames: 19,
    pointings: 7,
    detector: 2,
    wavelengthUm: [1.1041, 1.6581],
  },
  preview: { a: frame("a", "2025-12-02T12:06:59"), b: frame("b", "2025-12-02T21:48:00") },
  evidence: ["JPL predicts 7 Iris (A847 PA) (V 10.2) inside this field in 14 of 19 frames."],
  caution: "The asteroid's identity comes from JPL's catalogue and orbit predictions, not from this app.",
};

const M31: DiscoverCase = {
  ...IRIS,
  id: "m31-spectrum",
  kind: "spectrum",
  title: "The core of the Andromeda Galaxy, from 0.75 to 5 µm",
  summary: "SPHEREx never takes a colour picture.",
  target: { ...IRIS.target, name: "M31", constellation: "Andromeda" },
  observed: { ...IRIS.observed, frames: 18, pointings: 6, detector: 3, wavelengthUm: [1.6244, 2.3773] },
  evidence: ["110 frames from all six detectors in one pass."],
  caution: "Simple aperture photometry on an extended galaxy.",
};

const CASES: CasesFile = { built: "2026-09-28", cases: [IRIS, M31] };

/** Answers /api/cases and /api/health, and 404s everything else (the preview frames). */
function mockApi(cases: { status: number; body: unknown } | "pending" = { status: 200, body: CASES }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const path = new URL(url, "http://localhost").pathname;
      if (path === "/api/health") return new Response(JSON.stringify({ snapshotAvailable: true }), { status: 200 });
      if (path === "/api/cases") {
        if (cases === "pending") return new Promise<Response>(() => {});
        return new Response(JSON.stringify(cases.body), { status: cases.status });
      }
      return new Response(JSON.stringify({ error: { code: "not_found", message: "no" } }), { status: 404 });
    }),
  );
}

function renderPage(page: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{page}</MemoryRouter>
    </QueryClientProvider>,
  );
}

const bangla = () => act(() => setLang("bn"));

/** The credit paragraphs of the About page, as text. */
function creditTexts(): string[] {
  const section = screen.getByRole("region", { name: /Data and credits|ডেটা ও কৃতজ্ঞতা/ });
  return within(section)
    .getAllByText((_, el) => el?.tagName === "P" && !BANGLA.test(el.textContent ?? ""))
    .map((p) => p.textContent ?? "");
}

afterEach(() => {
  act(() => setLang("en"));
  vi.unstubAllGlobals();
});

describe("About in Bangla", () => {
  it("translates the header, the table of contents and every section title", () => {
    bangla();
    renderPage(<About />);
    expect(screen.getByRole("heading", { level: 1, name: "ইনফ্রারেড আকাশের এক টাইম মেশিন" })).toBeInTheDocument();
    expect(screen.getByText("পরিচিতি")).toHaveClass("kicker");
    const toc = screen.getByRole("navigation", { name: "এই পাতায়" });
    const sections: [string, string][] = [
      ["SPHEREx", "#mission"],
      ["যেভাবে কাজ করে", "#how"],
      ["পদ্ধতি", "#methods"],
      ["সীমাবদ্ধতা", "#limitations"],
      ["ডেটা ও কৃতজ্ঞতা", "#credits"],
      ["গোপনীয়তা", "#privacy"],
    ];
    for (const [name, href] of sections) {
      expect(within(toc).getByRole("link", { name })).toHaveAttribute("href", href);
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
    for (const q of ["কোথায়?", "কখন?", "কী বদলেছে?"]) expect(screen.getByText(q).tagName).toBe("STRONG");
    expect(screen.getByRole("link", { name: "অন্বেষণ শুরু করুন" })).toHaveAttribute("href", "/explore");
    expect(screen.queryByText("A time machine for the infrared sky")).not.toBeInTheDocument();
    expect(screen.queryByText("Reading the data.")).not.toBeInTheDocument();
  });

  it("keeps every number in the Methods exactly as the English gives it", () => {
    bangla();
    renderPage(<About />);
    const methods = plain(screen.getByRole("region", { name: "পদ্ধতি" }).textContent);
    for (const text of [
      "প্রায় 70 MB",
      "(Amazon S3)",
      "QR3-এর সংকুচিত ফ্ল্যাগ-প্লেনগুলো",
      "প্রায় 0.002 µm-এর মধ্যে",
      "12 আর্কসেকেন্ডের একটি অ্যাপারচার",
      "গ্রহাণু (7) Iris-এর বেলায়",
      "0.003 আর্কসেকেন্ডের মধ্যে মেলে",
      "1.4 আর্কসেকেন্ডের মধ্যে",
      "Qwen3 4B, Ollama-র মাধ্যমে",
    ]) {
      expect(methods).toContain(text);
    }
    const mission = plain(screen.getByRole("region", { name: "SPHEREx" }).textContent);
    for (const text of ["12 মার্চ 2025", "প্রায় 650 km", "ইনফ্রারেড আলোর 102টি রঙে", "0.75 থেকে 5 মাইক্রোমিটার", "6.15 আর্কসেকেন্ডের"]) {
      expect(mission).toContain(text);
    }
    // The documentation paths are code in both languages.
    expect(screen.getByText("docs/scientific-methods.md").tagName).toBe("CODE");
    expect(screen.getByText("docs/research/").tagName).toBe("CODE");
  });

  it("keeps the credits in English, word for word, and marks them as English", () => {
    renderPage(<About />);
    const english = creditTexts();
    expect(english).toHaveLength(8);

    bangla();
    expect(screen.getByRole("heading", { level: 2, name: "ডেটা ও কৃতজ্ঞতা" })).toBeInTheDocument();
    expect(screen.getByText(plain(ABOUT.bn.creditsNote), { normalizer: plain })).toBeInTheDocument();
    expect(creditTexts()).toEqual(english);
    const section = screen.getByRole("region", { name: "ডেটা ও কৃতজ্ঞতা" });
    for (const p of within(section).getAllByText((_, el) => el?.tagName === "P" && el.getAttribute("lang") === "en")) {
      expect(english).toContain(p.textContent);
    }
    expect(screen.getByText(/^This work makes use of data products from the Spectro-Photometer/)).toHaveAttribute("lang", "en");
    expect(screen.getByText(/^This research has made use of the NASA\/IPAC Infrared Science Archive/)).toHaveAttribute("lang", "en");
    expect(screen.getByRole("link", { name: "doi:10.26131/IRSA652" })).toHaveAttribute("href", "https://doi.org/10.26131/IRSA652");
    expect(screen.getByRole("link", { name: "SIMBAD database" })).toBeInTheDocument();
  });

  it("is English by default, unchanged, and switches both ways while open", () => {
    const { container } = renderPage(<About />);
    expect(screen.getByRole("heading", { level: 1, name: "A time machine for the infrared sky" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "On this page" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Data and credits" })).toBeInTheDocument();
    expect(screen.getByText("Reading the data.").tagName).toBe("STRONG");
    expect(screen.getByText(/for asteroid \(7\) Iris, the correction agrees to 0\.003 arcseconds\.$/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(BANGLA);
    expect(container.textContent).not.toContain("\u2060");
    expect(container.querySelector("[lang]")).toBeNull();

    bangla();
    expect(screen.getByRole("heading", { level: 1, name: "ইনফ্রারেড আকাশের এক টাইম মেশিন" })).toBeInTheDocument();
    act(() => setLang("en"));
    expect(screen.getByRole("heading", { level: 1, name: "A time machine for the infrared sky" })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(BANGLA);
  });
});

describe("Discover in Bangla", () => {
  it("translates the page and leaves the cases' own texts in English", async () => {
    mockApi();
    bangla();
    renderPage(<Discover />);
    expect(screen.getByRole("heading", { level: 1, name: "SPHEREx যেসব পরিবর্তন দেখেছে" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 2, name: "যা কিছু সরে যায়" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "এক জায়গা, অনেক রঙে" })).toBeInTheDocument();
    expect(screen.getByText("28 Sep 2026 তারিখে আর্কাইভ থেকে ঘটনাগুলো তৈরি করা হয়েছে।")).toBeInTheDocument();

    // The case texts come from the API: English, and marked as English.
    const title = screen.getByRole("heading", { level: 3, name: IRIS.title });
    expect(title).toHaveAttribute("lang", "en");
    expect(screen.getByText(IRIS.summary)).toHaveAttribute("lang", "en");
    expect(screen.getByText(IRIS.evidence[0]!).closest("ul")).toHaveAttribute("lang", "en");
    expect(screen.getByText(IRIS.caution)).toHaveAttribute("lang", "en");

    // The words around them are Bangla; numbers, dates and units stay as they are.
    const iris = title.closest("article")!;
    expect(within(iris).getByText("চলমান উৎস · পরিচিত গ্রহাণু")).toHaveClass("kicker");
    expect(
      within(iris).getByText("1 – 3 Dec 2025 · 7টি পর্যবেক্ষণে 19টি ফ্রেম · ডিটেক্টর 2, 1.10–1.66 µm · Sextans নক্ষত্রমণ্ডলে", {
        normalizer: plain,
      }),
    ).toBeInTheDocument();
    expect(within(iris).getByText("19টি ফ্রেমের দুটি, একই উজ্জ্বলতার মাপকাঠিতে পালা করে দেখানো।")).toBeInTheDocument();
    expect(within(iris).getByText("প্রমাণ")).toHaveClass("panel-title");
    expect(within(iris).getByRole("link", { name: "এই ঘটনাটি অন্বেষণ করুন" }).getAttribute("href")).toMatch(/^\/explore\?ra=161\.29678/);
    expect(await within(iris).findByRole("link", { name: "ডেমো স্ন্যাপশট খুলুন" })).toHaveAttribute(
      "href",
      expect.stringContaining("source=snapshot"),
    );
    expect(screen.getByText("অনেক এক্সপোজার থেকে বর্ণালি")).toHaveClass("kicker");

    expect(screen.getByRole("heading", { level: 2, name: "নিজেই খুঁজে দেখুন" })).toBeInTheDocument();
    expect(screen.getByText("1. ক্রান্তিবৃত্তের কাছাকাছি একটি জায়গা বেছে নিন।").tagName).toBe("STRONG");
    expect(screen.getByText(/না মিললে সেটি একটি অনিশ্চিত সম্ভাব্য বস্তু/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "‘চলমান বস্তুটি খুঁজুন’ খেলে অনুশীলন করুন" })).toHaveAttribute("href", "/play");
    expect(screen.getByRole("link", { name: "অথবা যেকোনো বস্তুর নাম বা স্থানাঙ্ক দিয়ে শুরু করুন" })).toHaveAttribute(
      "href",
      "/explore?q=10.6847+41.2690",
    );
    expect(screen.getByRole("heading", { level: 2, name: "প্ল্যানেট এক্সের কী খবর?" })).toBeInTheDocument();
    expect(screen.getByText(/যাকে প্রায়ই নবম গ্রহ \(Planet Nine\) বলা হয়/)).toBeInTheDocument();
    expect(screen.getByText(/প্রায় 500\sau দূরে/)).toBeInTheDocument();
    expect(screen.queryByText("Changes SPHEREx has seen")).not.toBeInTheDocument();
    expect(screen.queryByText("Hunt for yourself")).not.toBeInTheDocument();
  });

  it("says the case details are in English, only on a Bangla page", async () => {
    mockApi();
    renderPage(<Discover />);
    expect(await screen.findByRole("heading", { level: 2, name: "Things that move" })).toBeInTheDocument();
    expect(screen.queryByText("ঘটনাগুলোর বিবরণ ইংরেজিতে দেওয়া আছে।")).not.toBeInTheDocument();
    expect(screen.queryByText("Case details are in English.")).not.toBeInTheDocument();

    bangla();
    expect(screen.getByText("ঘটনাগুলোর বিবরণ ইংরেজিতে দেওয়া আছে।")).toHaveClass("text-sm", "text-faint");

    act(() => setLang("en"));
    expect(screen.queryByText("ঘটনাগুলোর বিবরণ ইংরেজিতে দেওয়া আছে।")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Things that move" })).toBeInTheDocument();
  });

  it("translates the loading, error and empty states", async () => {
    bangla();
    mockApi("pending");
    const loading = renderPage(<Discover />);
    expect(within(screen.getByRole("status")).getByText("ঘটনাগুলো লোড হচ্ছে…")).toBeInTheDocument();
    loading.unmount();

    mockApi({ status: 500, body: { error: { code: "internal", message: "no" } } });
    const failed = renderPage(<Discover />);
    expect(await screen.findByText("ঘটনাগুলো লোড করা যায়নি। ‘অন্বেষণ’ তবু কাজ করছে: কিছু একটা খুঁজে দেখুন।")).toHaveClass("note-danger");
    failed.unmount();

    mockApi({ status: 200, body: { built: null, cases: [] } });
    renderPage(<Discover />);
    const empty = await screen.findByText((_, el) => el?.tagName === "P" && !!el.querySelector("code"));
    expect(empty).toHaveTextContent("এখনো কোনো ঘটনা তৈরি করা হয়নি। সেগুলো তৈরি করতে make snapshot চালান।");
    expect(within(empty).getByText("make snapshot").tagName).toBe("CODE");
    // Nothing is listed, so there is nothing to say about the cases' language.
    expect(screen.queryByText("ঘটনাগুলোর বিবরণ ইংরেজিতে দেওয়া আছে।")).not.toBeInTheDocument();
  });

  it("is English by default and unchanged", async () => {
    mockApi();
    const { container } = renderPage(<Discover />);
    expect(screen.getByRole("heading", { level: 1, name: "Changes SPHEREx has seen" })).toBeInTheDocument();
    expect(await screen.findByText("Cases built from the archive on 28 Sep 2026.")).toBeInTheDocument();
    const iris = screen.getByRole("heading", { level: 3, name: IRIS.title }).closest("article")!;
    expect(within(iris).getByText("Moving source · known asteroid")).toBeInTheDocument();
    expect(within(iris).getByText("1 – 3 Dec 2025 · 19 frames in 7 pointings · detector 2, 1.10–1.66 µm · in Sextans")).toBeInTheDocument();
    expect(within(iris).getByText("Two of the 19 frames, flipped with one shared brightness scale.")).toBeInTheDocument();
    expect(within(iris).getByRole("link", { name: "Explore this case" })).toBeInTheDocument();
    expect(await within(iris).findByRole("link", { name: "Open the demo snapshot" })).toBeInTheDocument();
    expect(screen.getByText("1. Pick a spot near the ecliptic,").tagName).toBe("STRONG");
    expect(screen.getByRole("link", { name: "Practise on Spot the mover" })).toHaveAttribute("href", "/play");
    expect(screen.getByRole("heading", { level: 2, name: "What about Planet X?" })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(BANGLA);
    expect(container.querySelector("[lang]")).toBeNull();
  });
});

describe("About and Discover messages", () => {
  const tables = { ABOUT, DISCOVER } as const;
  const numbers = (text: string) => (text.match(/\d+(?:\.\d+)?/g) ?? []).sort();

  it("have the same keys, and Bangla keeps every number the English gives", () => {
    for (const [name, table] of Object.entries(tables)) {
      const en: Record<string, string> = table.en;
      const bn: Record<string, string> = table.bn;
      expect(Object.keys(bn).sort(), name).toEqual(Object.keys(en).sort());
      for (const key of Object.keys(en)) {
        expect(numbers(bn[key]!), `${name}.${key}`).toEqual(numbers(en[key]!));
        // Western digits only.
        expect(bn[key], `${name}.${key}`).not.toMatch(/[০-৯]/);
      }
    }
  });

  it("keep English free of Bangla and of word joiners", () => {
    for (const table of Object.values(tables)) {
      for (const text of Object.values<string>(table.en)) {
        expect(text).not.toMatch(BANGLA);
        expect(text).not.toContain("\u2060");
        expect(text).not.toContain("\u00a0");
      }
    }
  });

  it("call our findings candidates, never discoveries", () => {
    for (const table of Object.values(tables)) {
      for (const text of Object.values<string>(table.bn)) {
        // আবিষ্কার appears only to say that something is not one.
        for (const m of text.matchAll(/আবিষ্কার(\S*)\s*(\S*)/g)) expect(m[2]).toMatch(/^নয়/);
      }
    }
    expect(DISCOVER.bn.step3Text).toContain("সম্ভাব্য বস্তু");
    expect(ABOUT.bn.moving).toContain("সম্ভাব্য বস্তু");
  });

  it("write a case's facts in either language, keeping its wavelength range on one line in Bangla", () => {
    expect(caseFacts("en", IRIS)).toBe("1 – 3 Dec 2025 · 19 frames in 7 pointings · detector 2, 1.10–1.66 µm · in Sextans");
    const bn = caseFacts("bn", IRIS);
    expect(plain(bn)).toBe("1 – 3 Dec 2025 · 7টি পর্যবেক্ষণে 19টি ফ্রেম · ডিটেক্টর 2, 1.10–1.66 µm · Sextans নক্ষত্রমণ্ডলে");
    expect(bn).toContain("1.10–\u20601.66\u00a0µm");
  });
});
