import { Link } from "react-router";

export function NotFound() {
  return (
    <div className="page flex flex-1 flex-col justify-center py-24">
      <p className="kicker">404</p>
      <h1 className="mt-3 text-[length:var(--fs-h1)]">There is nothing at this address.</h1>
      <p className="prose-body mt-4">The link may be old or mistyped.</p>
      <div className="mt-8">
        <Link to="/explore" className="btn btn-primary">
          Explore the sky
        </Link>
      </div>
    </div>
  );
}
