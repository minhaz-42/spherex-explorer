import json
from itertools import pairwise

import numpy as np
import pytest
from astropy.io import fits

from spherex_explorer.archive.footprint import estimate_wavelength, parse_polygon, target_pixel
from spherex_explorer.archive.frames import group_passes, normalise
from spherex_explorer.archive.sia import parse_sia_csv, sia_params
from spherex_explorer.errors import InvalidQuery, NotFound, UpstreamError
from spherex_explorer.resolve import coords
from spherex_explorer.resolve.sesame import parse_sesame
from spherex_explorer.resolve.target import deep_field_at, describe
from spherex_explorer.science.grid import sky_wcs

M31 = (10.6847, 41.2690)
# The s_region of frame 2025W51_1A_0684_2 D3, copied from its SIA row.
M31_D3_REGION = (
    "POLYGON ICRS 6.962852120551271 41.75009330770693 11.28249000497766 43.137330881450204 "
    "13.174643355147754 39.946653279470475 8.97915502445252 38.62459220149968 "
    "6.962852120551271 41.75009330770693"
)


@pytest.mark.parametrize(
    ("text", "ra", "dec"),
    [
        ("10.6847 41.2690", 10.6847, 41.2690),
        ("10.6847, +41.2690", 10.6847, 41.2690),
        ("10.6847d 41.269d", 10.6847, 41.269),
        ("10.6847° −41.269°", 10.6847, -41.269),
        ("00:42:44.3 +41:16:08", 10.684583, 41.268889),
        ("00 42 44.3 +41 16 08", 10.684583, 41.268889),
        ("00h42m44.3s +41d16m08s", 10.684583, 41.268889),
        ("0h42m44s 41°16′08″", 10.683333, 41.268889),
        ("18:00:00 -66:33:38.6", 270.0, -66.560722),
    ],
)
def test_coordinates_in_common_formats(text: str, ra: float, dec: float) -> None:
    pos = coords.parse(text)
    assert pos is not None
    assert pos.ra == pytest.approx(ra, abs=1e-5)
    assert pos.dec == pytest.approx(dec, abs=1e-5)


def test_galactic_coordinates_are_converted() -> None:
    pos = coords.parse("l=0 b=0")
    assert pos is not None and pos.system == "galactic"
    # The Galactic centre is at about RA 266.40°, Dec −28.94°.
    assert pos.ra == pytest.approx(266.405, abs=0.01)
    assert pos.dec == pytest.approx(-28.936, abs=0.01)


@pytest.mark.parametrize("text", ["M31", "Betelgeuse", "NGC 1333", "Orion Nebula", "HD 209458"])
def test_names_are_not_coordinates(text: str) -> None:
    assert coords.parse(text) is None


@pytest.mark.parametrize("text", ["10 95", "24:00:00 +10:00:00", "10:61:00 +10:00:00", "12.3.4 5"])
def test_impossible_coordinates_are_rejected(text: str) -> None:
    with pytest.raises(InvalidQuery):
        coords.parse(text)


def test_sesame_answer_is_parsed(fixtures) -> None:
    hit = parse_sesame((fixtures / "sesame_m31.xml").read_text(), "M31")
    assert hit.ra == pytest.approx(10.68470833)
    assert hit.dec == pytest.approx(41.26875)
    assert hit.name == "M 31"
    assert hit.otype == "AGN"
    assert hit.resolver == "Simbad"


def test_sesame_unknown_name_is_not_found(fixtures) -> None:
    with pytest.raises(NotFound, match="No object called"):
        parse_sesame((fixtures / "sesame_notfound.xml").read_text(), "NotARealObjectXYZ")


def test_solar_system_names_get_a_helpful_message(fixtures) -> None:
    with pytest.raises(NotFound, match="move across the sky"):
        parse_sesame((fixtures / "sesame_notfound.xml").read_text(), "Planet X")


def test_sia_request_parameters() -> None:
    params = sia_params(["spherex_qr2", "spherex_qr3"], 10.5, -5.25, time_range=(61000, 61003))
    assert params[0] == ("COLLECTION", "spherex_qr2") and params[1] == ("COLLECTION", "spherex_qr3")
    assert ("RESPONSEFORMAT", "CSV") in params
    assert ("TIME", "61000.000000 61003.000000") in params


def test_sia_error_documents_are_detected(fixtures) -> None:
    with pytest.raises(UpstreamError) as err:
        parse_sia_csv((fixtures / "sia_error.txt").read_text())
    assert "outside valid interval" in (err.value.detail or "")


