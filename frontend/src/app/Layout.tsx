import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from "react-router";

import { LanguageToggle } from "../components/LanguageToggle";
import { AtlasSky, type SkyMood } from "../components/space/AtlasSky";
import { ThemeToggle } from "../components/ThemeToggle";
import { Wordmark } from "../components/Wordmark";
import { defineMessages, useLang, useT } from "../lib/i18n";

const M = defineMessages({
  en: {
    explore: "Explore",
    discover: "Discover",
    ask: "Ask",
    about: "About",
    home: "SPHEREx Explorer, home",
    main: "Main",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    skip: "Skip to content",
    methods: "Methods",
    credits: "Credits",
    independent:
      "An independent project built for the 2026 NASA Space Apps Challenge. Not affiliated with or endorsed by NASA, JPL, Caltech or IPAC.",
    clearSkies: "Clear skies.",
  },
  bn: {
    explore: "অন্বেষণ",
    discover: "পরিবর্তন",
    ask: "জিজ্ঞাসা",
    about: "পরিচিতি",
    home: "SPHEREx Explorer, প্রথম পাতা",
    main: "প্রধান",
    openMenu: "মেনু খুলুন",
    closeMenu: "মেনু বন্ধ করুন",
    skip: "মূল অংশে যান",
    methods: "পদ্ধতি",
    credits: "কৃতজ্ঞতা",
    independent:
      "2026 সালের NASA Space Apps Challenge-এর জন্য তৈরি একটি স্বাধীন প্রকল্প। NASA, JPL, Caltech বা IPAC-এর সঙ্গে যুক্ত নয়, তাদের অনুমোদিতও নয়।",
    clearSkies: "আকাশ পরিষ্কার থাকুক।",
  },
});

const NAV = [
  { to: "/explore", label: "explore" },
  { to: "/discover", label: "discover" },
  { to: "/ask", label: "ask" },
  { to: "/about", label: "about" },
] as const;

/** The viewer compares faint changes between frames, so nothing moves behind it. */
function skyMood(pathname: string): SkyMood | null {
  if (pathname.startsWith("/explore")) return null;
  return pathname === "/" ? "lively" : "calm";
}

function navClass(isActive: boolean): string {
  return `group relative inline-flex h-10 items-center px-3 text-[0.9375rem] no-underline transition-colors ${
    isActive ? "text-text" : "text-muted hover:text-text"
  }`;
}

function Header() {
  const [open, setOpen] = useState(false);
  const t = useT(M);

  return (
    <header className="sticky top-0 z-40 border-b border-rule/80 bg-bg/70 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-[var(--header-h)] max-w-[88rem] items-center justify-between px-[var(--gutter)]">
        <Link to="/" className="rounded-sm no-underline" aria-label={t("home")}>
          <Wordmark />
        </Link>
        <div className="flex items-center gap-1">
        <nav aria-label={t("main")} className="hidden sm:block">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} className={({ isActive }) => navClass(isActive)}>
                  {({ isActive }) => (
                    <>
                      {t(item.label)}
                      <span
                        aria-hidden="true"
                        className={`absolute inset-x-3 bottom-1 h-[2px] origin-left rounded-full bg-accent transition-transform duration-300 ${
                          isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-50"
                        }`}
                      />
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <span aria-hidden="true" className="mx-2 hidden h-5 w-px bg-rule sm:block" />
        <ThemeToggle />
        <LanguageToggle />
        <button
          type="button"
          className="btn btn-ghost btn-icon sm:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? t("closeMenu") : t("openMenu")}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
        </button>
        </div>
      </div>
      <nav id="mobile-nav" aria-label={t("main")} hidden={!open} className="border-t border-rule sm:hidden">
        <ul className="flex flex-col px-[var(--gutter)] py-2">
          {NAV.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex h-12 items-center gap-3 text-xl font-semibold no-underline ${isActive ? "text-text" : "text-muted"}`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      aria-hidden="true"
                      className={`size-1.5 rounded-full ${isActive ? "bg-accent" : "bg-transparent"}`}
                    />
                    {t(item.label)}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

const link = (href: string, text: string) => (
  <a className="link" href={href} rel="noreferrer" target="_blank">
    {text}
  </a>
);
const IRSA = link("https://irsa.ipac.caltech.edu/Missions/spherex.html", "NASA/IPAC Infrared Science Archive");
const JPL = link("https://ssd.jpl.nasa.gov/", "JPL Solar System Dynamics");
const CDS = link("https://cds.unistra.fr/", "CDS Sesame");

function Footer() {
  const t = useT(M);
  const lang = useLang();
  return (
    <footer className="relative mt-auto overflow-hidden border-t border-rule">
      {/* The limb of a planet rising behind the footer. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[70%] -z-10 aspect-square w-[160vw] -translate-x-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, rgb(91 63 208 / 0.08), rgb(91 63 208 / 0.04) 70%, rgb(232 168 56 / 0.1) 96%, transparent 100%)",
        }}
      />
      <div className="page grid gap-8 py-12 text-sm text-muted md:grid-cols-[1fr_auto]">
        <div className="max-w-2xl space-y-2">
          {lang === "bn" ? (
            <p>
              ছবি ও তথ্য: SPHEREx Quick Release ডেটা, {IRSA} থেকে। সৌরজগতের বস্তুর অবস্থান: {JPL}; নাম শনাক্তকরণ: {CDS}।
            </p>
          ) : (
            <p>
              Images and metadata from the SPHEREx Quick Release data at the {IRSA}. Solar-system positions from {JPL};
              names resolved by {CDS}.
            </p>
          )}
          <p className="text-faint">{t("independent")}</p>
        </div>
        <div className="flex flex-col gap-4 md:items-end">
          <ul className="flex gap-5 md:justify-end">
            <li>
              <Link className="link" to="/about">
                {t("about")}
              </Link>
            </li>
            <li>
              <Link className="link" to="/about#methods">
                {t("methods")}
              </Link>
            </li>
            <li>
              <Link className="link" to="/about#credits">
                {t("credits")}
              </Link>
            </li>
          </ul>
          <p className="text-base font-medium text-faint" aria-hidden="true">
            {t("clearSkies")}
          </p>
        </div>
      </div>
    </footer>
  );
}

export function Layout() {
  const { pathname } = useLocation();
  const mood = skyMood(pathname);
  const t = useT(M);

  return (
    <div className="relative isolate flex min-h-dvh flex-col">
      {mood ? <AtlasSky key={mood} mood={mood} /> : null}
      <a
        href="#main"
        className="visually-hidden focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-ink"
      >
        {t("skip")}
      </a>
      <Header />
      <main id="main" className="flex flex-1 flex-col">
        <Outlet />
      </main>
      <Footer />
      <ScrollRestoration />
    </div>
  );
}
