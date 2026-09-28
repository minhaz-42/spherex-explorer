import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CatalogMarkers } from "../src/features/viewer/overlays";

function draw(points: Parameters<typeof CatalogMarkers>[0]["points"]) {
  const { container } = render(
    <svg>
      <CatalogMarkers points={points} scale={1} />
    </svg>,
  );
  return container;
}

describe("catalogued objects on the image", () => {
  it("rings every object and names the ones whose labels fit", () => {
    const svg = draw([
      { x: 10, y: 10, name: "Andromeda Galaxy", type: "Galaxy", covered: true },
      // Right beside the first: its label would overlap, so only its ring is drawn.
      { x: 14, y: 12, name: "Bol 147", type: "Globular Cluster", covered: true },
      { x: 10, y: 80, name: "M31 RV", type: "Classical Nova", covered: true },
    ]);
    expect(svg.querySelectorAll("circle")).toHaveLength(3);
    expect([...svg.querySelectorAll("text")].map((t) => t.textContent)).toEqual(["Andromeda Galaxy", "M31 RV"]);
    expect(svg.querySelector("title")?.textContent).toBe("Andromeda Galaxy: Galaxy, catalogued in SIMBAD");
  });

  it("dims objects where the frame has no data", () => {
    const svg = draw([{ x: 10, y: 10, name: "Bol 158", type: "Globular Cluster", covered: false }]);
    expect(svg.querySelector("g g")?.getAttribute("opacity")).toBe("0.45");
  });
});
