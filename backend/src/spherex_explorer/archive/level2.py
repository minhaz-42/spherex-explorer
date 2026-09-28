"""Read a small window of a SPHEREx Level 2 spectral image without downloading the file.

A Level 2 file holds, in order: an empty primary HDU, ``IMAGE`` (MJy/sr), ``FLAGS``, ``VARIANCE``,
``ZODI``, a PSF extension (``PSF`` in QR2, ``EPSF`` in QR3) and the ``WCS-WAVE`` table. The file is
about 70 MB; a 0.2° window needs well under 2 MB of it.

The reader makes three rounds of parallel range requests:

1. the first blocks of the file: primary and ``IMAGE`` headers (WCS, times, spacecraft state);
2. the ``IMAGE`` rows of the window, the ``FLAGS`` header (plus the tile table when the flags are
   compressed, as in QR3), and the ``WCS-WAVE`` table from the end of the file;
3. the ``FLAGS`` rows (or their compressed tiles), a few ``VARIANCE`` rows round the target, and
   one ``ZODI`` row.

Header lengths other than ``IMAGE`` are predicted from the last file of the same release and then
checked; a wrong guess costs one more request, never a wrong answer.
"""

from __future__ import annotations

import asyncio
import warnings
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Literal

import numpy as np
from astropy.io import fits
from astropy.io.fits.hdu.compressed._codecs import Rice1
from astropy.utils.exceptions import AstropyWarning
from numpy.typing import NDArray

from ..errors import UpstreamError
from .fits_range import (
    BLOCK,
    RangeSource,
    data_length,
    hdu_span,
    padded,
    parse_header,
    read_header_at,
)
from .spectral import SpectralTable, index_offset

SERVICE = "SPHEREx archive (S3)"

# Header lengths seen so far, keyed by (release, EXTNAME); used to predict offsets.
_learned_header_len: dict[tuple[str, str], int] = {}


@dataclass(frozen=True)
class Window:
    """A rectangle of parent-image pixels, 0-based, half-open: ``[x0, x1) × [y0, y1)``."""

    x0: int
    y0: int
    x1: int
    y1: int

    @property
    def width(self) -> int:
        return self.x1 - self.x0

    @property
    def height(self) -> int:
        return self.y1 - self.y0

    def clip(self, nx: int, ny: int) -> Window | None:
        w = Window(max(self.x0, 0), max(self.y0, 0), min(self.x1, nx), min(self.y1, ny))
        return w if w.width > 0 and w.height > 0 else None


@dataclass
class Level2Window:
    """The parts of one Level 2 file needed to show and measure a small region."""

    header: fits.Header  # parent IMAGE header: WCS in parent-pixel coordinates
    window: Window
    image: NDArray[np.float32]
    flags: NDArray[np.int32]
    variance: NDArray[np.float32]  # rows [variance_y0, variance_y0 + len) of the window's columns
    variance_y0: int
    zodi: float | None  # ZODI model (MJy/sr) near the target row, median across the window
    spectral: SpectralTable
    flag_bits: dict[str, int]
    release: str
    access: Literal["s3", "ibe"]
    pipeline: str | None = None  # VERSION from the primary header
    requests: int = 0
    notes: list[str] = field(default_factory=list)

    def wavelength_at(self, x: float, y: float) -> tuple[float, float]:
        """Wavelength and bandwidth (µm) at 0-based parent pixel ``(x, y)``."""
        dx, dy = index_offset(self.header)
        return self.spectral.at_index(x + 1 + dx, y + 1 + dy)


@dataclass(frozen=True)
class WindowRequest:
    """Which pixels to read: the window, and the row of the target for VARIANCE and ZODI."""

    window: Window
    target_row: int
    variance_half_rows: int = 8


# Called with the parent IMAGE header and its size once round 1 has read it.
WindowChooser = Callable[[fits.Header, int, int], WindowRequest]


def flag_bits_from_header(header: fits.Header) -> dict[str, int]:
    """Flag names → bit numbers, from either header convention.

    QR2 writes ``HIERARCH MP_TRANSIENT = 0``; QR3 writes ``MSKN0000 = 'TRANSIENT'``.
    """
    bits: dict[str, int] = {}
    for key, value in header.items():
        key = str(key)
        if key.startswith("MP_") and isinstance(value, int):
            bits[key[3:]] = int(value)
        elif key.startswith("MSKN") and key[4:].isdigit():
            bits[str(value).strip()] = int(key[4:])
    return bits


def release_of(key: str) -> str:
    """``qr2``/``qr3``… from an S3 key such as ``qr2/level2/…``."""
    return key.split("/", 1)[0]


