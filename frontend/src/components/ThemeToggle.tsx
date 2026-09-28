import { Moon, Sun } from "lucide-react";

import { defineMessages, useT } from "../lib/i18n";
import { setTheme, useTheme } from "./space/theme";

const M = defineMessages({
  en: {
    toLight: "Switch to the light theme",
    toDark: "Switch to the dark theme",
    light: "Light theme",
    dark: "Dark theme",
  },
  bn: {
    toLight: "হালকা থিমে যান",
    toDark: "গাঢ় থিমে যান",
    light: "হালকা থিম",
    dark: "গাঢ় থিম",
  },
});

/** Switches between the light theme and the dark night-sky theme, and remembers the choice. */
export function ThemeToggle() {
  const t = useT(M);
  const theme = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      className="btn btn-ghost btn-icon"
      aria-pressed={dark}
      aria-label={dark ? t("toLight") : t("toDark")}
      title={dark ? t("light") : t("dark")}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
    </button>
  );
}
