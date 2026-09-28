import { expect, test } from "@playwright/test";

test("a position outside the demo snapshot says so and offers live data", async ({ page }) => {
  await page.goto("/explore?ra=10&dec=10&source=snapshot");
  await expect(page.getByText("This position is not in the demo snapshot.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Use live data" })).toBeVisible();
  // Nothing is substituted: no image is shown.
  await expect(page.getByRole("img", { name: /SPHEREx image of/ })).toHaveCount(0);
});

test("impossible coordinates are explained, not searched", async ({ page }) => {
  await page.goto("/explore");
  await page.getByLabel("Object name or sky coordinates").fill("10 95");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("alert")).toContainText("Declination must be between");
});

test("an empty search asks for input", async ({ page }) => {
  await page.goto("/explore");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("alert")).toContainText("Type an object name or coordinates");
});

test("Discover lists real cases with evidence and cautions", async ({ page }) => {
  await page.goto("/discover");
  await expect(page.getByRole("heading", { name: "Changes SPHEREx has seen" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Asteroid \(7\) Iris/ })).toBeVisible();
  await expect(page.getByText(/JPL predicts 7 Iris/)).toBeVisible();
  await expect(page.getByText(/not from this app/).first()).toBeVisible();
  await page.getByRole("link", { name: /Open the demo snapshot/ }).first().click();
  await expect(page).toHaveURL(/source=snapshot/);
  await expect(page.getByText(/Demo snapshot/).first()).toBeVisible();
});

test("unknown pages have a way back", async ({ page }) => {
  await page.goto("/no-such-page");
  await expect(page.getByRole("link", { name: "Explore the sky" })).toBeVisible();
});
