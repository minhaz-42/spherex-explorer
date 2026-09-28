import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AtlasTeaser } from "../src/features/objects/AtlasTeaser";
import { ATLAS, atlasEntryFor, atlasText, deepFieldName } from "../src/features/objects/atlas";
import { constellationName } from "../src/features/objects/constellations";
import { FieldObjects } from "../src/features/objects/FieldObjects";
import {
  distanceMethod,
  formatDistance,
  formatLightYears,
  infraredNote,
  keepNumbersWithUnits,
  mapLabel,
  morphologyWords,
} from "../src/features/objects/format";
import { PROFILE } from "../src/features/objects/messages";
import { ObjectAtlas } from "../src/features/objects/ObjectAtlas";
import { ObjectProfile, type SkyContext } from "../src/features/objects/ObjectProfile";
import type { FieldObjects as FieldObjectsAnswer, ObjectInfo } from "../src/features/objects/types";
import { currentLang, setLang } from "../src/lib/i18n";

const BANGLA_DIGITS = /[০-৯]/;
// In Bangla a number is joined to its word by a no-break space, "25\u00a0লক্ষ", "(774\u00a0kpc)".
const nb = (text: string) => text.replace(/(\d) /g, "$1\u00a0");
const BENGALI = /[ঀ-৿]/;

const M31: ObjectInfo = {
  id: "M  31",
  name: "Andromeda Galaxy",
  otype: "AGN",
  typeLabel: "Active Galaxy Nucleus",
  category: "galaxy",
  ra: 10.684708,
  dec: 41.26875,
  separationArcsec: 0.2,
  aliases: ["NGC 224", "UGC 454", "PGC 2557"],
  spectralType: null,
  morphology: "SA(s)b",
  magnitudes: { B: 4.36, V: 3.44, J: 2.09, H: 1.28, K: 0.98 },
  parallaxMas: null,
  distance: { value: 0.77, unit: "Mpc", lightYears: 2_510_000, method: "median of 12 published measurements" },
  redshift: -0.001,
  radialVelocityKms: -300,
  size: { majorArcmin: 199.5, minorArcmin: 70.8 },
  references: 13000,
  links: { simbad: "https://simbad.cds.unistra.fr/simbad/sim-id?Ident=M31" },
  credit: "SIMBAD, CDS, Strasbourg",
};

const SKY: SkyContext = {
  constellation: "Andromeda",
  galactic: { l: 121.2, b: -21.6 },
  ecliptic: { lon: 27.8, lat: 33.3 },
  deepField: null,
};

// The 88 names as the API sends them (astropy's get_constellation, misspellings and all).
const API_CONSTELLATIONS = [
  "Andromeda", "Antlia", "Apus", "Aquarius", "Aquila", "Ara", "Aries", "Auriga", "Boötes", "Caelum",
  "Camelopardalis", "Cancer", "Canes Venatici", "Canis Major", "Canis Minor", "Capricornus", "Carina",
  "Cassiopeia", "Centaurus", "Cepheus", "Cetus", "Chamaleon", "Circinus", "Columba", "Coma Berenices",
  "Corona Australis", "Corona Borealis", "Corvus", "Crater", "Crux ", "Cygnus", "Delphinus", "Dorado",
  "Draco", "Equuleus", "Eridanus", "Fornax", "Gemini", "Grus", "Hercules", "Horologium", "Hydra", "Hydrus",
  "Indus", "Lacerta", "Leo", "Leo Minor", "Lepus", "Libra", "Lupus", "Lynx", "Lyra", "Mensa",
  "Microscopium", "Monoceros", "Musca", "Norma", "Octans", "Ophiucus", "Orion", "Pavo", "Pegasus",
  "Perseus", "Phoenix", "Pictor", "Pisces", "Pisces Austrinus", "Puppis", "Pyxis", "Reticulum", "Sagitta",
  "Sagittarius", "Scorpius", "Sculptor", "Scutum", "Serpens", "Sextans", "Taurus", "Telescopium",
  "Triangulum", "Triangulum Australe", "Tucana", "Ursa Major", "Ursa Minor", "Vela", "Virgo", "Volans",
  "Vulpecula",
];