async def read_window(
    source: RangeSource,
    key: str,
    choose: WindowChooser,
) -> Level2Window:
    """Read the window that ``choose`` picks once it has seen the IMAGE header."""
    release = release_of(key)

    # Round 1: primary + IMAGE headers.
    head = await source.read(0, 20 * BLOCK)
    primary = parse_header(head)
    if primary is None:
        raise UpstreamError(SERVICE, "The file does not start with a FITS header.")
    image_off = primary[1]
    image_hdr, image_hlen = await _header_from(source, head, image_off)
    _expect(image_hdr, "IMAGE")
    nx, ny = int(image_hdr["NAXIS1"]), int(image_hdr["NAXIS2"])
    request = choose(image_hdr, nx, ny)
    window = request.window
    row = nx * 4

    image_data = image_off + image_hlen
    flags_off = image_off + hdu_span(image_hdr, image_hlen)

    # Round 2: IMAGE rows, FLAGS header (+ tile table), WCS-WAVE table.
    image_task = source.read(image_data + window.y0 * row, image_data + window.y1 * row)
    flags_head_task = source.read(flags_off, flags_off + 24 * BLOCK + ny * 8)
    wave_task = source.read_suffix(2 * BLOCK)
    image_raw, flags_head, wave_raw = await asyncio.gather(image_task, flags_head_task, wave_task)

    flags_hdr, flags_hlen = await _header_from(source, flags_head, 0, base=flags_off)
    _expect(flags_hdr, "FLAGS")
    _learned_header_len[(release, "FLAGS")] = flags_hlen
    flag_bits = flag_bits_from_header(flags_hdr)
    variance_off = flags_off + hdu_span(flags_hdr, flags_hlen)

    spectral = _parse_wave(wave_raw)

    # Round 3: FLAGS data, VARIANCE rows, ZODI row.
    vy0 = max(request.target_row - request.variance_half_rows, 0)
    vy1 = min(request.target_row + request.variance_half_rows + 1, ny)
    zy = min(max(request.target_row, 0), ny - 1)
    flags_task = _read_flags(
        source, flags_hdr, flags_off + flags_hlen, flags_head, flags_hlen, window, nx
    )
    variance_task = _read_plane_rows(source, release, "VARIANCE", variance_off, vy0, vy1, row)
    (flags, (var_hdr, var_hlen, var_raw)) = await asyncio.gather(flags_task, variance_task)
    zodi_off = variance_off + hdu_span(var_hdr, var_hlen)
    zodi_hdr, zodi_hlen, zodi_raw = await _read_plane_rows(
        source, release, "ZODI", zodi_off, zy, zy + 1, row
    )

    if spectral is None:
        spectral = await _walk_to_wave(source, zodi_off + hdu_span(zodi_hdr, zodi_hlen))

    image = _rows(image_raw, window.height, nx, ">f4")[:, window.x0 : window.x1]
    variance = _rows(var_raw, vy1 - vy0, nx, ">f4")[:, window.x0 : window.x1]
    zodi_row = _rows(zodi_raw, 1, nx, ">f4")[0, window.x0 : window.x1]
    zodi = float(np.nanmedian(zodi_row)) if np.isfinite(zodi_row).any() else None

    return Level2Window(
        header=image_hdr,
        window=window,
        image=image.astype(np.float32),
        flags=flags,
        variance=variance.astype(np.float32),
        variance_y0=vy0,
        zodi=zodi,
        spectral=spectral,
        flag_bits=flag_bits,
        release=release,
        access="s3",
        pipeline=str(primary[0].get("VERSION", "")).strip() or None,
        requests=getattr(source, "requests", 0),
    )


async def _header_from(
    source: RangeSource, buf: bytes, offset: int, *, base: int = 0
) -> tuple[fits.Header, int]:
    parsed = parse_header(buf[offset:])
    if parsed is not None:
        return parsed
    return await read_header_at(source, base + offset)


def _expect(header: fits.Header, extname: str) -> None:
    found = str(header.get("EXTNAME", "")).strip()
    if found != extname:
        raise UpstreamError(
            SERVICE,
            "The file does not have the layout of a SPHEREx Level 2 image.",
            detail=f"expected {extname}, found {found or 'no EXTNAME'}",
        )


def _rows(raw: bytes, nrows: int, ncols: int, dtype: str) -> NDArray[np.float32]:
    expected = nrows * ncols * 4
    if len(raw) < expected:
        raise UpstreamError(SERVICE, "The archive returned fewer bytes than requested.")
    arr: NDArray[np.float32] = np.frombuffer(raw[:expected], dtype=dtype).reshape(nrows, ncols)
    return arr


