"""The data the routes serve, computed without a request.

The routes and the assistant call the same functions, so they share the work, the cache keys, the
cache lifetimes and the rate-limit costs: a JPL check the assistant runs for a question is the one
the viewer's button would have run, and the other way round.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Any, Literal

from ..archive import sia
from ..archive.frames import group_passes, normalise
from ..archive.keys import FrameKey
from ..archive.meta import META_TTL_S, meta_from_header
from ..objects import simbad
from ..resolve import sesame
from ..resolve.target import deep_field_at, describe
from ..science.cutout import build_payload, fetch_window
from ..science.grid import Grid, make_grid
from ..science.moving import moving_candidates
from ..services import Services
from ..solar_system.known import known_objects
from .cachekeys import (
    candidates_key,
    cutout_key,
    known_key,
    object_key,
    observations_key,
    resolve_key,
)

Source = Literal["live", "snapshot"]
DAY = 86400.0


def now() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


async def resolve_name(svc: Services, text: str, source: Source, client: str) -> dict[str, Any]:
    """A name → a sky position with context, through CDS Sesame (cached 7 days)."""

    async def compute() -> dict[str, Any]:
        svc.limiter.check(client)
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
        "resolve", resolve_key(text), compute, ttl_s=7 * DAY, source=source
    )


async def observations(
    svc: Services,
    ra: float,
    dec: float,
    source: Source,
    client: str,
    deep_window: tuple[float, float] | None = None,
) -> dict[str, Any]:
    """Every SPHEREx frame covering the position, grouped into survey passes (cached 6 hours)."""
    settings = svc.settings
    field = deep_field_at(ra, dec)

    async def compute() -> dict[str, Any]:
        svc.limiter.check(client, cost=2)
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
            "retrievedAt": now(),
            "wavelengthNote": (
                "Wavelengths here are estimated from each image's footprint (within a few nm). "
                "The exact value is read from the frame's own WCS when its pixels load."
            ),
        }

    key = observations_key(ra, dec, settings.wide_collections, deep_window)
    return await svc.store.get_or_compute(
        "observations", key, compute, ttl_s=6 * 3600, source=source
    )


async def cutout(
    svc: Services, frame: FrameKey, grid: Grid, source: Source, client: str
) -> dict[str, Any]:
    """One frame aligned onto the target's grid, with measurements (cached 30 days)."""

    async def compute() -> dict[str, Any]:
        svc.limiter.check(client)
        window = await fetch_window(svc, frame, grid)
        payload = await asyncio.to_thread(build_payload, frame, grid, window)
        payload["retrievedAt"] = now()
        # The header facts the known-object check needs come free with the pixels.
        await asyncio.to_thread(
            svc.store.put, "meta", frame.key, meta_from_header(frame, window.header), META_TTL_S
        )
        return payload

    ck = cutout_key(frame.key, grid)
    return await svc.store.get_or_compute("cutout", ck, compute, ttl_s=30 * DAY, source=source)


async def known(
    svc: Services,
    ra: float,
    dec: float,
    size: float,
    keys: list[str],
    vmag_limit: float,
    source: Source,
    client: str,
) -> dict[str, Any]:
    """Catalogued asteroids and comets crossing the field, per frame, from JPL (cached 30 days).

    ``keys`` must already be parsed, de-duplicated and sorted.
    """

    async def compute() -> dict[str, Any]:
        svc.limiter.check(client, cost=10)
        result = await known_objects(svc, ra, dec, size, keys, vmag_limit)
        result["retrievedAt"] = now()
        return result

    ck = known_key(ra, dec, size, keys, vmag_limit)
    return await svc.store.get_or_compute("known", ck, compute, ttl_s=30 * DAY, source=source)


async def candidates(
    svc: Services, ra: float, dec: float, size: float, keys: list[str], source: Source, client: str
) -> dict[str, Any]:
    """This app's own moving-source search over a pass (cached 30 days)."""
    frames = [FrameKey.parse(k) for k in sorted(set(keys))]
    grid = make_grid(ra, dec, size)

    async def compute() -> dict[str, Any]:
        payloads = await asyncio.gather(*(cutout(svc, f, grid, source, client) for f in frames))
        result = await asyncio.to_thread(moving_candidates, grid, payloads)
        result["retrievedAt"] = now()
        return result

    ck = candidates_key(ra, dec, grid.size_px, [f.key for f in frames])
    return await svc.store.get_or_compute("candidates", ck, compute, ttl_s=30 * DAY, source=source)


async def object_at(
    svc: Services, ra: float, dec: float, source: Source, client: str
) -> dict[str, Any]:
    """The most-studied SIMBAD object at a position: the same entry /api/object caches."""
    radius = simbad.DEFAULT_RADIUS_DEG

    async def compute() -> dict[str, Any]:
        svc.limiter.check(client)
        return await simbad.object_at(svc.client, svc.settings.simbad_tap_url, ra, dec, radius)

    return await svc.store.get_or_compute(
        "object", object_key(ra, dec, radius), compute, ttl_s=7 * DAY, source=source
    )
