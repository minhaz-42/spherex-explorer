// Text effects: decode/scramble, hover roll, rolling digits, RGB glitch and a
// counting preloader. All are driven by data attributes, so the HTML stays
// editable and the effects can be removed by deleting an attribute.
//
//   data-scramble          decode once the page has loaded
//   data-scramble-view     decode when scrolled into view
//   data-scramble-hover    re-decode on hover / focus (put it on the link or button)
//   data-roll              duplicate the label and roll it upward on hover
//   data-odometer="102"    roll digits up to the number when scrolled into view
//   data-glitch            RGB-split flicker on hover and on a slow random timer
//   <div data-preloader>   counts 0–100 %, then lifts away and fires "page:ready"

const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const GLYPHS = '▚▞▙▟░▒#%&*+=<>/\\|01µλ∆';

// Keeps the real text for screen readers while the visible copy scrambles.
function prepare(el) {
  if (el._glyphs) return el._glyphs;
  const text = el.textContent.trim().replace(/\s+/g, ' ');
  el.textContent = '';
  const sr = document.createElement('span');
  sr.className = 'sr-only';
  sr.textContent = text;
  const vis = document.createElement('span');
  vis.setAttribute('aria-hidden', 'true');
  vis.textContent = text;
  el.append(sr, vis);
  el._glyphs = { text, vis };
  return el._glyphs;
}

export function scramble(el, { duration = 900, delay = 0 } = {}) {
  const target = el.matches('[data-scramble-hover]') && el.querySelector('[data-scramble-target]')
    ? el.querySelector('[data-scramble-target]') : el;
  const { text, vis } = prepare(target);
  if (reduce()) { vis.textContent = text; return Promise.resolve(); }
  cancelAnimationFrame(target._raf);
  return new Promise((done) => {
    const start = performance.now() + delay;
    const step = (now) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      const revealed = Math.floor(t * text.length);
      let out = '';
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === ' ' || i < revealed) out += ch;
        else if (now < start) out += ch === ' ' ? ' ' : '\u2002';
        else out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      vis.textContent = out;
      if (t < 1) target._raf = requestAnimationFrame(step);
      else { vis.textContent = text; done(); }
    };
    target._raf = requestAnimationFrame(step);
  });
}

function initRoll(el) {
  if (el._rolled) return;
  el._rolled = true;
  const label = el.textContent.trim();
  el.textContent = '';
  const wrap = document.createElement('span');
  wrap.className = 'roll';
  const a = document.createElement('span');
  a.textContent = label;
  const b = document.createElement('span');
  b.textContent = label;
  b.setAttribute('aria-hidden', 'true');
  wrap.append(a, b);
  el.append(wrap);
}

function initOdometer(el) {
  const final = el.dataset.odometer;
  el.textContent = '';
  el.setAttribute('aria-label', final);
  el.classList.add('odo');
  const cols = [];
  for (const ch of final) {
    if (!/\d/.test(ch)) {
      const s = document.createElement('span');
      s.textContent = ch;
      s.setAttribute('aria-hidden', 'true');
      el.append(s);
      continue;
    }
    const col = document.createElement('span');
    col.className = 'odo-col';
    col.setAttribute('aria-hidden', 'true');
    // Two full turns then the digit, like a mechanical counter.
    const digits = '01234567890123456789' + ch;
    for (const d of digits) {
      const s = document.createElement('span');
      s.textContent = d;
      col.append(s);
    }
    el.append(col);
    cols.push(col);
  }
  el._run = () => {
    cols.forEach((col, i) => {
      const n = col.children.length - 1;
      col.style.transitionDelay = `${i * 90}ms`;
      col.style.transform = `translateY(-${n}em)`;
    });
  };
  if (reduce()) {
    cols.forEach((col) => { col.style.transition = 'none'; });
    el._run();
  }
}

export function glitch(el) {
  if (reduce() || el.classList.contains('is-glitching')) return;
  el.dataset.text = el.textContent.trim();
  el.classList.add('is-glitching');
  setTimeout(() => el.classList.remove('is-glitching'), 420);
}

function initPreloader() {
  const pre = document.querySelector('[data-preloader]');
  const ready = () => window.dispatchEvent(new Event('page:ready'));
  if (!pre) { ready(); return; }
  const out = pre.querySelector('[data-preloader-count]');
  if (reduce()) { pre.remove(); ready(); return; }
  const start = performance.now();
  const duration = Number(pre.dataset.duration || 1100);
  const tick = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    if (out) out.textContent = String(Math.round(eased * 100)).padStart(3, '0');
    if (t < 1) requestAnimationFrame(tick);
    else {
      pre.classList.add('is-done');
      setTimeout(ready, 250);
      setTimeout(() => pre.remove(), 900);
    }
  };
  requestAnimationFrame(tick);
}

export function initEffects() {
  document.querySelectorAll('[data-roll]').forEach(initRoll);
  document.querySelectorAll('[data-odometer]').forEach(initOdometer);
  document.querySelectorAll('[data-scramble], [data-scramble-view]').forEach(prepare);

  document.querySelectorAll('[data-scramble-hover]').forEach((el) => {
    el.addEventListener('mouseenter', () => scramble(el, { duration: 450 }));
    el.addEventListener('focus', () => scramble(el, { duration: 450 }));
  });

  document.querySelectorAll('[data-glitch]').forEach((el) => {
    el.dataset.text = el.textContent.trim();
    el.addEventListener('mouseenter', () => glitch(el));
    if (!reduce()) {
      const loop = () => setTimeout(() => { glitch(el); loop(); }, 5000 + Math.random() * 6000);
      loop();
    }
  });

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      io.unobserve(el);
      if (el._run) el._run();
      else scramble(el, { duration: Number(el.dataset.duration || 800) });
    });
  }, { threshold: 0.4 });
  document.querySelectorAll('[data-scramble-view], [data-odometer]').forEach((el) => io.observe(el));

  window.addEventListener('page:ready', () => {
    document.querySelectorAll('[data-scramble]').forEach((el, i) => {
      scramble(el, { duration: Number(el.dataset.duration || 1000), delay: Number(el.dataset.delay || i * 120) });
    });
  }, { once: true });

  initPreloader();
}
