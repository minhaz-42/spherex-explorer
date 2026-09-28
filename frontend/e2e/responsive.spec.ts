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
