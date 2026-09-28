import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { CandidatesPanel } from "../src/features/known/Candidates";
import { KnownObjectsPanel } from "../src/features/known/KnownObjects";
import { KNOWN } from "../src/features/known/messages";
import { PLOTS } from "../src/features/plots/messages";
import { ScatterPlot } from "../src/features/plots/ScatterPlot";
import { TIMELINE } from "../src/features/timeline/messages";
import { FramePanel } from "../src/features/viewer/FramePanel";
import { frameCount, OVERLAYS, VIEWER } from "../src/features/viewer/messages";
import { Viewer } from "../src/features/viewer/Viewer";
import { Measurements } from "../src/features/wavelength/Measurements";
import { WAVELENGTH } from "../src/features/wavelength/messages";
import { describeWavelength } from "../src/lib/bands";
import { formatGap } from "../src/lib/format";
import { type Messages, setLang } from "../src/lib/i18n";
import { compatibility } from "../src/lib/sequence";
import type { Candidates, CutoutPayload, DecodedCutout, Frame, KnownObjects, Observations } from "../src/lib/types";

// Bangla may later carry word joiners (around hyphens) and no-break spaces; compare the words only.
const WJ = new RegExp(String.fromCharCode(0x2060), "g");
const NBSP = new RegExp(String.fromCharCode(0x00a0), "g");
const plain = (text: string | null | undefined) => (text ?? "").replace(WJ, "").replace(NBSP, " ").replace(/\s+/g, " ").trim();
const named = (text: string) => (name: string) => plain(name) === text;
const BANGLA_DIGITS = /[০-৯]/;

beforeAll(() => {
  // jsdom has no layout engine: give the image and the plot a size to draw into.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 600 });
});

afterEach(() => {
  act(() => setLang("en"));
  vi.unstubAllGlobals();
});

const bangla = () => act(() => setLang("bn"));

function frame(over: Partial<Frame>): Frame {
  return {
    id: "f1",
    obsId: "2025W49_1A_0332_1",
    pointing: "2025W49_1A_0332",
    step: 1,
    detector: 2,
    collection: "spherex_qr2",
    release: "qr2",
    deep: false,
    key: "k1",
    irsaUrl: "https://irsa.ipac.caltech.edu/x.fits",
    mjdStart: 61011.5,
    mjdEnd: 61011.501,
    mjdMid: 61011.5,
    isoMid: "2025-12-02T12:00:00.000",
    exposureS: 113.58,
    bandMinUm: 1.1,
    bandMaxUm: 1.62,
    resolvingPower: 41,
    footprint: [],
    wavelengthUm: 1.13,
    bandwidthUm: 0.026,
    targetPixel: [100, 100],
    passIndex: 0,
    ...over,
  };
}

// Two pointings 9.7 hours apart that saw the target at different wavelengths, as with (7) Iris.
const A = frame({});
const B = frame({
  id: "f2",
  obsId: "2025W49_1A_0423_1",
  pointing: "2025W49_1A_0423",
  key: "k2",
  mjdMid: 61011.5 + 9.7 / 24,
  isoMid: "2025-12-02T21:42:00.000",
  wavelengthUm: 1.508,
  bandwidthUm: 0.036,
});
const C = frame({
  id: "f3",
  obsId: "2025W49_1A_0423_2",
  pointing: "2025W49_1A_0423",
  step: 2,
  key: "k3",
  mjdMid: 61011.5 + 9.75 / 24,
  isoMid: "2025-12-02T21:45:00.000",
  wavelengthUm: 1.545,
  bandwidthUm: 0.037,
});

const OBSERVATIONS: Observations = {
  target: {
    ra: 161.29678,
    dec: 2.44824,
    raHms: "10h45m11.2s",
    decDms: "+02d26m54s",
    galactic: { l: 245.5, b: 51.0 },
    ecliptic: { lon: 160.2, lat: -5.1 },
    constellation: "Sextans",
    deepField: null,
  },
  collections: ["spherex_qr2"],
  deepField: null,
  frames: [A, B, C],
  passes: [
    {
      index: 0,
      mjdStart: A.mjdMid,
      mjdEnd: C.mjdMid,
      isoStart: A.isoMid,
      isoEnd: C.isoMid,
      frames: 3,
      pointings: 2,
      detectors: { "2": 3 },
      releases: ["qr2"],
    },
  ],
  summary: { frames: 3, passes: 1, detectors: { "2": 3 }, first: A.isoMid, last: C.isoMid },
  retrievedAt: "2026-09-28T00:00:00Z",
  wavelengthNote: "",
};

