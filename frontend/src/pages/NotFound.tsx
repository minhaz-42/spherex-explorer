import { Link } from "react-router";

import { usePrefersReducedMotion } from "../components/space/motion";
import { PlanetPortrait } from "../components/space/PlanetPortrait";

export function NotFound() {
  const reduced = usePrefersReducedMotion();
  return (
    <div className="page grid flex-1 items-center gap-12 py-20 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
      <div>
        <p className="kicker">404 · off the map</p>
        <h1 className="mt-4 text-[length:var(--fs-h1)]">There is nothing at this address.</h1>
        <p className="prose-body mt-4">
          The link may be old or mistyped. The sky, on the other hand, is all still there.
        </p>
        <div className="mt-8">
          <Link to="/explore" className="btn btn-primary">
            Explore the sky
          </Link>
        </div>
      </div>
      <div className="relative mx-auto aspect-square w-full max-w-sm" aria-hidden="true">
        <div
          className="absolute inset-[8%] rounded-full"
          style={{ background: "radial-gradient(closest-side, rgb(141 116 255 / 0.22), transparent)" }}
        />
        <PlanetPortrait id="neptune" className="absolute left-[18%] top-[18%] h-[64%] w-[64%]" />
        {/* A small moon on a tilted orbit. */}
        <svg viewBox="0 0 200 200" className="absolute inset-0 overflow-visible">
          <g transform="rotate(-18 100 100)">
            <ellipse cx="100" cy="100" rx="96" ry="30" fill="none" stroke="var(--text)" strokeOpacity="0.2" />
            {reduced ? (
              <circle cx="196" cy="100" r="4" fill="var(--accent)" />
            ) : (
              <circle r="4" fill="var(--accent)">
                <animateMotion
                  dur="12s"
                  repeatCount="indefinite"
                  path="M196 100A96 30 0 1 1 4 100A96 30 0 1 1 196 100"
                />
              </circle>
            )}
          </g>
        </svg>
      </div>
    </div>
  );
}
