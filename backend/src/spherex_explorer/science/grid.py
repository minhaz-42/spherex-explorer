"""Putting every frame of a sequence on one common grid.

SPHEREx detectors are rotated on the sky and carry TAN-SIP distortion, and each exposure points
slightly differently. To blink or subtract frames, each is resampled onto the same grid: a
gnomonic (TAN) projection centred on the target, north up and east left, with SPHEREx's native
6.15″ pixels, so no detail is invented and none is thrown away.
"""

from __future__ import annotations

import re
import warnings
from dataclasses import dataclass

import numpy as np
from astropy.io import fits
from astropy.utils.exceptions import AstropyWarning
from astropy.wcs import WCS
from numpy.typing import NDArray
from scipy import ndimage

from ..archive.level2 import Window

NATIVE_SCALE_ARCSEC = 6.15


@dataclass(frozen=True)
class Grid:
    ra: float
    dec: float
    size_px: int  # always odd, so the target sits on the centre pixel
    scale_arcsec: float = NATIVE_SCALE_ARCSEC

    @property
    def size_deg(self) -> float:
        return self.size_px * self.scale_arcsec / 3600

    @property
    def centre(self) -> float:
        """0-based pixel index of the target on both axes."""
        return (self.size_px - 1) / 2

    def wcs(self) -> WCS:
        w = WCS(naxis=2)
        w.wcs.ctype = ["RA---TAN", "DEC--TAN"]
        w.wcs.crval = [self.ra, self.dec]
        w.wcs.crpix = [self.centre + 1, self.centre + 1]
        s = self.scale_arcsec / 3600
        w.wcs.cdelt = [-s, s]
        w.wcs.cunit = ["deg", "deg"]
        w.wcs.radesys = "ICRS"
        return w

    def to_json(self) -> dict[str, float | int | str]:
        return {
            "ra": self.ra,
            "dec": self.dec,
            "sizePx": self.size_px,
            "scaleArcsec": self.scale_arcsec,
            "projection": "TAN, north up, east left",
        }


def make_grid(ra: float, dec: float, size_deg: float) -> Grid:
    n = max(round(size_deg * 3600 / NATIVE_SCALE_ARCSEC), 9)
    if n % 2 == 0:
        n += 1
    return Grid(ra=ra, dec=dec, size_px=n)


_SKY_KEY = re.compile(
    r"^(WCSAXES|CTYPE[12]|CUNIT[12]|CRVAL[12]|CRPIX[12]|CDELT[12]|PC[12]_[12]|CD[12]_[12]"
    r"|LONPOLE|LATPOLE|RADESYS|EQUINOX|NAXIS[12]?|[AB]P?_ORDER|[AB]P?_\d+_\d+)$"
)


def sky_wcs(header: fits.Header) -> WCS:
    """Celestial TAN-SIP WCS of a Level 2 IMAGE header.

    Only the primary celestial keywords are passed on. The spectral alternate WCS ``W`` refers
    to a lookup table in another extension, and wcslib cannot parse it from a lone header.
    """
    sky = fits.Header()
    for card in header.cards:
        if _SKY_KEY.match(card.keyword):
            sky.append(card)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", AstropyWarning)
        return WCS(sky, naxis=2)


def grid_to_source(
    grid: Grid, source: WCS, xs: NDArray[np.float64], ys: NDArray[np.float64]
) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
    """Map 0-based grid pixel positions to 0-based source-image pixel positions."""
    ra, dec = grid.wcs().pixel_to_world_values(xs, ys)
    sx, sy = source.world_to_pixel_values(ra, dec)
    return np.asarray(sx, dtype=np.float64), np.asarray(sy, dtype=np.float64)


def source_window(
    grid: Grid, header: fits.Header, nx: int, ny: int, margin: int = 3
) -> Window | None:
    """The smallest window of the source image that covers the grid, or None if they miss."""
    n = grid.size_px
    edge = np.linspace(-0.5, n - 0.5, 9)
    xs = np.concatenate([edge, edge, np.full(9, -0.5), np.full(9, n - 0.5)])
    ys = np.concatenate([np.full(9, -0.5), np.full(9, n - 0.5), edge, edge])
    sx, sy = grid_to_source(grid, sky_wcs(header), xs, ys)
    if not (np.isfinite(sx).all() and np.isfinite(sy).all()):
        return None
    window = Window(
        int(np.floor(sx.min())) - margin,
        int(np.floor(sy.min())) - margin,
        int(np.ceil(sx.max())) + margin + 1,
        int(np.ceil(sy.max())) + margin + 1,
    )
    return window.clip(nx, ny)


@dataclass
class Resampled:
    image: NDArray[np.float32]  # NaN where the frame has no data
    bad: NDArray[np.bool_]  # a masked (flagged) source pixel contributed
    covered: NDArray[np.bool_]  # inside the frame


def resample(
    grid: Grid,
    header: fits.Header,
    window: Window,
    image: NDArray[np.float32],
    good: NDArray[np.bool_],
) -> Resampled:
    """Bilinear resampling onto ``grid``, normalised by the good-pixel weight.

    Interpolating ``image × good`` and ``good`` separately and dividing keeps a flagged pixel
    from leaking its value into its neighbours. Grid pixels whose four source neighbours include
    a flagged one are reported in ``bad``; their values come from the good neighbours only.
    """
    n = grid.size_px
    gy, gx = np.mgrid[0:n, 0:n].astype(np.float64)
    sx, sy = grid_to_source(grid, sky_wcs(header), gx.ravel(), gy.ravel())
    lx = sx - window.x0
    ly = sy - window.y0
    h, w = image.shape
    inside = (lx >= -0.5) & (lx <= w - 0.5) & (ly >= -0.5) & (ly <= h - 0.5)
    coords = np.vstack([np.clip(ly, 0, h - 1), np.clip(lx, 0, w - 1)])
    weights = good.astype(np.float64)
    values = np.where(good, image, 0.0).astype(np.float64)
    num = ndimage.map_coordinates(values, coords, order=1, mode="nearest")
    den = ndimage.map_coordinates(weights, coords, order=1, mode="nearest")
    with np.errstate(invalid="ignore", divide="ignore"):
        out = np.where(den > 1e-6, num / den, np.nan)
    out = np.where(inside, out, np.nan)
    bad = inside & (den < 0.999)
    return Resampled(
        image=out.reshape(n, n).astype(np.float32),
        bad=bad.reshape(n, n),
        covered=inside.reshape(n, n),
    )


def fill_for_display(image: NDArray[np.float32], holes: NDArray[np.bool_]) -> NDArray[np.float32]:
    """Fill small holes (all four neighbours flagged) from nearby values, for display only.

    Measurements never use filled pixels; the mask sent with the image marks them.
    """
    if not holes.any():
        return image
    valid = np.isfinite(image) & ~holes
    values = np.where(valid, image, 0.0)
    num = ndimage.gaussian_filter(values, 1.2, mode="nearest")
    den = ndimage.gaussian_filter(valid.astype(np.float64), 1.2, mode="nearest")
    with np.errstate(invalid="ignore", divide="ignore"):
        smooth = np.where(den > 0.05, num / den, np.nan)
    out = image.copy()
    out[holes] = smooth[holes]
    return out.astype(np.float32)
