"""Parse the ways people write sky positions.

Accepted, with commas or spaces between the two coordinates:

- decimal degrees: ``10.6847 41.2690``, ``10.6847d +41.269d``, ``10.6847° 41.269°``
- sexagesimal RA in hours: ``00:42:44.3 +41:16:08``, ``00 42 44.3 +41 16 08``,
  ``00h42m44.3s +41d16m08s``, ``0h42m44s 41°16′08″``
- galactic: ``l=121.17 b=-21.57`` or ``galactic 121.17 -21.57``

``parse`` returns None for text that is not a position (it is then treated as a name) and raises
:class:`InvalidQuery` for text that is clearly a position but impossible (Dec above 90°).
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass

import astropy.units as u
from astropy.coordinates import SkyCoord

from ..errors import InvalidQuery

_NUM = r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)"
_SEP = r"(?:\s*,\s*|\s+)"

_DECIMAL = re.compile(rf"^(?P<ra>{_NUM})\s*(?:d|deg|°)?{_SEP}(?P<dec>{_NUM})\s*(?:d|deg|°)?$", re.I)
_SEXA_COLON = re.compile(
    rf"^(?P<h>\d{{1,2}})[:\s](?P<m>\d{{1,2}})[:\s](?P<s>{_NUM}){_SEP}"
    rf"(?P<sign>[+-]?)(?P<d>\d{{1,2}})[:\s](?P<dm>\d{{1,2}})[:\s](?P<ds>{_NUM})$"
)
_SEXA_LETTERS = re.compile(
    rf"^(?P<h>\d{{1,2}})\s*h\s*(?P<m>\d{{1,2}})\s*m\s*(?:(?P<s>{_NUM})\s*s?)?{_SEP}"
    rf"(?P<sign>[+-]?)(?P<d>\d{{1,2}})\s*(?:d|°)\s*(?P<dm>\d{{1,2}})\s*(?:m|'|′)\s*"
    rf"(?:(?P<ds>{_NUM})\s*(?:s|\"|″)?)?$",
    re.I,
)
_GALACTIC = re.compile(
    rf"^(?:l\s*=\s*(?P<l>{_NUM})\s*,?\s*b\s*=\s*(?P<b>{_NUM})|gal(?:actic)?:?\s+(?P<l2>{_NUM}){_SEP}(?P<b2>{_NUM}))$",
    re.I,
)


@dataclass(frozen=True)
class Position:
    ra: float
    dec: float
    system: str  # how the visitor wrote it: "icrs" or "galactic"


def _check(ra: float, dec: float) -> Position:
    if not (math.isfinite(ra) and math.isfinite(dec)):
        raise InvalidQuery("Coordinates must be numbers.")
    if not -90 <= dec <= 90:
        raise InvalidQuery(f"Declination must be between −90° and +90°; got {dec:g}°.")
    if not 0 <= ra < 360:
        if -360 < ra < 0 or ra == 360:
            ra %= 360
        else:
            raise InvalidQuery(f"Right ascension must be between 0° and 360°; got {ra:g}°.")
    return Position(ra=ra, dec=dec, system="icrs")


def _sexagesimal(m: re.Match[str]) -> Position:
    h, mi = int(m["h"]), int(m["m"])
    s = float(m["s"] or 0)
    d, dm = int(m["d"]), int(m["dm"])
    ds = float(m["ds"] or 0)
    if h > 23 or mi > 59 or s >= 60:
        raise InvalidQuery(
            "Right ascension in hours must be below 24h, with minutes and seconds below 60."
        )
    if dm > 59 or ds >= 60:
        raise InvalidQuery("Declination minutes and seconds must be below 60.")
    ra = 15 * (h + mi / 60 + s / 3600)
    dec = d + dm / 60 + ds / 3600
    if m["sign"] == "-":
        dec = -dec
    return _check(ra, dec)


def parse(text: str) -> Position | None:
    q = " ".join(text.strip().replace("−", "-").split())
    if not q:
        return None
    if m := _GALACTIC.match(q):
        lon = float(m["l"] if m["l"] is not None else m["l2"])
        lat = float(m["b"] if m["b"] is not None else m["b2"])
        if not -90 <= lat <= 90:
            raise InvalidQuery(f"Galactic latitude must be between −90° and +90°; got {lat:g}°.")
        c = SkyCoord(l=lon * u.deg, b=lat * u.deg, frame="galactic").icrs
        return Position(ra=float(c.ra.deg), dec=float(c.dec.deg), system="galactic")
    if m := _DECIMAL.match(q):
        return _check(float(m["ra"]), float(m["dec"]))
    if m := _SEXA_COLON.match(q):
        return _sexagesimal(m)
    if m := _SEXA_LETTERS.match(q):
        return _sexagesimal(m)
    # Looks numeric but did not parse: say so instead of sending it to the name resolver.
    # Catalogue names such as "HD 209458" start with letters, so require a leading digit or sign.
    looks_numeric = re.fullmatch(r"[+-]?\d[\d\s.,:+\-hmsd°′″'\"]*", q, re.I)
    if looks_numeric and sum(c.isdigit() for c in q) >= 3:
        raise InvalidQuery(
            "That looks like coordinates but could not be read. Try 10.6847 41.2690 "
            "or 00:42:44.3 +41:16:08."
        )
    return None
