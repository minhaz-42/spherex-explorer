import { Link } from "react-router";

import { RingedPlanetDoodle, SpherexDoodle } from "../components/space/Sketches";

export function NotFound() {
  return (
    <div className="page grid flex-1 items-center gap-10 py-20 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
      <div>
        <p className="kicker">404</p>
        <h1 className="mt-3 text-[length:var(--fs-h1)]">There is nothing at this address.</h1>
        <p className="prose-body mt-4">The link may be old or mistyped.</p>
        <div className="mt-8">
          <Link to="/explore" className="btn btn-primary">
            Explore the sky
          </Link>
        </div>
      </div>
      <div className="relative mx-auto h-64 w-full max-w-sm" aria-hidden="true">
        <RingedPlanetDoodle
          pencil="accent"
          className="absolute left-2 top-4 w-32 motion-safe:animate-[bob_7s_ease-in-out_infinite]"
        />
        <SpherexDoodle className="absolute bottom-0 right-4 w-36 rotate-12 motion-safe:animate-[bob_5s_ease-in-out_infinite]" />
        <p className="hand absolute right-0 top-2 rotate-6 text-2xl text-muted">lost in space…</p>
      </div>
    </div>
  );
}
