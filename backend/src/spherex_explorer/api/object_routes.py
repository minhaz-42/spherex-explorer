"""Routes for catalogued objects: SIMBAD facts at a position or in a field, CatWISE2020's moving
sources, survey images and old photographic plates of the field.

The browser may talk only to this app (``connect-src 'self'``, ``img-src 'self'``), so these proxy
CDS and STScI services, with the same validation, rate limiting, caching and snapshot rules as the
other routes.
"""

from __future__ import annotations

import asyncio
import base64
import logging
from typing import Annotated, Any

from fastapi import APIRouter, Query, Request, Response

from ..errors import UpstreamError
from ..objects import catwise, images, plates, simbad, skyview
from . import compute
from .cachekeys import field_objects_key, movers_key, object_image_key, plate_key
from .routes import DAY, DEC, RA, Source, services

router = APIRouter()
log = logging.getLogger("spherex_explorer")

IMAGE_CACHE_CONTROL = "public, max-age=604800"
# A plate is a large, slow download for STScI, so it costs more of a visitor's allowance.
PLATE_COST = 5


def _client(request: Request) -> str:
    return request.client.host if request.client else "unknown"


@router.get("/object")
async def object_at(
    request: Request,
    ra: RA,
    dec: DEC,
    radius: Annotated[
        float, Query(gt=0, le=0.05, description="Search radius, degrees")
    ] = simbad.DEFAULT_RADIUS_DEG,
    source: Source = "live",
) -> dict[str, Any]:
    """The most-studied SIMBAD object within ``radius`` of the position, with its main facts.

    Most-studied (most references) means a position resolved from "M31" gives M 31 itself rather
    than a faint star beside it. When nothing is catalogued within the radius the answer is
    ``{"object": null, "message": ...}``, an ordinary answer that is cached like the rest.
    """
    return await compute.object_entry(services(request), ra, dec, radius, source, _client(request))


@router.get("/field-objects")
async def field_objects(
    request: Request,
    ra: RA,
    dec: DEC,
    radius: Annotated[float, Query(gt=0, le=0.5, description="Cone radius, degrees")] = 0.15,
    limit: Annotated[int, Query(ge=1, le=60, description="Most objects to return")] = 25,
    source: Source = "live",
) -> dict[str, Any]:
    """The most-studied SIMBAD objects in a cone, for a "catalogued objects in view" list."""
    svc = services(request)

    async def compute() -> dict[str, Any]:
        svc.limiter.check(_client(request))
        return await simbad.field_objects(
            svc.client, svc.settings.simbad_tap_url, ra, dec, radius, limit
        )

    key = field_objects_key(ra, dec, radius, limit)
    return await svc.store.get_or_compute(
        "field-objects", key, compute, ttl_s=7 * DAY, source=source
    )


@router.get("/movers")
async def movers(
    request: Request,
    ra: RA,
    dec: DEC,
    radius: Annotated[float, Query(gt=0, le=0.5, description="Cone radius, degrees")] = 0.15,
    source: Source = "live",
) -> dict[str, Any]:
    """Catalogued moving stars and brown dwarfs in a cone, from CatWISE2020 (NASA WISE/NEOWISE).

    Positions are at the catalogue's epoch (``epochMjd``, 2015.4) with motions in arcsec/yr, so
    the viewer can move each one to the date of the frame on screen.
    """
    svc = services(request)
    # A 6′ cone and a 21′ one cost IRSA about the same; snap so nearby views share an answer.
    snapped = (round(ra, 3), round(dec, 3), round(radius, 2))

    async def compute() -> dict[str, Any]:
        svc.limiter.check(_client(request))
        return await catwise.field_movers(svc.client, svc.settings.irsa_tap_url, *snapped)

    return await svc.store.get_or_compute(
        "movers", movers_key(*snapped), compute, ttl_s=30 * DAY, source=source
    )


@router.get(
    "/object-image",
    response_class=Response,
    responses={200: {"content": {"image/jpeg": {}}, "description": "A JPEG of that patch of sky"}},
)
async def object_image(
    request: Request,
    ra: RA,
    dec: DEC,
    fov: Annotated[float, Query(ge=0.02, le=5, description="Field of view, degrees")],
    survey: Annotated[images.SurveyName, Query(description="dss, 2mass or wise")],
    size: Annotated[int, Query(ge=64, le=512, description="Width and height, pixels")] = 256,
    source: Source = "live",
) -> Response:
    """A colour survey image of the field (DSS2, 2MASS or AllWISE).

    From NASA SkyView, built here from its single-band images; if SkyView fails, the ready-made
    colour JPEG from CDS hips2fits. The ``X-Image-Credit`` header says which.
    """
    svc = services(request)
    wanted = images.quantise(ra, dec, fov, survey, size)

    async def compute() -> dict[str, Any]:
        svc.limiter.check(_client(request))
        facts = {
            "survey": wanted.survey,
            "ra": wanted.ra,
            "dec": wanted.dec,
            "fov": wanted.fov,
            "size": wanted.size,
            "projection": wanted.projection,
        }
        try:
            png = await skyview.fetch_png(svc.client, svc.settings.skyview_url, wanted)
            return {
                **facts,
                "png": base64.b64encode(png).decode("ascii"),
                "credit": skyview.CREDITS[wanted.survey],
            }
        except UpstreamError as exc:
            log.warning("NASA SkyView failed (%s); trying CDS hips2fits", exc.message)
        jpeg = await images.fetch_jpeg(svc.client, svc.settings.hips2fits_url, wanted)
        return {
            **facts,
            "hips": images.SURVEYS[wanted.survey].hips,
            "jpeg": base64.b64encode(jpeg).decode("ascii"),
            "credit": images.SURVEYS[wanted.survey].credit,
        }

    key = object_image_key(ra, dec, fov, survey, size)
    stored = await svc.store.get_or_compute(
        "object-image", key, compute, ttl_s=30 * DAY, source=source
    )
    # Answers cached before SkyView was added hold a hips2fits JPEG and no credit.
    png = "png" in stored
    return Response(
        content=base64.b64decode(stored["png"] if png else stored["jpeg"]),
        media_type="image/png" if png else "image/jpeg",
        headers={
            "Cache-Control": IMAGE_CACHE_CONTROL,
            "X-Image-Credit": stored.get("credit", images.SURVEYS[wanted.survey].credit),
        },
    )


@router.get("/plate")
async def plate(
    request: Request,
    ra: RA,
    dec: DEC,
    fov: Annotated[float, Query(ge=0.05, le=1.0, description="Field of view, degrees")],
    survey: Annotated[plates.PlateSurvey, Query(description="poss1 (1950s) or poss2 (1980s-90s)")],
    size: Annotated[int, Query(ge=128, le=512, description="Width and height, pixels")] = 384,
    source: Source = "live",
) -> dict[str, Any]:
    """One scanned photographic plate of the field (Digitized Sky Survey), north up, as a PNG.

    The first request for a field can take 10–30 s while STScI cuts the plate; plates never
    change, so the answer is kept for a year.
    """
    svc = services(request)
    wanted = plates.quantise(ra, dec, fov, survey, size)

    async def compute() -> dict[str, Any]:
        svc.limiter.check(_client(request), cost=PLATE_COST)
        raw = await plates.fetch_fits(svc.client, svc.settings.dss_url, wanted)
        return await asyncio.to_thread(plates.plate_json, raw, wanted)

    key = plate_key(ra, dec, fov, survey, size)
    return await svc.store.get_or_compute("plate", key, compute, ttl_s=365 * DAY, source=source)
