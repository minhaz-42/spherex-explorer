"""Context for a sky position: other coordinate systems, constellation, deep-field membership."""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import astropy.units as u
from astropy.coordinates import BarycentricMeanEcliptic, SkyCoord, get_constellation

# SPHEREx deep fields: about 100 deg² each. The north field is centred on the north ecliptic
# pole; the south one on ecliptic (+44.8°, −82°), RA 78.47°, Dec −60.41°, clear of the Magellanic
# Clouds (Bock et al. 2025). The sign of the longitude is checked against the archive: IRSA's deep
# collections return frames at +44.8° and none at −44.8° (docs/research, "Deep fields").
DEEP_FIELD_RADIUS_DEG = 6.5


@dataclass(frozen=True)
class DeepField:
    name: str
    ra: float
    dec: float


@lru_cache
def deep_fields() -> tuple[DeepField, ...]:
    north = SkyCoord(lon=0 * u.deg, lat=90 * u.deg, frame=BarycentricMeanEcliptic()).icrs
    south = SkyCoord(lon=44.8 * u.deg, lat=-82 * u.deg, frame=BarycentricMeanEcliptic()).icrs
    return (
        DeepField("North ecliptic pole deep field", float(north.ra.deg), float(north.dec.deg)),
        DeepField("South deep field", float(south.ra.deg), float(south.dec.deg)),
    )


def deep_field_at(ra: float, dec: float) -> DeepField | None:
    here = SkyCoord(ra * u.deg, dec * u.deg)
    for field in deep_fields():
        if (
            here.separation(SkyCoord(field.ra * u.deg, field.dec * u.deg)).deg
            <= DEEP_FIELD_RADIUS_DEG
        ):
            return field
    return None


def describe(ra: float, dec: float) -> dict[str, Any]:
    c = SkyCoord(ra * u.deg, dec * u.deg, frame="icrs")
    gal = c.galactic
    ecl = c.transform_to(BarycentricMeanEcliptic())
    field = deep_field_at(ra, dec)
    return {
        "ra": round(ra, 7),
        "dec": round(dec, 7),
        "raHms": c.ra.to_string(unit=u.hourangle, sep=":", precision=2, pad=True),
        "decDms": c.dec.to_string(unit=u.deg, sep=":", precision=1, alwayssign=True, pad=True),
        "galactic": {"l": round(float(gal.l.deg), 4), "b": round(float(gal.b.deg), 4)},
        "ecliptic": {"lon": round(float(ecl.lon.deg), 4), "lat": round(float(ecl.lat.deg), 4)},
        "constellation": str(get_constellation(c)),
        "deepField": field.name if field else None,
    }