function wrap(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>,
  );
}

/** The viewer on frame B with A as the reference; the archive never answers, so frames stay loading. */
function renderViewer() {
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
  return wrap(
    <Viewer
      observations={OBSERVATIONS}
      target={{ ra: 161.29678, dec: 2.44824, label: "Iris" }}
      source="snapshot"
      initial={{ frame: B.obsId, reference: A.obsId, compare: "diff", fov: 0.3 }}
    />,
  );
}

function cutout(): DecodedCutout {
  const payload: CutoutPayload = {
    key: "k2",
    obsId: B.obsId,
    detector: 2,
    release: "qr2",
    grid: { ra: 161.29678, dec: 2.44824, sizePx: 3, scaleArcsec: 6.15, projection: "TAN" },
    time: { mjdMid: B.mjdMid, isoMid: B.isoMid, mjdStart: null, mjdEnd: null, exposureS: 113.58 },
    wavelength: { atTargetUm: 1.508, bandwidthUm: 0.036, method: "from the spectral WCS" },
    target: { pixel: [1, 1], inFrame: true, flags: ["OVERFLOW"] },
    background: { levelMJySr: 0.4258, rmsMJySr: 0.0347, zodiModelMJySr: 0.3565, method: "annulus" },
    photometry: {
      fluxMicroJy: 120,
      errorMicroJy: 80,
      abMag: null,
      snr: 1.5,
      backgroundMJySr: 0.42,
      apertureRadiusArcsec: 12.3,
      pixelsUsed: 13,
      maskedInAperture: 2,
      overflowInAperture: true,
      reliable: false,
      reasons: ["2 flagged pixels inside the aperture."],
      method: "Circular aperture of radius 2 px (12.3″) on the Level 2 image.",
    },
    image: { width: 3, height: 3, unit: "MJy/sr", dtype: "float32-le", data: "", stats: null },
    mask: { dtype: "uint8", bits: { flagged: 1, noData: 2 }, maskedFlags: ["OVERFLOW"], data: "" },
    // No recorded state, so the "Where was SPHEREx?" disclosure stays out of this test.
    spacecraft: { frame: "J2000", positionKm: [null, null, null], velocityKmS: [null, null, null] },
    quality: { psfFwhmArcsec: 5.15, pipeline: "6.4+psffix1" },
    access: { via: "s3", requests: 9, notes: [] },
    retrievedAt: "2026-09-28T00:00:00Z",
  };
  return { payload, width: 3, height: 3, pixels: new Float32Array(9), mask: new Uint8Array(9) };
}