function mockFetch(routes: Record<string, { status: number; body: unknown }>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const path = new URL(url, "http://localhost").pathname;
      const hit = routes[path];
      if (!hit) return new Response(JSON.stringify({ error: { code: "not_found", message: "no" } }), { status: 404 });
      return new Response(JSON.stringify(hit.body), {
        status: hit.status,
        headers: { "Content-Type": "application/json" },
      });
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

const bangla = () => act(() => setLang("bn"));

afterEach(() => {
  act(() => setLang("en"));
  vi.unstubAllGlobals();
});

describe("distances in Bangla", () => {
  it("counts in হাজার, লক্ষ and কোটি, with Western digits", () => {
    const cases: Array<[number, string]> = [
      [0.5, "0.5 আলোকবর্ষ"],
      [480, "480 আলোকবর্ষ"],
      [640, "640 আলোকবর্ষ"],
      [999.7, "প্রায় 1,000 আলোকবর্ষ"],
      [1_540, "প্রায় 1,500 আলোকবর্ষ"],
      [5_760, "প্রায় 5,800 আলোকবর্ষ"],
      [9_960, "প্রায় 10 হাজার আলোকবর্ষ"],
      [26_100, "প্রায় 26 হাজার আলোকবর্ষ"],
      [99_600, "প্রায় 1 লক্ষ আলোকবর্ষ"],
      [170_000, "প্রায় 1.7 লক্ষ আলোকবর্ষ"],
      [2_530_000, "প্রায় 25 লক্ষ আলোকবর্ষ"],
      [9_960_000, "প্রায় 1 কোটি আলোকবর্ষ"],
      [12_200_000, "প্রায় 1.2 কোটি আলোকবর্ষ"],
      [30_000_000, "প্রায় 3 কোটি আলোকবর্ষ"],
      [250_000_000, "প্রায় 25 কোটি আলোকবর্ষ"],
      [1_000_000_000, "প্রায় 1 শত কোটি আলোকবর্ষ"],
      [2_500_000_000, "প্রায় 2.5 শত কোটি আলোকবর্ষ"],
      [13_800_000_000, "প্রায় 14 শত কোটি আলোকবর্ষ"],
    ];
    for (const [ly, words] of cases) {
      expect(formatLightYears(ly, "bn"), String(ly)).toBe(nb(words));
      expect(formatLightYears(ly, "bn")).not.toMatch(BANGLA_DIGITS);
    }
    expect(formatDistance({ value: 774, unit: "kpc", lightYears: 2_530_000, method: "x" }, "bn")).toBe(
      nb("প্রায় 25 লক্ষ আলোকবর্ষ (774 kpc)"),
    );
  });

  it("keeps English as it was, and English by default", () => {
    expect(formatLightYears(2_530_000)).toBe("2.5 million light-years");
    expect(formatLightYears(2_530_000, "en")).toBe("2.5 million light-years");
    expect(formatLightYears(12_200_000)).toBe("12 million light-years");
    expect(formatLightYears(480)).toBe("480 light-years");
    expect(formatDistance({ value: 0.77, unit: "Mpc", lightYears: 2_510_000, method: "x" })).toBe(
      "2.5 million light-years (0.77 Mpc)",
    );
  });

  it("says how the distance was measured", () => {
    expect(distanceMethod("median of 14 published measurements", "bn")).toBe("14টি প্রকাশিত পরিমাপের মধ্যক");
    expect(distanceMethod("1 published measurement", "bn")).toBe("1টি প্রকাশিত পরিমাপ");
    expect(distanceMethod("parallax", "bn")).toBe("লম্বন");
    expect(distanceMethod("something new", "bn")).toBe("something new");
    expect(distanceMethod("median of 14 published measurements")).toBe("median of 14 published measurements");
  });
});

describe("names and words in Bangla", () => {
  it("names galaxy shapes, wherever English does", () => {
    expect(morphologyWords("SA(s)b", "bn")).toBe("সর্পিল গ্যালাক্সি");
    expect(morphologyWords("SB(rs)bc", "bn")).toBe("বার-যুক্ত সর্পিল গ্যালাক্সি");
    expect(morphologyWords("SB(s)m", "bn")).toBe("বার-যুক্ত ম্যাজেলানিক ধাঁচের সর্পিল গ্যালাক্সি");
    expect(morphologyWords("S0pec", "bn")).toBe("লেন্স-আকৃতির গ্যালাক্সি");
    expect(morphologyWords("E5pec", "bn")).toBe("উপবৃত্তাকার গ্যালাক্সি");
    for (const code of ["SAB(rs)c", "dE2", "IBm", "Irr", "Sm", "1", "", null]) {
      expect(morphologyWords(code, "bn") === null, String(code)).toBe(morphologyWords(code) === null);
    }
  });

  it("names every constellation the API sends", () => {
    expect(API_CONSTELLATIONS).toHaveLength(88);
    for (const name of API_CONSTELLATIONS) expect(constellationName(name, "bn"), name).toMatch(BENGALI);
    expect(constellationName("Orion", "bn")).toBe("কালপুরুষ");
    expect(constellationName("Ursa Major", "bn")).toBe("সপ্তর্ষিমণ্ডল");
    expect(constellationName("Crux ", "bn")).toBe("ত্রিশঙ্কু");
    expect(constellationName("Taurus", "bn")).toBe("বৃষ");
    expect(constellationName("Andromeda", "bn")).toBe("অ্যান্ড্রোমিডা");
    expect(constellationName("Nowhere", "bn")).toBe("Nowhere");
    expect(constellationName("Orion", "en")).toBe("Orion");
  });

  it("writes an infrared note for every kind of object", () => {
    for (const kind of ["galaxy", "star", "nebula", "cluster", "solar-system", "other"] as const) {
      expect(infraredNote(kind, "bn")).toMatch(BENGALI);
      expect(infraredNote(kind, "bn")).not.toMatch(BANGLA_DIGITS);
    }
  });

  it("keeps a number on the same line as its unit", () => {
    expect(keepNumbersWithUnits("প্রায় 31 কোটি km (2.1 au), ডিসেম্বর 2025-এ")).toBe(
      "প্রায় 31\u00a0কোটি\u00a0km (2.1\u00a0au), ডিসেম্বর 2025-এ",
    );
    expect(keepNumbersWithUnits("আর 3.3 µm-এর কাছে, 1774 সালে")).toBe("আর 3.3\u00a0µm-এর কাছে, 1774 সালে");
    const helix = atlasText(ATLAS.find((o) => o.id === "helix-nebula")!, "bn");
    expect(helix.distance).toBe("প্রায় 650\u00a0আলোকবর্ষ");
    expect(atlasText(ATLAS.find((o) => o.id === "helix-nebula")!, "en").distance).toBe("about 650 light-years");
  });

  it("shortens a Bangla map label between words", () => {
    expect(mapLabel("কালপুরুষ নীহারিকা", "bn")).toBe("কালপুরুষ নীহারিকা");
    const long = "ক্রান্তিবৃত্তের উত্তর মেরুর গভীর ক্ষেত্র";
    const short = mapLabel(long, "bn");
    expect(short.endsWith("…")).toBe(true);
    expect(long.startsWith(short.slice(0, -1))).toBe(true);
    expect(long.charAt(short.length - 1)).toBe(" ");
    expect(mapLabel("A rather long label for the map target", "en")).toBe("A rather long label f…");
  });
});

describe("atlas in Bangla", () => {
  it("has a complete Bangla entry for every object", () => {
    expect(ATLAS).toHaveLength(24);
    for (const o of ATLAS) {
      expect(o.bn, o.id).toBeDefined();
      const bn = atlasText(o, "bn");
      for (const [field, text] of Object.entries(bn)) {
        if (field === "catalogue") continue;
        expect(text, `${o.id}.${field}`).toMatch(BENGALI);
        expect(text, `${o.id}.${field}`).not.toMatch(BANGLA_DIGITS);
      }
      // Catalogue designations are kept as they are.
      if (o.category !== "deep-field") expect(bn.catalogue, o.id).toBe(o.catalogue);
      expect(atlasText(o, "en").name, o.id).toBe(o.name);
    }
    const orion = ATLAS.find((o) => o.id === "orion-nebula")!;
    expect(atlasText(orion, "bn")).toMatchObject({ name: "কালপুরুষ নীহারিকা", constellation: "কালপুরুষ" });
    expect(atlasText(ATLAS.find((o) => o.id === "pleiades")!, "bn").name).toBe("কৃত্তিকা");
  });

  it("finds a catalogued object's atlas entry by any designation or its name", () => {
    expect(atlasEntryFor({ id: "M  31", name: null })?.id).toBe("andromeda-galaxy");
    expect(atlasEntryFor({ id: "Cl Melotte   22", name: null, aliases: ["M 45"] })?.id).toBe("pleiades");
    expect(atlasEntryFor({ id: "NAME Centaurus A", name: "Centaurus A" })?.id).toBe("centaurus-a");
    expect(atlasEntryFor({ id: "NAME Horsehead Nebula", name: null, aliases: ["Barnard 33"] })?.id).toBe(
      "horsehead-nebula",
    );
    expect(atlasEntryFor({ id: "M  3", name: null })).toBeNull();
    expect(deepFieldName("South deep field", "bn")).toBe("দক্ষিণের গভীর ক্ষেত্র");
    expect(deepFieldName("South deep field", "en")).toBe("South deep field");
  });

  it("shows the atlas in Bangla and filters it", async () => {
    bangla();
    wrap(<ObjectAtlas />);
    expect(screen.getByRole("heading", { name: "একটি বস্তু দিয়ে শুরু করুন।" })).toBeInTheDocument();
    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(ATLAS.length);
    expect(within(list).getByRole("heading", { name: "কালপুরুষ নীহারিকা" })).toBeInTheDocument();
    expect(within(list).getByRole("heading", { name: "কৃত্তিকা" })).toBeInTheDocument();
    expect(within(list).getByText("M42 · NGC 1976 · কালপুরুষ")).toBeInTheDocument();
    expect(within(list).getByText("প্রায় 25 লক্ষ আলোকবর্ষ")).toBeInTheDocument();
    expect(within(list).getByRole("img", { name: "দৃশ্যমান আলোয় অ্যান্ড্রোমিডা গ্যালাক্সি (DSS2)" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "অ্যাটলাস ফিল্টার করুন" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "সব 24টি" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "গ্যালাক্সি" }));
    const galaxies = ATLAS.filter((o) => o.category === "galaxy").length;
    expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(galaxies);
  });

  it("shows the landing-page teaser in Bangla", () => {
    bangla();
    wrap(<AtlasTeaser />);
    expect(screen.getAllByText("অন্বেষণ করুন")).toHaveLength(4);
    expect(screen.getByText("অ্যান্ড্রোমিডা গ্যালাক্সি")).toBeInTheDocument();
    expect(screen.getByText("কালপুরুষ নীহারিকা")).toBeInTheDocument();
  });

  it("stays in English by default", () => {
    expect(currentLang()).toBe("en");
    wrap(<ObjectAtlas />);
    expect(screen.getByRole("heading", { name: "Start with an object." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Orion Nebula" })).toBeInTheDocument();
    expect(screen.getByText("about 2.5 million light-years")).toBeInTheDocument();
  });
});

describe("object profile in Bangla", () => {
  it("describes the object, keeping SIMBAD's class and catalogue names", async () => {
    mockFetch({ "/api/object": { status: 200, body: M31 } });
    bangla();
    const { container } = wrap(<ObjectProfile ra={10.684708} dec={41.26875} label="M 31" source="live" sky={SKY} />);
    // A famous object takes the atlas's Bangla name, with SIMBAD's English one beneath.
    expect(await screen.findByRole("heading", { name: "অ্যান্ড্রোমিডা গ্যালাক্সি" })).toBeInTheDocument();
    expect(screen.getByText("Andromeda Galaxy · M 31")).toBeInTheDocument();
    expect(screen.getByText("এই বস্তুর পরিচয়")).toBeInTheDocument();
    expect(screen.getByText("সর্পিল গ্যালাক্সি")).toBeInTheDocument();
    expect(screen.getByText("SIMBAD শ্রেণি: Active Galaxy Nucleus")).toBeInTheDocument();
    expect(screen.getByText("প্রায় 25 লক্ষ আলোকবর্ষ (0.77 Mpc)")).toBeInTheDocument();
    expect(screen.getByText("12টি প্রকাশিত পরিমাপের মধ্যক")).toBeInTheDocument();
    expect(screen.getByText("অ্যান্ড্রোমিডা")).toBeInTheDocument(); // the constellation
    expect(screen.getByText("NGC 224 · UGC 454 · PGC 2557")).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: /এই অংশের ছবি/ })).toHaveLength(3);
    expect(screen.getByRole("img", { name: /^পুরো আকাশের মানচিত্র: অ্যান্ড্রোমিডা গ্যালাক্সি/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "এর রংগুলো শুনুন" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /SIMBAD/ })).toHaveAttribute("href", M31.links.simbad);
    // No English sentence of the profile is left on the page.
    const text = container.textContent ?? "";
    // ("Galaxy" and "No" are left out: SIMBAD's own names, such as "Active Galaxy Nucleus", contain them.)
    for (const [key, english] of Object.entries(PROFILE.en)) {
      if (!english.includes("{") && key !== "galaxy" && key !== "no") expect(text, key).not.toContain(english);
    }
    expect(text).not.toMatch(BANGLA_DIGITS);

    // And back to English when the reader switches.
    act(() => setLang("en"));
    expect(screen.getByRole("heading", { name: "Andromeda Galaxy" })).toBeInTheDocument();
    expect(screen.getByText("2.5 million light-years (0.77 Mpc)")).toBeInTheDocument();
  });

  it("says so in Bangla when nothing is catalogued there", async () => {
    mockFetch({});
    bangla();
    wrap(
      <ObjectProfile
        ra={270}
        dec={66.56}
        label="North ecliptic pole"
        source="live"
        sky={{ ...SKY, constellation: "Draco", deepField: "North ecliptic pole deep field" }}
      />,
    );
    expect(await screen.findByText(/ঠিক এই জায়গায় ক্যাটালগভুক্ত কোনো বস্তু নেই/)).toBeInTheDocument();
    expect(screen.getByText("ড্রাকো")).toBeInTheDocument();
    expect(screen.getByText("ক্রান্তিবৃত্তের উত্তর মেরুর গভীর ক্ষেত্র")).toBeInTheDocument();
  });
});

describe("objects in the field, in Bangla", () => {
  it("translates the table but keeps SIMBAD's types, and the links", async () => {
    const field: FieldObjectsAnswer = {
      objects: [
        {
          id: "M  82",
          name: null,
          otype: "SBG",
          typeLabel: "Starburst Galaxy",
          category: "galaxy",
          ra: 148.968458,
          dec: 69.679703,
          separationArcmin: 37.4,
          magnitudes: { V: 8.4, K: 4.7 },
          references: 5000,
        },
      ],
      radiusDeg: 0.15,
      total: 1,
      credit: "SIMBAD, CDS, Strasbourg",
    };
    mockFetch({ "/api/field-objects": { status: 200, body: field } });
    bangla();
    wrap(<FieldObjects ra={148.888219} dec={69.065295} source="live" />);
    const table = await screen.findByRole("table");
    expect(within(table).getByRole("columnheader", { name: "বস্তু" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "লক্ষ্যবস্তু থেকে" })).toBeInTheDocument();
    expect(within(table).getByText("Starburst Galaxy")).toBeInTheDocument();
    const link = within(table).getByRole("link", { name: /সিগার গ্যালাক্সি/ });
    expect(link.getAttribute("href")).toContain("name=M+82");
    expect(screen.getByText("দৃষ্টিক্ষেত্রে ক্যাটালগভুক্ত বস্তু")).toBeInTheDocument();
    expect(screen.getByText(/লক্ষ্যবস্তুর 9′-এর মধ্যে/)).toBeInTheDocument();
  });
});
