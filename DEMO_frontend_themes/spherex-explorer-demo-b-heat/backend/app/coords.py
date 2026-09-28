"""Parse sky positions typed by a visitor.

Accepted forms (ICRS unless marked galactic):

    10.6847 +41.2690            decimal degrees
    10.6847, 41.269
    00h42m44.3s +41d16m09s      sexagesimal, with markers
    00:42:44.3 +41:16:09        sexagesimal, with colons
    00 42 44.3 +41 16 09        sexagesimal, with spaces
    l=121.17 b=-21.57           galactic longitude and latitude
    gal 121.17 -21.57

Anything else is treated as an object name and resolved elsewhere.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass


class CoordinateError(ValueError):
    """The text looks like coordinates but can't be read as a valid position."""


@dataclass(frozen=True)
class SkyPosition:
    ra: float  # degrees, ICRS
    dec: float  # degrees, ICRS
    frame: str  # "icrs" or "galactic": what the visitor typed
    l: float | None = None
    b: float | None = None


# Rotation from ICRS (J2000) unit vectors to galactic ones.
_ICRS_TO_GAL = (
    (-0.0548755604162154, -0.8734370902348850, -0.4838350155487132),
    (0.4941094278755837, -0.4448296299600112, 0.7469822444972189),
    (-0.8676661490190047, -0.1980763734312015, 0.4559837761750669),
)

_NUM = r"[-+]?\d+(?:\.\d+)?"
_GALACTIC = [
    re.compile(rf"^(?:gal(?:actic)?\s*[:,]?\s*)?l\s*=\s*({_NUM})\s*[,;]?\s*b\s*=\s*({_NUM})$"),
    re.compile(rf"^gal(?:actic)?\s*[:,]?\s*({_NUM})\s*[,;\s]\s*({_NUM})$"),
]
_TOKEN = re.compile(r"^[-+]?\d+(?:\.\d+)?$")


def galactic_to_icrs(l_deg: float, b_deg: float) -> tuple[float, float]:
    lr, br = math.radians(l_deg), math.radians(b_deg)
    g = (math.cos(br) * math.cos(lr), math.cos(br) * math.sin(lr), math.sin(br))
    # The inverse of a rotation is its transpose.
    e = [sum(_ICRS_TO_GAL[j][i] * g[j] for j in range(3)) for i in range(3)]
    ra = math.degrees(math.atan2(e[1], e[0])) % 360.0
    dec = math.degrees(math.asin(max(-1.0, min(1.0, e[2]))))
    return ra, dec


def _check(ra: float, dec: float) -> None:
    if not 0.0 <= ra < 360.0:
        raise CoordinateError(f"Right ascension must be between 0 and 360 degrees, got {ra:g}.")
    if not -90.0 <= dec <= 90.0:
        raise CoordinateError(f"Declination must be between -90 and +90 degrees, got {dec:g}.")


def _sexagesimal(tokens: list[str]) -> tuple[float, float]:
    h, m, s, d, dm, ds = (float(t) for t in tokens)
    if h >= 24 or m >= 60 or s >= 60:
        raise CoordinateError("Right ascension must be under 24h, with minutes and seconds under 60.")
    if abs(d) > 90 or dm >= 60 or ds >= 60:
        raise CoordinateError("Declination must be within ±90°, with minutes and seconds under 60.")
    sign = -1.0 if tokens[3].startswith("-") else 1.0
    ra = (h + m / 60 + s / 3600) * 15.0
    dec = sign * (abs(d) + dm / 60 + ds / 3600)
    return ra, dec


def parse_position(text: str) -> SkyPosition | None:
    """Returns a position, or None if the text isn't coordinates (so it's a name)."""
    raw = text.strip().replace("\u2212", "-").replace("\u2013", "-")
    lowered = raw.lower()

    for pattern in _GALACTIC:
        match = pattern.match(lowered)
        if match:
            l_deg, b_deg = float(match.group(1)), float(match.group(2))
            if not -90.0 <= b_deg <= 90.0:
                raise CoordinateError(f"Galactic latitude must be between -90 and +90 degrees, got {b_deg:g}.")
            ra, dec = galactic_to_icrs(l_deg % 360.0, b_deg)
            return SkyPosition(ra=ra, dec=dec, frame="galactic", l=l_deg % 360.0, b=b_deg)

    # Turn unit markers and separators into spaces, then look at the numbers.
    cleaned = re.sub(r"(?<=\d)[hdmsHDMS°'\":]", " ", raw)
    cleaned = cleaned.replace(",", " ")
    tokens = cleaned.split()
    if not tokens or not all(_TOKEN.match(t) for t in tokens):
        return None

    if len(tokens) == 2:
        ra, dec = float(tokens[0]), float(tokens[1])
    elif len(tokens) == 6:
        ra, dec = _sexagesimal(tokens)
    else:
        raise CoordinateError(
            "Coordinates need two numbers in degrees, or six for hours-minutes-seconds and degrees-minutes-seconds."
        )
    _check(ra, dec)
    return SkyPosition(ra=ra, dec=dec, frame="icrs")
