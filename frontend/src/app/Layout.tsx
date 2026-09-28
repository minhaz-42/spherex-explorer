import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from "react-router";

import { AtlasSky, type SkyMood } from "../components/space/AtlasSky";
import { ThemeToggle } from "../components/ThemeToggle";
import { Wordmark } from "../components/Wordmark";

const NAV = [
  { to: "/explore", label: "Explore" },
  { to: "/discover", label: "Discover" },
  { to: "/ask", label: "Ask" },
  { to: "/about", label: "About" },
];

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

  return (
    <header className="sticky top-0 z-40 border-b border-rule/80 bg-bg/70 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-[var(--header-h)] max-w-[88rem] items-center justify-between px-[var(--gutter)]">
        <Link to="/" className="rounded-sm no-underline" aria-label="SPHEREx Explorer, home">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-1">
        <nav aria-label="Main" className="hidden sm:block">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} className={({ isActive }) => navClass(isActive)}>
                  {({ isActive }) => (
                    <>
                      {item.label}
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
      </div>
      <nav id="mobile-nav" aria-label="Main" hidden={!open} className="border-t border-rule sm:hidden">
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
                    {item.label}
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

function Footer() {
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
          <p className="text-base font-medium text-faint" aria-hidden="true">
            Clear skies.
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
      {mood ? <AtlasSky key={mood} mood={mood} /> : null}
      <a
        href="#main"
        className="visually-hidden focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-ink"
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