describe("the wavelength and difference rules in Bangla", () => {
  it("describes wavelengths in Bangla, and in English by default", () => {
    expect(describeWavelength(0.9)).toBe("just beyond red light");
    expect(describeWavelength(1.5)).toBe("near-infrared, where starlight dominates");
    expect(describeWavelength(3.0)).toBe("infrared where water ice and organic molecules absorb");
    expect(describeWavelength(4.3)).toBe("infrared where carbon dioxide and carbon monoxide ices absorb");
    expect(plain(describeWavelength(0.9, "bn"))).toBe("লাল আলোর ঠিক ওপারে");
    expect(plain(describeWavelength(1.5, "bn"))).toBe("নিকট-ইনফ্রারেড, যেখানে তারার আলোই প্রধান");
    expect(plain(describeWavelength(3.0, "bn"))).toBe("ইনফ্রারেড, যেখানে পানির বরফ ও জৈব অণু আলো শোষণ করে");
    expect(plain(describeWavelength(4.3, "bn"))).toBe(
      "ইনফ্রারেড, যেখানে কার্বন ডাই-অক্সাইড ও কার্বন মনোক্সাইডের বরফ আলো শোষণ করে",
    );
  });

  it("refuses a difference between different wavelengths with the same reason in both languages", () => {
    const en = compatibility(A, B);
    expect(en.ok).toBe(false);
    expect(en.reasons).toEqual([
      "They saw the target at 1.130 µm and 1.508 µm, more than half a spectral channel (0.013 µm) apart. A difference would mostly show how the sources' brightness varies with wavelength, not a change in time.",
    ]);
    const bn = compatibility(A, B, "bn");
    expect(bn.ok).toBe(false);
    expect(bn.reasons.map(plain)).toEqual([
      "ফ্রেম দুটি লক্ষ্যকে দেখেছে 1.130 µm ও 1.508 µm-এ, অর্ধেক বর্ণালি-চ্যানেলের (0.013 µm) চেয়ে বেশি ব্যবধানে। পার্থক্য নিলে মূলত দেখা যেত তরঙ্গদৈর্ঘ্যভেদে উৎসগুলোর উজ্জ্বলতার তারতম্য, সময়ের সঙ্গে পরিবর্তন নয়।",
    ]);
    // The language changes the words only, never the decision.
    expect(bn.deltaWavelengthUm).toBe(en.deltaWavelengthUm);
  });

  it("explains the other refusals and cautions in Bangla", () => {
    const detectors = compatibility(frame({ detector: 2 }), frame({ detector: 5 }), "bn");
    expect(detectors.reasons.map(plain)[0]).toBe(
      "ফ্রেম দুটি ভিন্ন ডিটেক্টরের (D2 ও D5), যেগুলো তরঙ্গদৈর্ঘ্যের ভিন্ন ভিন্ন পরিসর দেখে।",
    );
    const unknown = compatibility(frame({ wavelengthUm: null }), frame({}), "bn");
    expect(unknown.reasons.map(plain)).toEqual(["দুটি ফ্রেমের অন্তত একটির ক্ষেত্রে লক্ষ্যে তরঙ্গদৈর্ঘ্য জানা নেই।"]);
    const cautions = compatibility(frame({ release: "qr2" }), frame({ release: "qr3", mjdMid: 61011.501 }), "bn");
    expect(cautions.ok).toBe(true);
    expect(cautions.cautions.map(plain)).toEqual([
      "ফ্রেমগুলো ভিন্ন ভিন্ন ডেটা রিলিজের (QR2 ও QR3), যেগুলো ভিন্নভাবে ক্যালিব্রেট করা হয়েছিল; উজ্জ্বলতার ছোট পার্থক্য হয়তো ক্যালিব্রেশনের কারণে।",
      "ফ্রেমগুলোর মধ্যে মাত্র কয়েক মিনিটের ব্যবধান; কেবল দ্রুতগামী বস্তুই সরে থাকবে।",
    ]);
    expect(compatibility(frame({ release: "qr2" }), frame({ release: "qr3", mjdMid: 61011.501 })).cautions).toEqual([
      "The frames come from different data releases (QR2 and QR3), which were calibrated differently; small brightness differences may be calibration.",
      "The frames are only minutes apart; only fast-moving objects will have moved.",
    ]);
  });

  it("writes gaps and frame counts in Bangla with Western digits and the unit symbols kept", () => {
    expect(formatGap(2 / 1440, "bn")).toBe("2 min");
    expect(formatGap(9.7 / 24, "bn")).toBe("9.7 h");
    expect(plain(formatGap(3.25, "bn"))).toBe("3.3 দিন");
    expect(plain(formatGap(180, "bn"))).toBe("5.9 মাস");
    expect(formatGap(3.25)).toBe("3.3 days");
    expect(plain(frameCount("bn", 1405))).toBe("1,405টি ফ্রেম");
    expect(frameCount("en", 1)).toBe("1 frame");
    expect(frameCount("en", 19)).toBe("19 frames");
  });
});

