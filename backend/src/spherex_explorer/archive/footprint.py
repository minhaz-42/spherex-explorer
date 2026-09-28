"""Where on the detector a target fell, and so which wavelength it was seen at, from search
results alone.

The ``s_region`` polygon of a SPHEREx image lists the outer corners of its pixel grid in the
order (−0.5, −0.5), (2039.5, −0.5), (2039.5, 2039.5), (−0.5, 2039.5) (0-based pixels). We verified
this against full TAN-SIP headers: every vertex lies within the half-pixel diagonal (4.35″) of the
matching corner pixel centre.

Mapping the polygon to those corners with a projective transform on the tangent plane places a
target to within about 5 pixels (SIP distortion is not modelled). The linear variable filter changes
wavelength by about 0.0004 µm per pixel, so the estimate is good to about 0.002 µm, a few percent
of a spectral channel. When the frame's pixels are read, the exact value from its
own WCS replaces the estimate.
"""

from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path

import numpy as np
from numpy.typing import NDArray

from .spectral import SpectralTable

NPIX = 2040
_CORNERS = np.array(
    [[-0.5, -0.5], [NPIX - 0.5, -0.5], [NPIX - 0.5, NPIX - 0.5], [-0.5, NPIX - 0.5]],
    dtype=np.float64,
)
_TABLES = Path(__file__).with_name("wave_tables.json")


def parse_polygon(s_region: str) -> list[tuple[float, float]]:
    """Vertices of an ``s_region`` such as ``POLYGON ICRS ra1 dec1 ra2 dec2 …``."""
    parts = s_region.split()
    if len(parts) < 2 or parts[0].upper() != "POLYGON":
        raise ValueError(f"not a polygon: {s_region[:40]!r}")
    start = 2 if not _is_number(parts[1]) else 1
    values = [float(v) for v in parts[start:]]
    if len(values) < 8 or len(values) % 2:
        raise ValueError("polygon needs at least four vertices")
    points = list(zip(values[0::2], values[1::2], strict=True))
    if len(points) > 4 and _same(points[0], points[-1]):
        points = points[:-1]
    return points


def _is_number(s: str) -> bool:
    try:
        float(s)
    except ValueError:
        return False
    return True


def _same(a: tuple[float, float], b: tuple[float, float]) -> bool:
    return abs(a[0] - b[0]) < 1e-9 and abs(a[1] - b[1]) < 1e-9


def gnomonic(
    ra: NDArray[np.float64], dec: NDArray[np.float64], ra0: float, dec0: float
) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
    """Tangent-plane coordinates (radians) of points about ``(ra0, dec0)`` (degrees)."""
    a, d = np.radians(ra), np.radians(dec)
    a0, d0 = math.radians(ra0), math.radians(dec0)
    cos_c = math.sin(d0) * np.sin(d) + math.cos(d0) * np.cos(d) * np.cos(a - a0)
    xi = np.cos(d) * np.sin(a - a0) / cos_c
    eta = (math.cos(d0) * np.sin(d) - math.sin(d0) * np.cos(d) * np.cos(a - a0)) / cos_c
    return xi, eta


def _homography(src: NDArray[np.float64], dst: NDArray[np.float64]) -> NDArray[np.float64]:
    rows = []
    for (x, y), (u, v) in zip(src, dst, strict=True):
        rows.append([x, y, 1, 0, 0, 0, -u * x, -u * y, -u])
        rows.append([0, 0, 0, x, y, 1, -v * x, -v * y, -v])
    _, _, vt = np.linalg.svd(np.asarray(rows, dtype=np.float64))
    h = np.asarray(vt[-1].reshape(3, 3), dtype=np.float64)
    return np.asarray(h / h[2, 2], dtype=np.float64)


def target_pixel(s_region: str, ra: float, dec: float) -> tuple[float, float] | None:
    """Estimated 0-based detector pixel of ``(ra, dec)``, or None if the polygon is unusable."""
    try:
        points = parse_polygon(s_region)
    except ValueError:
        return None
    if len(points) != 4:
        return None
    pra = np.array([p[0] for p in points])
    pdec = np.array([p[1] for p in points])
    # Centre of the footprint, averaging RA on the unit circle so 0/360 wrap-around is safe.
    ra0 = math.degrees(math.atan2(np.sin(np.radians(pra)).mean(), np.cos(np.radians(pra)).mean()))
    dec0 = float(pdec.mean())
    xi, eta = gnomonic(pra, pdec, ra0, dec0)
    h = _homography(np.column_stack([xi, eta]), _CORNERS)
    txi, teta = gnomonic(np.array([ra]), np.array([dec]), ra0, dec0)
    u, v, w = h @ np.array([txi[0], teta[0], 1.0])
    if not math.isfinite(u / w) or not math.isfinite(v / w):
        return None
    return float(u / w), float(v / w)


@lru_cache
def detector_tables() -> dict[str, SpectralTable]:
    data = json.loads(_TABLES.read_text())
    return {key: SpectralTable.from_json(t) for key, t in data["tables"].items()}


def estimate_wavelength(
    release: str, detector: int, x: float, y: float
) -> tuple[float, float] | None:
    """Wavelength and bandwidth (µm) at 0-based full-frame pixel ``(x, y)`` of a detector."""
    tables = detector_tables()
    table = tables.get(f"{release}:D{detector}") or tables.get(f"qr2:D{detector}")
    if table is None:
        return None
    # Full frames use CRPIXnW = CRVALnW = 1, so the table index is the 1-based pixel.
    return table.at_index(x + 1, y + 1)
