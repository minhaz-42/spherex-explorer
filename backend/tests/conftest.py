from collections.abc import AsyncIterator, Iterator
from pathlib import Path

import httpx
import pytest
from asgi_lifespan import LifespanManager
from fastapi import FastAPI

from spherex_explorer.config import Settings
from spherex_explorer.main import create_app

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture
def fixtures() -> Path:
    return FIXTURES


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(
        cache_dir=tmp_path / "cache",
        snapshot_dir=tmp_path / "snapshot",
        cases_file=FIXTURES / "cases.json",
        frontend_dist=tmp_path / "no-dist",
        rate_limit_per_minute=10_000,
        upstream_timeout_s=5,
        jpl_timeout_s=5,
    )


@pytest.fixture
def app(settings: Settings) -> Iterator[FastAPI]:
    yield create_app(settings)


@pytest.fixture
async def api(app: FastAPI) -> AsyncIterator[httpx.AsyncClient]:
    async with LifespanManager(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            yield client