describe("the viewer in Bangla", () => {
  it("is English by default", () => {
    renderViewer();
    const viewer = screen.getByRole("region", { name: "Sky viewer" });
    for (const name of ["Single", "Blink", "Side by side", "Difference"]) {
      expect(within(viewer).getByRole("radio", { name })).toBeInTheDocument();
    }
    const text = viewer.textContent ?? "";
    expect(text).toContain("A difference image would be misleading here.");
    expect(text).toContain(
      "They saw the target at 1.130 µm and 1.508 µm, more than half a spectral channel (0.013 µm) apart. A difference would mostly show how the sources' brightness varies with wavelength, not a change in time.",
    );
    expect(text).toContain("Use Blink to compare positions, or pick a matched-wavelength sequence.");
    expect(text).toContain(
      "9.7 h apart, 0.378 µm apart in wavelength. Positions can be compared (stars stay put, moving objects shift), but brightness differences may just be the sources’ colours.",
    );
    expect(text).toContain(
      "0 frames of 3 loaded. Each dot’s height is the wavelength that frame saw at the target; a ring marks frames at the same wavelength as A. Keys: ← → step, space play, R set reference.",
    );
    expect(text).toContain("Near-infrared, where starlight dominates. Detector 2 covers 1.10–1.62 µm. Estimated from the image footprint until the pixels load.");
    expect(screen.getByRole("region", { name: /^This observation · 2 of 3$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next frame" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Difference image, current frame minus reference" })).toBeInTheDocument();
  });

  it("switches its controls, notes and validity rules to Bangla", () => {
    renderViewer();
    bangla();
    const viewer = screen.getByRole("region", { name: named("আকাশের ছবি দেখার অংশ") });
    for (const name of ["একক", "ব্লিংক", "পাশাপাশি", "পার্থক্য"]) {
      expect(within(viewer).getByRole("radio", { name: named(name) })).toBeInTheDocument();
    }
    const text = plain(viewer.textContent);
    // The difference image is refused, with the reason, exactly as in English.
    expect(text).toContain("এখানে পার্থক্য-ছবি বিভ্রান্তিকর হবে।");
    expect(text).toContain(
      "ফ্রেম দুটি লক্ষ্যকে দেখেছে 1.130 µm ও 1.508 µm-এ, অর্ধেক বর্ণালি-চ্যানেলের (0.013 µm) চেয়ে বেশি ব্যবধানে। পার্থক্য নিলে মূলত দেখা যেত তরঙ্গদৈর্ঘ্যভেদে উৎসগুলোর উজ্জ্বলতার তারতম্য, সময়ের সঙ্গে পরিবর্তন নয়।",
    );
    expect(text).toContain("অবস্থান তুলনা করতে ব্লিংক ব্যবহার করুন, অথবা একই তরঙ্গদৈর্ঘ্যে মেলানো ফ্রেমের একটি ক্রম বেছে নিন।");
    // A brightness difference may be the sources' colour, not a change in time.
    expect(text).toContain(
      "সময়ের ব্যবধান 9.7 h, তরঙ্গদৈর্ঘ্যের ব্যবধান 0.378 µm। অবস্থান তুলনা করা যায় (তারাগুলো নিজের জায়গায় থাকে, চলমান বস্তু সরে যায়), কিন্তু উজ্জ্বলতার পার্থক্য হয়তো কেবল উৎসগুলোর রঙের কারণেই।",
    );
    expect(text).toContain("পার্থক্য দেখানো হয় কেবল তখনই, যখন দুটি ফ্রেমই একই ডিটেক্টরে লক্ষ্যকে এমন তরঙ্গদৈর্ঘ্যে দেখেছে, যেগুলোর ব্যবধান অর্ধেক বর্ণালি-চ্যানেলের বেশি নয়।");
    expect(text).toContain("3টির মধ্যে 0টি ফ্রেম লোড হয়েছে।");
    expect(text).toContain("কিবোর্ড: ← → এক ধাপ সরুন, Space চালান, R রেফারেন্স ঠিক করুন।");
    expect(text).toContain("নিকট-ইনফ্রারেড, যেখানে তারার আলোই প্রধান। ডিটেক্টর 2-এর পরিসর 1.10–1.62 µm।");
    expect(text).toContain("পিক্সেল লোড হলে মাপা হবে।");
    expect(text).toContain("চিহ্নিত পিক্সেল দেখান (দেখানোর জন্য পূরণ করা, মাপা হয়নি)");
    expect(text).not.toMatch(BANGLA_DIGITS);
    expect(screen.getByRole("region", { name: named("এই পর্যবেক্ষণ · 3টির মধ্যে 2 নম্বর") })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: named("পার্থক্য-ছবি: বর্তমান ফ্রেম বিয়োগ রেফারেন্স ফ্রেম") })).toBeInTheDocument();
    for (const name of ["প্রথম ফ্রেম", "আগের ফ্রেম", "ফ্রেমগুলো পরপর চালান", "পরের ফ্রেম", "জুম কমান", "পুরো ছবি দেখুন", "জুম বাড়ান"]) {
      expect(screen.getByRole("button", { name: named(name) })).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: named("এই দৃশ্য নিয়ে প্রশ্ন করুন") })).toHaveAttribute("href", "/ask");
    expect(screen.getByRole("radio", { name: named("একটি জরিপ-পর্ব") })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: named("ডিটেক্টর 2, 1.1 থেকে 1.62 মাইক্রোমিটার, 3টি ফ্রেম") })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: named("ফ্রেম 1: 2 Dec 2025, 12:00:00 UTC, 1.130 µm, রেফারেন্স A, এখনো লোড হয়নি") })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: named("JPL-এ পরিচিত বস্তু খুঁজুন") })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: named("চলমান উৎস খুঁজুন") })).toBeInTheDocument();
  });

  it("shows the side-by-side frames and the time gaps in Bangla", async () => {
    renderViewer();
    bangla();
    await userEvent.click(screen.getByRole("radio", { name: named("পাশাপাশি") }));
    expect(screen.getByRole("img", { name: named("ফ্রেম A: 2 Dec 2025 12:00:00 UTC") })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: named("ফ্রেম B: 2 Dec 2025 21:42:00 UTC") })).toBeInTheDocument();
    expect(plain(screen.getByRole("list", { name: named("এই ক্রমের ফ্রেমগুলো") }).textContent)).toContain("+9.7 h");
    await userEvent.click(screen.getByRole("radio", { name: named("একক") }));
    expect(screen.getByRole("img", { name: named("Iris-এর SPHEREx ছবি, 2 Dec 2025 21:42:00 UTC") })).toBeInTheDocument();
  });
});

