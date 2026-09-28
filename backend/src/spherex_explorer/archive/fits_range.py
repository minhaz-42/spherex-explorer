"""Reading parts of a remote FITS file with HTTP byte-range requests.

FITS is a sequence of 2880-byte blocks: each HDU is a header (80-character cards, ending with
``END``) followed by its data, padded to a whole number of blocks. Given a header we know exactly
how long its data is, so we can jump to any HDU or any row of an image without downloading the
rest of the file.
"""

from __future__ import annotations

import asyncio
import re
import warnings
from typing import Protocol

import httpx
from astropy.io import fits
from astropy.utils.exceptions import AstropyWarning

from ..errors import UpstreamError
from ..http import upstream

BLOCK = 2880
CARD = 80
_END = b"END" + b" " * 77
_CONTENT_RANGE = re.compile(r"bytes (\d+)-(\d+)/(\d+|\*)")


class RangeSource(Protocol):
    """Anything that can return a byte range of one file."""

    @property
    def size(self) -> int | None: ...

    async def read(self, start: int, end: int) -> bytes:
        """Bytes ``[start, end)``. May return fewer bytes only at the end of the file."""
        ...

    async def read_suffix(self, length: int) -> bytes:
        """The last ``length`` bytes of the file."""
        ...


def padded(n: int) -> int:
    return -(-n // BLOCK) * BLOCK


def find_header_end(buf: bytes) -> int | None:
    """Length in bytes of the header that starts at ``buf[0]``, or None if ``END`` is not in buf."""
    for block_start in range(0, len(buf) - BLOCK + 1, BLOCK):
        block = buf[block_start : block_start + BLOCK]
        for card in range(0, BLOCK, CARD):
            if block[card : card + CARD] == _END or block[card : card + 8] == b"END     ":
                return block_start + BLOCK
    return None


def parse_header(buf: bytes) -> tuple[fits.Header, int] | None:
    """Parse the header at the start of ``buf``: ``(header, length)``, or None if incomplete."""
    length = find_header_end(buf)
    if length is None:
        return None
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", AstropyWarning)
        header = fits.Header.fromstring(buf[:length].decode("ascii", errors="replace"))
    return header, length


def data_length(header: fits.Header) -> int:
    """Unpadded length in bytes of the data that follows ``header`` (FITS standard §4.4.1)."""
    naxis = int(header.get("NAXIS", 0))
    if naxis == 0:
        return 0
    count = 1
    for i in range(1, naxis + 1):
        count *= int(header[f"NAXIS{i}"])
    bitpix = abs(int(header["BITPIX"]))
    gcount = int(header.get("GCOUNT", 1))
    pcount = int(header.get("PCOUNT", 0))
    return bitpix // 8 * gcount * (pcount + count)


def hdu_span(header: fits.Header, header_len: int) -> int:
    """Bytes from the start of this HDU's header to the start of the next HDU."""
    return header_len + padded(data_length(header))


class HttpRangeSource:
    """A :class:`RangeSource` over HTTP(S) that insists on real partial responses."""

    def __init__(self, client: httpx.AsyncClient, url: str, service: str) -> None:
        self.client = client
        self.url = url
        self.service = service
        self._size: int | None = None
        self.requests = 0

    @property
    def size(self) -> int | None:
        return self._size

    async def _get(self, range_header: str) -> bytes:
        self.requests += 1
        async with upstream(self.service):
            try:
                response = await self.client.get(self.url, headers={"Range": range_header})
            except (httpx.RemoteProtocolError, httpx.ReadError, httpx.ConnectError):
                # A dropped keep-alive connection is common on long links; one retry on a fresh
                # connection fixes nearly all of them.
                await asyncio.sleep(0.3)
                response = await self.client.get(self.url, headers={"Range": range_header})
            response.raise_for_status()
        if response.status_code != 206:
            raise UpstreamError(
                self.service,
                f"{self.service} ignored a byte-range request.",
                detail=f"HTTP {response.status_code} for {range_header}",
            )
        match = _CONTENT_RANGE.fullmatch(response.headers.get("content-range", ""))
        if match and match.group(3) != "*":
            self._size = int(match.group(3))
        return response.content

    async def read(self, start: int, end: int) -> bytes:
        if end <= start:
            return b""
        return await self._get(f"bytes={start}-{end - 1}")

    async def read_suffix(self, length: int) -> bytes:
        return await self._get(f"bytes=-{length}")


async def read_header_at(
    source: RangeSource, offset: int, *, first_blocks: int = 16, max_blocks: int = 64
) -> tuple[fits.Header, int]:
    """Read and parse the header that starts at ``offset``."""
    blocks = first_blocks
    while True:
        buf = await source.read(offset, offset + blocks * BLOCK)
        parsed = parse_header(buf)
        if parsed is not None:
            return parsed
        if len(buf) < blocks * BLOCK or blocks >= max_blocks:
            raise UpstreamError("SPHEREx archive", "A FITS header in the file could not be read.")
        blocks = min(blocks * 4, max_blocks)
