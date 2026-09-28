"""App factory: the /api routes, plus the built web app at "/" when present.

Run it with:  python -m uvicorn app.main:app --port 8000   (from backend/)
"""

from __future__ import annotations

from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from . import __version__
from .cache import TTLCache
from .config import Settings
from .routes import router

USER_AGENT = f"spherex-explorer/{__version__}"


def create_app(settings: Settings | None = None, transport: httpx.AsyncBaseTransport | None = None) -> FastAPI:
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        async with httpx.AsyncClient(
            transport=transport,
            headers={"User-Agent": USER_AGENT},
            follow_redirects=True,
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
        ) as client:
            app.state.http = client
            yield

    app = FastAPI(title="SPHEREx Explorer", version=__version__, lifespan=lifespan)
    app.state.settings = settings
    app.state.cache = TTLCache()

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        return response

    app.include_router(router)

    dist = settings.frontend_dist
    if (dist / "index.html").is_file():
        app.mount("/", StaticFiles(directory=dist, html=True), name="frontend")
    else:
        @app.get("/", include_in_schema=False)
        async def no_frontend() -> JSONResponse:
            return JSONResponse({
                "message": "The web app hasn't been built. Run `python start.py` for development, "
                           "or `python start.py --prod` to build it and serve it here.",
                "api_docs": "/docs",
            })

    return app


app = create_app()
