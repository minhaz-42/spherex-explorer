import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { ScatterPlot } from "../src/features/plots/ScatterPlot";
import { SearchForm } from "../src/features/search/SearchForm";

beforeAll(() => {
  // jsdom has no layout engine: give the plot a width to draw into.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 600 });
});

describe("SearchForm", () => {
  it("asks for input instead of searching for nothing", async () => {
    const onSearch = vi.fn();
    render(<SearchForm onSearch={onSearch} />);
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Type an object name or coordinates.");
    expect(onSearch).not.toHaveBeenCalled();
  });

  it("sends the trimmed query", async () => {
    const onSearch = vi.fn();
    render(<SearchForm onSearch={onSearch} />);
    await userEvent.type(screen.getByLabelText("Object name or sky coordinates"), "  M31 {enter}");
    expect(onSearch).toHaveBeenCalledWith("M31");
  });

  it("shows a server error next to the field", () => {
    render(<SearchForm onSearch={() => {}} error="No object called “Xyz” was found." />);
    expect(screen.getByRole("alert")).toHaveTextContent("No object called");
    expect(screen.getByLabelText("Object name or sky coordinates")).toHaveAttribute("aria-invalid", "true");
  });
});

describe("ScatterPlot", () => {
  const points = [
    { id: "a", x: 1.1, y: 5, yErr: 0.5, details: ["2 Dec 2025 12:06 UTC"] },
    { id: "b", x: 1.5, y: 200, yErr: 2, current: true, details: ["2 Dec 2025 21:49 UTC"] },
    { id: "c", x: 1.3, y: 0.2, caveat: true, details: ["Signal-to-noise below 3"] },
  ];

  it("keeps every value in a table, in x order, with its notes", () => {
    render(
      <ScatterPlot
        points={points}
        xLabel="Wavelength (µm)"
        yLabel="Brightness (mJy)"
        xHeading="Wavelength"
        yHeading="Brightness (mJy)"
        formatX={(v) => v.toFixed(2)}
        formatY={(v) => String(v)}
        caption="3 frames measured."
      />,
    );
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows.map((r) => r.querySelector("td")?.textContent)).toEqual(["1.10", "1.30", "1.50"]);
    expect(rows[1]).toHaveTextContent("Signal-to-noise below 3");
    expect(rows[2]).toHaveTextContent("200 ± 2");
    expect(screen.getByRole("group", { name: /Brightness \(mJy\) against Wavelength/ })).toBeInTheDocument();
  });

  it("can be read point by point from the keyboard", async () => {
    const onSelect = vi.fn();
    render(
      <ScatterPlot
        points={points}
        xLabel="Wavelength (µm)"
        yLabel="Brightness (mJy)"
        xHeading="Wavelength"
        yHeading="Brightness (mJy)"
        formatX={(v) => v.toFixed(2)}
        formatY={(v) => String(v)}
        onSelect={onSelect}
        caption=""
      />,
    );
    const plot = screen.getByRole("group", { name: /against/ });
    plot.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("status")).toHaveTextContent("5 ± 0.5");
    await userEvent.keyboard("{ArrowRight}{Enter}");
    expect(onSelect).toHaveBeenCalledWith("c");
  });
});
