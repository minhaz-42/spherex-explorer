import { expect, test } from "@playwright/test";

test("the viewer works on a phone", async ({ page }) => {
  await page.goto(
    "/explore?ra=161.29678&dec=2.44824&name=Asteroid+(7)+Iris+near+36+Sextantis&seq=pass&det=2" +
      "&f=2025W49_1A_0423_1&fa=2025W49_1A_0332_1&cmp=single&fov=0.3&source=snapshot",
  );
  await expect(page.getByText(/19 frames of 19 loaded/)).toBeVisible({ timeout: 40_000 });
  const image = page.getByRole("img", { name: /SPHEREx image of/ });
  await expect(image).toBeVisible();
  // The image fills the width of the screen, and nothing scrolls sideways.
  const box = await image.boundingBox();
  const width = page.viewportSize()!.width;
  expect(box!.width).toBeGreaterThan(width * 0.8);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
  // Playback controls are reachable and large enough to tap.
  const next = page.getByRole("button", { name: "Next frame" });
  const nb = await next.boundingBox();
  expect(nb!.height).toBeGreaterThanOrEqual(40);
  await next.click();
  await expect(page.getByText(/^11 \/ 19/)).toBeVisible();
});

test("Ask works on a phone", async ({ page }) => {
  await page.goto("/about");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("link", { name: "Ask", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Ask about the sky" })).toBeVisible();
  // The question box sits at the bottom of the screen, within reach of a thumb.
  const box = await page.getByRole("textbox", { name: "Your question" }).boundingBox();
  const height = page.viewportSize()!.height;
  expect(box!.y + box!.height).toBeGreaterThan(height * 0.8);
  expect(box!.y + box!.height).toBeLessThanOrEqual(height);
  await page.getByRole("button", { name: "What is SPHEREx?" }).click();
  await expect(page.locator("article p").filter({ hasText: /SPHEREx/ }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
});

