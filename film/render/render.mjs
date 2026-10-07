// Renders the film by stepping render/index.html through time in headless Chromium.
//   node render/render.mjs stills 3 8.6 12.5          PNG stills into build/stills/
//   node render/render.mjs sheet 0 60 2               a contact sheet, one frame every 2 s
//   node render/render.mjs cues                       sound cues for the mixer (build/cues.json)
//   node render/render.mjs video [from] [to] [--workers 6] [--draft]
//                                                     build/video/picture.mp4 (no sound)
import { spawn } from "child_process";
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync, rmSync } from "fs";
import http from "http";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const FILM = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Playwright comes from the web app's own dependencies (npm ci in frontend/).
const require = createRequire(path.join(FILM, "..", "frontend", "package.json"));
const { chromium } = require("playwright");
const FPS = 30;
const FFMPEG = process.env.FFMPEG || "ffmpeg";

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".ttf": "font/ttf", ".txt": "text/plain" };
function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const p = path.join(FILM, decodeURIComponent(new URL(req.url, "http://x").pathname));
      if (!p.startsWith(FILM) || !existsSync(p) || statSync(p).isDirectory()) {
        res.writeHead(404);
        return res.end();
      }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream", "Cache-Control": "max-age=3600" });
      createReadStream(p).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function openFilm(browser, port) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on("console", (m) => {
    if (m.type() === "error") console.error("  page:", m.text());
  });
  page.on("pageerror", (e) => console.error("  page error:", e.message));
  await page.goto(`http://127.0.0.1:${port}/render/index.html`);
  const info = await page.evaluate(() => window.film.ready);
  return { page, info };
}

async function frameAt(page, t, type = "png") {
  await page.evaluate((tt) => window.film.render(tt), t);
  return page.screenshot({ type, quality: type === "jpeg" ? 92 : undefined, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
}

const [mode, ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter((a) => a.startsWith("--")));
// Positional numbers only: a value that follows a --flag belongs to the flag.
const nums = rest.filter((a, i) => !a.startsWith("--") && !(i > 0 && rest[i - 1].startsWith("--") && rest[i - 1] !== "--draft")).map(Number);
const opt = (name, dflt) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? Number(rest[i + 1]) : dflt;
};

const server = await serve();
const port = server.address().port;
const browser = await chromium.launch({ args: ["--disable-web-security", "--autoplay-policy=no-user-gesture-required"] });

try {
  if (mode === "stills") {
    const out = path.join(FILM, "build", "stills");
    mkdirSync(out, { recursive: true });
    const { page } = await openFilm(browser, port);
    for (const t of nums) {
      const buf = await frameAt(page, t, "jpeg");
      writeFileSync(path.join(out, `t${t.toFixed(2).padStart(7, "0")}.jpg`), buf);
      console.log("✓", t);
    }
  } else if (mode === "sheet") {
    const [a, b, step = 2] = nums;
    const out = path.join(FILM, "build", "stills", `sheet_${a}_${b}`);
    rmSync(out, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });
    const { page } = await openFilm(browser, port);
    const files = [];
    for (let t = a; t <= b + 1e-6; t += step) {
      const f = path.join(out, `${t.toFixed(2).padStart(7, "0")}.jpg`);
      writeFileSync(f, await frameAt(page, t, "jpeg"));
      files.push(f);
    }
    const sheet = path.join(FILM, "build", "stills", `sheet_${a}_${b}.jpg`);
    await new Promise((res) =>
      spawn("magick", ["montage", "-font", "/System/Library/Fonts/Helvetica.ttc", "-label", "%t", ...files, "-tile", "4x", "-geometry", "480x270+4+4", "-pointsize", "14", "-fill", "white", "-background", "#111", sheet], { stdio: "inherit" }).on("close", res),
    );
    console.log("✓", sheet);
  } else if (mode === "cues") {
    const { page } = await openFilm(browser, port);
    const cues = await page.evaluate(() => window.film.cues());
    writeFileSync(path.join(FILM, "build", "cues.json"), JSON.stringify(cues, null, 1));
    console.log(`✓ ${cues.length} cues`);
  } else if (mode === "video") {
    const { page: probe, info } = await openFilm(browser, port);
    await probe.close();
    const from = nums[0] ?? 0;
    const to = nums[1] ?? info.duration;
    const draft = flags.has("--draft");
    const workers = opt("workers", 6);
    const first = Math.round(from * FPS);
    const last = Math.round(to * FPS); // exclusive
    const total = last - first;
    const outDir = path.join(FILM, "build", "video");
    mkdirSync(outDir, { recursive: true });
    const per = Math.ceil(total / workers);
    const started = Date.now();
    let done = 0;
    const parts = [];
    await Promise.all(
      Array.from({ length: workers }, async (_, w) => {
        const a = first + w * per;
        const b = Math.min(last, a + per);
        if (a >= b) return;
        const file = path.join(outDir, `part${String(w).padStart(2, "0")}.mp4`);
        parts[w] = file;
        const ff = spawn(FFMPEG, [
          "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
          ...(draft ? ["-vf", "scale=960:540"] : []),
          "-c:v", "libx264", "-preset", draft ? "veryfast" : "slow", "-crf", draft ? "26" : "14",
          "-pix_fmt", "yuv420p", "-tune", "film", "-x264-params", "keyint=60:min-keyint=1", "-r", String(FPS), file,
        ], { stdio: ["pipe", "inherit", "inherit"] });
        const { page } = await openFilm(browser, port);
        for (let f = a; f < b; f++) {
          const buf = await frameAt(page, f / FPS, draft ? "jpeg" : "png");
          if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
          done++;
          if (done % 60 === 0) {
            const el = (Date.now() - started) / 1000;
            process.stdout.write(`\r  ${done}/${total} frames  ${(done / el).toFixed(1)} fps  eta ${Math.round(((total - done) * el) / done)} s   `);
          }
        }
        ff.stdin.end();
        await new Promise((r) => ff.on("close", r));
        await page.close();
      }),
    );
    const list = path.join(outDir, "parts.txt");
    writeFileSync(list, parts.filter(Boolean).map((p) => `file '${p}'`).join("\n"));
    const name = from === 0 && to === info.duration ? "picture.mp4" : `picture_${from}_${to}.mp4`;
    await new Promise((res) => spawn(FFMPEG, ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", path.join(outDir, name)], { stdio: "inherit" }).on("close", res));
    console.log(`\n✓ ${name}: ${total} frames in ${Math.round((Date.now() - started) / 1000)} s`);
  } else {
    console.log("modes: stills | sheet | cues | video");
  }
} finally {
  await browser.close();
  server.close();
}
