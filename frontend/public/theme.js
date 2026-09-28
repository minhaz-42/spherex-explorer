// Applies the theme before the first paint, so a dark-theme visitor never sees a light flash.
// A separate file rather than inline, because the Content-Security-Policy only allows scripts from 'self'.
// `?theme=dark` or `?theme=light` in the address picks a theme (handy for demos) and remembers it.
(function () {
  const asked = new URLSearchParams(location.search).get("theme");
  let theme = asked === "dark" || asked === "light" ? asked : null;
  try {
    if (theme) localStorage.setItem("spherex-theme", theme);
    else theme = localStorage.getItem("spherex-theme");
  } catch {
    // Storage unavailable: use the address, or stay on the default light theme.
  }
  if (theme === "dark") document.documentElement.dataset.theme = "dark";
})();