describe("the frame panel in Bangla", () => {
  it("keeps the flagged-pixel and signal-to-noise caveats, and the API's words in English", async () => {
    render(<FramePanel frame={B} cutout={cutout()} index={1} count={3} />);
    expect(screen.getByText(/^The pixels at the target are flagged OVERFLOW in this frame\./)).toHaveTextContent(
      "The pixels at the target are flagged OVERFLOW in this frame. The image there is filled in from its surroundings for display and is not a measurement; do not read a change into it.",
    );
    expect(screen.getByText("Nothing clearly detected at the target (signal-to-noise below 3).")).toBeInTheDocument();
    bangla();
    const panel = screen.getByRole("region", { name: named("এই পর্যবেক্ষণ · 3টির মধ্যে 2 নম্বর") });
    const text = plain(panel.textContent);
    expect(text).toContain(
      "এই ফ্রেমে লক্ষ্যের পিক্সেলগুলো OVERFLOW হিসেবে চিহ্নিত। সেখানকার ছবি কেবল দেখানোর জন্য চারপাশ থেকে পূরণ করা, এটি কোনো পরিমাপ নয়; এতে কোনো পরিবর্তন আছে বলে ধরে নেবেন না।",
    );
    expect(text).toContain("লক্ষ্যে স্পষ্টভাবে কিছু শনাক্ত হয়নি (সংকেত-শব্দ অনুপাত 3-এর কম)।");
    expect(text).toContain("2 flagged pixels inside the aperture.");
    await userEvent.click(screen.getByText(named("প্রযুক্তিগত বিবরণ")));
    const details = plain(panel.querySelector("details:last-of-type")?.textContent);
    for (const words of [
      "পর্যবেক্ষণ2025W49_1A_0423_1",
      "এক্সপোজারের মাঝামাঝি সময়",
      "D2 (পয়েন্টিংয়ের 1 নম্বর ধাপ)",
      "এক্সপোজার113.6 s",
      "লক্ষ্যের পিক্সেলে চিহ্নOVERFLOW",
      "S3 বাইট-রেঞ্জ (9টি অনুরোধ)",
      "IRSA-তে মূল ফাইল (প্রায় 70 MB)",
      // Collection, pipeline and method come from the archive and stay as they are.
      "spherex_qr2",
      "6.4+psffix1",
      "Circular aperture of radius 2 px (12.3″) on the Level 2 image.",
    ]) {
      expect(details).toContain(words);
    }
  });
});

