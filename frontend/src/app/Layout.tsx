import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet, ScrollRestoration } from "react-router";

import { Wordmark } from "../components/Wordmark";

const NAV = [
  { to: "/explore", label: "Explore" },
  { to: "/discover", label: "Discover" },
  { to: "/about", label: "About" },
];

function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-bg/95 backdrop-blur-sm">
      <div className="mx-auto flex h-[var(--header-h)] max-w-[96rem] items-center justify-between px-[var(--gutter)]">
        <Link to="/" className="rounded-sm no-underline" aria-label="SPHEREx Explorer, home">
          <Wordmark />
        </Link>
        <nav aria-label="Main" className="hidden sm:block">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `inline-flex h-9 items-center rounded-sm px-3 text-[0.9375rem] no-underline transition-colors ${
                      isActive ? "text-text shadow-[inset_0_-2px_0_var(--accent)]" : "text-muted hover:text-text"
                    }`
                  }
                >
                  {item.label}
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
      <nav id="mobile-nav" aria-label="Main" hidden={!open} className="border-t border-rule sm:hidden">
        <ul className="flex flex-col px-[var(--gutter)] py-2">
          {NAV.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex h-12 items-center text-base no-underline ${isActive ? "text-text" : "text-muted"}`
                }
              >
                {item.label}
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
    <footer className="mt-auto border-t border-rule">
      <div className="page grid gap-6 py-10 text-sm text-muted md:grid-cols-[1fr_auto]">
        <div className="max-w-2xl space-y-2">
          <p>
            Images and metadata from the SPHEREx Quick Release data at the{" "}
            <a className="link" href="https://irsa.ipac.caltech.edu/Missions/spherex.html" rel="noreferrer" target="_blank">
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
            An independent project built for the 2026 NASA Space Apps Challenge. Not affiliated with or endorsed by NASA,
            JPL, Caltech or IPAC.
          </p>
        </div>
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
      </div>
    </footer>
  );
}

export function Layout() {
  return (
    <div className="flex min-h-dvh flex-col">
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
