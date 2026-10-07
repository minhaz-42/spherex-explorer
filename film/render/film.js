// The film: loads the data every scene needs, then draws any moment `t` (seconds) on request.
// render.mjs calls window.film.render(t) once per frame. Scenes q1–q4 are written on the source
// timeline; edit.json assembles the finished film from stretches of it and the new scenes.
import { Clip, F, FPS, H, W, black, grain, json, makeGrain, settle, textFile } from "./core.js";
import { OPENING_END, drawBug, drawOpening, drawTeam } from "./scenes/intro.js";
import { q1, q1Cues } from "./scenes/q1.js";
import { q2, q2Cues } from "./scenes/q2.js";
import { q3, q3Cues } from "./scenes/q3.js";
import { q4, q4Cues } from "./scenes/q4.js";

// The finished length, from edit.json once it has loaded.
let DURATION = 0;
let PIECES = [];

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
  PIECES = (await json("/edit.json")).pieces;
  let at = 0;
  for (const p of PIECES) {
    p.at = at;
    p.dur ??= p.src[1] - p.src[0];
    at += p.dur;
  }
  DURATION = Math.round(at * 1000) / 1000;
  // Optional: the team's own footage (footage/team.mp4, extracted by `make team`).
  const team = await json("/build/footage/team/frames.json").catch(() => null);
  // The narration as placed, so the team's cards land on their lines.
  const lines = await json("/build/vo/lines.json").catch(() => []);
  for (const f of [F.display, F.sans, F.mono, F.type, F.serif, F.bangla]) {
    for (const wgt of [300, 400, 500, 600, 700, 800]) await document.fonts.load(`${wgt} 40px "${f}"`, "SPHEREx Explorer আকাশ 0123");
  }
  await document.fonts.ready;
  makeGrain();
  return { clips, iris, barnard, pluto, orbits, land, gitlog, code, config, team, lines };
}

const shots = [...q1, ...q2, ...q3, ...q4];
const scenes = { opening: () => 0.045, team: drawTeam };
let D;

/** The piece of the cut that is on screen at film time T, and the time within it. */
function pieceAt(T) {
  const p = PIECES.find((q) => T < q.at + q.dur) ?? PIECES[PIECES.length - 1];
  return [p, T - p.at];
}

async function render(T) {
  const frame = Math.round(T * FPS);
  const [piece, local] = pieceAt(T);
  await settle(() => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "none";
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    let grainAmount = 0.05;
    if (piece.src) {
      const t = piece.src[0] + local;
      for (const s of shots) {
        if (t >= s.a && t < s.b) {
          ctx.save();
          const g = s.draw(ctx, t, D, frame);
          ctx.restore();
          if (typeof g === "number") grainAmount = g;
        }
      }
    } else {
      ctx.save();
      grainAmount = scenes[piece.scene](ctx, local, D, frame, piece);
      ctx.restore();
    }
    if (T < OPENING_END) {
      ctx.save();
      drawOpening(ctx, T, D);
      ctx.restore();
    }
    grain(ctx, frame, grainAmount);
    drawBug(ctx, T, D, DURATION);
    if (T >= DURATION - 0.05) black(ctx, 1);
  });
}

window.film = {
  ready: load().then((d) => {
    D = d;
    return { duration: DURATION, fps: FPS };
  }),
  render,
  // Sound cues on the source timeline; audio/score.py places them through edit.json.
  cues: () => [...q1Cues(D), ...q2Cues(D), ...q3Cues(D), ...q4Cues(D)].sort((a, b) => a.t - b.t),
};
