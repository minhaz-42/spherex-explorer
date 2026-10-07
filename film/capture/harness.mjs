// Records the running app (http://127.0.0.1:8000) as image sequences for the film, using Chrome's
// screencast so motion is smooth, and logs a synthetic cursor track that the film draws on top
// (headless Chrome renders no pointer). Each clip lands in build/capture/<name>/.
import { createRequire } from "module";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

export const FILM = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Playwright comes from the web app's own dependencies (npm ci in frontend/).
const require = createRequire(path.join(FILM, "..", "frontend", "package.json"));
const { chromium } = require("playwright");
export const BASE = "http://127.0.0.1:8000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export async function record(name, { width = 1600, height = 900, dsf = 2, theme = "dark", lang = "en", mobile = false, fps = 50 }, script) {
  const dir = path.join(FILM, "build", "capture", name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(path.join(dir, "frames"), { recursive: true });

  // Without the flag, headless screencast frames arrive at CSS size whatever the context scale.
  const browser = await chromium.launch({ args: ["--hide-scrollbars", `--force-device-scale-factor=${dsf}`] });
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dsf,
    isMobile: mobile,
    hasTouch: mobile,
    colorScheme: theme,
    locale: lang === "bn" ? "bn-BD" : "en-GB",
  });
  await context.addInitScript(([t, l]) => {
    try {
      localStorage.setItem("spherex-theme", t);
      localStorage.setItem("spherex-lang", l);
    } catch {}
  }, [theme, lang]);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);

  const frames = [];
  const events = [];
  let t0 = null;
  let recording = false;
  let pending = [];
  cdp.on("Page.screencastFrame", async (f) => {
    cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
    if (!recording) return;
    const t = f.metadata.timestamp;
    if (t0 === null) t0 = t;
    // Big frames at full rate fill the disk; the film plays at 30 fps.
    if (frames.length && t - t0 - frames[frames.length - 1].t < 0.98 / fps) return;
    const file = `${String(frames.length).padStart(5, "0")}.jpg`;
    frames.push({ file, t: t - t0 });
    pending.push(
      import("fs/promises").then((fs) => fs.writeFile(path.join(dir, "frames", file), Buffer.from(f.data, "base64"))),
    );
  });

  const cursor = { x: width * 0.62, y: height * 0.72 };
  // Events keep wall-clock epoch seconds, the same clock as the screencast's frame timestamps.
  const now = () => Date.now() / 1000;
  const log = (type, extra = {}) => events.push({ t: now(), type, x: cursor.x, y: cursor.y, ...extra });

  const api = {
    page,
    width,
    height,
    sleep,
    mark: (label) => log("mark", { label }),
    async moveTo(x, y, ms = 700) {
      const sx = cursor.x;
      const sy = cursor.y;
      const steps = Math.max(2, Math.round(ms / 16));
      for (let i = 1; i <= steps; i++) {
        const k = ease(i / steps);
        cursor.x = sx + (x - sx) * k;
        cursor.y = sy + (y - sy) * k;
        log("move");
        await page.mouse.move(cursor.x, cursor.y);
        await sleep(ms / steps);
      }
    },
    async moveToEl(locator, ms = 700, dx = 0.5, dy = 0.5) {
      await locator.scrollIntoViewIfNeeded();
      const b = await locator.boundingBox();
      await api.moveTo(b.x + b.width * dx, b.y + b.height * dy, ms);
    },
    async click(locator, ms = 700) {
      if (locator) await api.moveToEl(locator, ms);
      log("down");
      await page.mouse.down();
      await sleep(90);
      await page.mouse.up();
      log("up");
    },
    // Record where an element is on screen at this moment, so the film can frame or label it.
    async box(name, locator) {
      const b = await locator.first().boundingBox().catch(() => null);
      if (b) events.push({ t: now(), type: "box", name, bx: b.x, by: b.y, bw: b.width, bh: b.height });
    },
    async boxBiggestCanvas(name) {
      const b = await page.evaluate(() => {
        let best = null;
        for (const c of document.querySelectorAll("canvas")) {
          const r = c.getBoundingClientRect();
          if (r.width * r.height > 0 && (!best || r.width * r.height > best.width * best.height)) best = r;
        }
        return best && { x: best.x, y: best.y, width: best.width, height: best.height };
      });
      if (b) events.push({ t: now(), type: "box", name, bx: b.x, by: b.y, bw: b.width, bh: b.height });
    },
    async type(text, delay = 85) {
      for (const ch of text) {
        await page.keyboard.type(ch);
        log("key", { ch });
        await sleep(delay + Math.random() * 40);
      }
    },
    async scrollBy(dy, ms = 1200) {
      // Eased programmatic scrolling reads better on screen than wheel ticks.
      const start = await page.evaluate(() => window.scrollY);
      const steps = Math.max(2, Math.round(ms / 16));
      for (let i = 1; i <= steps; i++) {
        await page.evaluate((y) => window.scrollTo(0, y), start + dy * ease(i / steps));
        log("scroll");
        await sleep(ms / steps);
      }
    },
    async scrollTo(locator, offset = 120, ms = 1200) {
      const y = await locator.evaluate((el, off) => el.getBoundingClientRect().top + window.scrollY - off, offset);
      const start = await page.evaluate(() => window.scrollY);
      await api.scrollBy(y - start, ms);
    },
  };

  try {
    await script.prepare?.(api);
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: width * dsf, maxHeight: height * dsf, everyNthFrame: 1 });
    await sleep(300);
    recording = true;
    log("start");
    await script.run(api);
    log("end");
    // Keep the screencast alive for a beat so the last state is captured.
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
    await sleep(600);
    recording = false;
    await cdp.send("Page.stopScreencast");
    await Promise.all(pending);
  } finally {
    await browser.close();
  }
  // Both clocks are epoch seconds; put events on the frames' timeline, which starts at the first frame.
  for (const e of events) e.t -= t0 ?? 0;
  const meta = { name, width, height, dsf, frames, events, duration: frames.length ? frames[frames.length - 1].t : 0 };
  writeFileSync(path.join(dir, "clip.json"), JSON.stringify(meta));
  const span = meta.duration;
  console.log(`✓ ${name}: ${frames.length} frames over ${span.toFixed(1)} s (${(frames.length / Math.max(span, 0.01)).toFixed(1)} fps)`);
  return meta;
}
