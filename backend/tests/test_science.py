import base64
import math

import numpy as np
import pytest
from astropy.io import fits

from spherex_explorer.archive.keys import FrameKey
from spherex_explorer.archive.level2 import Level2Window, Window
from spherex_explorer.archive.spectral import SpectralTable
from spherex_explorer.errors import InvalidQuery
from spherex_explorer.science.cutout import MASK_FLAGGED, MASK_NO_DATA, build_payload
from spherex_explorer.science.grid import make_grid, resample, sky_wcs, source_window
from spherex_explorer.science.masking import DEFAULT_MASKED, bit_table, mask_value, names_set
from spherex_explorer.science.photometry import (
    ARCSEC2_TO_SR,
    aperture_photometry,
    estimate_background,
)

from .synthetic import image_header, wave_table

PIXEL_SR = 37.86 * ARCSEC2_TO_SR


def north_up_header(n: int, ra: float, dec: float) -> fits.Header:
    h = fits.Header()
    h["CTYPE1"], h["CTYPE2"] = "RA---TAN", "DEC--TAN"
    h["CRVAL1"], h["CRVAL2"] = ra, dec
    h["CRPIX1"], h["CRPIX2"] = (n + 1) / 2, (n + 1) / 2
    h["CDELT1"], h["CDELT2"] = -6.15 / 3600, 6.15 / 3600
    return h


