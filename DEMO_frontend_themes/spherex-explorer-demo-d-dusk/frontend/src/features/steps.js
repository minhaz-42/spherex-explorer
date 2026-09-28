// The four steps: the list over the sphere drives the headline column.
// Edit the steps in index.html (data-title, data-body and the panel text).
import { scramble } from '../lib/effects.js';

export function initSteps() {
  const list = document.querySelector('[data-steps]');
  if (!list) return;
  const buttons = [...list.querySelectorAll('button[aria-controls]')];
  const title = document.querySelector('[data-step-title]');
  const body = document.querySelector('[data-step-body]');
  const num = document.querySelector('[data-step-num]');
  const bar = document.querySelector('[data-step-bar]');
  let current = 0;

  const setTitle = (text, duration) => {
    title.textContent = text;
    title._glyphs = null;
    scramble(title, { duration });
  };

  const show = (i) => {
    current = (i + buttons.length) % buttons.length;
    buttons.forEach((btn, k) => {
      const open = k === current;
      btn.setAttribute('aria-expanded', String(open));
      document.getElementById(btn.getAttribute('aria-controls')).hidden = !open;
    });
    const btn = buttons[current];
    setTitle(btn.dataset.title, 700);
    body.textContent = btn.dataset.body;
    num.textContent = String(current + 1).padStart(2, '0');
    bar.style.setProperty('--p', String((current + 1) / buttons.length));
  };

  buttons.forEach((btn, k) => btn.addEventListener('click', () => show(k)));
  document.querySelector('[data-step-next]')?.addEventListener('click', () => show(current + 1));
  bar.style.setProperty('--p', String(1 / buttons.length));
  // The headline decodes once the preloader has lifted, like the other pages.
  window.addEventListener('page:ready', () => setTitle(buttons[current].dataset.title, 1000), { once: true });
}
