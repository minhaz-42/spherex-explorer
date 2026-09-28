"""Coarse categories for SIMBAD object types, for the Explore page's markers and filters.

SIMBAD arranges its object types in a hierarchy, given for each type by ``otypedef.path``: a quasar
is ``G > AGN > QSO`` and a planetary nebula ``* > Ev* > PN``. The category follows the top of that
path, except for a few types that SIMBAD files under one branch but that look like another on an
image:

============  ==========================================================================
category      SIMBAD types
============  ==========================================================================
galaxy        ``G`` (galaxies, including AGN, quasars, blazars, Seyfert and starburst
              galaxies), ``GrG``, ``ClG``, ``SCG`` and ``PCG`` (groups, clusters,
              superclusters and proto-clusters of galaxies), ``PaG`` and ``IG`` (pairs and
              interacting galaxies), ``PoG`` (part of a galaxy), and ``LeG`` and ``LeQ``
              (lensed images of a galaxy or quasar, filed under gravitational sources)
star          ``*``: every kind of star, binary, variable, young stellar object, nova,
              supernova and exoplanet, except the three types listed under nebula
nebula        ``ISM`` (clouds, H II and star-forming regions, reflection and dark nebulae,
              supernova remnants, bubbles), ``PoC`` (part of a cloud), and ``PN``, ``PN?``
              (planetary nebulae) and ``HH`` (Herbig-Haro objects), filed under stars
cluster       ``Cl*`` (open and globular star clusters) and ``As*`` (associations, moving
              groups, stellar streams)
other         everything else: sources known from one waveband only (``X``, ``Rad``, ``IR``,
              ``UV``, ``gam``), gravitational sources, transients, blends, regions, errors
              and objects of unknown nature
solar-system  part of the vocabulary but never produced here: SIMBAD holds no Solar System
              bodies
============  ==========================================================================

A cluster of galaxies is a ``galaxy``: ``cluster`` always means a cluster of stars.
"""

from __future__ import annotations

from typing import Literal

Category = Literal["galaxy", "star", "nebula", "cluster", "solar-system", "other"]

# The top of the SIMBAD type path → category.
_BY_ROOT: dict[str, Category] = {
    "G": "galaxy",
    "GrG": "galaxy",
    "ClG": "galaxy",
    "SCG": "galaxy",
    "PCG": "galaxy",
    "PaG": "galaxy",
    "IG": "galaxy",
    "PoG": "galaxy",
    "*": "star",
    "ISM": "nebula",
    "PoC": "nebula",
    "Cl*": "cluster",
    "As*": "cluster",
}

# Types whose place in the hierarchy differs from how they look.
_BY_TYPE: dict[str, Category] = {
    "PN": "nebula",
    "PN?": "nebula",
    "HH": "nebula",
    "LeG": "galaxy",
    "LeQ": "galaxy",
}


def category(otype: str | None, path: str | None = None) -> Category:
    """The category of a SIMBAD type, from its code and (when known) its ``otypedef.path``."""
    code = (otype or "").strip()
    if code in _BY_TYPE:
        return _BY_TYPE[code]
    root = (path or "").split(">", 1)[0].strip() or code
    if root in _BY_ROOT:
        return _BY_ROOT[root]
    # A type missing from otypedef: SIMBAD's star types are the ones whose codes carry a "*".
    return "star" if "*" in code and not path else "other"
