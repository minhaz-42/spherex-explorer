"""The wavelength that falls on a pixel.

SPHEREx detectors sit behind linear variable filters, so every pixel has its own central
wavelength and bandwidth. Level 2 files describe this with an alternate WCS ``W`` of type
``WAVE-TAB`` (FITS Paper III): a coarse grid of control points in the ``WCS-WAVE`` table, with
bilinear interpolation between them. IRSA documents the result as accurate to about 1 nm.

We evaluate the table ourselves instead of through astropy, because astropy carries the image's
SIP distortion onto the alternate WCS (astropy issue 13105), which shifts wavelengths by about
0.006 µm. Wavelength is a property of the detector and filter, not of the optics.
"""

from __future__ import annotations

import warnings
from dataclasses import dataclass
from typing import Any

import numpy as np
from astropy.io import fits
from astropy.utils.exceptions import AstropyWarning
from numpy.typing import NDArray


@dataclass(frozen=True)
class SpectralTable:
    """Control points (1-based parent-image pixels) and wavelength/bandwidth grids in µm."""

    x: NDArray[np.float64]
    y: NDArray[np.float64]
    wavelength: NDArray[np.float64]  # shape (len(y), len(x))
    bandwidth: NDArray[np.float64]

    @classmethod
    def from_values(cls, x: Any, y: Any, values: Any) -> SpectralTable:
        """Build from the ``X``, ``Y`` and ``VALUES`` cells of a ``WCS-WAVE`` row.

        ``VALUES`` has FITS dimensions ``(2, nx, ny)``, so numpy sees it as ``[y][x][k]`` with
        k = 0 for wavelength and 1 for bandwidth.
        """
        xs = np.asarray(x, dtype=np.float64).ravel()
        ys = np.asarray(y, dtype=np.float64).ravel()
        vals = np.asarray(values, dtype=np.float64).reshape(len(ys), len(xs), 2)
        return cls(x=xs, y=ys, wavelength=vals[..., 0], bandwidth=vals[..., 1])

    @classmethod
    def from_hdu(cls, hdu: fits.BinTableHDU) -> SpectralTable:
        row = hdu.data[0]
        return cls.from_values(row["X"], row["Y"], row["VALUES"])

    @classmethod
    def from_bytes(cls, raw: bytes) -> SpectralTable:
        """Parse a ``WCS-WAVE`` HDU (header and data) read straight from a file."""
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", AstropyWarning)
            hdu = fits.BinTableHDU.fromstring(raw)
        if str(hdu.header.get("EXTNAME", "")).strip() != "WCS-WAVE":
            raise ValueError("not a WCS-WAVE extension")
        return cls.from_hdu(hdu)

    def to_json(self) -> dict[str, list[Any]]:
        return {
            "x": self.x.tolist(),
            "y": self.y.tolist(),
            "wavelength": self.wavelength.round(6).tolist(),
            "bandwidth": self.bandwidth.round(6).tolist(),
        }

    @classmethod
    def from_json(cls, data: dict[str, Any]) -> SpectralTable:
        return cls(
            x=np.asarray(data["x"], dtype=np.float64),
            y=np.asarray(data["y"], dtype=np.float64),
            wavelength=np.asarray(data["wavelength"], dtype=np.float64),
            bandwidth=np.asarray(data["bandwidth"], dtype=np.float64),
        )

    def at_index(self, ix: float, iy: float) -> tuple[float, float]:
        """Bilinear interpolation at table index coordinates (1-based parent pixels)."""
        wl = _bilinear(self.x, self.y, self.wavelength, ix, iy)
        bw = _bilinear(self.x, self.y, self.bandwidth, ix, iy)
        return wl, bw


def _bilinear(
    xs: NDArray[np.float64], ys: NDArray[np.float64], grid: NDArray[np.float64], x: float, y: float
) -> float:
    # Positions outside the control points are clamped to the edge cells and extrapolated
    # linearly, as FITS Paper III allows; SPHEREx control points span the full array anyway.
    i = int(np.clip(np.searchsorted(xs, x) - 1, 0, len(xs) - 2))
    j = int(np.clip(np.searchsorted(ys, y) - 1, 0, len(ys) - 2))
    tx = (x - xs[i]) / (xs[i + 1] - xs[i])
    ty = (y - ys[j]) / (ys[j + 1] - ys[j])
    v00, v10 = grid[j, i], grid[j, i + 1]
    v01, v11 = grid[j + 1, i], grid[j + 1, i + 1]
    return float(
        v00 * (1 - tx) * (1 - ty) + v10 * tx * (1 - ty) + v01 * (1 - tx) * ty + v11 * tx * ty
    )


def index_offset(header: fits.Header) -> tuple[float, float]:
    """``(dx, dy)`` so that table index = 1-based pixel of this header's image + offset.

    For the ``WAVE-TAB`` axes with unit ``CDELT`` and identity ``PC``, the lookup coordinate is
    ``p - CRPIXnW + CRVALnW``. In a full frame this is the pixel itself; in an IRSA cutout it adds
    the cutout's position in the parent image.
    """
    dx = float(header.get("CRVAL1W", 1.0)) - float(header.get("CRPIX1W", 1.0))
    dy = float(header.get("CRVAL2W", 1.0)) - float(header.get("CRPIX2W", 1.0))
    return dx, dy