describe("known objects and candidates in Bangla", () => {
  const KNOWN_ANSWER: KnownObjects = {
    field: { ra: 161.29678, dec: 2.44824, sizeDeg: 0.3 },
    searched: { referenceKey: "k2", referenceMjd: B.mjdMid, halfWidthDeg: 0.67, vmagLimit: 20, candidates: 6 },
    objects: [
      {
        name: "7 Iris (A847 PA)",
        vmag: 10.2,
        rateArcsecPerHour: 39.3,
        positions: [
          { key: "k1", mjd: A.mjdMid, ra: 161.2, dec: 2.5, inField: true, distanceAu: 2.07 },
          { key: "k2", mjd: B.mjdMid, ra: 161.3, dec: 2.45, inField: true, distanceAu: 2.07 },
          { key: "k3", mjd: C.mjdMid, ra: 161.5, dec: 2.4, inField: false, distanceAu: 2.07 },
        ],
      },
    ],
    framesWithoutState: [],
    source: "JPL Small-Body Identification (two-pass) and JPL Horizons",
    method: "These are predictions for catalogued objects, not detections.",
    retrievedAt: "2026-09-28T00:00:00Z",
  };
  const CANDIDATES_ANSWER: Candidates = {
    field: { ra: 161.29678, dec: 2.44824, sizePx: 177, scaleArcsec: 6.15 },
    candidates: [
      {
        id: "C1",
        strength: "candidate",
        rateArcsecPerHour: 38.6,
        positionAngleDeg: 122.5,
        residualArcsec: 1.2,
        sightings: [
          { mjd: A.mjdMid, ra: 150.0, dec: 2.0, snr: 900, keys: ["k1"] },
          { mjd: B.mjdMid, ra: 150.1, dec: 1.9, snr: 900, keys: ["k2", "k3"] },
          { mjd: C.mjdMid, ra: 150.2, dec: 1.8, snr: 900, keys: ["k3"] },
        ],
      },
      {
        id: "C2",
        strength: "weak candidate",
        rateArcsecPerHour: 20,
        positionAngleDeg: 10,
        residualArcsec: 0,
        sightings: [
          { mjd: A.mjdMid, ra: 151.0, dec: 2.0, snr: 6, keys: ["k1"] },
          { mjd: B.mjdMid, ra: 151.1, dec: 2.0, snr: 6, keys: ["k2"] },
        ],
      },
    ],
    stats: { frames: 3, detections: 1405, transient: 99, sightings: 10, candidates: 1 },
    limits: { minRateArcsecPerHour: 1.8, maxRateArcsecPerHour: 153.8 },
    method: "Point sources were detected in each aligned frame.",
    caution: "These are candidates from an automatic search.",
    retrievedAt: "2026-09-28T00:00:00Z",
  };

  function mockApi() {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const path = new URL(url, "http://localhost").pathname;
        const body = path === "/api/known-objects" ? KNOWN_ANSWER : path === "/api/candidates" ? CANDIDATES_ANSWER : null;
        return new Response(JSON.stringify(body ?? { error: { code: "not_found", message: "no" } }), {
          status: body ? 200 : 404,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
  }

  const props = { sequence: [A, B, C], target: { ra: 161.29678, dec: 2.44824 }, fov: 0.3, source: "snapshot" as const, enabled: true };

  it("lists JPL's predictions in Bangla, with names, source and method as JPL sends them", async () => {
    mockApi();
    wrap(<KnownObjectsPanel {...props} current={B} show onShow={() => {}} onResult={() => {}} />);
    bangla();
    await userEvent.click(screen.getByRole("button", { name: named("JPL-এ পরিচিত বস্তু খুঁজুন") }));
    const item = await screen.findByRole("listitem");
    expect(plain(item.textContent)).toBe("7 Iris (A847 PA)V 10.2ঘণ্টায় 39″ সরে · 3টি ফ্রেমের মধ্যে 2টিতে দৃষ্টিক্ষেত্রে ছিল · এই ফ্রেমে আছে");
    const section = screen.getByRole("region", { name: named("সৌরজগতের পরিচিত বস্তু") });
    expect(plain(section.textContent)).toContain(
      "তথ্যসূত্র: JPL Small-Body Identification (two-pass) and JPL Horizons। মাঝের ফ্রেমের সময়ে V 20-এর চেয়ে উজ্জ্বল 6টি ক্যাটালগভুক্ত বস্তু দৃষ্টিক্ষেত্র থেকে 0.67°-এর মধ্যে ছিল।",
    );
    expect(section.textContent).toContain("These are predictions for catalogued objects, not detections.");
  });

  it("calls our own detections candidates, never discoveries", async () => {
    mockApi();
    wrap(<CandidatesPanel {...props} known={KNOWN_ANSWER} showWeak={false} onShowWeak={() => {}} onResult={() => {}} />);
    bangla();
    await userEvent.click(screen.getByRole("button", { name: named("চলমান উৎস খুঁজুন") }));
    await screen.findByText(named("C1"));
    const section = screen.getByRole("region", { name: named("এই জরিপ-পর্বে চলমান উৎস") });
    const text = plain(section.textContent);
    expect(text).toContain(
      "1,405টি উৎস শনাক্ত হয়েছে; তার মধ্যে 99টিকে একই জায়গায় আর দেখা যায়নি, সেগুলোর 10টি একই পয়েন্টিংয়ের মধ্যে আবার দেখা গেছে, আর 1টি তিন বা তার বেশি পয়েন্টিংজুড়ে এক সরলরেখায় পড়েছে।",
    );
    expect(text).toContain("39″/h, দক্ষিণ-পূর্ব দিকে");
    expect(text).toContain("একটি সরলরেখার ওপর 3বার দেখা গেছে (বিক্ষেপ 1.2″)।");
    expect(text).toContain("V 20-এর চেয়ে উজ্জ্বল কোনো ক্যাটালগভুক্ত বস্তুর সঙ্গে মেলে না। নিশ্চিত নয় এমন সম্ভাব্য বস্তু: আরও বিশ্লেষণ দরকার।");
    expect(screen.getByRole("checkbox", { name: named("1টি দুর্বল সম্ভাব্য বস্তুও দেখান (কেবল দুবার দেখা গেছে)") })).toBeInTheDocument();
    expect(text).toContain("These are candidates from an automatic search.");
    expect(text).not.toContain("আবিষ্কার");
    act(() => setLang("en"));
    expect(section.textContent).toContain("No catalogued body brighter than V 20 matches. Unconfirmed candidate: further analysis required.");
    expect(section.textContent).toContain("39″/h toward the south-east");
    expect(screen.getByRole("checkbox", { name: "Also show 1 weak candidate (two sightings only)" })).toBeInTheDocument();
  });
});

describe("brightness measurements and the plot in Bangla", () => {
  it("says what the points mean in each kind of sequence", () => {
    const common = { results: [], current: 0, passFrames: [A, B, C], target: { ra: 161.29678, dec: 2.44824 }, source: "snapshot" as const, onSelectFrame: () => {} };
    const { unmount } = wrap(<Measurements mode="pass" sequence={[A, B, C]} {...common} />);
    expect(screen.getByText("spectrum").closest("p")).toHaveTextContent(
      "In one pass, each exposure sees the target through a different part of SPHEREx’s filter, so these points trace the target’s spectrum across this detector’s band. They were taken at different times, so a source that varies within a pass would distort it.",
    );
    bangla();
    expect(plain(screen.getByText(named("বর্ণালি")).closest("p")?.textContent)).toBe(
      "একটি জরিপ-পর্বে প্রতিটি এক্সপোজার SPHEREx-এর ফিল্টারের আলাদা আলাদা অংশ দিয়ে লক্ষ্যকে দেখে, তাই এই বিন্দুগুলো এই ডিটেক্টরের ব্যান্ডজুড়ে লক্ষ্যের বর্ণালি এঁকে দেয়। বিন্দুগুলো ভিন্ন ভিন্ন সময়ে নেওয়া, তাই যে উৎস একটি পর্বের মধ্যেই বদলায়, সেটি বর্ণালিটিকে বিকৃত করবে।",
    );
    expect(screen.getByRole("button", { name: named("এই জরিপ-পর্বের ছয়টি ব্যান্ডই মাপুন") })).toBeInTheDocument();
    expect(plain(screen.getByRole("region", { name: named("লক্ষ্যে উজ্জ্বলতা") }).textContent)).toContain("3টি ফ্রেম, প্রায় 0.75–5 µm।");
    unmount();

    wrap(<Measurements mode="wavelength" sequence={[A, frame({ id: "f9", release: "qr3", mjdMid: 61200 })]} {...common} />);
    expect(plain(screen.getByText(named("সময়ের")).closest("p")?.textContent)).toBe(
      "প্রতিটি বিন্দু লক্ষ্যকে প্রায় একই তরঙ্গদৈর্ঘ্যে দেখেছে, তাই এদের মধ্যের পার্থক্য হলো সময়ের সঙ্গে পরিবর্তন, ত্রুটি-দণ্ডের সীমার মধ্যে এবং সাধারণ অ্যাপারচার ফটোমেট্রির সতর্কতাগুলো সাপেক্ষে।",
    );
    expect(plain(screen.getByText(/QR2/).textContent)).toBe(
      "এই ফ্রেমগুলো ভিন্ন ভিন্ন ডেটা রিলিজ থেকে এসেছে (QR2 ও QR3), যেগুলো ভিন্নভাবে ক্যালিব্রেট করা হয়েছিল। রিলিজগুলোর মাঝে ছোট একটি ধাপ উৎসের কারণে না হয়ে ক্যালিব্রেশনের কারণেও হতে পারে।",
    );
    act(() => setLang("en"));
    expect(screen.getByText(/QR2/)).toHaveTextContent(
      "These frames come from different data releases (QR2 and QR3), which were calibrated differently. A small step between releases may be calibration rather than the source.",
    );
  });

  it("labels the plot and its table in Bangla", () => {
    const plot = (x: string, y: string) => (
      <ScatterPlot
        points={[{ id: "a", x: 1.1, y: 5, yErr: 0.5, details: ["note"] }]}
        xLabel={x}
        yLabel={y}
        xHeading={x}
        yHeading={y}
        formatX={(v) => v.toFixed(2)}
        formatY={(v) => String(v)}
        caption=""
      />
    );
    const { rerender } = render(plot("Wavelength (µm)", "Brightness (mJy)"));
    expect(screen.getByRole("group", { name: "Brightness (mJy) against Wavelength (µm). Use the arrow keys to read points." })).toBeInTheDocument();
    expect(screen.getByText("Show the values as a table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Notes" })).toBeInTheDocument();
    bangla();
    rerender(plot("লক্ষ্যে তরঙ্গদৈর্ঘ্য (µm)", "উজ্জ্বলতা (mJy)"));
    expect(
      screen.getByRole("group", { name: named("উজ্জ্বলতা (mJy) বনাম লক্ষ্যে তরঙ্গদৈর্ঘ্য (µm)। বিন্দুগুলো একে একে পড়তে কিবোর্ডের তীরচিহ্ন-বোতাম ব্যবহার করুন।") }),
    ).toBeInTheDocument();
    expect(screen.getByText(named("মানগুলো সারণি আকারে দেখুন"))).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: named("মন্তব্য") })).toBeInTheDocument();
  });
});

