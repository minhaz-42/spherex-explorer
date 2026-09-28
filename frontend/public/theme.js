// Applies a saved theme before the first paint, so a dark-theme visitor never sees a light flash.
// A separate file rather than inline, because the Content-Security-Policy only allows scripts from 'self'.
try {
  if (localStorage.getItem("spherex-theme") === "dark") document.documentElement.dataset.theme = "dark";
} catch {
  // Storage unavailable: stay on the default light theme.
}