async def _read_plane_rows(
    source: RangeSource, release: str, extname: str, offset: int, y0: int, y1: int, row: int
) -> tuple[fits.Header, int, bytes]:
    """Header and rows ``[y0, y1)`` of an uncompressed image HDU starting at ``offset``."""
    guess = _learned_header_len.get((release, extname), 4 * BLOCK)
    head_task = source.read(offset, offset + 24 * BLOCK)
    rows_task = source.read(offset + guess + y0 * row, offset + guess + y1 * row)
    head, rows = await asyncio.gather(head_task, rows_task)
    header, hlen = await _header_from(source, head, 0, base=offset)
    _expect(header, extname)
    _learned_header_len[(release, extname)] = hlen
    if hlen != guess:
        rows = await source.read(offset + hlen + y0 * row, offset + hlen + y1 * row)
    return header, hlen, rows


async def _read_flags(
    source: RangeSource,
    header: fits.Header,
    data_off: int,
    head_buf: bytes,
    hlen: int,
    window: Window,
    nx: int,
) -> NDArray[np.int32]:
    if not header.get("ZIMAGE", False):
        raw = await source.read(data_off + window.y0 * nx * 4, data_off + window.y1 * nx * 4)
        flags = np.frombuffer(raw, dtype=">i4").reshape(window.height, nx)
        return flags[:, window.x0 : window.x1].astype(np.int32)
    return await _read_compressed_flags(source, header, data_off, head_buf, hlen, window, nx)


async def _read_compressed_flags(
    source: RangeSource,
    header: fits.Header,
    data_off: int,
    head_buf: bytes,
    hlen: int,
    window: Window,
    nx: int,
) -> NDArray[np.int32]:
    """Decode the rows of a RICE_1 tile-compressed FLAGS image (QR3) from its heap.

    The HDU is a binary table with one row per tile. Each row holds a descriptor (byte count,
    heap offset) pointing into the heap that follows the table. SPHEREx uses one image row per
    tile, so the window's rows are one contiguous run of heap bytes.
    """
    ctype = str(header.get("ZCMPTYPE", "")).strip()
    tile_x, tile_y = int(header.get("ZTILE1", 0)), int(header.get("ZTILE2", 0))
    if ctype != "RICE_1" or tile_x != nx or tile_y != 1 or int(header["NAXIS1"]) != 8:
        raise UpstreamError(
            SERVICE,
            "The flag extension uses a compression layout this app does not read.",
            detail=f"{ctype} tiles {tile_x}x{tile_y}",
        )
    ntiles = int(header["NAXIS2"])
    table_len = 8 * ntiles
    table = head_buf[hlen : hlen + table_len]
    if len(table) < table_len:
        table = await source.read(data_off, data_off + table_len)
    desc = np.frombuffer(table, dtype=">i4").reshape(ntiles, 2)
    counts = desc[window.y0 : window.y1, 0].astype(np.int64)
    offsets = desc[window.y0 : window.y1, 1].astype(np.int64)
    heap = data_off + int(header.get("THEAP", table_len))
    start, end = int(offsets.min()), int((offsets + counts).max())
    raw = await source.read(heap + start, heap + end)

    blocksize = int(header.get("ZVAL1", 32)) if header.get("ZNAME1") == "BLOCKSIZE" else 32
    bytepix = int(header.get("ZVAL2", 4)) if header.get("ZNAME2") == "BYTEPIX" else 4
    codec = Rice1(blocksize=blocksize, bytepix=bytepix, tilesize=nx)
    out = np.empty((window.height, window.width), dtype=np.int32)
    for i, (count, offset) in enumerate(zip(counts, offsets, strict=True)):
        chunk = np.frombuffer(raw, dtype=np.uint8, count=int(count), offset=int(offset) - start)
        decoded = np.asarray(codec.decode(chunk)).view(np.int32).reshape(-1)
        out[i] = decoded[window.x0 : window.x1]
    return out


def _parse_wave(raw: bytes) -> SpectralTable | None:
    """The WCS-WAVE table from the last bytes of the file, if that is where it is."""
    for start in range(0, len(raw) - BLOCK + 1, BLOCK):
        if raw[start : start + 8] != b"XTENSION":
            continue
        try:
            return SpectralTable.from_bytes(raw[start:])
        except (ValueError, KeyError, IndexError, OSError):
            return None
    return None


async def _walk_to_wave(source: RangeSource, offset: int) -> SpectralTable:
    """Slow path: step over the PSF extension to find WCS-WAVE."""
    for _ in range(4):
        header, hlen = await read_header_at(source, offset)
        name = str(header.get("EXTNAME", "")).strip()
        if name == "WCS-WAVE":
            raw = await source.read(offset, offset + hlen + padded(data_length(header)))
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", AstropyWarning)
                return SpectralTable.from_bytes(raw)
        offset += hdu_span(header, hlen)
    raise UpstreamError(SERVICE, "The file has no wavelength table (WCS-WAVE).")
