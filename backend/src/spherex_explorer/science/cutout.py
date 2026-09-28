"""From one archive file to an aligned, measured cutout the browser can display.

Steps, in order:

1. read the window of the Level 2 file that covers the grid (S3 byte ranges, IBE as fallback);
2. mask flagged pixels (the Mosaic Tool set) and estimate the local background;
3. resample the background-subtracted image onto the common grid;
4. measure the wavelength that fell on the target and the aperture flux there;
5. package float32 pixels, a mask and every number with its unit and method.

The background is subtracted because the zodiacal light and airglow change from frame to frame by
more than most astronomical changes; leaving them in would make whole frames brighten and fade.
"""

from __future__ import annotations

import base64
import logging
import math
from typing import Any

import numpy as np
from astropy.io import fits
from numpy.typing import NDArray

from ..archive.fits_range import HttpRangeSource
from ..archive.ibe import read_ibe_window
from ..archive.keys import FrameKey
from ..archive.level2 import Level2Window, WindowRequest, read_window
from ..errors import NotFound, UpstreamError
from ..services import Services
from .grid import Grid, fill_for_display, resample, sky_wcs, source_window
from .masking import DEFAULT_MASKED, bit_table, mask_value, names_set
from .photometry import ARCSEC2_TO_SR, aperture_photometry, estimate_background

log = logging.getLogger(__name__)

MASK_FLAGGED = 1
MASK_NO_DATA = 2
# Part of every cutout cache key: bump it whenever the payload a frame produces would change.
PIPELINE_VERSION = 2


class _Chooser:
    def __init__(self, grid: Grid) -> None:
        self.grid = grid

    def __call__(self, header: fits.Header, nx: int, ny: int) -> WindowRequest:
        window = source_window(self.grid, header, nx, ny)
        if window is None:
            raise NotFound("This frame does not cover the requested position.")
        _, ty = sky_wcs(header).world_to_pixel_values(self.grid.ra, self.grid.dec)
        return WindowRequest(window=window, target_row=round(float(ty)), variance_half_rows=10)


async def fetch_window(svc: Services, frame: FrameKey, grid: Grid) -> Level2Window:
    settings = svc.settings
    async with svc.s3_slots:
        source = HttpRangeSource(svc.client, frame.url(settings.s3_url), "SPHEREx archive (S3)")
        try:
            return await read_window(source, frame.key, _Chooser(grid))
        except NotFound:
            raise
        except UpstreamError as exc:
            log.warning(
                "S3 read failed for %s (%s); trying the IRSA cutout service", frame.key, exc.message
            )
    return await read_ibe_window(
        svc.client, frame.url(settings.irsa_data_url), grid.ra, grid.dec, grid.size_deg * 1.5
    )


def _b64(array: NDArray[Any]) -> str:
    return base64.b64encode(np.ascontiguousarray(array).tobytes()).decode("ascii")


def _finite(value: float | None, digits: int) -> float | None:
    if value is None or not math.isfinite(value):
        return None
    return round(float(value), digits)


def build_payload(frame: FrameKey, grid: Grid, win: Level2Window) -> dict[str, Any]:
    header = win.header
    bits = bit_table(win.flag_bits)
    masked_bits = mask_value(bits)
    overflow_bit = 1 << bits["OVERFLOW"]
    usable = ((win.flags & masked_bits) == 0) & np.isfinite(win.image)
    overflow = (win.flags & overflow_bit) != 0

    bg = estimate_background(win.image, usable)
    if bg is None:
        raise NotFound("This frame has too few usable pixels at the requested position.")

    res = resample(grid, header, win.window, win.image - np.float32(bg.level), usable)
    holes = res.covered & ~np.isfinite(res.image)
    display = fill_for_display(res.image, holes)
    mask = np.zeros(res.image.shape, dtype=np.uint8)
    mask[res.bad | holes] |= MASK_FLAGGED
    mask[~res.covered] |= MASK_NO_DATA

    tx, ty = (float(v) for v in sky_wcs(header).world_to_pixel_values(grid.ra, grid.dec))
    lx, ly = tx - win.window.x0, ty - win.window.y0
    target_inside = -0.5 <= lx <= win.window.width - 0.5 and -0.5 <= ly <= win.window.height - 0.5
    wavelength, bandwidth = win.wavelength_at(tx, ty)

    omega_arcsec2 = float(header.get("OMEGA_MEDIAN", 6.15**2))
    pixel_sr = omega_arcsec2 * ARCSEC2_TO_SR
    phot = aperture_photometry(
        win.image,
        win.variance,
        usable,
        overflow,
        lx,
        ly,
        pixel_sr,
        variance_rows=(win.variance_y0 - win.window.y0, win.variance.shape[0]),
    )

    flags_at_target: list[str] = []
    if target_inside:
        iy, ix = round(ly), round(lx)
        iy = min(max(iy, 0), win.flags.shape[0] - 1)
        ix = min(max(ix, 0), win.flags.shape[1] - 1)
        flags_at_target = names_set(int(win.flags[iy, ix]), bits)

    finite = display[np.isfinite(display)]
    stats = (
        {
            k: float(v)
            for k, v in zip(
                ("p01", "p50", "p99", "p995"), np.percentile(finite, [1, 50, 99, 99.5]), strict=True
            )
        }
        if finite.size
        else None
    )

    def num(key: str) -> float | None:
        value = header.get(key)
        return float(value) if isinstance(value, int | float) else None

    return {
        "key": frame.key,
        "obsId": frame.obs_id,
        "detector": frame.detector,
        "release": frame.release,
        "grid": grid.to_json(),
        "time": {
            "mjdMid": num("MJD-AVG"),
            "isoMid": str(header.get("DATE-AVG", "")) or None,
            "mjdStart": num("MJD-BEG"),
            "mjdEnd": num("MJD-END"),
            "exposureS": num("XPOSURE"),
        },
        "wavelength": {
            "atTargetUm": _finite(wavelength, 5),
            "bandwidthUm": _finite(bandwidth, 5),
            "method": "Bilinear lookup in the frame's WCS-WAVE table at the target pixel.",
        },
        "target": {
            "pixel": [round(tx, 3), round(ty, 3)],
            "inFrame": target_inside,
            "flags": flags_at_target,
        },
        "background": {
            "levelMJySr": _finite(bg.level, 6),
            "rmsMJySr": _finite(bg.rms, 6),
            "zodiModelMJySr": _finite(win.zodi, 6),
            "method": (
                "Sigma-clipped median of unflagged pixels in the window; subtracted from the image."
            ),
        },
        "photometry": phot.to_json(),
        "image": {
            "width": grid.size_px,
            "height": grid.size_px,
            "unit": "MJy/sr (background subtracted)",
            "dtype": "float32-le",
            "data": _b64(display.astype("<f4")),
            "stats": stats,
        },
        "mask": {
            "dtype": "uint8",
            "bits": {"flagged": MASK_FLAGGED, "noData": MASK_NO_DATA},
            "maskedFlags": [name for name in DEFAULT_MASKED if name in bits],
            "data": _b64(mask),
        },
        "spacecraft": {
            "frame": str(header.get("XYZ_SC_SYSTEM", "GEOCENTER")),
            "positionKm": [num("X_SC"), num("Y_SC"), num("Z_SC")],
            "velocityKmS": [num("VX_SC"), num("VY_SC"), num("VZ_SC")],
        },
        "quality": {
            "psfFwhmArcsec": num("PSF_FWHM"),
            "pipeline": win.pipeline,
        },
        "access": {"via": win.access, "requests": win.requests, "notes": win.notes},
    }
