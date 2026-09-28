"""Photographic plates of a field from the STScI Digitized Sky Survey (DSS).

``GET https://archive.stsci.edu/cgi-bin/dss_search?v=poss1_red&r=269.452083&d=4.693364&e=J2000&
h=2&w=2&f=fits&c=none`` answers a FITS cutout (``h`` × ``w`` arcminutes) of one scanned plate:
``poss1_red`` is the first Palomar survey (POSS-I, 1.7″ pixels), ``poss2ukstu_red`` the second-epoch
red surveys (POSS-II in the north, the UK Schmidt's AAO-SES and SERC-ER in the south, 1.0″ pixels).
Outside a survey's coverage it answers HTTP 200 with an HTML error page. A 1° cutout is 9 MB
(POSS-I) to 26 MB (POSS-II) and takes 10–30 s, so downloads are capped and given a deadline.

The header names the plate and when it was exposed. Its ``DATE-OBS`` can have minutes above 59
(``1950-07-09T06:75:00``, a known DSS quirk), so only the date is kept. The cutout carries a linear
TAN WCS fitted by STScI, which agrees with the full plate solution to under 1″ across a degree.

For display the plate is resampled through that WCS onto a north-up, east-left grid of
``size`` × ``size`` pixels (block-averaged first when shrinking, so plate grain and faint stars
are averaged rather than aliased), stretched linearly between its 1st and 99.7th percentiles, and
written as an 8-bit greyscale PNG with the standard library.
"""

from __future__ import annotations

import asyncio
import base64
import io
import re
import struct
import zlib
from dataclasses import dataclass
from typing import Any, Literal

import httpx
import numpy as np
from astropy.io import fits
from astropy.wcs.utils import proj_plane_pixel_scales
from numpy.typing import NDArray
from scipy import ndimage

from ..errors import NotFound, UpstreamError, UpstreamTimeout
from ..http import upstream
from ..science.grid import Grid, grid_to_source, sky_wcs
from .images import snap_size, snap_view

SERVICE = "STScI Digitized Sky Survey"
CREDIT = "Digitized Sky Survey (STScI/AURA; Palomar Observatory, Caltech; UK Schmidt Telescope)"
# The whole request, download included; STScI takes 10–30 s for a large field.
TIMEOUT_S = 90.0
# A 1° POSS-II cutout, with the margin below, is about 29 MB.
MAX_BYTES = 40_000_000
# Cutout side / displayed side: room to turn a slightly rotated plate north up.
MARGIN = 1.06
MAX_CUTOUT_ARCMIN = 64.0
SIZES = (128, 192, 256, 384, 512)
# Bump when the resampling or the stretch changes, so cached PNGs are rebuilt.
RENDER_VERSION = 1

PlateSurvey = Literal["poss1", "poss2"]
DSS_SURVEYS: dict[PlateSurvey, str] = {"poss1": "poss1_red", "poss2": "poss2ukstu_red"}

# The header's SURVEY keyword → the survey's usual name and its band (emulsion letter).
_SURVEY_LABELS = {
    "POSSI-E": ("POSS-I", "red (E)"),
    "POSSII-F": ("POSS-II", "red (F)"),
    "SERC-ER": ("SERC-ER", "red (R)"),
    "AAO-SES": ("AAO-SES", "red (R)"),
}
_DATE = re.compile(r"\d{4}-\d{2}-\d{2}")


@dataclass(frozen=True)
class PlateRequest:
    ra: float
    dec: float
    fov: float
    survey: PlateSurvey
    size: int

    def params(self) -> dict[str, str]:
        side = f"{min(self.fov * 60 * MARGIN, MAX_CUTOUT_ARCMIN):.2f}"
        return {
            "v": DSS_SURVEYS[self.survey],
            "r": f"{self.ra:.5f}",
            "d": f"{self.dec:.5f}",
            "e": "J2000",
            "h": side,
            "w": side,
            "f": "fits",
            "c": "none",
        }


def quantise(ra: float, dec: float, fov: float, survey: PlateSurvey, size: int) -> PlateRequest:
    """Snap a request to the same grid as the survey images, sizes to :data:`SIZES`."""
    q_ra, q_dec, q_fov = snap_view(ra, dec, fov)
    return PlateRequest(q_ra, q_dec, q_fov, survey, snap_size(size, SIZES))


# --- download --------------------------------------------------------------------------------


async def _read_capped(response: httpx.Response) -> bytes:
    declared = response.headers.get("content-length", "")
    if declared.isdigit() and int(declared) > MAX_BYTES:
        raise UpstreamError(SERVICE, "The plate cutout was too large.", detail=f"{declared} bytes")
    chunks: list[bytes] = []
    received = 0
    async for chunk in response.aiter_bytes():
        received += len(chunk)
        if received > MAX_BYTES:
            raise UpstreamError(SERVICE, "The plate cutout was too large.", detail=f">{MAX_BYTES}")
        chunks.append(chunk)
    return b"".join(chunks)


async def fetch_fits(client: httpx.AsyncClient, url: str, request: PlateRequest) -> bytes:
    """The FITS cutout, or :class:`NotFound` when the survey has no plate of the position."""
    try:
        async with asyncio.timeout(TIMEOUT_S), upstream(SERVICE):
            stream = client.stream("GET", url, params=request.params(), timeout=TIMEOUT_S)
            async with stream as response:
                if response.status_code >= 400:
                    await response.aread()  # so the error can quote the body
                response.raise_for_status()
                body = await _read_capped(response)
    except TimeoutError as exc:
        raise UpstreamTimeout(
            SERVICE,
            "The Digitized Sky Survey took too long to send this plate. "
            "Try again, or ask for a smaller field of view.",
        ) from exc
    if body.startswith(b"SIMPLE  ="):
        return body
    if b"not available" in body[:4096]:
        message = f"The Digitized Sky Survey has no {request.survey} plate of this position."
        if request.survey == "poss1":
            message += " POSS-I did not reach the far southern sky; try poss2."
        raise NotFound(message)
    raise UpstreamError(
        SERVICE,
        "The Digitized Sky Survey did not send a FITS image.",
        detail=body[:300].decode("latin-1"),
    )


