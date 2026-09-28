"""FastAPI application: the JSON API under ``/api`` and, in production, the built frontend."""

import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import __version__
from .api import routes
from .cache import Store
from .config import Settings, get_settings
from .errors import ExplorerError, UpstreamError
from .http import make_client
from .ratelimit import RateLimiter
from .services import Services

log = logging.getLogger("spherex_explorer")

CSP = "; ".join(
    [
        "default-src 'self'",
        "img-src 'self' data: blob:",
        "style-src 'self'",
        "font-src 'self'",
        "script-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
        "form-action 'self'",
    ]
)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        client = make_client(settings)
        app.state.services = Services(
            settings=settings,
            client=client,
            store=Store(settings.cache_dir, settings.snapshot_dir),
            limiter=RateLimiter(settings.rate_limit_per_minute),
        )
        try:
            yield
        finally:
            await client.aclose()

    app = FastAPI(
        title="SPHEREx Explorer API",
        version=__version__,
        lifespan=lifespan,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        redoc_url=None,
    )

    app.add_middleware(GZipMiddleware, minimum_size=1024)
    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["GET"]
        )

    @app.middleware("http")
    async def security_headers(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault(
            "Permissions-Policy", "camera=(), microphone=(), geolocation=()"
        )
        if not request.url.path.startswith("/api/docs"):
            response.headers.setdefault("Content-Security-Policy", CSP)
        return response

    @app.exception_handler(ExplorerError)
    async def explorer_error(_: Request, exc: ExplorerError) -> JSONResponse:
        body: dict[str, object] = {"error": {"code": exc.code, "message": exc.message}}
        if isinstance(exc, UpstreamError):
            body["error"]["service"] = exc.service  # type: ignore[index]
            log.warning("upstream %s failed: %s %s", exc.service, exc.message, exc.detail or "")
        return JSONResponse(body, status_code=exc.status)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        first = exc.errors()[0] if exc.errors() else {}
        where = ".".join(str(p) for p in first.get("loc", []) if p not in ("query", "path"))
        message = f"{where}: {first.get('msg', 'invalid value')}" if where else "Invalid request."
        return JSONResponse(
            {"error": {"code": "invalid_query", "message": message}}, status_code=400
        )

    app.include_router(routes.router, prefix="/api")
    _mount_frontend(app, settings.frontend_dist)
    return app


def _mount_frontend(app: FastAPI, dist: Path) -> None:
    """Serve the Vite build with a single-page-app fallback, if it has been built."""
    index = dist / "index.html"
    if not index.is_file():
        return
    assets = dist / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    # A plain function: FastAPI runs it in a worker thread, so the filesystem checks do not
    # block the event loop.
    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> Response:
        if path.startswith("api/"):
            return JSONResponse(
                {"error": {"code": "not_found", "message": "No such API route."}}, status_code=404
            )
        candidate = (dist / path).resolve()
        if path and candidate.is_file() and candidate.is_relative_to(dist.resolve()):
            return FileResponse(candidate)
        return FileResponse(index, headers={"Cache-Control": "no-cache"})


app = create_app()


def run() -> None:
    import uvicorn

    uvicorn.run("spherex_explorer.main:app", host="127.0.0.1", port=8000)
