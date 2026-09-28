"""HTTP routes. Each validates its input, then hands off to the data and science layers."""

from __future__ import annotations

import asyncio
import json
from datetime import UTC, datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Query, Request
from pydantic import BaseModel, Field

from .. import __version__
from ..archive import sia
from ..archive.frames import group_passes, normalise
from ..archive.keys import FrameKey
from ..archive.meta import META_TTL_S, meta_from_header
from ..cache import cache_key
from ..errors import InvalidQuery
from ..resolve import coords, sesame
from ..resolve.target import deep_field_at, describe
from ..science.cutout import PIPELINE_VERSION, build_payload, fetch_window
from ..science.grid import Grid, make_grid
from ..science.moving import moving_candidates
from ..science.sources import ALGORITHM_VERSION
from ..services import Services
from ..solar_system.known import known_objects

router = APIRouter()

Source = Literal["live", "snapshot"]
RA = Annotated[float, Query(ge=0, lt=360, description="Right ascension, ICRS degrees")]
DEC = Annotated[float, Query(ge=-90, le=90, description="Declination, ICRS degrees")]
DAY = 86400.0


def services(request: Request) -> Services:
    svc: Services = request.app.state.services
    return svc


def _client(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _now() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


@router.get("/health")
async def health(request: Request) -> dict[str, object]:
    svc = services(request)
    return {
        "status": "ok",
        "version": __version__,
        "snapshotAvailable": svc.settings.snapshot_dir.is_dir(),
    }


@router.get("/resolve")
async def resolve(
    request: Request,
    q: Annotated[str, Query(min_length=1, max_length=120)],
    source: Source = "live",
) -> dict[str, Any]:
    """An object name or a coordinate string → a sky position with context."""
    svc = services(request)
    text = q.strip()
    position = coords.parse(text)
    if position is not None:
        return {
            "query": text,
            "name": None,
            "kind": None,
            "otype": None,
            "resolver": "coordinates" if position.system == "icrs" else "galactic coordinates",
            **describe(position.ra, position.dec),
        }
    svc.limiter.check(_client(request))

    async def compute() -> dict[str, Any]:
        hit = await sesame.resolve_name(svc.client, svc.settings.sesame_url, text)
        return {
            "query": text,
            "name": hit.name,
            "kind": hit.kind,
            "otype": hit.otype,
            "resolver": hit.resolver,
            **describe(hit.ra, hit.dec),
        }

    return await svc.store.get_or_compute(
        "resolve", cache_key(text.lower()), compute, ttl_s=7 * DAY, source=source
    )


@router.get("/observations")
async def observations(
    request: Request,
    ra: RA,
    dec: DEC,
    source: Source = "live",
    deep_start: Annotated[float | None, Query(alias="deepStart", ge=60700, le=70000)] = None,
    deep_end: Annotated[float | None, Query(alias="deepEnd", ge=60700, le=70000)] = None,
) -> dict[str, Any]:
    """Every SPHEREx frame that covers the position, grouped into survey passes.

    Deep-survey frames (tens of thousands at the ecliptic poles) are included only for an explicit
    window of at most 31 days, given as MJD ``deepStart``/``deepEnd``.
    """
    svc = services(request)
    settings = svc.settings
    field = deep_field_at(ra, dec)
    deep_window: tuple[float, float] | None = None
    if deep_start is not None or deep_end is not None:
        if deep_start is None or deep_end is None or not 0 < deep_end - deep_start <= 31:
            raise InvalidQuery(
                "A deep-survey window needs deepStart and deepEnd at most 31 days apart."
            )
        if field is None:
            raise InvalidQuery("This position is not inside a SPHEREx deep field.")
        deep_window = (deep_start, deep_end)

    async def compute() -> dict[str, Any]:
        svc.limiter.check(_client(request), cost=2)
        jobs = [sia.search(svc.client, settings.sia_url, settings.wide_collections, ra, dec)]
        if deep_window is not None:
            jobs.append(
                sia.search(
                    svc.client,
                    settings.sia_url,
                    settings.deep_collections,
                    ra,
                    dec,
                    time_range=deep_window,
                )
            )
        results = await asyncio.gather(*jobs)
        rows = [row for result in results for row in result]
        frames = normalise(rows, ra, dec)
        passes = group_passes(frames)
        detectors: dict[str, int] = {}
        for frame in frames:
            detectors[str(frame.detector)] = detectors.get(str(frame.detector), 0) + 1
        return {
            "target": describe(ra, dec),
            "collections": settings.wide_collections
            + (settings.deep_collections if deep_window else []),
            "deepField": {"name": field.name, "window": deep_window} if field else None,
            "frames": [f.to_json() for f in frames],
            "passes": passes,
            "summary": {
                "frames": len(frames),
                "passes": len(passes),
                "detectors": detectors,
                "first": frames[0].isoMid if frames else None,
                "last": frames[-1].isoMid if frames else None,
            },
            "retrievedAt": _now(),
            "wavelengthNote": (
                "Wavelengths here are estimated from each image's footprint (within a few nm). "
                "The exact value is read from the frame's own WCS when its pixels load."
            ),
        }

    key = cache_key(ra, dec, settings.wide_collections, deep_window)
    return await svc.store.get_or_compute(
        "observations", key, compute, ttl_s=6 * 3600, source=source
    )


@router.get("/cutout")
async def cutout(
    request: Request,
    key: Annotated[str, Query(min_length=20, max_length=200)],
    ra: RA,
    dec: DEC,
    size: Annotated[float, Query(ge=0.03, description="Field of view, degrees")] = 0.2,
    source: Source = "live",
) -> dict[str, Any]:
    """One frame, aligned onto a north-up grid centred on ``(ra, dec)``, with measurements."""
    svc = services(request)
    if size > svc.settings.max_cutout_deg:
        raise InvalidQuery(f"The field of view can be at most {svc.settings.max_cutout_deg}°.")
    frame = FrameKey.parse(key)
    grid = make_grid(ra, dec, size)
    return await _cutout(svc, request, frame, grid, source)


async def _cutout(
    svc: Services, request: Request, frame: FrameKey, grid: Grid, source: Source
) -> dict[str, Any]:
    async def compute() -> dict[str, Any]:
        svc.limiter.check(_client(request))
        window = await fetch_window(svc, frame, grid)
        payload = await asyncio.to_thread(build_payload, frame, grid, window)
        payload["retrievedAt"] = _now()
        # The header facts the known-object check needs come free with the pixels.
        await asyncio.to_thread(
            svc.store.put, "meta", frame.key, meta_from_header(frame, window.header), META_TTL_S
        )
        return payload

    ck = cache_key(frame.key, grid.ra, grid.dec, grid.size_px, PIPELINE_VERSION)
    return await svc.store.get_or_compute("cutout", ck, compute, ttl_s=30 * DAY, source=source)


MEASURE_FIELD_DEG = 0.05


@router.get("/measure")
async def measure(
    request: Request,
    key: Annotated[str, Query(min_length=20, max_length=200)],
    ra: RA,
    dec: DEC,
    source: Source = "live",
) -> dict[str, Any]:
    """Wavelength, time and aperture brightness at ``(ra, dec)`` in one frame, without pixels.

    Reads only a 0.05° window (about 30 rows of the file), so a whole pass of frames across all
    six detectors can be measured quickly to build up the target's spectrum.
    """
    svc = services(request)
    frame = FrameKey.parse(key)
    grid = make_grid(ra, dec, MEASURE_FIELD_DEG)

    async def compute() -> dict[str, Any]:
        svc.limiter.check(_client(request), cost=0.5)
        window = await fetch_window(svc, frame, grid)
        payload = await asyncio.to_thread(build_payload, frame, grid, window)
        return {
            "key": payload["key"],
            "obsId": payload["obsId"],
            "detector": payload["detector"],
            "release": payload["release"],
            "time": payload["time"],
            "wavelength": payload["wavelength"],
            "target": payload["target"],
            "photometry": payload["photometry"],
            "background": payload["background"],
            "retrievedAt": _now(),
        }

    ck = cache_key(frame.key, grid.ra, grid.dec, PIPELINE_VERSION)
    return await svc.store.get_or_compute("measure", ck, compute, ttl_s=30 * DAY, source=source)


class KnownObjectsRequest(BaseModel):
    ra: float = Field(ge=0, lt=360)
    dec: float = Field(ge=-90, le=90)
    size: float = Field(ge=0.03, le=0.5, description="Field of view, degrees")
    keys: list[str] = Field(min_length=1, max_length=60)
    vmagLimit: float = Field(default=20.0, ge=10, le=22)


@router.post("/known-objects")
async def known(
    request: Request, body: KnownObjectsRequest, source: Source = "live"
) -> dict[str, Any]:
    """Catalogued asteroids and comets that crossed the field, with predicted positions per frame.

    The first request for a field takes about a minute, because JPL integrates orbits.
    """
    svc = services(request)
    keys = sorted({FrameKey.parse(k).key for k in body.keys})

    async def compute() -> dict[str, Any]:
        svc.limiter.check(_client(request), cost=10)
        result = await known_objects(svc, body.ra, body.dec, body.size, keys, body.vmagLimit)
        result["retrievedAt"] = _now()
        return result

    ck = cache_key(body.ra, body.dec, body.size, keys, body.vmagLimit)
    return await svc.store.get_or_compute("known", ck, compute, ttl_s=30 * DAY, source=source)


class CandidatesRequest(BaseModel):
    ra: float = Field(ge=0, lt=360)
    dec: float = Field(ge=-90, le=90)
    size: float = Field(ge=0.03, le=0.5)
    keys: list[str] = Field(min_length=2, max_length=60)


@router.post("/candidates")
async def candidates(
    request: Request, body: CandidatesRequest, source: Source = "live"
) -> dict[str, Any]:
    """Candidate moving sources in a pass, found by our own simple search (not by JPL)."""
    svc = services(request)
    frames = [FrameKey.parse(k) for k in sorted(set(body.keys))]
    grid = make_grid(body.ra, body.dec, body.size)

    async def compute() -> dict[str, Any]:
        payloads = await asyncio.gather(*(_cutout(svc, request, f, grid, source) for f in frames))
        result = await asyncio.to_thread(moving_candidates, grid, payloads)
        result["retrievedAt"] = _now()
        return result

    ck = cache_key(
        body.ra,
        body.dec,
        grid.size_px,
        [f.key for f in frames],
        PIPELINE_VERSION,
        ALGORITHM_VERSION,
    )
    return await svc.store.get_or_compute("candidates", ck, compute, ttl_s=30 * DAY, source=source)


@router.get("/cases")
async def cases(request: Request) -> dict[str, Any]:
    """The curated Discover cases, built from live data by ``scripts/build_cases.py``."""
    svc = services(request)
    path = svc.settings.cases_file
    try:
        data: dict[str, Any] = await asyncio.to_thread(lambda: json.loads(path.read_text()))
    except FileNotFoundError:
        return {"built": None, "cases": []}
    return data
