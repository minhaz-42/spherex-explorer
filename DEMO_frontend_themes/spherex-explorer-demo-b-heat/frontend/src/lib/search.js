// Search forms: <form data-search="section-id"> with one text input.
// Resolves the name or coordinates, asks the archive which SPHEREx images
// cover the position, reports the answer under the form, then scrolls to the
// section named in data-search.
import { ApiError, frames, resolve } from './api.js';

const fmt = (n) => n.toLocaleString('en-US');
const deg = (x, signed = false) => `${signed && x >= 0 ? '+' : ''}${x.toFixed(4)}°`;
const day = (iso) => iso?.slice(0, 10);

// Uses a .search-status element inside the form or right after it, or adds one.
function statusFor(form) {
  const next = form.nextElementSibling;
  let el = form.querySelector('.search-status') || (next?.matches('.search-status') ? next : null);
  if (!el) {
    el = document.createElement('p');
    el.className = 'search-status';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    form.after(el);
  }
  return el;
}

function show(el, text, kind = 'info') {
  el.textContent = text;
  el.dataset.kind = kind;
}

function describeTarget(r) {
  const where = `RA ${deg(r.ra)}, Dec ${deg(r.dec, true)}`;
  if (r.frame === 'name') return `${r.name} is at ${where}.`;
  if (r.frame === 'galactic') return `l ${r.l.toFixed(2)}°, b ${r.b.toFixed(2)}° is ${where}.`;
  return `Position ${where}.`;
}

function describeFrames(f) {
  if (!f.count) return 'No SPHEREx images cover this position yet. The archive grows weekly, so try again later.';
  const parts = f.collections
    .filter((c) => c.count || c.error)
    .map((c) => `${c.release} ${c.survey} ${c.error ? '(unavailable)' : fmt(c.count)}`);
  const failed = f.collections.some((c) => c.error) ? ' Some collections didn\u2019t answer, so this may be incomplete.' : '';
  return `Found ${fmt(f.count)} SPHEREx images from ${day(f.earliest_utc)} to ${day(f.latest_utc)}: ${parts.join(', ')}.${failed}`;
}

// Optional <select name="release|survey|band"> fields narrow the answer.
// Their values are "all", or a release (QR2, QR3), survey (wide, deep) or band number.
function applyFilters(form, found) {
  const value = (name) => form.querySelector(`select[name="${name}"]`)?.value || 'all';
  const release = value('release');
  const survey = value('survey');
  const band = value('band');
  if (release === 'all' && survey === 'all' && band === 'all') return found;
  const matches = (f) => (release === 'all' || f.release === release)
    && (survey === 'all' || f.survey === survey)
    && (band === 'all' || String(f.band) === band);
  const kept = found.frames.filter(matches);
  const collections = found.collections
    .filter((c) => (release === 'all' || c.release === release) && (survey === 'all' || c.survey === survey))
    .map((c) => ({ ...c, count: kept.filter((f) => f.collection === c.collection).length }));
  return {
    ...found,
    frames: kept,
    count: kept.length,
    collections,
    earliest_utc: kept[0]?.time_utc ?? null,
    latest_utc: kept.at(-1)?.time_utc ?? null,
  };
}

export function initSearch() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('form[data-search]').forEach((form) => {
    let controller;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const input = form.querySelector('input[type="search"], input[name="q"], input:not([type])');
      const q = input?.value.trim();
      const status = statusFor(form);
      if (!q) {
        show(status, 'Type an object name, such as M31, or coordinates such as 10.6847 +41.2690.', 'error');
        input?.focus();
        return;
      }
      controller?.abort();
      controller = new AbortController();
      const { signal } = controller;
      form.setAttribute('aria-busy', 'true');
      try {
        show(status, `Looking up ${q}\u2026`);
        const target = await resolve(q, { signal });
        show(status, `${describeTarget(target)} Searching the SPHEREx archive, which can take about 10 seconds\u2026`);
        const found = applyFilters(form, await frames(target.ra, target.dec, { signal }));
        show(status, `${describeTarget(target)} ${describeFrames(found)}`, 'ok');
        document.dispatchEvent(new CustomEvent('spherex:search', { detail: { target, frames: found } }));
        const section = document.getElementById(form.dataset.search);
        if (section && !section.contains(form)) section.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
      } catch (err) {
        if (err.name === 'AbortError') return;
        show(status, err instanceof ApiError ? err.message : 'Something went wrong while searching. Try again.', 'error');
      } finally {
        form.removeAttribute('aria-busy');
      }
    });
  });
}
