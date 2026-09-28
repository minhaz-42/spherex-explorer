"""Cache keys shared by the routes and the assistant.

The assistant reads what the viewer has already loaded, so it must build exactly the keys the
routes use. Defining them once here keeps the two from drifting apart.
"""

from __future__ import annotations

from ..cache import cache_key
from ..objects import images, plates, simbad
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


def object_key(ra: float, dec: float, radius: float = simbad.DEFAULT_RADIUS_DEG) -> str:
    return cache_key(ra, dec, radius, simbad.FORMAT_VERSION)


def field_objects_key(ra: float, dec: float, radius: float, limit: int) -> str:
    return cache_key(ra, dec, radius, limit, simbad.FORMAT_VERSION)


def object_image_key(
    ra: float, dec: float, fov: float, survey: images.SurveyName, size: int
) -> str:
    """Built from the snapped request, so nearly identical views share one image."""
    q = images.quantise(ra, dec, fov, survey, size)
    return cache_key(q.ra, q.dec, q.fov, q.survey, q.size)


def plate_key(ra: float, dec: float, fov: float, survey: plates.PlateSurvey, size: int) -> str:
    q = plates.quantise(ra, dec, fov, survey, size)
    return cache_key(q.ra, q.dec, q.fov, q.survey, q.size, plates.RENDER_VERSION)
