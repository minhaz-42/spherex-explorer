"""HTTP routes, all under /api."""

from __future__ import annotations

import httpx
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from . import __version__
from .coords import CoordinateError, parse_position
from .sesame import NameNotFound, resolve_name
from .sia import BANDS, query_all

router = APIRouter(prefix="/api")


class Health(BaseModel):
    status: str
    version: str


class Band(BaseModel):
    band: int
    min_um: float
    max_um: float
    resolving_power: int
    detector: str


class Resolved(BaseModel):
    query: str
    name: str | None
    ra: float
    dec: float
    frame: str  # what was typed: "icrs", "galactic" or "name"
    l: float | None = None
    b: float | None = None


class CollectionSummary(BaseModel):
    collection: str
    release: str
    survey: str
    count: int
    error: str | None


class FrameOut(BaseModel):
    obs_id: str
    collection: str
    release: str
    survey: str
    t_min_mjd: float
    time_utc: str
    em_min_um: float
    em_max_um: float
    band: int | None
    bandpass_name: str
    access_url: str
    cloud_access: str


class Frames(BaseModel):
    ra: float
    dec: float
    radius_deg: float
    count: int
    earliest_utc: str | None
    latest_utc: str | None
    collections: list[CollectionSummary]
    frames: list[FrameOut]


def _state(request: Request):
    return request.app.state


@router.get("/health", response_model=Health)
async def health() -> Health:
    return Health(status="ok", version=__version__)


@router.get("/bands", response_model=list[Band])
async def bands() -> list[Band]:
    return [
        Band(band=n, min_um=lo, max_um=hi, resolving_power=r, detector=d) for n, (lo, hi, r, d) in BANDS.items()
    ]


@router.get("/resolve", response_model=Resolved)
async def resolve(request: Request, q: str = Query(..., min_length=1, max_length=200)) -> Resolved:
    state = _state(request)
    key = f"resolve:{q.strip().lower()}"
    if (cached := state.cache.get(key)) is not None:
        return cached

    try:
        position = parse_position(q)
    except CoordinateError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if position is not None:
        result = Resolved(query=q, name=None, ra=position.ra, dec=position.dec, frame=position.frame,
                          l=position.l, b=position.b)
    else:
        try:
            ra, dec, name = await resolve_name(state.http, q, state.settings.upstream_timeout_s)
        except NameNotFound as exc:
            raise HTTPException(status_code=404, detail=f"No object called “{q.strip()}” was found. Check the spelling, or enter coordinates.") from exc
        except httpx.TimeoutException as exc:
            raise HTTPException(status_code=504, detail="The CDS name resolver didn't answer in time. Try again, or enter coordinates.") from exc
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail="Couldn't reach the CDS name resolver. Try again, or enter coordinates.") from exc
        result = Resolved(query=q, name=name, ra=ra, dec=dec, frame="name")

    state.cache.set(key, result, state.settings.resolve_ttl_s)
    return result


@router.get("/frames", response_model=Frames)
async def frames(
    request: Request,
    ra: float = Query(..., ge=0, lt=360),
    dec: float = Query(..., ge=-90, le=90),
    radius: float | None = Query(None, gt=0, le=0.5, description="Search radius in degrees"),
) -> Frames:
    state = _state(request)
    radius_deg = radius or state.settings.search_radius_deg
    key = f"frames:{ra:.6f}:{dec:.6f}:{radius_deg:.5f}"
    if (cached := state.cache.get(key)) is not None:
        return cached

    found, summary = await query_all(state.http, ra, dec, radius_deg, state.settings.upstream_timeout_s)
    if all(s.error for s in summary):
        raise HTTPException(status_code=502, detail=f"The SPHEREx archive couldn't be searched: {summary[0].error} Try again in a minute.")

    result = Frames(
        ra=ra,
        dec=dec,
        radius_deg=radius_deg,
        count=len(found),
        earliest_utc=found[0].time_utc if found else None,
        latest_utc=found[-1].time_utc if found else None,
        collections=[CollectionSummary(**vars(s)) for s in summary],
        frames=[FrameOut(**f.to_dict()) for f in found],
    )
    # Don't keep partial answers for long: a failed collection may recover.
    ttl = state.settings.frames_ttl_s if not any(s.error for s in summary) else 60.0
    state.cache.set(key, result, ttl)
    return result
