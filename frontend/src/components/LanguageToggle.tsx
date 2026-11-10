import { defineMessages, setLang, useLang, useT } from "../lib/i18n";

const M = defineMessages({
  en: { label: "Show the site in Bangla", title: "বাংলা" },
  bn: { label: "Show the site in English", title: "English" },
});

/**
 * Switches the site between English and Bangla, and remembers the choice. The visible "বাং" or "EN"
 * starts the button's accessible name (WCAG 2.5.3), so a voice-control user can say what they see.
 */
export function LanguageToggle() {
  const lang = useLang();
  const t = useT(M);
  const next = lang === "bn" ? "en" : "bn";
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm min-w-[3.25rem] px-2 font-semibold"
      title={t("label")}
      onClick={() => setLang(next)}
    >
      <span lang={next}>{next === "bn" ? "বাং" : "EN"}</span>
      <span className="sr-only">{`: ${t("label")}`}</span>
    </button>
  );
}
