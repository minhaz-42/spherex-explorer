import { expect, test } from "@playwright/test";

/**
 * The Ask page on the demo snapshot, with no language model (SPHEREX_ASSISTANT_PROVIDER=off in
 * playwright.config.ts): answers are built from the same evidence a local model would be given.
 */
const IRIS =
  "/explore?ra=161.29678&dec=2.44824&name=Asteroid+%287%29+Iris+near+36+Sextantis&seq=pass&det=2" +
  "&f=2025W49_1A_0423_1&fa=2025W49_1A_0332_1&cmp=blink&fov=0.3&source=snapshot";

test("Ask answers about the view you had open", async ({ page }) => {
  await page.goto(IRIS);
  await expect(page.getByText(/19 frames of 19 loaded/)).toBeVisible();
  await page.getByRole("link", { name: "Ask about this view" }).click();

  await expect(page).toHaveURL(/\/ask$/);
  await expect(page.getByRole("heading", { level: 1, name: "Ask about the sky" })).toBeVisible();
  await expect(page.getByText(/Built-in answers/)).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Your question" })).toBeFocused();
  const card = page.getByRole("region", { name: "The view you had open" });
  await expect(card).toContainText("Asteroid (7) Iris near 36 Sextantis");
  await expect(card).toContainText("frame 10 of 19 · detector 2 · blinking A and B · demo snapshot");

  await page.getByRole("button", { name: "Did anything move here?" }).click();
  // The server read the frames, JPL's predictions and the search result for exactly that view.
  const answer = page.locator("article p").filter({ hasText: /^Target on screen — Asteroid \(7\) Iris/ });
  await expect(answer).toBeVisible();
  await expect(answer).toContainText("matches JPL's prediction for 7 Iris");
  await expect(answer).toContainText("includes the light of 7 Iris (A847 PA) in frame B but not in frame A");

  await page.getByText(/^Sources \(\d+\)$/).click();
  await expect(page.getByText("Comparison of A and B", { exact: true })).toBeVisible();
  await expect(page.getByText("JPL known objects in this field", { exact: true })).toBeVisible();
});

test("Ask links to Discover cases, stays on the demo snapshot and keeps the conversation", async ({ page }) => {
  await page.goto(IRIS);
  await expect(page.getByText(/19 frames of 19 loaded/)).toBeVisible();
  await page.getByRole("link", { name: "Ask", exact: true }).click();
  await page.getByRole("textbox", { name: "Your question" }).fill("Show me an asteroid");
  await page.getByRole("textbox", { name: "Your question" }).press("Enter");

  const hebe = page.getByRole("link", { name: /Open: Asteroid \(6\) Hebe/ });
  await expect(hebe).toBeVisible();
  await hebe.click();
  await expect(page).toHaveURL(/ra=326\.891.*source=snapshot/);
  await expect(page.getByRole("heading", { level: 1, name: /Hebe/ })).toBeVisible();

  await page.getByRole("link", { name: "Ask", exact: true }).click();
  await expect(page.getByText("Show me an asteroid")).toBeVisible();
});

test("Ask never claims a planet", async ({ page }) => {
  await page.goto("/ask");
  await page.getByRole("button", { name: "Could SPHEREx find Planet Nine?" }).click();
  const answer = page.locator("article").last();
  await expect(answer.getByText(/Planet/).first()).toBeVisible();
  await expect(answer).not.toContainText(/discovered|we found|is Planet X/i);
});