def test_sia_empty_and_malformed_responses() -> None:
    assert parse_sia_csv("") == []
    with pytest.raises(UpstreamError):
        parse_sia_csv("a,b,c\n1,2,3\n")


def test_polygon_parsing() -> None:
    points = parse_polygon(M31_D3_REGION)
    assert len(points) == 4
    assert points[0] == pytest.approx((6.962852120551271, 41.75009330770693))
    with pytest.raises(ValueError):
        parse_polygon("CIRCLE ICRS 1 2 3")


def test_footprint_places_the_target_within_a_few_pixels(fixtures) -> None:
    # The IRSA cutout header of the same frame, shifted back to parent-image pixels.
    header = fits.Header.fromstring(
        (fixtures / "qr2_cutout_image_header.txt").read_text(), sep="\n"
    )
    header["CRPIX1"] += 1292
    header["CRPIX2"] += 863
    tx, ty = (float(v) for v in sky_wcs(header).world_to_pixel_values(*M31))
    est = target_pixel(M31_D3_REGION, *M31)
    assert est is not None
    # SIP distortion is not modelled; the residual is about 5 px (0.002 µm of wavelength).
    assert np.hypot(est[0] - tx, est[1] - ty) < 6.0


def test_wavelength_estimate_matches_the_wcs_value(fixtures) -> None:
    # The live pipeline measured 2.0247 µm at the centre of this M31 cutout from its own table.
    est = target_pixel(M31_D3_REGION, *M31)
    assert est is not None
    wavelength = estimate_wavelength("qr2", 3, *est)
    assert wavelength is not None
    assert wavelength[0] == pytest.approx(2.0247, abs=0.003)


def test_iris_frames_normalise_with_accurate_wavelengths(fixtures) -> None:
    rows = parse_sia_csv((fixtures / "sia_iris_d2.csv").read_text())
    truth = json.loads((fixtures / "iris_positions.json").read_text())
    ra, dec = truth["grid_centre"]
    frames = normalise(rows, ra, dec)
    assert len(frames) == 14
    assert [f.mjdMid for f in frames] == sorted(f.mjdMid for f in frames)
    by_obs = {f.obsId: f for f in frames}
    for obs_id, wcs_value in truth["wcs_wavelength_um"].items():
        estimate = by_obs[obs_id].wavelengthUm
        bandwidth = by_obs[obs_id].bandwidthUm
        assert estimate is not None and bandwidth is not None
        # Within a fifth of a spectral channel.
        assert abs(estimate - wcs_value) < 0.2 * bandwidth, obs_id
    first = frames[0]
    assert first.detector == 2 and first.release == "qr2" and first.step == 1
    assert first.pointing == "2025W49_1A_0332"
    assert first.key.startswith("qr2/level2/2025W49_1A/")
    assert first.isoMid.startswith("2025-12-02T12:0")


def test_m31_frames_group_into_survey_passes(fixtures) -> None:
    rows = parse_sia_csv((fixtures / "sia_m31.csv").read_text())
    frames = normalise(rows, *M31)
    passes = group_passes(frames)
    assert len(frames) >= 25
    assert len(passes) >= 3
    starts = [p["isoStart"] for p in passes]
    assert starts[0].startswith("2025-07")
    assert all(f.passIndex >= 0 for f in frames)
    assert sum(p["frames"] for p in passes) == len(frames)
    # Passes are separated by more than 20 days.
    for a, b in pairwise(passes):
        assert b["mjdStart"] - a["mjdEnd"] > 20


def test_duplicate_rows_are_dropped(fixtures) -> None:
    rows = parse_sia_csv((fixtures / "sia_iris_d2.csv").read_text())
    truth = json.loads((fixtures / "iris_positions.json").read_text())
    assert len(normalise(rows + rows, *truth["grid_centre"])) == 14


def test_target_context() -> None:
    info = describe(*M31)
    assert info["constellation"] == "Andromeda"
    assert info["raHms"].startswith("00:42:44")
    assert info["deepField"] is None
    assert deep_field_at(270.0, 66.56) is not None
    assert describe(270.0, 66.56)["deepField"] == "North ecliptic pole deep field"


def test_the_south_deep_field_is_where_the_archive_has_its_frames() -> None:
    # IRSA's deep collections have frames at ecliptic (+44.8°, −82°) and none at (−44.8°, −82°).
    assert describe(78.4651, -60.4058)["deepField"] == "South deep field"
    assert deep_field_at(72.0, -71.3629) is None
    # The Large Magellanic Cloud, which the field was placed to avoid, is outside it.
    assert deep_field_at(80.894, -69.756) is None
