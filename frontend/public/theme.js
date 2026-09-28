// Applies the saved theme and language before the first paint, so a visitor never sees a flash of
// the wrong one. A separate file rather than inline, because the Content-Security-Policy only allows
// scripts from 'self'. `?theme=dark|light` and `?lang=bn|en` in the address pick one (handy for
// demos) and remember it.
(function () {
  const params = new URLSearchParams(location.search);
  const pick = (param, key, allowed) => {
    const asked = params.get(param);
    let value = allowed.includes(asked) ? asked : null;
    try {
      if (value) localStorage.setItem(key, value);
      else value = localStorage.getItem(key);
    } catch {
      // Storage unavailable: use the address, or stay on the default.
    }
    return value;
  };
  if (pick("theme", "spherex-theme", ["dark", "light"]) === "dark") document.documentElement.dataset.theme = "dark";
  if (pick("lang", "spherex-lang", ["bn", "en"]) === "bn") document.documentElement.lang = "bn";
})();
