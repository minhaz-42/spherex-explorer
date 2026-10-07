// The app footage for the film. Run with the app serving on :8000 (make serve) and Ollama running
// for the assistant:
//   node capture/clips.mjs            every clip
//   node capture/clips.mjs iris ask   just those
import { BASE, record } from "./harness.mjs";

const IRIS =
  "/explore?ra=161.29678&dec=2.44824&name=Asteroid+%287%29+Iris+near+36+Sextantis&seq=pass&det=2" +
  "&f=2025W49_1A_0423_1&fa=2025W49_1A_0332_1&cmp=blink&fov=0.3";
const BARNARD = "/explore?q=Barnard%27s+Star";

async function waitText(page, text, timeout = 240000) {
  await page.getByText(text, { exact: false }).first().waitFor({ state: "visible", timeout });
}

async function allFramesLoaded(page, timeout = 300000) {
  await page.waitForFunction(() => /(\d+) frames of \1 loaded/.test(document.body.innerText), null, { timeout });
}

async function scrollToInstant(page, locator, offset) {
  await locator.evaluate((el, off) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - off), offset);
}

const clips = {
  // The landing page, a name typed into the search, and every frame of that place lined up.
  search: [
    {},
    {
      async prepare({ page }) {
        const scout = await page.context().newPage();
        await scout.goto(BASE + "/explore?q=Andromeda+Galaxy", { waitUntil: "domcontentloaded" });
        await allFramesLoaded(scout);
        await scout.close();
        await page.goto(BASE + "/", { waitUntil: "networkidle" });
        await page.waitForTimeout(1500);
      },
      async run(a) {
        const { page } = a;
        await a.sleep(1500);
        const box = page.getByPlaceholder(/Try M31/).first();
        await a.box("searchbox", box);
        await a.box("headline", page.getByRole("heading", { level: 1 }).first());
        await a.click(box, 900);
        await a.sleep(250);
        await a.type("Andromeda Galaxy", 90);
        await a.sleep(450);
        a.mark("enter");
        await page.keyboard.press("Enter");
        await waitText(page, "frames in");
        a.mark("loaded");
        await a.box("title", page.getByRole("heading", { level: 1 }).first());
        await a.box("framesIn", page.getByText("frames in").first());
        await allFramesLoaded(page);
        await a.sleep(1800);
        await a.scrollTo(page.getByRole("radio", { name: "Blink" }).first(), 24, 1600);
        await a.sleep(800);
        const play = page.getByRole("button", { name: "Play through the frames" }).first();
        await a.click(play, 900);
        a.mark("play");
        await a.boxBiggestCanvas("image");
        await a.box("timeline", page.getByRole("button", { name: /^Frame 1:/ }).first());
        await a.sleep(8000);
      },
    },
  ],

  // The Iris case, tall enough that the image and the panels beside and below it share the screen:
  // the blink, our own search, JPL's prediction, and the honest difference view.
  iris: [
    { height: 1560, dsf: 1.5, fps: 32 },
    {
      async prepare({ page }) {
        await page.goto(BASE + IRIS, { waitUntil: "networkidle" });
        await waitText(page, "19 frames of 19 loaded");
        await scrollToInstant(page, page.getByRole("radio", { name: "Blink" }).first(), 84);
        await page.waitForTimeout(1500);
      },
      async run(a) {
        const { page } = a;
        a.mark("blink");
        await a.boxBiggestCanvas("image");
        await a.box("compare", page.getByRole("radiogroup").first());
        await a.box("known", page.getByText("Known Solar System objects").first());
        await a.box("moving", page.getByText("Moving sources in this pass").first());
        await a.sleep(6500);
        const search = page.getByRole("button", { name: "Search for moving sources" });
        await a.moveToEl(search, 1100);
        await a.sleep(350);
        await a.click(null);
        a.mark("search");
        await waitText(page, "sightings on a straight line");
        a.mark("candidate");
        await a.box("c1", page.getByText("sightings on a straight line").first());
        await a.box("movingResult", page.getByText("sources detected").first());
        await a.sleep(3800);
        const jpl = page.getByRole("button", { name: "Check JPL for known objects" });
        await a.click(jpl, 1000);
        a.mark("jpl");
        await waitText(page, "Matches JPL");
        a.mark("jpl-done");
        await a.box("jplResult", page.getByText("A847 PA").first());
        await a.box("matches", page.getByText("Matches JPL").first());
        await a.boxBiggestCanvas("image2");
        await a.sleep(6000);
        await a.click(page.getByRole("radio", { name: "Difference" }).first(), 1100);
        a.mark("difference");
        await a.sleep(600);
        await a.box("misleading", page.getByText("A difference image would be misleading").first());
        await a.boxBiggestCanvas("image3");
        await a.sleep(4400);
        await a.click(page.getByRole("radio", { name: "Blink" }).first(), 900);
        a.mark("blink-again");
        await a.sleep(3000);
        await a.scrollBy(1000, 2000);
        a.mark("plot");
        await a.box("plot", page.locator("svg").filter({ hasText: "Wavelength" }).first());
        await a.sleep(4500);
      },
    },
  ],

  // The Iris image itself: the blink, then our search's marks and JPL's track drawn onto it, then
  // the honest difference view. Controls are pressed without scrolling so the image stays in shot.
  irisImage: [
    { height: 1250, dsf: 1.6, fps: 32 },
    {
      async prepare({ page }) {
        await page.goto(BASE + IRIS, { waitUntil: "networkidle" });
        await waitText(page, "19 frames of 19 loaded");
        await scrollToInstant(page, page.getByRole("radio", { name: "Blink" }).first(), 84);
        await page.waitForTimeout(1500);
      },
      async run(a) {
        const { page } = a;
        const press = (loc) => loc.first().evaluate((el) => el.click());
        await a.boxBiggestCanvas("image");
        await a.box("compare", page.getByRole("radiogroup").first());
        a.mark("blink");
        await a.moveTo(a.width * 0.42, a.height * 0.5, 1400);
        await a.sleep(4200);
        await press(page.getByRole("button", { name: "Search for moving sources" }));
        a.mark("search");
        await waitText(page, "sightings on a straight line");
        await a.sleep(3500);
        await press(page.getByRole("button", { name: "Check JPL for known objects" }));
        a.mark("jpl");
        await waitText(page, "Matches JPL");
        a.mark("jpl-done");
        await a.boxBiggestCanvas("image2");
        await a.sleep(6500);
        await a.click(page.getByRole("radio", { name: "Difference" }), 1000);
        a.mark("difference");
        await a.sleep(700);
        await a.box("misleading", page.getByText("A difference image would be misleading").first());
        await a.boxBiggestCanvas("image3");
        await a.sleep(4500);
        await a.click(page.getByRole("radio", { name: "Blink" }), 900);
        a.mark("blink-again");
        await a.sleep(4000);
      },
    },
  ],

  // The panels beside the image: our own search, then JPL's answer, clicked in view.
  irisPanel: [
    {},
    {
      async prepare({ page }) {
        await page.goto(BASE + IRIS, { waitUntil: "networkidle" });
        await waitText(page, "19 frames of 19 loaded");
        await scrollToInstant(page, page.getByText("Known Solar System objects").first(), 330);
        await page.waitForTimeout(1500);
      },
      async run(a) {
        const { page } = a;
        await a.box("known", page.getByText("Known Solar System objects").first());
        await a.box("moving", page.getByText("Moving sources in this pass").first());
        await a.sleep(700);
        await a.click(page.getByRole("button", { name: "Search for moving sources" }), 1100);
        a.mark("search");
        await waitText(page, "sightings on a straight line");
        await a.box("c1", page.getByText("sightings on a straight line").first());
        await a.box("movingResult", page.getByText("sources detected").first());
        await a.sleep(3000);
        await a.click(page.getByRole("button", { name: "Check JPL for known objects" }), 1100);
        a.mark("jpl");
        await waitText(page, "Matches JPL");
        a.mark("jpl-done");
        await a.box("jplResult", page.getByText("A847 PA").first());
        await a.box("matches", page.getByText("Matches JPL").first());
        await a.moveTo(a.width * 0.66, a.height * 0.8, 1200);
        await a.sleep(5000);
      },
    },
  ],

  // Barnard's Star across 75 years of surveys.
  decades: [
    {},
    {
      async prepare({ page }) {
        await page.goto(BASE + BARNARD, { waitUntil: "networkidle" });
        await waitText(page, "Across the decades");
        await page.waitForLoadState("networkidle", { timeout: 180000 }).catch(() => {});
        await page.waitForTimeout(6000);
        await scrollToInstant(page, page.getByText("Across the decades").first(), 84);
        await page.waitForTimeout(1500);
      },
      async run(a) {
        const { page } = a;
        await a.sleep(600);
        // The blink button sits below the fold; press it without scrolling the shot away.
        await page.getByRole("button", { name: "Blink through the decades" }).evaluate((el) => el.click());
        a.mark("blink");
        await a.moveTo(a.width * 0.86, a.height * 0.86, 900);
        await a.sleep(10500);
      },
    },
  ],

  // Where SPHEREx was when it took the frame on screen.
  globe: [
    {},
    {
      async prepare({ page }) {
        await page.goto(BASE + IRIS, { waitUntil: "networkidle" });
        await waitText(page, "19 frames of 19 loaded");
        await scrollToInstant(page, page.getByRole("radio", { name: "Blink" }).first(), 84);
        await page.waitForTimeout(800);
      },
      async run(a) {
        const { page } = a;
        await a.sleep(600);
        await a.click(page.getByText("Where was SPHEREx for this frame?").first(), 1000);
        a.mark("open");
        await a.sleep(2500);
        await a.moveTo(a.width * 0.5, a.height * 0.5, 800);
        await page.mouse.down();
        await a.moveTo(a.width * 0.58, a.height * 0.52, 1600);
        await page.mouse.up();
        await a.sleep(3500);
      },
    },
  ],

  // Spot the mover: the blink game, found by eye.
  play: [
    {},
    {
      async prepare({ page }) {
        // Learn where the mover is in round one from a throwaway page, so the take can find it.
        const scout = await page.context().newPage();
        await scout.goto(BASE + "/play", { waitUntil: "networkidle" });
        const showMe = scout.getByRole("button", { name: "Show me" });
        await showMe.waitFor({ timeout: 120000 });
        await scout.waitForFunction(() => !document.querySelector("button:disabled"), null, { timeout: 120000 }).catch(() => {});
        await showMe.click();
        const where = await scout.evaluate(() => {
          const stage = document.querySelector('[role="application"]');
          const svg = stage.querySelector("svg");
          const vb = svg.viewBox.baseVal;
          const c = [...svg.querySelectorAll("circle")].map((el) => ({ x: +el.getAttribute("cx"), y: +el.getAttribute("cy") }));
          return { size: vb.width, points: c };
        });
        await scout.close();
        this.where = where;
        await page.goto(BASE + "/play", { waitUntil: "networkidle" });
        await page.getByRole("button", { name: "Show me" }).waitFor({ timeout: 120000 });
        await page.waitForTimeout(2500);
      },
      async run(a) {
        const { page } = a;
        const stage = page.locator('[role="application"]').first();
        await a.sleep(1200);
        const b = await stage.boundingBox();
        // Wander the field like a person hunting, then tap the mover.
        await a.moveTo(b.x + b.width * 0.3, b.y + b.height * 0.35, 900);
        await a.sleep(500);
        await a.moveTo(b.x + b.width * 0.62, b.y + b.height * 0.6, 900);
        await a.sleep(500);
        const p = this.where.points[this.where.points.length - 1];
        await a.moveTo(b.x + (p.x / this.where.size) * b.width, b.y + (p.y / this.where.size) * b.height, 900);
        await a.sleep(500);
        await a.click(null);
        a.mark("tap");
        await a.sleep(4000);
      },
    },
  ],

  // The same page in English, then Bangla at a click.
  bangla: [
    {},
    {
      async prepare({ page }) {
        await page.goto(BASE + IRIS, { waitUntil: "networkidle" });
        await waitText(page, "19 frames of 19 loaded");
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(800);
      },
      async run(a) {
        const { page } = a;
        await a.sleep(1400);
        await a.click(page.getByRole("button", { name: "Show the site in Bangla" }).first(), 1000);
        a.mark("bangla");
        await a.sleep(2800);
        await a.scrollBy(820, 2200);
        await a.sleep(2000);
      },
    },
  ],

  // Ask about the view on screen; the answer arrives with its numbered sources.
  ask: [
    {},
    {
      async prepare({ page }) {
        // Load the local model first, so the take shows answer speed rather than model start-up.
        await fetch("http://127.0.0.1:11434/api/generate", {
          method: "POST",
          body: JSON.stringify({ model: "qwen3:4b-instruct-2507-q4_K_M", prompt: "Hi", stream: false, keep_alive: "15m" }),
        }).then((r) => r.text()).catch(() => {});
        await page.goto(BASE + IRIS, { waitUntil: "networkidle" });
        await waitText(page, "19 frames of 19 loaded");
        await page.getByRole("link", { name: "Ask about this view" }).or(page.getByRole("button", { name: "Ask about this view" })).first().click();
        await page.waitForURL(/\/ask/);
        await page.waitForTimeout(2000);
      },
      async run(a) {
        const { page } = a;
        await a.sleep(1000);
        const box = page.getByPlaceholder(/Ask about this view|Message SPHEREx/).first();
        await a.click(box, 900);
        await a.type("What am I looking at?", 80);
        await a.sleep(350);
        await page.keyboard.press("Enter");
        a.mark("sent");
        await waitText(page, "Writing", 30000).catch(() => {});
        await page.waitForFunction(() => !document.body.innerText.includes("Writing"), null, { timeout: 180000 });
        a.mark("answered");
        await a.sleep(1200);
        await a.moveTo(a.width * 0.5, a.height * 0.55, 900);
        await a.sleep(5000);
      },
    },
  ],

  // A phone, in Bangla: the Iris case on a small screen.
  phone: [
    { width: 390, height: 844, dsf: 3, lang: "bn", mobile: true, fps: 30 },
    {
      async prepare({ page }) {
        await page.goto(BASE + IRIS + "&lang=bn", { waitUntil: "networkidle" });
        await page.waitForTimeout(6000);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(800);
      },
      async run(a) {
        await a.sleep(1500);
        await a.scrollBy(1500, 3500);
        await a.sleep(2500);
        await a.scrollBy(900, 2000);
        await a.sleep(2000);
      },
    },
  ],

  // Discover: the cases, built from live data.
  discover: [
    {},
    {
      async prepare({ page }) {
        await page.goto(BASE + "/discover", { waitUntil: "networkidle" });
        await page.waitForTimeout(2500);
      },
      async run(a) {
        await a.sleep(1500);
        await a.scrollBy(560, 2400);
        await a.sleep(3000);
      },
    },
  ],
};

const wanted = process.argv.slice(2);
for (const [name, [opts, script]] of Object.entries(clips)) {
  if (wanted.length && !wanted.includes(name)) continue;
  try {
    await record(name, opts, script);
  } catch (e) {
    console.error(`✗ ${name}: ${e.message.split("\n")[0]}`);
  }
}
