"""Cache keys shared by the routes and the assistant.

The assistant reads what the viewer has already loaded, so it must build exactly the keys the
routes use. Defining them once here keeps the two from drifting apart.
"""

from __future__ import annotations

from ..cache import cache_key
from ..science.cutout import PIPELINE_VERSION
from ..science.grid import Grid
from ..science.sources import ALGORITHM_VERSION


def resolve_key(text: str) -> str:
    return cache_key(text.strip().lower())


def observations_key(
    ra: float, dec: float, collections: list[str], deep_window: tuple[float, float] | None
) -> str:
    return cache_key(ra, dec, collections, deep_window)


def cutout_key(frame_key: str, grid: Grid) -> str:
    return cache_key(frame_key, grid.ra, grid.dec, grid.size_px, PIPELINE_VERSION)


def measure_key(frame_key: str, grid: Grid) -> str:
    return cache_key(frame_key, grid.ra, grid.dec, PIPELINE_VERSION)


def known_key(ra: float, dec: float, size: float, keys: list[str], vmag_limit: float) -> str:
    return cache_key(ra, dec, size, sorted(keys), vmag_limit)


def candidates_key(ra: float, dec: float, size_px: int, keys: list[str]) -> str:
    return cache_key(ra, dec, size_px, sorted(keys), PIPELINE_VERSION, ALGORITHM_VERSION)
