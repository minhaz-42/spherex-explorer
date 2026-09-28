import math

import pytest

from app.coords import CoordinateError, galactic_to_icrs, parse_position


def close(a, b, tol=1e-3):
    return math.isclose(a, b, abs_tol=tol)


@pytest.mark.parametrize(
    "text",
    ["10.6847 +41.2690", "10.6847, 41.269", "10.6847,+41.2690", "  10.6847   41.269 "],
)
def test_decimal(text):
    p = parse_position(text)
    assert p and p.frame == "icrs" and close(p.ra, 10.6847) and close(p.dec, 41.269)


@pytest.mark.parametrize(
    "text",
    ["00h42m44.3s +41d16m09s", "00:42:44.3 +41:16:09", "00 42 44.3 +41 16 09", "00h42m44.3s +41°16'09\""],
)
def test_sexagesimal(text):
    p = parse_position(text)
    assert p and close(p.ra, 10.68458) and close(p.dec, 41.26917)


def test_negative_declination_with_zero_degrees():
    p = parse_position("05:35:17.3 -00:30:00")
    assert p and p.dec < 0 and close(p.dec, -0.5)


def test_unicode_minus():
    p = parse_position("83.82 \u22125.39")
    assert p and close(p.dec, -5.39)


@pytest.mark.parametrize("text", ["l=121.17 b=-21.57", "gal 121.17 -21.57", "L = 121.17, B = -21.57"])
def test_galactic_is_converted_to_icrs(text):
    p = parse_position(text)
    assert p and p.frame == "galactic"
    # M31 is at l=121.17, b=-21.57; RA 10.68, Dec 41.27
    assert close(p.ra, 10.68, 0.02) and close(p.dec, 41.27, 0.02)


def test_galactic_centre():
    ra, dec = galactic_to_icrs(0.0, 0.0)
    assert close(ra, 266.405, 0.01) and close(dec, -28.936, 0.01)


@pytest.mark.parametrize("text", ["M31", "NGC 1976", "3C 273", "36 Sex", "Vega", "(7) Iris"])
def test_names_are_not_coordinates(text):
    assert parse_position(text) is None


@pytest.mark.parametrize("text", ["400 10", "10 95", "25:00:00 +10:00:00", "10 20 30"])
def test_invalid_coordinates_explain_themselves(text):
    with pytest.raises(CoordinateError):
        parse_position(text)
