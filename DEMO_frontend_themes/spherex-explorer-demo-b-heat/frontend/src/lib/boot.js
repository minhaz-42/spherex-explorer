// Start-up shared by every page: theme, text effects, backgrounds, clocks,
// search forms and the explorer preview.
import { initTheme } from './theme.js';
import { initEffects } from './effects.js';
import { initSearch } from './search.js';
import { mountExplorer } from './explorer.js';
import { starfield } from './sky.js';
import { BANDS, lambdaColor, toMJD } from './data.js';

/** 102 channels: 17 per band, each band spanning its own range. */
function rulers() {
  document.querySelectorAll('[data-ruler]').forEach((el) => {
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = BANDS.map((b) => Array.from({ length: 17 }, (_, i) => {
      const micron = b.min + ((i + 0.5) / 17) * (b.max - b.min);
      return `<i style="--c:${lambdaColor(micron)}"></i>`;
    }).join('')).join('');
  });
}

/** <el data-clock="utc|date|mjd"> shows the current time, updated every second. */
function clocks() {
  const els = document.querySelectorAll('[data-clock]');
  if (!els.length) return;
  const tick = () => {
    const now = new Date();
    els.forEach((el) => {
      const kind = el.dataset.clock;
      if (kind === 'utc') el.textContent = now.toISOString().slice(11, 19);
      if (kind === 'date') el.textContent = now.toISOString().slice(0, 10);
      if (kind === 'mjd') el.textContent = toMJD(now).toFixed(4);
    });
  };
  tick();
  setInterval(tick, 1000);
}

/** <header data-header> gets data-scrolled="true" once the page scrolls. */
function header() {
  const el = document.querySelector('[data-header]');
  if (!el) return;
  const update = () => { el.dataset.scrolled = String(scrollY > 40); };
  update();
  addEventListener('scroll', update, { passive: true });
}

export function boot() {
  document.documentElement.classList.remove('no-js');
  rulers();
  header();
  initTheme();
  initEffects();
  initSearch();
  document.querySelectorAll('[data-starfield]').forEach((canvas, i) =>
    starfield(canvas, { seed: i + 3, density: Number(canvas.dataset.density || 0.00018) }));
  document.querySelectorAll('[data-explorer]').forEach(mountExplorer);
  clocks();
}
