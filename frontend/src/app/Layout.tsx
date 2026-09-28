import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from "react-router";

import { PencilDefs } from "../components/space/PencilDefs";
import { SketchSky, type SkyMood } from "../components/space/SketchSky";
import { Wordmark } from "../components/Wordmark";

const NAV = [
  { to: "/explore", label: "Explore" },
  { to: "/discover", label: "Discover" },
  { to: "/about", label: "About" },
];

/** The viewer compares faint changes between frames, so nothing moves behind it. */
function skyMood(pathname: string): SkyMood | null {
  if (pathname.startsWith("/explore")) return null;
  return pathname === "/" ? "lively" : "calm";
}

function navClass(isActive: boolean): string {
  return `relative inline-flex h-10 items-center rounded-md px-3 text-[0.9375rem] no-underline transition-colors ${
    isActive ? "text-text" : "text-muted hover:text-text"
  }`;
}

function ActiveScribble() {
  // A highlighter stroke under the current page.
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 12"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-1 bottom-1 -z-10 h-3 w-[calc(100%-0.5rem)]"
    >
      <path
        d="M2 7.5c18-3 40-4.2 62-3.6 12 .3 24 1.3 34 2.6"
        fill="none"
        stroke="var(--highlight)"
        strokeWidth="7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-bg/85 backdrop-blur-sm">
      <div className="mx-auto flex h-[var(--header-h)] max-w-[96rem] items-center justify-between px-[var(--gutter)]">
        <Link to="/" className="rounded-sm no-underline" aria-label="SPHEREx Explorer, home">
          <Wordmark />
        </Link>
        <nav aria-label="Main" className="hidden sm:block">
          <ul className="isolate flex items-center gap-1">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} className={({ isActive }) => navClass(isActive)}>
                  {({ isActive }) => (
                    <>
                      {item.label}
                      {isActive ? <ActiveScribble /> : null}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <button
          type="button"
          className="btn btn-ghost btn-icon sm:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
        </button>
      </div>
      <div aria-hidden="true" className="squiggle h-2 opacity-60" />
      <nav id="mobile-nav" aria-label="Main" hidden={!open} className="sm:hidden">
        <ul className="flex flex-col px-[var(--gutter)] py-2">
          {NAV.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex h-12 items-center font-display text-xl no-underline ${isActive ? "text-text" : "text-muted"}`
                }
              >
                {({ isActive }) => <span className={isActive ? "highlight" : undefined}>{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="relative mt-auto">
      <div aria-hidden="true" className="squiggle h-2 opacity-60" />
      <div className="page grid gap-6 py-10 text-sm text-muted md:grid-cols-[1fr_auto]">
        <div className="max-w-2xl space-y-2">
          <p>
            Images and metadata from the SPHEREx Quick Release data at the{" "}
            <a
              className="link"
              href="https://irsa.ipac.caltech.edu/Missions/spherex.html"
              rel="noreferrer"
              target="_blank"
            >
              NASA/IPAC Infrared Science Archive
            </a>
            . Solar-system positions from{" "}
            <a className="link" href="https://ssd.jpl.nasa.gov/" rel="noreferrer" target="_blank">
              JPL Solar System Dynamics
            </a>
            ; names resolved by{" "}
            <a className="link" href="https://cds.unistra.fr/" rel="noreferrer" target="_blank">
              CDS Sesame
            </a>
            .
          </p>
          <p className="text-faint">
            An independent project built for the 2026 NASA Space Apps Challenge. Not affiliated with or endorsed by
            NASA, JPL, Caltech or IPAC.
          </p>
        </div>
        <div className="flex flex-col gap-4 md:items-end">
          <ul className="flex gap-5 md:justify-end">
            <li>
              <Link className="link" to="/about">
                About
              </Link>
            </li>
            <li>
              <Link className="link" to="/about#methods">
                Methods
              </Link>
            </li>
            <li>
              <Link className="link" to="/about#credits">
                Credits
              </Link>
            </li>
          </ul>
          <p className="hand -rotate-2 text-xl text-muted" aria-hidden="true">
            clear skies ✦
          </p>
        </div>
      </div>
    </footer>
  );
}

export function Layout() {
  const { pathname } = useLocation();
  const mood = skyMood(pathname);

  return (
    <div className="relative isolate flex min-h-dvh flex-col">
      <PencilDefs />
      {mood ? <SketchSky key={mood} mood={mood} /> : null}
      <a
        href="#main"
        className="visually-hidden focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-sm focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-ink"
      >
        Skip to content
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
