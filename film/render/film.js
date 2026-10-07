// The film: loads the data every scene needs, then draws any moment `t` (seconds) on request.
// render.mjs calls window.film.render(t) once per frame.
import { Clip, F, FPS, H, W, black, grain, json, makeGrain, settle, textFile } from "./core.js";
import { q1, q1Cues } from "./scenes/q1.js";
import { q2, q2Cues } from "./scenes/q2.js";
import { q3, q3Cues } from "./scenes/q3.js";
import { q4, q4Cues } from "./scenes/q4.js";

export const DURATION = 238;

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d", { alpha: false });

async function load() {
  const clipNames = ["search", "irisImage", "irisPanel", "decades", "globe", "play", "bangla", "ask", "phone", "discover"];
  const clips = {};
  await Promise.all(
    clipNames.map(async (n) => {
      try {
        clips[n] = new Clip(n, await json(`/build/capture/${n}/clip.json`));
      } catch (e) {
        console.error("clip", n, e);
      }
    }),
  );
  const [iris, barnard, pluto, orbits, land, gitlog, code, config] = await Promise.all([
    json("/build/img/iris/iris.json"),
    json("/build/img/barnard/barnard.json"),
    json("/build/img/pluto/pluto.json"),
    json("/build/img/extras/orbits.json"),
    json("/build/img/extras/land.json"),
    textFile("/build/img/extras/gitlog.txt"),
    textFile("/build/img/extras/code.txt"),
    json("/config.json").catch(() => ({})),
  ]);
  // Optional: the team's own footage (footage/team.mp4, extracted by `make team`).
  const team = await json("/build/footage/team/frames.json").catch(() => null);
  for (const f of [F.display, F.sans, F.mono, F.type, F.serif, F.bangla]) {
    for (const wgt of [300, 400, 500, 600, 700, 800]) await document.fonts.load(`${wgt} 40px "${f}"`, "SPHEREx Explorer আকাশ 0123");
  }
  await document.fonts.ready;
  makeGrain();
  return { clips, iris, barnard, pluto, orbits, land, gitlog, code, config, team };
}

const shots = [...q1, ...q2, ...q3, ...q4];
let D;

async function render(t) {
  const frame = Math.round(t * FPS);
  await settle(() => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "none";
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    let grainAmount = 0.05;
    for (const s of shots) {
      if (t >= s.a && t < s.b) {
        ctx.save();
        const g = s.draw(ctx, t, D, frame);
        ctx.restore();
        if (typeof g === "number") grainAmount = g;
      }
    }
    grain(ctx, frame, grainAmount);
    if (t >= DURATION - 0.05) black(ctx, 1);
  });
}

window.film = {
  ready: load().then((d) => {
    D = d;
    return { duration: DURATION, fps: FPS };
  }),
  render,
  cues: () => [...q1Cues(D), ...q2Cues(D), ...q3Cues(D), ...q4Cues(D)].sort((a, b) => a.t - b.t),
};
