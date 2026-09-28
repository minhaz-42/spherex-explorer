"""Shared HTTP clients for upstream services.

One pooled client is reused for the whole process: TLS set-up to us-east-1 costs more than the
small range reads themselves, so connection reuse is what makes cutouts fast.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx

from . import __version__
from .config import Settings
from .errors import UpstreamError, UpstreamTimeout

USER_AGENT = f"spherex-explorer/{__version__} (+https://github.com/minhaz-42/spherex-explorer)"


def make_client(settings: Settings) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        timeout=httpx.Timeout(settings.upstream_timeout_s, connect=15.0),
        limits=httpx.Limits(max_connections=32, max_keepalive_connections=16),
        headers={"User-Agent": USER_AGENT},
        follow_redirects=True,
        transport=httpx.AsyncHTTPTransport(retries=2),
    )


@asynccontextmanager
async def upstream(service: str) -> AsyncIterator[None]:
    """Translate transport failures into :class:`UpstreamError` naming the service."""
    try:
        yield
    except httpx.TimeoutException as exc:
        raise UpstreamTimeout(service, f"{service} did not answer in time.") from exc
    except httpx.HTTPStatusError as exc:
        raise UpstreamError(
            service,
            f"{service} answered with HTTP {exc.response.status_code}.",
            detail=exc.response.text[:300],
        ) from exc
    except httpx.TransportError as exc:
        raise UpstreamError(service, f"Could not reach {service}.", detail=str(exc)) from exc
