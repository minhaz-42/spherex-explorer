"""Survey images of a patch of sky, cut from all-sky HiPS surveys by the CDS hips2fits service.

``GET https://alasky.cds.unistra.fr/hips-image-services/hips2fits?hips=CDS/P/DSS2/color&width=256&
height=256&fov=0.5&projection=TAN&coordsys=icrs&ra=10.6847&dec=41.2688&format=jpg`` answers a JPEG,
or an HTTP 400 with a JSON reason. The page may show images only from this app
(``img-src 'self'``), so the backend fetches them, checks that they really are JPEGs and caches
them.

Requests are snapped to a coarse grid first, so that nearly identical views share one download.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Literal

import httpx

from ..errors import UpstreamError
from ..http import upstream

SERVICE = "CDS hips2fits image service"
TIMEOUT_S = 30.0
SIZES = (64, 128, 192, 256, 384, 512)
# A tangent-plane (TAN) view stretches visibly beyond a few degrees; SIN keeps wide fields natural.
SIN_ABOVE_DEG = 3.0

SurveyName = Literal["dss", "2mass", "wise"]


@dataclass(frozen=True)
class Survey:
    hips: str
    credit: str


SURVEYS: dict[SurveyName, Survey] = {
    "dss": Survey("CDS/P/DSS2/color", "DSS2 (STScI/AURA) via CDS hips2fits"),
    "2mass": Survey("CDS/P/2MASS/color", "2MASS (UMass/IPAC-Caltech, NASA/NSF) via CDS hips2fits"),
    "wise": Survey("CDS/P/allWISE/color", "AllWISE (NASA/JPL-Caltech/UCLA) via CDS hips2fits"),
}


@dataclass(frozen=True)
class ImageRequest:
    ra: float
    dec: float
    fov: float
    survey: SurveyName
    size: int

    @property
    def projection(self) -> str:
        return "SIN" if self.fov > SIN_ABOVE_DEG else "TAN"

    def params(self) -> dict[str, str]:
        return {
            "hips": SURVEYS[self.survey].hips,
            "width": str(self.size),
            "height": str(self.size),
            "fov": f"{self.fov:g}",
            "projection": self.projection,
            "coordsys": "icrs",
            "ra": f"{self.ra:.4f}",
            "dec": f"{self.dec:.4f}",
            "format": "jpg",
        }


def snap_view(ra: float, dec: float, fov: float) -> tuple[float, float, float]:
    """Position to 1e-4° (0.36″, far below a pixel) and field of view to three significant
    figures: the grid the image caches work on."""
    if not all(math.isfinite(v) for v in (ra, dec, fov)) or fov <= 0:
        raise ValueError("image requests need finite coordinates and a positive field of view")
    return round(ra, 4) % 360.0, min(max(round(dec, 4), -90.0), 90.0), float(f"{fov:.3g}")


def snap_size(size: int, sizes: tuple[int, ...] = SIZES) -> int:
    """Up to the next allowed size, so a snapped image is never smaller than the one asked for."""
    return next((s for s in sizes if s >= size), sizes[-1])


def quantise(ra: float, dec: float, fov: float, survey: SurveyName, size: int) -> ImageRequest:
    """Snap a request to the grid the cache works on (see :func:`snap_view`, :func:`snap_size`)."""
    q_ra, q_dec, q_fov = snap_view(ra, dec, fov)
    return ImageRequest(ra=q_ra, dec=q_dec, fov=q_fov, survey=survey, size=snap_size(size))


async def fetch_jpeg(client: httpx.AsyncClient, url: str, request: ImageRequest) -> bytes:
    async with upstream(SERVICE):
        response = await client.get(url, params=request.params(), timeout=TIMEOUT_S)
        response.raise_for_status()
    content_type = response.headers.get("content-type", "")
    # hips2fits sends JPEGs with a comment segment carrying the WCS, but always from the SOI marker.
    if not content_type.startswith("image/") or not response.content.startswith(b"\xff\xd8"):
        raise UpstreamError(
            SERVICE,
            "The sky image service did not send an image.",
            detail=f"content-type {content_type!r}, {len(response.content)} bytes",
        )
    return response.content