def gaussian_star(shape, cx, cy, total, fwhm_px=1.2):
    sigma = fwhm_px / 2.3548
    yy, xx = np.mgrid[0 : shape[0], 0 : shape[1]]
    g = np.exp(-((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * sigma**2))
    return (g / g.sum() * total).astype(np.float32)


def test_grid_is_odd_centred_and_north_up() -> None:
    grid = make_grid(161.3, 2.45, 0.2)
    assert grid.size_px % 2 == 1
    assert grid.size_px == 117
    w = grid.wcs()
    ra, dec = w.pixel_to_world_values(grid.centre, grid.centre)
    assert ra == pytest.approx(161.3) and dec == pytest.approx(2.45)
    # One pixel up is north (dec grows); one pixel right is west (RA falls).
    _, dec_up = w.pixel_to_world_values(grid.centre, grid.centre + 1)
    ra_right, _ = w.pixel_to_world_values(grid.centre + 1, grid.centre)
    assert dec_up > 2.45 and ra_right < 161.3


def test_resampling_onto_the_same_grid_is_the_identity() -> None:
    grid = make_grid(161.3, 2.45, 0.1)
    n = grid.size_px
    header = north_up_header(n, 161.3, 2.45)
    image = np.random.default_rng(3).normal(1.0, 0.1, (n, n)).astype(np.float32)
    good = np.ones((n, n), dtype=bool)
    out = resample(grid, header, Window(0, 0, n, n), image, good)
    np.testing.assert_allclose(out.image, image, atol=1e-5)
    assert out.covered.all() and not out.bad.any()


def test_flagged_pixels_do_not_leak_into_neighbours() -> None:
    grid = make_grid(161.3, 2.45, 0.1)
    n = grid.size_px
    header = north_up_header(n, 161.3, 2.45)
    image = np.ones((n, n), dtype=np.float32)
    image[10, 10] = 1e6  # a hot pixel
    good = np.ones((n, n), dtype=bool)
    good[10, 10] = False
    out = resample(grid, header, Window(0, 0, n, n), image, good)
    assert np.nanmax(out.image) == pytest.approx(1.0, abs=1e-5)
    assert out.bad[10, 10]


def test_source_window_covers_a_rotated_grid_and_misses_far_away() -> None:
    header = image_header(64, 64)
    grid = make_grid(161.3, 2.45, 0.05)
    win = source_window(grid, header, 64, 64)
    assert win is not None
    # A 0.05° grid rotated 30° needs a window wider than the grid itself.
    assert win.width >= grid.size_px
    assert source_window(make_grid(200.0, -30.0, 0.05), header, 64, 64) is None


def test_background_is_robust_to_a_bright_star() -> None:
    rng = np.random.default_rng(0)
    image = rng.normal(0.4, 0.01, (60, 60)).astype(np.float32)
    image += gaussian_star(image.shape, 30, 30, 500.0)
    bg = estimate_background(image, np.ones(image.shape, dtype=bool))
    assert bg is not None
    assert bg.level == pytest.approx(0.4, abs=0.003)
    assert bg.rms == pytest.approx(0.01, rel=0.2)


def test_aperture_photometry_recovers_a_known_point_source() -> None:
    total = 2.0  # MJy/sr summed over pixels
    image = np.full((40, 40), 0.3, dtype=np.float32) + gaussian_star((40, 40), 20.3, 19.6, total)
    variance = np.full((40, 40), 1e-6, dtype=np.float32)
    usable = np.ones((40, 40), dtype=bool)
    phot = aperture_photometry(
        image, variance, usable, np.zeros_like(usable), 20.3, 19.6, PIXEL_SR, variance_rows=(0, 40)
    )
    expected_ujy = total * PIXEL_SR * 1e12
    # A 2 px aperture holds essentially all of a 1.2 px FWHM Gaussian.
    assert phot.flux_ujy == pytest.approx(expected_ujy, rel=0.02)
    assert phot.error_ujy is not None and phot.error_ujy > 0
    assert phot.snr is not None and phot.snr > 100
    assert phot.reliable
    assert phot.ab_mag == pytest.approx(-2.5 * math.log10(expected_ujy * 1e-6 / 3631), abs=0.03)


def test_photometry_reports_masked_and_saturated_pixels() -> None:
    image = np.full((30, 30), 0.3, dtype=np.float32) + gaussian_star((30, 30), 15, 15, 1.0)
    usable = np.ones((30, 30), dtype=bool)
    usable[15, 16] = False
    image[15, 16] = np.nan
    overflow = np.zeros((30, 30), dtype=bool)
    overflow[15, 15] = True
    phot = aperture_photometry(image, None, usable, overflow, 15, 15, PIXEL_SR)
    assert phot.flux_ujy is not None and math.isfinite(phot.flux_ujy)
    assert not phot.reliable
    assert phot.masked_in_aperture == 1
    assert any("overflow" in r for r in phot.reasons)


def test_photometry_at_the_edge_is_refused() -> None:
    image = np.ones((20, 20), dtype=np.float32)
    usable = np.ones((20, 20), dtype=bool)
    phot = aperture_photometry(image, None, usable, np.zeros_like(usable), -1.5, 10, PIXEL_SR)
    assert phot.flux_ujy is None and not phot.reliable


def test_default_mask_and_flag_names() -> None:
    bits = bit_table({"TRANSIENT": 0, "SOURCE": 21})
    value = mask_value(bits)
    assert value >> 0 & 1  # TRANSIENT masked
    assert not value >> 21 & 1  # SOURCE is informational
    assert not value >> 1 & 1  # OVERFLOW is informational
    assert set(DEFAULT_MASKED) <= set(bits)
    assert names_set((1 << 0) | (1 << 21), bits) == ["SOURCE", "TRANSIENT"]


def test_frame_key_validation() -> None:
    key = (
        "qr2/level2/2025W49_1A/l2b-v20-2025-339/2/"
        "level2_2025W49_1A_0332_1D2_spx_l2b-v20-2025-339.fits"
    )
    fk = FrameKey.parse(key)
    assert (fk.release, fk.obs_id, fk.detector) == ("qr2", "2025W49_1A_0332_1", 2)
    retry = (
        "qr3/level2/2026W31_2A/l2b_retry-v27-2026-242/5/"
        "level2_2026W31_2A_0101_3D5_spx_l2b_retry-v27-2026-242.fits"
    )
    assert FrameKey.parse(retry).detector == 5
    for bad in [
        "../etc/passwd",
        # detector in the path and in the file name disagree
        key.replace("level2_2025W49_1A_0332_1D2", "level2_2025W49_1A_0332_1D3"),
        "https://evil.example/qr2/level2/x.fits",
        key + "?x=1",
        "qr2/abs_gain_matrix/cal-agm-v7-2025-218/1/abs_gain_matrix_D1_spx_cal-agm-v7-2025-218.fits",
    ]:
        with pytest.raises(InvalidQuery):
            FrameKey.parse(bad)


def synthetic_window(ra: float, dec: float) -> Level2Window:
    header = image_header(64, 64, ra=ra, dec=dec)
    rng = np.random.default_rng(5)
    image = rng.normal(0.4, 0.01, (64, 64)).astype(np.float32)
    tx, ty = (float(v) for v in sky_wcs(header).world_to_pixel_values(ra, dec))
    image += gaussian_star((64, 64), tx, ty, 3.0)
    flags = np.zeros((64, 64), dtype=np.int32)
    flags[5, 5] = 1 << 10  # HOT, far from the target
    wave = wave_table(64, 64)
    return Level2Window(
        header=header,
        window=Window(0, 0, 64, 64),
        image=image,
        flags=flags,
        variance=np.full((64, 64), 1e-4, dtype=np.float32),
        variance_y0=0,
        zodi=0.35,
        spectral=SpectralTable.from_hdu(wave),
        flag_bits={"HOT": 10, "OVERFLOW": 1, "SOURCE": 21},
        release="qr2",
        access="s3",
        pipeline="6.4",
        requests=9,
    )


def test_payload_has_units_methods_and_decodable_arrays() -> None:
    ra, dec = 161.3, 2.45
    win = synthetic_window(ra, dec)
    grid = make_grid(ra, dec, 0.05)
    key = FrameKey.parse(
        "qr2/level2/2025W49_1A/l2b-v20-2025-339/2/level2_2025W49_1A_0332_1D2_spx_l2b-v20-2025-339.fits"
    )
    p = build_payload(key, grid, win)

    n = grid.size_px
    image = np.frombuffer(base64.b64decode(p["image"]["data"]), dtype="<f4").reshape(n, n)
    mask = np.frombuffer(base64.b64decode(p["mask"]["data"]), dtype=np.uint8).reshape(n, n)
    assert image.shape == (n, n) and mask.shape == (n, n)
    c = n // 2
    # The star is at the target, which is the centre of the grid.
    assert np.nanargmax(image) == c * n + c
    assert not (mask & MASK_NO_DATA).all()
    assert set(np.unique(mask)) <= {0, MASK_FLAGGED, MASK_NO_DATA, MASK_FLAGGED | MASK_NO_DATA}

    assert p["background"]["levelMJySr"] == pytest.approx(0.4, abs=0.005)
    assert p["image"]["unit"].startswith("MJy/sr")
    assert p["target"]["inFrame"] is True
    assert p["photometry"]["reliable"] is True
    assert p["photometry"]["fluxMicroJy"] == pytest.approx(
        3.0 * 37.86 * ARCSEC2_TO_SR * 1e12, rel=0.05
    )
    # Wavelength at the centre of the synthetic filter: 1.10 + 0.5 × (y / 63) + a little along x.
    assert 1.3 < p["wavelength"]["atTargetUm"] < 1.4
    assert p["time"]["isoMid"].startswith("2025-12-02")
    assert p["spacecraft"]["positionKm"][0] == pytest.approx(5481.95)
    assert "HOT" in p["mask"]["maskedFlags"]


def test_display_fill_closes_large_holes() -> None:
    from spherex_explorer.science.grid import fill_for_display

    image = np.full((40, 40), 5.0, dtype=np.float32)
    holes = np.zeros((40, 40), dtype=bool)
    holes[15:25, 15:25] = True  # a 10×10 flagged core with no clean pixel inside
    image[holes] = np.nan
    filled = fill_for_display(image, holes)
    assert np.isfinite(filled[holes]).all()
    assert filled[holes] == pytest.approx(5.0, abs=1e-4)
    assert (filled[~holes] == 5.0).all()  # real pixels are untouched


def test_a_mostly_flagged_aperture_is_not_measured() -> None:
    # QR3 flags a saturated galaxy core as BLOOM across the whole aperture; summing the few
    # unflagged pixels would report a bright source as zero.
    image = np.full((30, 30), 0.3, dtype=np.float32) + gaussian_star((30, 30), 15, 15, 50.0)
    usable = np.ones((30, 30), dtype=bool)
    usable[12:19, 12:19] = False
    phot = aperture_photometry(image, None, usable, np.zeros_like(usable), 15, 15, PIXEL_SR)
    assert phot.flux_ujy is None
    assert not phot.reliable
    assert "not measurable" in phot.reasons[0]
