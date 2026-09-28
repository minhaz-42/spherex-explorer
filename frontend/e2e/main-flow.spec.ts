import { expect, test } from "@playwright/test";

/**
 * The main flow from the project brief, on the demo snapshot:
 * open the app → search a sky position → retrieve observations → view an image → change
 * observation → play the timeline → inspect metadata → return to search.
 */
test("search, step through time, play and inspect", async ({ page }) => {
  await page.goto("/explore?source=snapshot");
  await expect(page.getByRole("heading", { name: "Where in the sky?" })).toBeVisible();

  // Search by coordinates (resolved locally, no network needed).
  await page.getByLabel("Object name or sky coordinates").fill("161.29678 2.44824");
  await page.getByRole("button", { name: "Search" }).click();

  // Observations: the heading summarises every pass that covers the position.
  await expect(page.getByText(/243 frames in 4 passes/)).toBeVisible();
  await expect(page.getByText(/Demo snapshot/).first()).toBeVisible();

  // The snapshot holds the December 2025 pass in detector 2: choose it.
  await page.getByRole("button", { name: /25 Nov – 6 Dec 2025/ }).click();
  await page.getByRole("radio", { name: /Detector 2,/ }).click();
  await expect(page.getByText(/19 frames of 19 loaded/)).toBeVisible();

  // View an image and its metadata.
  const panel = page.getByRole("region", { name: /This observation/ });
  await expect(page.getByRole("img", { name: /SPHEREx image of/ })).toBeVisible();
  await expect(page.getByText("Wavelength at the target")).toBeVisible();
  const firstDate = await page.locator("#frame-title").locator("xpath=..").textContent();

  // Change observation with the Next button and with the keyboard.
  await page.getByRole("button", { name: "Next frame" }).click();
  await expect(page.getByText(/^2 \/ 19/)).toBeVisible();
  await page.getByRole("img", { name: /SPHEREx image of/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText(/^3 \/ 19/)).toBeVisible();
  expect(await page.locator("#frame-title").locator("xpath=..").textContent()).not.toEqual(firstDate);

  // Play the timeline, then pause.
  await page.getByRole("button", { name: "Play through the frames" }).click();
  await expect(page.getByText(/^4 \/ 19/)).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: "Pause" }).click();

  // Inspect the technical metadata.
  await page.getByText("Technical details").click();
  await expect(page.getByText("Observation", { exact: true })).toBeVisible();
  await expect(page.getByText(/^2025W49_1A_/)).toBeVisible();
  void panel;

  // The view is in the URL, so it can be shared.
  await expect(page).toHaveURL(/f=2025W49_1A_/);

  // Return to search.
  await page.getByRole("link", { name: "Explore", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Where in the sky?" })).toBeVisible();
});

test("comparison modes explain what they show", async ({ page }) => {
  await page.goto(
    "/explore?ra=161.29678&dec=2.44824&name=Asteroid+(7)+Iris+near+36+Sextantis&seq=pass&det=2" +
      "&f=2025W49_1A_0423_1&fa=2025W49_1A_0332_1&cmp=blink&fov=0.3&source=snapshot",
  );
  await expect(page.getByText(/19 frames of 19 loaded/)).toBeVisible();
  // Blink: A and B are named with their dates and wavelengths, and the note says why brightness
  // may differ.
  await expect(page.getByText(/9\.7 h apart, 0\.379 µm apart in wavelength/)).toBeVisible();
  await expect(page.getByText(/brightness differences may just be the sources’ colours/)).toBeVisible();
  // Difference is refused for frames that saw different wavelengths, with the reason.
  await page.getByRole("radio", { name: "Difference" }).click();
  await expect(page.getByText("A difference image would be misleading here.")).toBeVisible();
  await expect(page.getByText(/more than half a spectral channel/)).toBeVisible();
  // Side by side shows two images.
  await page.getByRole("radio", { name: "Side by side" }).click();
  await expect(page.getByRole("img", { name: /^Frame A:/ })).toBeVisible();
  await expect(page.getByRole("img", { name: /^Frame B:/ })).toBeVisible();
});

test("known objects and the moving-source search agree on Iris", async ({ page }) => {
  await page.goto(
    "/explore?ra=161.29678&dec=2.44824&name=Asteroid+(7)+Iris+near+36+Sextantis&seq=pass&det=2" +
      "&f=2025W49_1A_0423_1&fa=2025W49_1A_0332_1&cmp=single&fov=0.3&source=snapshot",
  );
  await expect(page.getByText(/19 frames of 19 loaded/)).toBeVisible();
  await page.getByRole("button", { name: /Check JPL for known objects/ }).click();
  await expect(page.getByText("7 Iris (A847 PA)")).toBeVisible();
  await page.getByRole("button", { name: /Search for moving sources/ }).click();
  await expect(page.getByText(/Matches JPL’s prediction for 7 Iris/)).toBeVisible();
});
