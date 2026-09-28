import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { routes } from "../src/app/router";

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  // No retries and no network: pages that fetch fall back to their offline states.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
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

describe("landing page", () => {
  it("leads with the promise and the three questions", () => {
    renderAt("/");
    expect(screen.getByRole("heading", { level: 1, name: /pick a point in the sky/i })).toBeInTheDocument();
    for (const q of ["Where?", "When?", "What changed?"]) {
      expect(screen.getByRole("heading", { name: q })).toBeInTheDocument();
    }
  });

  it("sends a search to the explorer with the query in the URL", async () => {
    const router = renderAt("/");
    const [field] = screen.getAllByLabelText("Object name or coordinates");
    await userEvent.type(field!, "M31{Enter}");
    expect(router.state.location.pathname).toBe("/explore");
    expect(router.state.location.search).toBe("?q=M31");
  });

  it("offers examples that are known to have data", () => {
    renderAt("/");
    expect(screen.getByRole("link", { name: "Andromeda Galaxy" })).toHaveAttribute("href", "/explore?q=M31");
    expect(screen.getByRole("link", { name: "Asteroid (7) Iris" })).toHaveAttribute("href", "/discover");
  });

  it("lets keyboard users pick a planet and read about it", async () => {
    renderAt("/");
    await userEvent.click(screen.getByRole("button", { name: "Saturn" }));
    expect(screen.getByRole("button", { name: "Saturn" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/rings are mostly water ice/i)).toBeInTheDocument();
  });

  it("explains each SPHEREx band on request", async () => {
    renderAt("/");
    await userEvent.click(screen.getByRole("button", { name: /Band 6/ }));
    expect(screen.getByText(/Carbon-monoxide ice/)).toBeInTheDocument();
  });

  it("shows the Iris case as a labelled illustration until the real frames load", () => {
    renderAt("/");
    expect(screen.getByRole("img", { name: /Illustration: the asteroid \(7\) Iris/ })).toBeInTheDocument();
    expect(screen.getByText(/The real frames are on the Discover page/)).toBeInTheDocument();
  });
});
