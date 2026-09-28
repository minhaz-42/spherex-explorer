import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ObjectAtlas } from "../src/features/objects/ObjectAtlas";
import { ATLAS } from "../src/features/objects/atlas";
import { FieldObjects } from "../src/features/objects/FieldObjects";
import { displayId, formatLightYears, formatSize, frameFov, morphologyWords } from "../src/features/objects/format";
import { ObjectProfile } from "../src/features/objects/ObjectProfile";
import { eclipticToEquatorial, galacticToEquatorial, hammer } from "../src/features/objects/sky";
import type { FieldObjects as FieldObjectsAnswer, ObjectInfo } from "../src/features/objects/types";

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
  magnitudes: { V: 3.44, K: 0.98 },
  parallaxMas: null,
  distance: { value: 0.77, unit: "Mpc", lightYears: 2_510_000, method: "median of 12 published measurements" },
  redshift: -0.001,
  radialVelocityKms: -300,
  size: { majorArcmin: 199.5, minorArcmin: 70.8 },
  references: 13000,
  links: {
    simbad: "https://simbad.cds.unistra.fr/simbad/sim-id?Ident=M31",
    ned: "https://ned.ipac.caltech.edu/byname?objname=M31",
  },
  credit: "SIMBAD, CDS, Strasbourg",
};

const FIELD: FieldObjectsAnswer = {
  objects: [
    {
      id: "M  32",
      name: null,
      otype: "G",
      typeLabel: "Galaxy",
      category: "galaxy",
      ra: 10.6743,
      dec: 40.8652,
      separationArcmin: 24.2,
      magnitudes: { V: 8.1 },
      references: 2500,
    },
    {
      id: "HD   3914",
      name: null,
      otype: "*",
      typeLabel: "Star",
      category: "star",
      ra: 10.8,
      dec: 41.2,
      separationArcmin: 6.3,
      magnitudes: { V: 7.2, K: 5.9 },
      references: 30,
    },
  ],
  radiusDeg: 0.15,
  total: 2,
  credit: "SIMBAD, CDS, Strasbourg",
};

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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sky maths", () => {
  it("puts the Galactic centre and the ecliptic where they belong", () => {
    const [ra, dec] = galacticToEquatorial(0, 0);
    expect(ra).toBeCloseTo(266.405, 1);
    expect(dec).toBeCloseTo(-28.936, 1);
    const [era, edec] = eclipticToEquatorial(90, 0);
    expect(era).toBeCloseTo(90, 3);
    expect(edec).toBeCloseTo(23.439, 2);
  });

  it("projects the whole sky into the Hammer ellipse, with RA increasing to the left", () => {
    const centre = hammer(0, 0);
    expect(centre.x).toBeCloseTo(0, 9);
    expect(centre.y).toBeCloseTo(0, 9);
    expect(hammer(0, 90).y).toBeCloseTo(Math.SQRT2, 6);
    expect(hammer(30, 0).x).toBeLessThan(0);
    expect(hammer(330, 0).x).toBeGreaterThan(0);
  });

  it("formats distances, sizes and a framing field of view", () => {
    expect(formatLightYears(2_510_000)).toBe("2.5 million light-years");
    expect(formatLightYears(640)).toBe("640 light-years");
    expect(formatSize({ majorArcmin: 199.5, minorArcmin: 70.8 })).toBe("3.3° × 1.2°");
    expect(formatSize({ majorArcmin: 0.5, minorArcmin: null })).toBe("30″");
    expect(frameFov(M31)).toBe(3);
    expect(frameFov(null)).toBe(0.3);
  });
});

