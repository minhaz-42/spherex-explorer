"""Survey images of a patch of sky from NASA's SkyView (HEASARC, NASA Goddard), as colour PNGs.

``GET https://skyview.gsfc.nasa.gov/current/cgi/runquery.pl?position=269.452,4.693&survey=2MASS-K&
pixels=256&size=0.3&Return=FITS&coordinates=J2000&projection=Tan`` answers one band as a FITS image
on a north-up, east-left grid of ``pixels`` × ``pixels`` centred on the position. Asked for several
surveys at once it sends an empty image, so each band is its own request, made in parallel
(6–15 s each); the colour image is put together here:

- DSS2: the red plate as red, the blue plate as blue, their mean as green;
- 2MASS: Ks, H and J as red, green and blue;
- AllWISE: 4.6 µm (W2) as red, 3.4 µm (W1) as blue, their mean as green.

Each band is stretched on its own (asinh above the median sky, up to its 99.8th percentile), so the
sky comes out neutral and a star's colour shows its spectrum across the bands.

SkyView is the first source for the "same patch in other light" images; CDS hips2fits, which
serves ready-made colour JPEGs, is the fallback (see ``api/object_routes.py``).
"""

from __future__ import annotations

import asyncio
import io

import httpx
import numpy as np
from astropy.io import fits
from numpy.typing import NDArray

from ..errors import UpstreamError, UpstreamTimeout
from ..http import upstream
from .images import ImageRequest, SurveyName
from .plates import png_rgb

SERVICE = "NASA SkyView"
TIMEOUT_S = 60.0
# A 512 × 512 float image is 1 MB; anything far larger is not what was asked for.
MAX_BYTES = 4_000_000
# Bump when the bands or the stretch change, so cached images are rebuilt.
RENDER_VERSION = 1

# Red first, blue last; with two bands the green is their mean.
BANDS: dict[SurveyName, tuple[str, ...]] = {
    "dss": ("DSS2 Red", "DSS2 Blue"),
    "2mass": ("2MASS-K", "2MASS-H", "2MASS-J"),
    "wise": ("WISE 4.6", "WISE 3.4"),
}
CREDITS: dict[SurveyName, str] = {
    "dss": "DSS2 (STScI/AURA) via NASA SkyView",
    "2mass": "2MASS (UMass/IPAC-Caltech, NASA/NSF) via NASA SkyView",
    "wise": "AllWISE (NASA/JPL-Caltech/UCLA) via NASA SkyView",
}
# How hard the faint end is lifted: smaller shows fainter stars and more noise.
SOFTENING = 0.08
# The stretch's top is never less than this many noise sigmas above the sky.
NOISE_FLOOR = 15.0


def params(request: ImageRequest, band: str) -> dict[str, str]:
    return {
        "position": f"{request.ra:.4f},{request.dec:.4f}",
        "survey": band,
        "pixels": str(request.size),
        "size": f"{request.fov:g}",
        "Return": "FITS",
        "coordinates": "J2000",
        "projection": request.projection.title(),
    }


async def fetch_band(
    client: httpx.AsyncClient, url: str, request: ImageRequest, band: str
) -> NDArray[np.float32]:
    """One band as a ``size`` × ``size`` array, rows running south to north (FITS order)."""
    try:
        async with asyncio.timeout(TIMEOUT_S), upstream(SERVICE):
            response = await client.get(url, params=params(request, band), timeout=TIMEOUT_S)
            response.raise_for_status()
    except TimeoutError as exc:
        raise UpstreamTimeout(SERVICE, f"{SERVICE} took too long to send {band}.") from exc
    body = response.content
    if len(body) > MAX_BYTES or not body.startswith(b"SIMPLE  ="):
        raise UpstreamError(
            SERVICE,
            f"{SERVICE} did not send a FITS image for {band}.",
            detail=f"content-type {response.headers.get('content-type', '')!r}, {len(body)} bytes",
        )
    return await asyncio.to_thread(read_band, body, request.size, band)


def read_band(raw: bytes, size: int, band: str) -> NDArray[np.float32]:
    try:
        with fits.open(io.BytesIO(raw)) as hdul:
            data = hdul[0].data
            image = None if data is None else np.asarray(data, dtype=np.float32)
    except (OSError, ValueError) as exc:
        raise UpstreamError(
            SERVICE, f"The {band} image could not be read.", detail=str(exc)
        ) from exc
    # An empty answer (a 1 × 1 image) is how SkyView says it could not make the image.
    if image is None or image.shape != (size, size):
        shape = None if image is None else image.shape
        raise UpstreamError(
            SERVICE, f"{SERVICE} sent no {band} image here.", detail=f"shape {shape}"
        )
    return image


def stretch(values: NDArray[np.float32]) -> NDArray[np.float32]:
    """0–1: asinh above the median sky up to the 99.8th percentile; 0 where there is no data.

    The top is at least 15 noise sigmas above the sky (from the median absolute deviation), so a
    field with hardly a star in it does not turn its noise up to white.
    """
    finite = values[np.isfinite(values)]
    if finite.size == 0:
        return np.zeros(values.shape, dtype=np.float32)
    sky = float(np.median(finite))
    sigma = 1.4826 * float(np.median(np.abs(finite - sky)))
    top = max(float(np.percentile(finite, 99.8)), sky + NOISE_FLOOR * sigma)
    x = (values - sky) / max(top - sky, 1e-6)
    y = np.arcsinh(np.maximum(x, 0) / SOFTENING) / np.arcsinh(1 / SOFTENING)
    return np.where(np.isfinite(y), np.clip(y, 0, 1), 0).astype(np.float32)


def colour(bands: list[NDArray[np.float32]]) -> NDArray[np.uint8]:
    """Red, (green,) blue bands → an RGB image, top row first."""
    stretched = [stretch(b) for b in bands]
    if len(stretched) == 2:
        red, blue = stretched
        stretched = [red, ((red + blue) / 2).astype(np.float32), blue]
    rgb = np.stack(stretched, axis=-1)[::-1]
    return np.round(rgb * 255).astype(np.uint8)


async def fetch_png(client: httpx.AsyncClient, url: str, request: ImageRequest) -> bytes:
    """The colour image of the request's field, as a PNG."""
    bands = await asyncio.gather(
        *(fetch_band(client, url, request, band) for band in BANDS[request.survey])
    )
    pixels = await asyncio.to_thread(colour, list(bands))
    return png_rgb(pixels)
