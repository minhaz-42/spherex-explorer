// Theme switching with a full-page reveal that grows out of the toggle
// (View Transitions API). Browsers without it, and visitors who ask for
// reduced motion, get an instant switch.
//
// Markup:  <button data-theme-toggle>…</button>
// Options: <html data-theme-variant="circle|wipe|diamond"> picks the reveal shape.

const KEY = 'spherex-theme';
const root = document.documentElement;

function read() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
function write(theme) {
  try { localStorage.setItem(KEY, theme); } catch { /* private mode: keep it in memory */ }
}

function apply(theme) {
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    const next = theme === 'dark' ? 'light' : 'dark';
    btn.setAttribute('aria-label', `Switch to ${next} mode`);
    btn.setAttribute('aria-pressed', String(theme === 'dark'));
    btn.dataset.state = theme;
  });
  window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
}

function clipFrames(variant, x, y) {
  const w = innerWidth;
  const h = innerHeight;
  const r = Math.hypot(Math.max(x, w - x), Math.max(y, h - y));
  if (variant === 'wipe') return ['inset(0 0 100% 0)', 'inset(0 0 0% 0)'];
  if (variant === 'diamond') {
    const d = r * 1.5;
    return [
      `polygon(${x}px ${y}px, ${x}px ${y}px, ${x}px ${y}px, ${x}px ${y}px)`,
      `polygon(${x}px ${y - d}px, ${x + d}px ${y}px, ${x}px ${y + d}px, ${x - d}px ${y}px)`,
    ];
  }
  return [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`];
}

function toggle(event, button) {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  write(next);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!document.startViewTransition || reduce) {
    apply(next);
    return;
  }
  // Keyboard presses report 0,0, so start from the button's centre instead.
  const box = button.getBoundingClientRect();
  const fromPointer = event.detail > 0 && (event.clientX || event.clientY);
  const x = fromPointer ? event.clientX : box.left + box.width / 2;
  const y = fromPointer ? event.clientY : box.top + box.height / 2;
  const variant = root.dataset.themeVariant || 'circle';

  const transition = document.startViewTransition(() => apply(next));
  transition.ready.then(() => {
    root.animate(
      { clipPath: clipFrames(variant, x, y) },
      { duration: 750, easing: 'cubic-bezier(.76,0,.24,1)', pseudoElement: '::view-transition-new(root)' },
    );
  });
}

export function initTheme() {
  const stored = read();
  const system = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  apply(root.dataset.theme || stored || system);
  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    btn.addEventListener('click', (e) => toggle(e, btn));
  });
  // Follow the OS setting until the visitor picks one themselves.
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
    if (!read()) apply(e.matches ? 'light' : 'dark');
  });
}

/** Reads a CSS custom property from :root (used by canvas drawings). */
export function token(name) {
  return getComputedStyle(root).getPropertyValue(name).trim();
}
