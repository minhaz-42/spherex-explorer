import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { PALETTES, THEME_KEY } from "../src/components/space/theme";
import { ThemeToggle } from "../src/components/ThemeToggle";

afterEach(() => {
  delete document.documentElement.dataset.theme;
  localStorage.clear();
});

describe("theme toggle", () => {
  it("starts light, switches to dark and back, and remembers the choice", async () => {
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole("button", { name: "Switch to the dark theme" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");

    const back = screen.getByRole("button", { name: "Switch to the light theme" });
    expect(back).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(back);
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_KEY)).toBe("light");
  });

  it("has a canvas palette for each theme", () => {
    for (const pal of Object.values(PALETTES)) {
      expect(pal.stars.length).toBeGreaterThan(0);
      expect(pal.ink.split(",")).toHaveLength(3);
    }
  });
});
