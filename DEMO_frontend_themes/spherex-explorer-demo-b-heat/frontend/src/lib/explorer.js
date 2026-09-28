// The Explore preview: timeline, compare modes, the same-wavelength gate for
// differences, and spectrum / light-curve plots. It binds to markup that each
// demo writes and styles itself, through data-ex="…" hooks, so every demo can
// lay the parts out its own way.
import { makeFrames, lambdaColor, fmtUTC, starFlux, sameWavelength, rng } from './data.js';
import { frameData, paint, diff, rgb } from './sky.js';
import { token } from './theme.js';

const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const um = (x) => `${x.toFixed(2)} µm`;

export function mountExplorer(root) {
  const frames = makeFrames();
  const cache = new Map();
  const data = (f) => cache.get(f.index) || cache.set(f.index, frameData(f)).get(f.index);
  const flux = (f) => starFlux(f.lambda) * (1 + (rng(f.seed * 31)() - 0.5) * 0.06);
  const q = (name) => root.querySelector(`[data-ex="${name}"]`);

  // Start on pass 1 band 2; frame B is the same pointing slot one pass later,
  // which saw a different wavelength, so the gate has something to explain.
  const state = { a: 7, b: 31, mode: 'single', plot: 'spectrum', playing: false, speed: 1, blinkOn: false };
  let playTimer = 0;
  let blinkTimer = 0;

  const colors = () => ({
    ink: rgb(token('--frame-ink') || '#fff'),
    paper: rgb(token('--frame-paper') || '#000'),
    pos: rgb(token('--diff-pos') || '#f60'),
    neg: rgb(token('--diff-neg') || '#08f'),
  });

  // ---- timeline -----------------------------------------------------------
  const timeline = q('timeline');
  const ticks = [];
  if (timeline) {
    timeline.innerHTML = '';
    [1, 2, 3].forEach((p) => {
      const inPass = frames.filter((f) => f.pass === p);
      const group = document.createElement('div');
      group.className = 'ex-pass';
      const label = document.createElement('div');
      label.className = 'ex-pass-label';
      label.textContent = `Pass ${p}, ${inPass[0].release}, ${fmtUTC(inPass[0].date).slice(0, 10)}`;
      const row = document.createElement('div');
      row.className = 'ex-pointings';
      [1, 2, 3, 4].forEach((k) => {
        const pt = document.createElement('div');
        pt.className = 'ex-pointing';
        inPass.filter((f) => f.pointing === k).forEach((f) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'ex-tick';
          b.style.setProperty('--c', lambdaColor(f.lambda));
          b.setAttribute('aria-label', `Pass ${f.pass}, pointing ${f.pointing}, band ${f.band}, ${um(f.lambda)}`);
          b.addEventListener('click', (e) => {
            if (e.shiftKey || e.altKey) setB(f.index); else setA(f.index);
          });
          pt.append(b);
          ticks[f.index] = b;
        });
        row.append(pt);
      });
      group.append(label, row);
      timeline.append(group);
    });
  }

  // ---- rendering ----------------------------------------------------------
  function readout(prefix, f) {
    const set = (k, v) => { const el = q(`${prefix}-${k}`); if (el) el.textContent = v; };
    set('lambda', um(f.lambda));
    set('time', `${fmtUTC(f.date)} UTC`);
    set('meta', `Band ${f.band}, ${f.detector}, pass ${f.pass}, pointing ${f.pointing}, ${f.release}`);
    const sw = q(`${prefix}-swatch`);
    if (sw) sw.style.background = lambdaColor(f.lambda);
  }

  function notice(text) {
    const el = q('notice');
    if (!el) return;
    el.textContent = text || '';
    el.hidden = !text;
  }

  function draw() {
    const A = frames[state.a];
    const B = frames[state.b];
    const va = q('view-a');
    const vb = q('view-b');
    const views = q('views');
    if (views) views.dataset.mode = state.mode;
    root.dataset.mode = state.mode;
    const c = colors();
    readout('a', A);
    readout('b', B);
    root.dataset.refused = 'false';
    notice('');

    if (state.mode === 'single') paint(va, data(A), c);
    if (state.mode === 'side') { paint(va, data(A), c); if (vb) paint(vb, data(B), c); }
    if (state.mode === 'blink') {
      paint(va, data(state.blinkOn ? B : A), c);
      const label = q('blink-label');
      if (label) label.textContent = state.blinkOn ? 'Showing frame B' : 'Showing frame A';
      if (A.band !== B.band || !sameWavelength(A, B)) {
        notice(`These frames saw ${um(A.lambda)} and ${um(B.lambda)}. Brightness can differ because of the target's spectrum, not a change.`);
      }
    }
    if (state.mode === 'difference') {
      if (sameWavelength(A, B)) {
        paint(va, diff(data(A), data(B)), c, { diverging: true });
      } else {
        root.dataset.refused = 'true';
        paint(va, data(A), c);
        notice(`No difference shown. Frame A saw ${um(A.lambda)} and frame B saw ${um(B.lambda)}, so any change could be the target's spectrum. Pick two frames that saw the same wavelength.`);
      }
    }

    ticks.forEach((t, i) => {
      if (!t) return;
      if (i === state.a) t.setAttribute('aria-current', 'true'); else t.removeAttribute('aria-current');
      t.dataset.b = String(i === state.b);
    });
    const count = q('count');
    if (count) count.textContent = `Frame ${state.a + 1} of ${frames.length}`;
    root.querySelectorAll('[data-ex-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.exMode === state.mode)));
    root.querySelectorAll('[data-ex-plot]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.exPlot === state.plot)));
    const play = q('play');
    if (play) {
      play.setAttribute('aria-pressed', String(state.playing));
      play.setAttribute('aria-label', state.playing ? 'Pause' : 'Play');
      play.dataset.state = state.playing ? 'playing' : 'paused';
    }
    drawPlot();
  }

  // ---- plots --------------------------------------------------------------
  function drawPlot() {
    const host = q('plot');
    if (!host) return;
    const W = 600; const H = 250; const L = 44; const Rr = 12; const T = 16; const Bm = 34;
    const A = frames[state.a];
    let svg = `<svg viewBox="0 0 ${W} ${H}" class="ex-plot-svg" role="img" aria-labelledby="ex-plot-title"><title id="ex-plot-title">`;
    const caption = q('plot-caption');

    if (state.plot === 'spectrum') {
      svg += 'Brightness of the target against wavelength, every frame</title>';
      const x = (l) => L + ((l - 0.75) / 4.25) * (W - L - Rr);
      const maxF = Math.max(...frames.map(flux)) * 1.1;
      const y = (v) => H - Bm - (v / maxF) * (H - T - Bm);
      [[0.75, 1.09], [1.10, 1.62], [1.63, 2.41], [2.42, 3.82], [3.83, 4.41], [4.42, 5.0]].forEach(([a, b], i) => {
        svg += `<rect x="${x(a)}" y="${T}" width="${x(b) - x(a)}" height="${H - T - Bm}" class="ex-band ${i % 2 ? 'odd' : ''}"/>`;
        svg += `<text x="${(x(a) + x(b)) / 2}" y="${H - Bm + 14}" class="ex-axis" text-anchor="middle">B${i + 1}</text>`;
      });
      [1, 2, 3, 4, 5].forEach((l) => { svg += `<text x="${x(l)}" y="${H - 6}" class="ex-axis" text-anchor="middle">${l} µm</text>`; });
      frames.forEach((f) => {
        const cls = f.index === state.a ? 'is-a' : f.index === state.b ? 'is-b' : `pass-${f.pass}`;
        svg += `<circle data-i="${f.index}" cx="${x(f.lambda)}" cy="${y(flux(f))}" r="${f.index === state.a || f.index === state.b ? 5.5 : 3.2}" class="ex-pt ${cls}"/>`;
      });
      svg += `<text x="${L - 8}" y="${T + 8}" class="ex-axis" text-anchor="end">bright</text>`;
      if (caption) caption.textContent = 'Every frame measured at the target. Passes are shaded differently; A and B are ringed. Click a point to open that frame.';
    } else {
      const same = frames.filter((f) => sameWavelength(A, f));
      svg += `Brightness over time at ${um(A.lambda)}</title>`;
      const t0 = frames[0].date.getTime(); const t1 = frames[frames.length - 1].date.getTime();
      const x = (d) => L + ((d.getTime() - t0) / (t1 - t0)) * (W - L - Rr);
      const vals = same.map(flux);
      const mid = vals.reduce((s, v) => s + v, 0) / vals.length;
      const y = (v) => H - Bm - (((v - mid) / (mid * 0.25)) * 0.5 + 0.5) * (H - T - Bm);
      svg += `<line x1="${L}" x2="${W - Rr}" y1="${y(mid)}" y2="${y(mid)}" class="ex-grid"/>`;
      [2025.5, 2026, 2026.5].forEach((yr) => {
        const d = new Date(Date.UTC(Math.floor(yr), yr % 1 ? 6 : 0, 1));
        if (d.getTime() < t0 || d.getTime() > t1) return;
        svg += `<text x="${x(d)}" y="${H - 6}" class="ex-axis" text-anchor="middle">${d.toISOString().slice(0, 7)}</text>`;
      });
      same.forEach((f) => {
        svg += `<circle data-i="${f.index}" cx="${x(f.date)}" cy="${y(flux(f))}" r="6" class="ex-pt ${f.index === state.a ? 'is-a' : `pass-${f.pass}`}"/>`;
      });
      if (caption) {
        caption.textContent = `${same.length} of ${frames.length} frames saw ${um(A.lambda)} within half a resolution element. The other ${frames.length - same.length} saw other wavelengths and are left out, so this curve compares like with like.`;
      }
    }
    svg += '</svg>';
    host.innerHTML = svg;
    host.querySelectorAll('.ex-pt').forEach((pt) => pt.addEventListener('click', () => setA(Number(pt.dataset.i))));
  }

  // ---- actions ------------------------------------------------------------
  function setA(i) { state.a = (i + frames.length) % frames.length; draw(); }
  function setB(i) { state.b = i; draw(); }
  function step(n) { setA(state.a + n); }

  function play(on) {
    state.playing = on;
    clearInterval(playTimer);
    if (on) playTimer = setInterval(() => step(1), 700 / state.speed);
    draw();
  }

  function setMode(mode) {
    state.mode = mode;
    clearInterval(blinkTimer);
    state.blinkOn = false;
    if (mode === 'blink' && !reduce()) {
      blinkTimer = setInterval(() => { state.blinkOn = !state.blinkOn; draw(); }, 650);
    }
    draw();
  }

  function findMatch() {
    const A = frames[state.a];
    const match = frames
      .filter((f) => f.pass !== A.pass && sameWavelength(A, f))
      .sort((m, n) => Math.abs(m.lambda - A.lambda) - Math.abs(n.lambda - A.lambda))[0];
    if (match) setB(match.index);
    else notice(`No frame from another pass saw ${um(A.lambda)}. The light curve and difference need two frames at the same wavelength.`);
  }

  root.querySelectorAll('[data-ex-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.exMode)));
  root.querySelectorAll('[data-ex-plot]').forEach((b) => b.addEventListener('click', () => { state.plot = b.dataset.exPlot; draw(); }));
  q('prev')?.addEventListener('click', () => step(-1));
  q('next')?.addEventListener('click', () => step(1));
  q('play')?.addEventListener('click', () => play(!state.playing));
  q('pin')?.addEventListener('click', () => setB(state.a));
  q('match')?.addEventListener('click', findMatch);
  q('speed')?.addEventListener('click', (e) => {
    state.speed = state.speed === 4 ? 1 : state.speed * 2;
    e.currentTarget.textContent = `${state.speed}×`;
    if (state.playing) play(true);
  });
  q('view-a')?.addEventListener('click', () => {
    if (state.mode === 'blink' && reduce()) { state.blinkOn = !state.blinkOn; draw(); }
  });

  root.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select')) return;
    if (e.key === 'ArrowRight') { step(e.shiftKey ? 6 : 1); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { step(e.shiftKey ? -6 : -1); e.preventDefault(); }
    else if (e.key === ' ' && !e.target.closest('button')) { play(!state.playing); e.preventDefault(); }
    else if (e.key.toLowerCase() === 'b') setB(state.a);
    else if (['1', '2', '3', '4'].includes(e.key)) setMode(['single', 'blink', 'side', 'difference'][Number(e.key) - 1]);
  });

  window.addEventListener('themechange', () => requestAnimationFrame(draw));
  new ResizeObserver(() => draw()).observe(q('view-a') || root);
  draw();
  return { frames, state, draw };
}
