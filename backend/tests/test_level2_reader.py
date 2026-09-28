import io

import httpx
import numpy as np
import pytest
import respx
from astropy.io import fits

from spherex_explorer.archive import level2
from spherex_explorer.archive.fits_range import (
    BLOCK,
    HttpRangeSource,
    data_length,
    parse_header,
)
from spherex_explorer.archive.level2 import (
    Window,
    WindowRequest,
    flag_bits_from_header,
    read_window,
)
from spherex_explorer.errors import UpstreamError

from .synthetic import MemorySource, make_level2


def chooser(window: Window, target_row: int = 32):
    def choose(header: fits.Header, nx: int, ny: int) -> WindowRequest:
        assert (nx, ny) == (64, 64)
        return WindowRequest(window=window, target_row=target_row, variance_half_rows=3)

    return choose


@pytest.fixture(autouse=True)
def forget_learned_lengths():
    level2._learned_header_len.clear()
    yield
    level2._learned_header_len.clear()


@pytest.mark.parametrize("compressed", [False, True], ids=["qr2-layout", "qr3-layout"])
async def test_window_matches_the_full_arrays(compressed: bool) -> None:
    syn = make_level2(compressed_flags=compressed)
    source = MemorySource(syn.raw)
    win = Window(10, 20, 40, 45)
    result = await read_window(source, "qr2/level2/x.fits", chooser(win, target_row=30))

    np.testing.assert_array_equal(result.image, syn.image[20:45, 10:40])
    np.testing.assert_array_equal(result.flags, syn.flags[20:45, 10:40])
    np.testing.assert_array_equal(result.variance, syn.variance[27:34, 10:40])
    assert result.variance_y0 == 27
    assert result.zodi == pytest.approx(float(np.median(syn.zodi[30, 10:40])))
    assert result.header["EXTNAME"] == "IMAGE"
    assert result.flag_bits == {"TRANSIENT": 0, "HOT": 10, "SOURCE": 21}


async def test_compressed_flags_are_read_tile_by_tile() -> None:
    syn = make_level2(compressed_flags=True)
    # Open the flags as the binary table they are on disk, to know where the heap lies.
    hdul = fits.open(io.BytesIO(syn.raw), disable_image_compression=True)
    flags_hdu = hdul["FLAGS"]
    heap_start = flags_hdu._data_offset + flags_hdu.header.get("THEAP", 8 * 64)
    heap_len = flags_hdu.header["PCOUNT"]
    assert heap_len > 0
    source = MemorySource(syn.raw)
    await read_window(source, "qr3/level2/x.fits", chooser(Window(0, 2, 64, 12), target_row=5))
    heap_reads = [(a, b) for a, b in source.calls if a >= heap_start and b <= heap_start + heap_len]
    # One read of the heap, covering only the 10 requested rows' tiles.
    assert len(heap_reads) == 1
    a, b = heap_reads[0]
    assert b - a < heap_len * 0.3


async def test_request_count_is_small_and_learned_lengths_help() -> None:
    syn = make_level2()
    first = MemorySource(syn.raw)
    await read_window(first, "qr2/level2/a.fits", chooser(Window(0, 0, 32, 32)))
    second = MemorySource(syn.raw)
    await read_window(second, "qr2/level2/b.fits", chooser(Window(0, 0, 32, 32)))
    # The first file of a release may need re-reads for header lengths; later ones do not.
    assert second.requests <= first.requests
    assert second.requests <= 9


async def test_image_header_length_can_vary() -> None:
    short = make_level2(extra_cards=0)
    long = make_level2(extra_cards=60)  # pushes the IMAGE header into more blocks
    for syn in (short, long):
        result = await read_window(
            MemorySource(syn.raw), "qr2/level2/x.fits", chooser(Window(5, 5, 25, 25))
        )
        np.testing.assert_array_equal(result.image, syn.image[5:25, 5:25])


async def test_wavelength_lookup_uses_the_file_table() -> None:
    syn = make_level2()
    result = await read_window(
        MemorySource(syn.raw), "qr2/level2/x.fits", chooser(Window(0, 0, 8, 8))
    )
    wl_bottom, bw = result.wavelength_at(0, 0)
    wl_top, _ = result.wavelength_at(0, 63)
    assert wl_bottom == pytest.approx(1.10, abs=1e-6)
    assert wl_top == pytest.approx(1.60, abs=1e-6)
    assert bw == pytest.approx(1.10 / 41, rel=1e-5)


async def test_a_file_that_is_not_level2_is_rejected() -> None:
    raw = fits.HDUList([fits.PrimaryHDU(), fits.ImageHDU(np.zeros((4, 4)), name="SCI")])
    buf = io.BytesIO()
    raw.writeto(buf)
    with pytest.raises(UpstreamError, match="layout"):
        await read_window(MemorySource(buf.getvalue()), "qr2/x.fits", chooser(Window(0, 0, 2, 2)))


def test_flag_bits_parse_both_header_conventions() -> None:
    qr2 = fits.Header()
    qr2["HIERARCH MP_TRANSIENT"] = 0
    qr2["HIERARCH MP_SOURCE"] = 21
    qr3 = fits.Header()
    qr3["MSKN0000"] = "TRANSIENT"
    qr3["MSKN0021"] = "SOURCE"
    assert (
        flag_bits_from_header(qr2) == flag_bits_from_header(qr3) == {"TRANSIENT": 0, "SOURCE": 21}
    )


def test_real_qr2_flags_header_parses(fixtures) -> None:
    text = (fixtures / "qr2_flags_header.txt").read_text()
    bits = flag_bits_from_header(fits.Header.fromstring(text, sep="\n"))
    assert bits["TRANSIENT"] == 0
    assert bits["SOURCE"] == 21
    assert bits["HALO"] == 28


def test_header_parsing_and_data_length() -> None:
    syn = make_level2()
    header, length = parse_header(syn.raw[BLOCK:]) or (None, 0)
    assert header is not None and header["EXTNAME"] == "IMAGE"
    assert length % BLOCK == 0
    assert data_length(header) == 64 * 64 * 4
    assert parse_header(syn.raw[BLOCK : BLOCK + 80]) is None


@respx.mock
async def test_http_range_source_requires_partial_content() -> None:
    url = "https://example.test/file.fits"
    body = bytes(range(256)) * 40

    def reply(request: httpx.Request) -> httpx.Response:
        spec = request.headers["range"].removeprefix("bytes=")
        if spec.startswith("-"):
            n = int(spec[1:])
            start, end = len(body) - n, len(body) - 1
        else:
            a, b = spec.split("-")
            start, end = int(a), int(b)
        return httpx.Response(
            206,
            content=body[start : end + 1],
            headers={"Content-Range": f"bytes {start}-{end}/{len(body)}"},
        )

    respx.get(url).mock(side_effect=reply)
    async with httpx.AsyncClient() as client:
        source = HttpRangeSource(client, url, "test")
        assert await source.read(10, 20) == body[10:20]
        assert await source.read_suffix(5) == body[-5:]
        assert source.size == len(body)
        assert source.requests == 2


@respx.mock
async def test_http_range_source_rejects_full_responses() -> None:
    url = "https://example.test/file.fits"
    respx.get(url).mock(return_value=httpx.Response(200, content=b"x" * 100))
    async with httpx.AsyncClient() as client:
        with pytest.raises(UpstreamError, match="byte-range"):
            await HttpRangeSource(client, url, "test").read(0, 10)