describe("the viewer's message tables", () => {
  // Where Bangla counts with a classifier it takes the bare number ({n}, {total}) instead of the
  // English plural ({frames}) or noun ({noun}); the code passes both.
  const EXTRA: Record<string, string[]> = { "VIEWER.loaded": ["n"], "KNOWN.inField": ["total"] };
  const DROPPED: Record<string, string[]> = { "VIEWER.loaded": ["frames"], "KNOWN.inField": ["frames"], "KNOWN.showWeak": ["noun"] };
  const TABLES: Record<string, Messages<string>> = { VIEWER, OVERLAYS, TIMELINE, WAVELENGTH, KNOWN, PLOTS };
  const KEEP = ["SPHEREx", "JPL", "IRSA", "S3", "MB", "µm", "″", "°", "AB", "UTC", "V =", "Asinh", "←", "→"];
  const holes = (s: string) => new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!));

  it("fills the same placeholders, keeps names and symbols, and uses Western digits", () => {
    for (const [table, messages] of Object.entries(TABLES)) {
      for (const key of Object.keys(messages.en)) {
        const en = messages.en[key]!;
        const bn = messages.bn[key]!;
        const where = `${table}.${key}`;
        expect(bn.trim().length, where).toBeGreaterThan(0);
        expect(bn, where).not.toMatch(BANGLA_DIGITS);
        expect(bn, where).not.toContain("আবিষ্কার");
        const allowed = new Set([...holes(en), ...(EXTRA[where] ?? [])]);
        for (const hole of holes(bn)) expect(allowed.has(hole), `${where} {${hole}}`).toBe(true);
        const filled = new Set([...holes(bn), ...(DROPPED[where] ?? [])]);
        for (const hole of holes(en)) expect(filled.has(hole), `${where} drops {${hole}}`).toBe(true);
        for (const name of KEEP) if (new RegExp(`(^|[^A-Za-z])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^A-Za-z]|$)`).test(en)) expect(bn, `${where} keeps ${name}`).toContain(name);
      }
    }
  });
});
