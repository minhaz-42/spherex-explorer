import { expect, test } from "@playwright/test";

/**
 * The assistant on the demo snapshot, with no language model (SPHEREX_ASSISTANT_PROVIDER=off in
 * playwright.config.ts): answers are built from the same evidence a local model would be given.
 */
const IRIS =
  "/explore?ra=161.29678&dec=2.44824&name=Asteroid+%287%29+Iris+near+36+Sextantis&seq=pass&det=2" +
  "&f=2025W49_1A_0423_1&fa=2025W49_1A_0332_1&cmp=blink&fov=0.3&source=snapshot";

test("the assistant answers from the view on screen", async ({ page }) => {
  await page.goto(IRIS);
  await expect(page.getByText(/19 frames of 19 loaded/)).toBeVisible();

  await page.getByRole("button", { name: "Ask", exact: true }).click();
  const panel = page.getByRole("complementary", { name: "Ask about the sky" });
  await expect(panel.getByText(/Built-in answers/)).toBeVisible();
  await expect(panel.getByRole("textbox", { name: "Your question" })).toBeFocused();

  await panel.getByRole("button", { name: "Did anything move here?" }).click();
  // The server read the frames, JPL's predictions and the search result for this exact view.
  const answer = panel.locator("article p").filter({ hasText: /^Target on screen — Asteroid \(7\) Iris/ });
  await expect(answer).toBeVisible();
  await expect(answer).toContainText("matches JPL's prediction for 7 Iris");
  await expect(answer).toContainText("includes the light of 7 Iris (A847 PA) in frame B but not in frame A");

  await panel.getByText(/^Sources \(\d+\)$/).click();
  await expect(panel.getByText("Comparison of A and B", { exact: true })).toBeVisible();
  await expect(panel.getByText("JPL known objects in this field", { exact: true })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(page.getByRole("button", { name: "Ask", exact: true })).toBeFocused();
});

test("the assistant links to Discover cases and stays on the demo snapshot", async ({ page }) => {
  await page.goto(IRIS);
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  const panel = page.getByRole("complementary", { name: "Ask about the sky" });
  await panel.getByRole("textbox", { name: "Your question" }).fill("Show me an asteroid");
  await panel.getByRole("textbox", { name: "Your question" }).press("Enter");

  const hebe = panel.getByRole("link", { name: /Open: Asteroid \(6\) Hebe/ });
  await expect(hebe).toBeVisible();
  await hebe.click();
  await expect(page).toHaveURL(/ra=326\.891.*source=snapshot/);
  await expect(page.getByRole("heading", { level: 1, name: /Hebe/ })).toBeVisible();
  // The conversation is still there after following the link.
  await expect(panel.getByText("Show me an asteroid")).toBeVisible();
});

test("the assistant never claims a planet", async ({ page }) => {
  await page.goto("/about");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  const panel = page.getByRole("complementary", { name: "Ask about the sky" });
  await panel.getByRole("button", { name: "Could SPHEREx find Planet Nine?" }).click();
  const answer = panel.locator("article").last();
  await expect(answer.getByText(/Planet/).first()).toBeVisible();
  await expect(answer).not.toContainText(/discovered|we found|is Planet X/i);
});
