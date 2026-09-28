"""Small synthetic SPHEREx Level 2 files for tests.

They have the real HDU sequence and keywords (IMAGE, FLAGS, VARIANCE, ZODI, PSF or EPSF,
WCS-WAVE), at a fraction of the size, so the range reader can be tested end to end against
astropy's own reading of the same bytes.
"""

from __future__ import annotations

import io
from dataclasses import dataclass

import numpy as np
from astropy.io import fits

from spherex_explorer.archive.fits_range import RangeSource


@dataclass
class Synthetic:
    raw: bytes
    image: np.ndarray
    flags: np.ndarray
    variance: np.ndarray
    zodi: np.ndarray
    header: fits.Header


def image_header(
    nx: int, ny: int, *, ra: float = 161.3, dec: float = 2.45, extra_cards: int = 0
) -> fits.Header:
    h = fits.Header()
    h["EXTNAME"] = "IMAGE"
    h["BUNIT"] = "MJy / sr"
    h["DETECTOR"] = 2
    h["CTYPE1"], h["CTYPE2"] = "RA---TAN", "DEC--TAN"
    h["CRVAL1"], h["CRVAL2"] = ra, dec
    h["CRPIX1"], h["CRPIX2"] = (nx + 1) / 2, (ny + 1) / 2
    # A detector rotated by 30° with 6.15" pixels, like the real ones (which are not north up).
    s = 6.15 / 3600
    c, n = np.cos(np.radians(30)), np.sin(np.radians(30))
    h["PC1_1"], h["PC1_2"], h["PC2_1"], h["PC2_2"] = -s * c, s * n, s * n, s * c
    h["CDELT1"], h["CDELT2"] = 1.0, 1.0
    h["CUNIT1"], h["CUNIT2"] = "deg", "deg"
    h["RADESYS"] = "ICRS"
    h["DATE-AVG"] = "2025-12-02T12:07:00.000"
    h["MJD-AVG"] = 61011.50486
    h["MJD-BEG"] = 61011.50420
    h["MJD-END"] = 61011.50552
    h["XPOSURE"] = 113.5826
    h["X_SC"], h["Y_SC"], h["Z_SC"] = 5481.95, 150.09, 4388.65
    h["VX_SC"], h["VY_SC"], h["VZ_SC"] = 4.68, -1.21, -5.78
    h["HIERARCH OMEGA_MEDIAN"] = 37.86
    h["PSF_FWHM"] = 5.2
    h["CTYPE1W"], h["CTYPE2W"] = "WAVE-TAB", "WAVE-TAB"
    h["CRPIX1W"], h["CRPIX2W"] = 1.0, 1.0
    h["CRVAL1W"], h["CRVAL2W"] = 1.0, 1.0
    for i in range(extra_cards):
        h["HISTORY"] = f"padding card {i} to change the header length"
    return h


def wave_table(nx: int, ny: int) -> fits.BinTableHDU:
    xs = np.array([1, nx // 2, nx], dtype=np.int32)
    ys = np.array([1, ny // 2, ny], dtype=np.int32)
    # Wavelength rises along y (the filter axis) and slightly along x (curved iso-lines).
    wl = 1.10 + 0.50 * (ys[:, None] - 1) / (ny - 1) + 0.01 * (xs[None, :] - 1) / (nx - 1)
    bw = wl / 41.0
    values = np.stack([wl, bw], axis=-1).astype(np.float32)  # numpy [y][x][k]
    cols = [
        fits.Column(name="X", format=f"{len(xs)}J", array=xs[None, :]),
        fits.Column(name="Y", format=f"{len(ys)}J", array=ys[None, :]),
        fits.Column(
            name="VALUES",
            format=f"{values.size}E",
            dim=f"(2,{len(xs)},{len(ys)})",
            array=values[None, ...],
        ),
    ]
    return fits.BinTableHDU.from_columns(cols, name="WCS-WAVE")


def make_level2(
    nx: int = 64,
    ny: int = 64,
    *,
    compressed_flags: bool = False,
    extra_cards: int = 0,
    seed: int = 1,
) -> Synthetic:
    rng = np.random.default_rng(seed)
    image = rng.normal(0.2, 0.01, (ny, nx)).astype(np.float32)
    image[ny // 2, nx // 2] += 5.0
    flags = np.zeros((ny, nx), dtype=np.int32)
    flags[rng.integers(0, ny, 40), rng.integers(0, nx, 40)] = 1 << 21  # SOURCE
    flags[3, 5] |= 1 << 10  # HOT
    flags[10, 20] |= 1  # TRANSIENT
    variance = (
        np.full((ny, nx), 1e-4, dtype=np.float32) + rng.random((ny, nx), dtype=np.float32) * 1e-5
    )
    zodi = np.full((ny, nx), 0.11, dtype=np.float32) + np.linspace(0, 0.01, nx, dtype=np.float32)

    header = image_header(nx, ny, extra_cards=extra_cards)
    hdus: list[fits.hdu.base.ExtensionHDU] = [fits.ImageHDU(image, header=header, name="IMAGE")]
    if compressed_flags:
        fh = fits.CompImageHDU(flags, compression_type="RICE_1", tile_shape=(1, nx), name="FLAGS")
        for bit, name in [(0, "TRANSIENT"), (10, "HOT"), (21, "SOURCE")]:
            fh.header[f"MSKN{bit:04d}"] = name
        hdus.append(fh)
    else:
        fh = fits.ImageHDU(flags, name="FLAGS")
        for bit, name in [(0, "TRANSIENT"), (10, "HOT"), (21, "SOURCE")]:
            fh.header[f"HIERARCH MP_{name}"] = bit
        hdus.append(fh)
    hdus.append(fits.ImageHDU(variance, name="VARIANCE"))
    hdus.append(fits.ImageHDU(zodi, name="ZODI"))
    hdus.append(fits.ImageHDU(np.zeros((3, 9, 9), dtype=np.float32), name="PSF"))
    hdus.append(wave_table(nx, ny))
    buf = io.BytesIO()
    fits.HDUList([fits.PrimaryHDU(), *hdus]).writeto(buf)
    return Synthetic(buf.getvalue(), image, flags, variance, zodi, header)


class MemorySource(RangeSource):
    """An in-memory :class:`RangeSource` that records every request."""

    def __init__(self, raw: bytes) -> None:
        self.raw = raw
        self.calls: list[tuple[int, int]] = []

    @property
    def size(self) -> int | None:
        return len(self.raw)

    @property
    def requests(self) -> int:
        return len(self.calls)

    async def read(self, start: int, end: int) -> bytes:
        self.calls.append((start, end))
        return self.raw[start:end]

    async def read_suffix(self, length: int) -> bytes:
        self.calls.append((-length, len(self.raw)))
        return self.raw[-length:]
