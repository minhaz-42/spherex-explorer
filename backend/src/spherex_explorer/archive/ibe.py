"""Fallback: IRSA's own cutout service (IBE), used when S3 range reads fail.

IBE returns a multi-extension FITS trimmed to the region, with WCS keywords adjusted to the cutout.
It is slower and larger than range reads (it always includes the whole PSF extension, about 4–5
MB), but it is IRSA's supported path. We convert its headers back to parent-image coordinates so
the rest of the pipeline treats both sources the same way.
"""

from __future__ import annotations

import io
import warnings

import httpx
import numpy as np
from astropy.io import fits
from astropy.utils.exceptions import AstropyWarning

from ..errors import UpstreamError
from ..http import upstream
from .level2 import Level2Window, Window, flag_bits_from_header, release_of
from .spectral import SpectralTable

SERVICE = "IRSA cutout service"


async def read_ibe_window(
    client: httpx.AsyncClient, url: str, ra: float, dec: float, size_deg: float
) -> Level2Window:
    async with upstream(SERVICE):
        response = await client.get(
            url, params={"center": f"{ra:.7f},{dec:.7f}", "size": f"{size_deg:.5f}"}
        )
        response.raise_for_status()
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", AstropyWarning)
            hdul = fits.open(io.BytesIO(response.content), memmap=False)
            image_hdu = hdul["IMAGE"]
            header = image_hdu.header.copy()
            image = np.asarray(image_hdu.data, dtype=np.float32)
            flags = np.asarray(hdul["FLAGS"].data, dtype=np.int32)
            variance = np.asarray(hdul["VARIANCE"].data, dtype=np.float32)
            zodi_plane = np.asarray(hdul["ZODI"].data, dtype=np.float32)
            spectral = SpectralTable.from_hdu(hdul["WCS-WAVE"])
            flag_bits = flag_bits_from_header(hdul["FLAGS"].header)
            pipeline = str(hdul[0].header.get("VERSION", "")).strip() or None
    except (KeyError, OSError, ValueError, TypeError) as exc:
        raise UpstreamError(
            SERVICE, "The cutout service returned an unreadable file.", detail=str(exc)
        ) from exc

    # Alternate WCS "A" gives 0-based parent-pixel coordinates: x_parent = p - CRPIX1A (p 1-based).
    x0 = round(1 - float(header.get("CRPIX1A", 1.0)))
    y0 = round(1 - float(header.get("CRPIX2A", 1.0)))
    for key, shift in (
        ("CRPIX1", x0),
        ("CRPIX2", y0),
        ("CRPIX1W", x0),
        ("CRPIX2W", y0),
        ("CRPIX1A", x0),
        ("CRPIX2A", y0),
    ):
        if key in header:
            header[key] = float(header[key]) + shift
    h, w = image.shape
    window = Window(x0, y0, x0 + w, y0 + h)
    zodi = float(np.nanmedian(zodi_plane[h // 2])) if np.isfinite(zodi_plane).any() else None
    return Level2Window(
        header=header,
        window=window,
        image=image,
        flags=flags,
        variance=variance,
        variance_y0=y0,
        zodi=zodi,
        spectral=spectral,
        flag_bits=flag_bits,
        release=release_of(url.split("/ibe/data/spherex/", 1)[-1]),
        access="ibe",
        pipeline=pipeline,
        requests=1,
        notes=["Read through the IRSA cutout service because direct cloud access failed."],
    )
