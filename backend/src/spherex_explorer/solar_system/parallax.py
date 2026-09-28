"""From Earth's centre to SPHEREx: correcting a geocentric position for the spacecraft's offset.

SPHEREx orbits about 7,000 km from Earth's centre, so a nearby body appears shifted against the
stars by up to about 9.7″ divided by its distance in au: under a pixel for main-belt asteroids,
tens of pixels for near-Earth objects. The FITS header of every frame records the spacecraft's
geocentric position at mid-exposure (``X_SC``, ``Y_SC``, ``Z_SC``, km, ICRF-aligned), which is
all the correction needs: the direction from SPHEREx is the body's geocentric vector minus the
spacecraft's.
"""

from __future__ import annotations

import math

AU_KM = 149_597_870.7


def unit_vector(ra_deg: float, dec_deg: float) -> tuple[float, float, float]:
    a, d = math.radians(ra_deg), math.radians(dec_deg)
    return (math.cos(d) * math.cos(a), math.cos(d) * math.sin(a), math.sin(d))


def from_spacecraft(
    ra_deg: float, dec_deg: float, delta_au: float, spacecraft_km: tuple[float, float, float]
) -> tuple[float, float]:
    """RA/Dec (degrees) of a body seen from the spacecraft, given its geocentric position."""
    ux, uy, uz = unit_vector(ra_deg, dec_deg)
    r = delta_au * AU_KM
    x, y, z = r * ux - spacecraft_km[0], r * uy - spacecraft_km[1], r * uz - spacecraft_km[2]
    ra = math.degrees(math.atan2(y, x)) % 360
    dec = math.degrees(math.atan2(z, math.hypot(x, y)))
    return ra, dec


def separation_arcsec(ra1: float, dec1: float, ra2: float, dec2: float) -> float:
    a = unit_vector(ra1, dec1)
    b = unit_vector(ra2, dec2)
    dot = min(max(sum(p * q for p, q in zip(a, b, strict=True)), -1.0), 1.0)
    cross = math.sqrt(max(1 - dot * dot, 0.0))
    return math.degrees(math.atan2(cross, dot)) * 3600
