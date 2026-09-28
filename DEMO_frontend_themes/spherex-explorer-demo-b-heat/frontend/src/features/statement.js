// <p data-lit> lights up word by word as it passes the middle of the screen.
export function initStatement() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('[data-lit]').forEach((el) => {
    const text = el.textContent.trim();
    el.setAttribute('aria-label', text);
    el.textContent = '';
    const spans = text.split(/\s+/).map((word) => {
      const span = document.createElement('span');
      span.className = 'w';
      span.setAttribute('aria-hidden', 'true');
      span.textContent = word;
      return span;
    });
    spans.forEach((span, i) => el.append(span, i < spans.length - 1 ? ' ' : ''));

    if (reduce) {
      spans.forEach((span) => span.classList.add('on'));
      return;
    }
    const update = () => {
      const box = el.getBoundingClientRect();
      const progress = (innerHeight * 0.75 - box.top) / (box.height + innerHeight * 0.25);
      const lit = Math.round(Math.min(1, Math.max(0, progress)) * spans.length);
      spans.forEach((span, i) => span.classList.toggle('on', i < lit));
    };
    update();
    addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update);
  });
}
