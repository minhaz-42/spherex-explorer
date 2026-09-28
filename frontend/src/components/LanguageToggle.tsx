import { defineMessages, setLang, useLang, useT } from "../lib/i18n";

const M = defineMessages({
  en: { label: "Show the site in Bangla", title: "বাংলা" },
  bn: { label: "Show the site in English", title: "English" },
});

/** Switches the site between English and Bangla, and remembers the choice. */
export function LanguageToggle() {
  const lang = useLang();
  const t = useT(M);
  const next = lang === "bn" ? "en" : "bn";
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm min-w-[3.25rem] px-2 font-semibold"
      aria-label={t("label")}
      title={t("label")}
      onClick={() => setLang(next)}
    >
      <span lang={next}>{next === "bn" ? "বাং" : "EN"}</span>
    </button>
  );
}