# --- the plate -------------------------------------------------------------------------------


def read_plate(raw: bytes) -> tuple[fits.Header, NDArray[np.float32]]:
    try:
        with fits.open(io.BytesIO(raw)) as hdul:
            header = hdul[0].header.copy()
            data = hdul[0].data
            image = None if data is None else np.asarray(data, dtype=np.float32)
    except (OSError, ValueError) as exc:
        raise UpstreamError(
            SERVICE, "The plate cutout could not be read.", detail=str(exc)
        ) from exc
    if image is None or image.ndim != 2 or min(image.shape) < 2:
        raise UpstreamError(SERVICE, "The plate cutout held no image.")
    return header, image


def _text(header: fits.Header, key: str) -> str:
    return str(header.get(key, "")).strip()


def plate_facts(header: fits.Header) -> dict[str, Any]:
    """Which survey and plate, and when: from the DSS header keywords."""
    survey = _text(header, "SURVEY")
    label, band = _SURVEY_LABELS.get(survey, (survey or None, "red"))
    epoch = _DATE.match(_text(header, "DATE-OBS"))
    exposure = header.get("EXPOSURE")
    return {
        "label": label,
        "band": band,
        "epoch": epoch.group(0) if epoch else None,
        "plate": _text(header, "PLTLABEL") or None,
        # DSS cuts TELESCOP at 18 characters ("Oschin Schmidt - D", "UK Schmidt - Doubl"); the
        # part before " - " is the telescope's name.
        "telescope": _text(header, "TELESCOP").split(" - ")[0].strip() or None,
        "exposureMin": float(exposure) if isinstance(exposure, int | float) else None,
    }


def _block_mean(image: NDArray[np.float32], k: int) -> NDArray[np.float32]:
    h, w = image.shape[0] // k * k, image.shape[1] // k * k
    return image[:h, :w].reshape(h // k, k, w // k, k).mean(axis=(1, 3), dtype=np.float32)


def resample(
    header: fits.Header, image: NDArray[np.float32], request: PlateRequest
) -> NDArray[np.float32]:
    """The plate on a north-up, east-left TAN grid, rows running south to north (FITS order).

    NaN where the cutout does not reach. The WCS decides the orientation, so a plate stored
    mirrored or rotated comes out the same way round.
    """
    plate_wcs = sky_wcs(header)
    grid = Grid(request.ra, request.dec, request.size, request.fov * 3600 / request.size)
    plate_arcsec = float(np.mean(proj_plane_pixel_scales(plate_wcs))) * 3600
    k = max(int(grid.scale_arcsec / plate_arcsec), 1)
    binned = _block_mean(image, k) if k > 1 else image
    n = request.size
    gy, gx = np.mgrid[0:n, 0:n].astype(np.float64)
    sx, sy = grid_to_source(grid, plate_wcs, gx.ravel(), gy.ravel())
    # Binned pixel i covers plate pixels k·i … k·i + k − 1.
    bx, by = (sx - (k - 1) / 2) / k, (sy - (k - 1) / 2) / k
    h, w = binned.shape
    inside = (bx >= -0.5) & (bx <= w - 0.5) & (by >= -0.5) & (by <= h - 0.5)
    coords = np.vstack([np.clip(by, 0, h - 1), np.clip(bx, 0, w - 1)])
    values = ndimage.map_coordinates(binned, coords, order=1, mode="nearest")
    return np.where(inside, values, np.nan).reshape(n, n).astype(np.float32)


def stretch(values: NDArray[np.float32]) -> NDArray[np.uint8]:
    """Linear between the 1st and 99.7th percentiles; black where there is no data."""
    finite = values[np.isfinite(values)]
    if finite.size == 0:
        return np.zeros(values.shape, dtype=np.uint8)
    lo, hi = (float(v) for v in np.percentile(finite, [1, 99.7]))
    scaled = np.clip((values - lo) / max(hi - lo, 1e-6), 0, 1)
    return np.where(np.isfinite(scaled), np.round(scaled * 255), 0).astype(np.uint8)


def png_grey(pixels: NDArray[np.uint8]) -> bytes:
    """An 8-bit greyscale PNG (colour type 0, filter 0 on every row), top row first."""
    height, width = pixels.shape
    rows = np.hstack([np.zeros((height, 1), dtype=np.uint8), pixels]).tobytes()

    def chunk(kind: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))
        )

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 0, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(rows, 9))
        + chunk(b"IEND", b"")
    )


def plate_json(raw: bytes, request: PlateRequest) -> dict[str, Any]:
    """The ``/api/plate`` answer from a DSS FITS cutout."""
    header, image = read_plate(raw)
    # FITS rows run south to north; a PNG starts at the top.
    pixels = stretch(resample(header, image, request))[::-1]
    png = base64.b64encode(png_grey(pixels)).decode("ascii")
    return {
        "survey": request.survey,
        **plate_facts(header),
        "png": f"data:image/png;base64,{png}",
        "credit": CREDIT,
    }
