// The detector-filter stack and the six band tabs.
import { BANDS, lambdaColor } from '../lib/data.js';
import { scramble } from '../lib/effects.js';

const gradient = (b, deg = 90) =>
  `linear-gradient(${deg}deg, ${lambdaColor(b.min)}, ${lambdaColor((b.min + b.max) / 2)}, ${lambdaColor(b.max)})`;

// Short notes shown under each band. Edit freely.
const NOTES = {
  1: 'The shortest band, just past visible red light.',
  2: 'Near infrared, where dust hides much less of the Milky Way than in visible light.',
  3: 'Covers the carbon monoxide bands that mark cool, evolved stars.',
  4: 'The widest band, crossing the water-ice feature near 3 µm.',
  5: 'Higher resolving power, so narrower channels.',
  6: 'The longest wavelengths, up to 5 µm, where zodiacal light rises.',
};

/** <div data-lvf>: six filter plates stacked in perspective. */
function initFilterStack() {
  const stack = document.querySelector('[data-lvf]');
  if (!stack) return;
  const plates = BANDS.map((b, i) => {
    const plate = document.createElement('i');
    plate.style.background = gradient(b);
    plate.style.opacity = '0.92';
    plate.style.transform = `translate(-50%, -50%) rotateX(58deg) rotateZ(-36deg) translateZ(${(2.5 - i) * 34}px)`;
    return plate;
  });
  const labels = BANDS.map((b, i) => {
    const label = document.createElement('b');
    label.style.right = '0';
    label.style.top = `${14 + i * 12.5}%`;
    label.textContent = `${b.detector}  ${b.min.toFixed(2)}–${b.max.toFixed(2)} µm`;
    return label;
  });
  stack.replaceChildren(...plates, ...labels);
}

/** [data-bands] with role="tab" buttons and data-band-* outputs. */
function initBandTabs() {
  const root = document.querySelector('[data-bands]');
  if (!root) return;
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const out = (name) => root.querySelector(`[data-band-${name}]`);
  let current = 3;

  const show = (n, focus = false) => {
    current = ((n - 1 + BANDS.length) % BANDS.length) + 1;
    const b = BANDS[current - 1];
    tabs.forEach((tab) => {
      const selected = Number(tab.dataset.band) === current;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus();
    });
    root.querySelector('[role="tabpanel"]').setAttribute('aria-labelledby', `tab-${current}`);

    const title = out('title');
    title.textContent = `Band ${current}`;
    title._glyphs = null;
    scramble(title, { duration: 500 });
    out('range').textContent = `${b.min.toFixed(2)}–${b.max.toFixed(2)} µm`;
    out('r').textContent = b.R;
    out('det').textContent = b.detector;
    out('text').textContent = NOTES[current];
    out('orb').style.setProperty('--orb', `color-mix(in oklab, ${lambdaColor((b.min + b.max) / 2, 0.85)} 62%, #4a3526)`);
    out('lvf').style.background = gradient(b, 0);
    out('caption').textContent = `Filter gradient, ${b.detector}`;
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => show(Number(tab.dataset.band)));
    tab.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') show(current + 1, true);
      if (e.key === 'ArrowLeft') show(current - 1, true);
    });
  });
  root.querySelectorAll('[data-band-step]').forEach((btn) =>
    btn.addEventListener('click', () => show(current + Number(btn.dataset.bandStep))));
  show(current);
}

export function initBands() {
  initFilterStack();
  initBandTabs();
}