describe("galaxy shapes", () => {
  it("reads the morphology codes SIMBAD actually returns", () => {
    // Real SIMBAD values (2026-09-28): M31, NGC 1300, M33, M51, LMC, M87, M110, Centaurus A, NGC 6822, M104.
    const cases: Array<[string, string | null]> = [
      ["SA(s)b", "Spiral galaxy"],
      ["SB(rs)bc", "Barred spiral galaxy"],
      ["SA(s)cd", "Spiral galaxy"],
      ["SA", "Spiral galaxy"],
      ["SB(s)m", "Barred Magellanic spiral galaxy"],
      ["E-E/S0", "Elliptical galaxy"],
      ["E5pec", "Elliptical galaxy"],
      ["S0pec", "Lenticular galaxy"],
      ["IBm", "Barred irregular galaxy"],
      ["1", null],
      ["SAB(rs)c", "Weakly barred spiral galaxy"],
      ["dE2", "Dwarf elliptical galaxy"],
      ["Irr", "Irregular galaxy"],
    ];
    for (const [code, words] of cases) expect(morphologyWords(code), code).toBe(words);
    expect(morphologyWords(null)).toBeNull();
  });

  it("writes SIMBAD identifiers as people do", () => {
    expect(displayId("M  31")).toBe("M 31");
    expect(displayId("NAME Centaurus A")).toBe("Centaurus A");
    expect(displayId("*  36 Sex")).toBe("36 Sex");
    expect(displayId("V* RR Lyr")).toBe("RR Lyr");
    expect(displayId("** STF 2272")).toBe("STF 2272");
    expect(displayId("* alf CMa")).toBe("α CMa");
    expect(displayId("* mu. Cep")).toBe("μ Cep");
    expect(displayId("* ome02 Sco")).toBe("ω² Sco");
    expect(displayId("* 9 CMa")).toBe("9 CMa");
    expect(displayId("NAME Barnard's star")).toBe("Barnard's star");
  });
});

describe("object profile", () => {
  it("shows what the catalogue knows about the object", async () => {
    mockFetch({ "/api/object": { status: 200, body: M31 } });
    wrap(<ObjectProfile ra={10.684708} dec={41.26875} label="M 31" source="live" />);
    expect(await screen.findByRole("heading", { name: "Andromeda Galaxy" })).toBeInTheDocument();
    // Named by its shape, with SIMBAD's own class (by its nucleus) kept underneath.
    expect(screen.getByText("Spiral galaxy")).toBeInTheDocument();
    expect(screen.getByText("SIMBAD class: Active Galaxy Nucleus")).toBeInTheDocument();
    expect(screen.getByText("SA(s)b")).toBeInTheDocument();
    expect(screen.getByText(/2\.5 million light-years/)).toBeInTheDocument();
    expect(screen.getByText(/NGC 224/)).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: /image of this field/ })).toHaveLength(3);
    expect(screen.getByRole("link", { name: /SIMBAD/ })).toHaveAttribute("href", M31.links.simbad);
  });

  it("says so when nothing is catalogued at the position", async () => {
    mockFetch({});
    wrap(<ObjectProfile ra={270} dec={66.56} label="North ecliptic pole" source="live" />);
    expect(await screen.findByText(/No catalogued object sits exactly here/)).toBeInTheDocument();
  });
});

describe("objects in the field", () => {
  it("lists them with links that explore each one", async () => {
    mockFetch({ "/api/field-objects": { status: 200, body: FIELD } });
    wrap(<FieldObjects ra={10.684708} dec={41.26875} source="live" />);
    const table = await screen.findByRole("table");
    const link = within(table).getByRole("link", { name: /M 32/ });
    expect(link.getAttribute("href")).toContain("/explore?ra=10.674300&dec=40.865200");
    expect(within(table).getByText("Star")).toBeInTheDocument();
  });
});

describe("atlas", () => {
  it("offers curated objects and filters them by kind", async () => {
    wrap(<ObjectAtlas />);
    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(ATLAS.length);
    const galaxies = ATLAS.filter((o) => o.category === "galaxy").length;
    await userEvent.click(screen.getByRole("button", { name: "Galaxies" }));
    expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(galaxies);
  });

  it("gives every object a link and a position", () => {
    for (const o of ATLAS) {
      expect(o.query ?? o.to, o.id).toBeTruthy();
      expect(o.ra, o.id).toBeGreaterThanOrEqual(0);
      expect(o.ra, o.id).toBeLessThan(360);
      expect(Math.abs(o.dec), o.id).toBeLessThanOrEqual(90);
      expect(o.fovDeg, o.id).toBeGreaterThan(0);
    }
  });
});
