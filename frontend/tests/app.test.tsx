import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { routes } from "../src/app/router";

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(<RouterProvider router={router} />);
}

describe("app shell", () => {
  it("shows the main navigation and credits on every page", () => {
    renderAt("/about");
    expect(screen.getAllByRole("navigation", { name: "Main" }).length).toBeGreaterThan(0);
    expect(screen.getByText(/Not affiliated with or endorsed by NASA/)).toBeInTheDocument();
  });

  it("renders a helpful 404 for unknown paths", () => {
    renderAt("/no-such-page");
    expect(screen.getByRole("heading", { name: /nothing at this address/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore the sky" })).toHaveAttribute("href", "/explore");
  });
});
