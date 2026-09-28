import { isRouteErrorResponse, Link, useRouteError } from "react-router";

export function RouteError() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <div className="page flex flex-1 flex-col justify-center py-24">
      <p className="kicker">{notFound ? "404" : "Something went wrong"}</p>
      <h1 className="mt-3 text-[length:var(--fs-h1)]">
        {notFound ? "There is nothing at this address." : "This page failed to load."}
      </h1>
      <p className="prose-body mt-4">
        {notFound
          ? "The link may be old or mistyped."
          : "It is a problem in the app, not in the SPHEREx data. Reloading usually fixes it."}
      </p>
      <div className="mt-8 flex gap-3">
        <Link to="/explore" className="btn btn-primary">
          Explore the sky
        </Link>
        <Link to="/" className="btn btn-secondary">
          Home
        </Link>
      </div>
    </div>
  );
}
