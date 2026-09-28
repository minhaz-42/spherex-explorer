"""Facts about catalogued objects from the SIMBAD TAP service (CDS, Strasbourg).

``POST https://simbad.cds.unistra.fr/simbad/sim-tap/sync`` with ``request=doQuery&lang=adql&
format=json&query=<ADQL>`` answers ``{"metadata": [{"name": …}, …], "data": [[…], …]}``. A rejected
query comes back as a VOTable with ``QUERY_STATUS = ERROR`` and HTTP 400, even though JSON was
asked for.

Two properties of the service shape the queries below:

- Its ADQL parser accepts only unqualified names after ``ORDER BY``, so the sort keys are aliases.
- Sorting a cone on the ``nbref`` column itself is slow (10–20 s, worst when the cone is empty): the
  database appears to walk its ``nbref`` index down from the most-studied object in the whole sky.
  Sorting on the computed ``nbref + 0`` makes it select the cone first, which takes under a second.

ADQL text is built only from validated floats and integers, never from strings a visitor sent.
"""

from __future__ import annotations

import html
import json
import math
import re
import statistics
from typing import Any
from urllib.parse import quote

import httpx

from ..errors import NotFound, UpstreamError
from ..http import upstream
from ..solar_system.parallax import separation_arcsec
from .categories import Category, category

SERVICE = "CDS SIMBAD database"
CREDIT = "SIMBAD, CDS, Strasbourg"
TIMEOUT_S = 30.0
# Bump when the JSON these functions return changes shape, so cached answers are not reused.
FORMAT_VERSION = 1
# 36″: "the object at this position", for a position resolved from a name or clicked in a view.
DEFAULT_RADIUS_DEG = 0.01

PC_TO_LY = 3.26156
_PARSECS = {"pc": 1.0, "kpc": 1e3, "Mpc": 1e6}
# A parallax gives the distance when it is large and well measured; otherwise the published
# distances are more trustworthy.
MIN_PARALLAX_MAS = 0.5
MAX_PARALLAX_REL_ERROR = 0.2

OBJECT_BANDS = ("B", "V", "G", "J", "H", "K")
FIELD_BANDS = ("V", "K")
MAX_ALIASES = 8

_STATUS = re.compile(r'<INFO name="QUERY_STATUS" value="ERROR">(.*?)</INFO>', re.S)


# --- the TAP protocol ------------------------------------------------------------------------


def parse_tap(status: int, text: str) -> list[dict[str, Any]]:
    """The rows of a TAP answer, each a dict keyed by column name."""
    rejected = _STATUS.search(text)
    if rejected is not None:
        reason = html.unescape(rejected.group(1).strip())
        raise UpstreamError(SERVICE, "SIMBAD could not run the query.", detail=reason)
    if status >= 400:
        raise UpstreamError(SERVICE, f"{SERVICE} answered with HTTP {status}.", detail=text[:300])
    try:
        body = json.loads(text)
        names = [str(column["name"]) for column in body["metadata"]]
        return [dict(zip(names, row, strict=True)) for row in body["data"]]
    except (ValueError, KeyError, TypeError) as exc:
        raise UpstreamError(
            SERVICE, "SIMBAD sent an unreadable answer.", detail=text[:300]
        ) from exc


async def run_query(client: httpx.AsyncClient, url: str, adql: str) -> list[dict[str, Any]]:
    async with upstream(SERVICE):
        response = await client.post(
            url,
            data={"request": "doQuery", "lang": "adql", "format": "json", "query": adql},
            timeout=TIMEOUT_S,
        )
    return parse_tap(response.status_code, response.text)


# --- ADQL ------------------------------------------------------------------------------------


def _deg(value: float) -> str:
    """A validated angle as fixed-point ADQL text (never exponent notation)."""
    number = float(value)
    if not math.isfinite(number):
        raise ValueError(f"not a finite angle: {value!r}")
    return f"{number:.7f}"


def _cone_query(columns: str, ra: float, dec: float, radius: float, top: int) -> str:
    """Objects within ``radius`` of the position, most-studied first, then nearest first."""
    a, d, r = _deg(ra), _deg(dec), _deg(radius)
    return (
        f"SELECT TOP {int(top):d} {columns}, b.nbref + 0 AS refs, "  # noqa: S608 (numbers only)
        f"DISTANCE(POINT('ICRS', b.ra, b.dec), POINT('ICRS', {a}, {d})) AS sep "
        "FROM basic AS b "
        "LEFT JOIN otypedef AS t ON t.otype = b.otype "
        "LEFT JOIN allfluxes AS f ON f.oidref = b.oid "
        "LEFT JOIN ids AS i ON i.oidref = b.oid "
        f"WHERE CONTAINS(POINT('ICRS', b.ra, b.dec), CIRCLE('ICRS', {a}, {d}, {r})) = 1 "
        "ORDER BY refs DESC, sep ASC"
    )


def object_query(ra: float, dec: float, radius: float) -> str:
    columns = (
        "b.oid, b.main_id, b.ra, b.dec, b.otype, t.description, t.path, b.sp_type, "
        "b.morph_type, b.plx_value, b.plx_err, b.pmra, b.pmdec, b.rvz_redshift, b.rvz_radvel, "
        "b.galdim_majaxis, b.galdim_minaxis, "
        + ", ".join(f"f.{band}" for band in OBJECT_BANDS)
        + ", i.ids"
    )
    return _cone_query(columns, ra, dec, radius, 1)


def field_query(ra: float, dec: float, radius: float, limit: int) -> str:
    columns = (
        "b.main_id, b.ra, b.dec, b.otype, t.description, t.path, "
        + ", ".join(f"f.{band}" for band in FIELD_BANDS)
        + ", i.ids"
    )
    return _cone_query(columns, ra, dec, radius, limit)


def distances_query(oid: int) -> str:
    return f"SELECT dist, unit, method, bibcode FROM mesDistance WHERE oidref = {int(oid):d}"  # noqa: S608


# --- values ----------------------------------------------------------------------------------


def _float(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _rounded(value: Any, digits: int) -> float | None:
    number = _float(value)
    return None if number is None else round(number, digits)


def _text(value: Any) -> str | None:
    text = str(value).strip() if value is not None else ""
    return text or None


def _sig(value: float, figures: int = 3) -> float:
    return float(f"{value:.{figures}g}")


def tidy(identifier: str) -> str:
    """An identifier with SIMBAD's column padding removed: ``"NGC   224"`` → ``"NGC 224"``."""
    return " ".join(identifier.split())


def identifiers(row: dict[str, Any]) -> list[str]:
    """Every identifier of the object, in SIMBAD's order (``ids`` joins them with ``|``)."""
    return [tidy(i) for i in str(row.get("ids") or "").split("|") if i.strip()]


# --- names -----------------------------------------------------------------------------------

_KIND_WORDS = frozenset({"galaxy", "nebula", "cluster", "cloud"})
# The IAU constellation abbreviations, which make names like "Ori Nebula" or "And Nebula" terse
# variants of the full ones ("Orion Nebula"). A list literal of 88 strings would be far longer.
_CONSTELLATIONS = frozenset(
    "And Ant Aps Aql Aqr Ara Ari Aur Boo Cae Cam Cap Car Cas Cen Cep Cet Cha Cir CMa CMi Cnc Col "  # noqa: SIM905
    "Com CrA CrB Crt Cru Crv CVn Cyg Del Dor Dra Equ Eri For Gem Gru Her Hor Hya Hyi Ind Lac Leo "
    "Lep Lib LMi Lup Lyn Lyr Men Mic Mon Mus Nor Oct Oph Ori Pav Peg Per Phe Pic PsA Psc Pup Pyx "
    "Ret Scl Sco Sct Ser Sex Sge Sgr Tau Tel TrA Tri Tuc UMa UMi Vel Vir Vol Vul".split()
)


def _words(name: str) -> set[str]:
    return {w for w in re.findall(r"[a-z']+", name.lower()) if len(w) >= 3} - _KIND_WORDS


def _related(a: set[str], b: set[str]) -> bool:
    """Whether two names share a word, counting an abbreviation ("Car") as its word ("Carina")."""
    return any(x.startswith(y) or y.startswith(x) for x in a for y in b)


def common_name(ids: list[str], main_id: str, kind: Category) -> str | None:
    """The object's everyday name, from SIMBAD's ``NAME`` identifiers, or ``None``.

    SIMBAD lists several in no meaningful order (M 31 has "Andromeda", "Andromeda Galaxy",
    "And Nebula" and "Andromeda Nebula"), so they are ranked, in order of importance, by:

    1. not being an upper-case abbreviation ("CRAB NEB");
    2. saying what the object is ("… Galaxy", "… Nebula", "… Cluster", "… Cloud");
    3. not using a constellation abbreviation ("Ori Nebula" is a variant of "Orion Nebula");
    4. sharing words with the other names: the core the variants agree on ("Whirlpool Galaxy"
       over "Question Mark Galaxy", "North America Nebula" over "Bermuda Cluster");
    5. naming the object's own kind ("Andromeda Galaxy" over "Andromeda Nebula");
    6. being shorter ("Orion Nebula" over "Great Orion Nebula", "Polaris" over "Lodestar").

    Names ending in ``*`` label a galaxy's nucleus ("M 81*") and are skipped. When SIMBAD's main
    identifier is itself a name ("NAME Sgr A*"), that name is used.
    """
    if main_id.startswith("NAME "):
        return tidy(main_id[5:])
    names = list(dict.fromkeys(i[5:] for i in ids if i.startswith("NAME ")))
    candidates = [n for n in names if n and not n.endswith("*")]
    if not candidates:
        return None
    words = {n: _words(n) for n in names}
    own_word = kind if kind in _KIND_WORDS else None

    def rank(item: tuple[int, str]) -> tuple[bool, bool, bool, int, bool, int, int, int]:
        index, name = item
        parts = name.split()
        lower = {p.lower() for p in parts}
        return (
            not (name.isupper() and " " in name),
            bool(_KIND_WORDS & lower),
            not _CONSTELLATIONS.intersection(parts),
            sum(1 for other in names if other != name and _related(words[name], words[other])),
            own_word in lower,
            -len(parts),
            -len(name),
            -index,
        )

    return max(enumerate(candidates), key=rank)[1]


# --- aliases ---------------------------------------------------------------------------------

# Catalogues worth showing, best first: the names people know, then the major catalogues of the
# object's kind, then the others. Identifiers from unlisted catalogues follow, in SIMBAD's order;
# author-coded ones such as "[DGW65] 4" are left out.
_FAMOUS = ("M", "NGC", "IC")
_STAR_CATALOGUES = ("*", "V*", "HD", "HIP", "HR", "Gaia DR3", "2MASS", "TYC", "SAO", "BD", "GJ")
_GALAXY_CATALOGUES = ("UGC", "PGC", "LEDA", "MCG", "ESO", "2MASX", "IRAS", "SDSS")
_NEBULA_CATALOGUES = ("Cl", "Sh", "LBN", "LDN", "RCW", "PN")
_CATALOGUE = re.compile(r"^(Gaia DR\d|[^\s+-]+)")


def _catalogue_order(kind: Category) -> tuple[str, ...]:
    if kind == "galaxy":
        return _FAMOUS + _GALAXY_CATALOGUES + _STAR_CATALOGUES + _NEBULA_CATALOGUES
    if kind in ("nebula", "cluster"):
        return _FAMOUS + _NEBULA_CATALOGUES + _STAR_CATALOGUES + _GALAXY_CATALOGUES
    return _FAMOUS + _STAR_CATALOGUES + _GALAXY_CATALOGUES + _NEBULA_CATALOGUES


def aliases(ids: list[str], main_id: str, kind: Category) -> list[str]:
    """Up to eight other identifiers, from the best-known catalogues first."""
    order = {name: rank for rank, name in enumerate(_catalogue_order(kind))}
    main = tidy(main_id)
    seen: set[str] = set()
    ranked: list[tuple[int, int, str]] = []
    for index, identifier in enumerate(ids):
        if identifier == main or identifier in seen or identifier.startswith(("NAME ", "[")):
            continue
        seen.add(identifier)
        match = _CATALOGUE.match(identifier)
        ranked.append((order.get(match.group(1) if match else "", len(order)), index, identifier))
    return [identifier for *_, identifier in sorted(ranked)[:MAX_ALIASES]]


# --- distance --------------------------------------------------------------------------------


def good_parallax(plx_mas: float | None, plx_err_mas: float | None) -> bool:
    return (
        plx_mas is not None
        and plx_err_mas is not None
        and plx_mas > MIN_PARALLAX_MAS
        and plx_err_mas / plx_mas < MAX_PARALLAX_REL_ERROR
    )


def _distance(parsecs: float, method: str) -> dict[str, Any]:
    """A distance in the unit that reads best: pc below 1000 pc, kpc below 1000 kpc, else Mpc.

    The unit is chosen after rounding, so 999.7 pc reads "1 kpc" rather than "1000 pc".
    """
    rounded = _sig(parsecs)
    if rounded < 1e3:
        scale, unit = 1.0, "pc"
    elif rounded < 1e6:
        scale, unit = 1e3, "kpc"
    else:
        scale, unit = 1e6, "Mpc"
    return {
        "value": _sig(parsecs / scale),
        "unit": unit,
        "lightYears": _sig(parsecs * PC_TO_LY),
        "method": method,
    }


def choose_distance(
    plx_mas: float | None, plx_err_mas: float | None, measurements: list[dict[str, Any]]
) -> dict[str, Any] | None:
    """The distance from a good parallax, else the median of SIMBAD's published distances.

    ``measurements`` are ``mesDistance`` rows (``dist`` and ``unit``); rows in units other than
    pc, kpc or Mpc, or without a positive distance, are ignored.
    """
    if plx_mas is not None and good_parallax(plx_mas, plx_err_mas):
        return _distance(1000.0 / plx_mas, "parallax")
    parsecs = []
    for row in measurements:
        dist, scale = _float(row.get("dist")), _PARSECS.get(str(row.get("unit") or "").strip())
        if dist is not None and dist > 0 and scale is not None:
            parsecs.append(dist * scale)
    if not parsecs:
        return None
    n = len(parsecs)
    method = f"median of {n} published measurements" if n > 1 else "1 published measurement"
    return _distance(statistics.median(parsecs), method)


# --- answers ---------------------------------------------------------------------------------


def _position(row: dict[str, Any]) -> tuple[str, float, float]:
    main_id, ra, dec = _text(row.get("main_id")), _float(row.get("ra")), _float(row.get("dec"))
    if main_id is None or ra is None or dec is None:
        raise UpstreamError(SERVICE, "SIMBAD sent an object without an identifier or position.")
    return str(row["main_id"]), ra, dec


def links(main_id: str) -> dict[str, str]:
    name = quote(tidy(main_id), safe="")
    return {
        "simbad": f"https://simbad.cds.unistra.fr/simbad/sim-id?Ident={name}",
        "ned": f"https://ned.ipac.caltech.edu/byname?objname={name}",
    }


def object_json(
    row: dict[str, Any], measurements: list[dict[str, Any]], ra: float, dec: float
) -> dict[str, Any]:
    """The ``/api/object`` answer from an :func:`object_query` row and its ``mesDistance`` rows."""
    main_id, obj_ra, obj_dec = _position(row)
    otype = _text(row.get("otype"))
    kind = category(otype, _text(row.get("path")))
    ids = identifiers(row)
    plx, plx_err = _float(row.get("plx_value")), _float(row.get("plx_err"))
    # SIMBAD's pmra is already μα·cos δ, the motion along the sky, not the change of RA itself.
    pm_ra, pm_dec = _rounded(row.get("pmra"), 3), _rounded(row.get("pmdec"), 3)
    major, minor = _rounded(row.get("galdim_majaxis"), 2), _rounded(row.get("galdim_minaxis"), 2)
    return {
        "id": main_id,
        "name": common_name(ids, main_id, kind),
        "otype": otype,
        "typeLabel": _text(row.get("description")) or otype,
        "category": kind,
        "ra": round(obj_ra, 7),
        "dec": round(obj_dec, 7),
        "separationArcsec": round(separation_arcsec(ra, dec, obj_ra, obj_dec), 2),
        "aliases": aliases(ids, main_id, kind),
        "spectralType": _text(row.get("sp_type")),
        "morphology": _text(row.get("morph_type")),
        "magnitudes": {band: _rounded(row.get(band), 3) for band in OBJECT_BANDS},
        "parallaxMas": None if plx is None else round(plx, 4),
        "properMotion": None
        if pm_ra is None and pm_dec is None
        else {"raMasYr": pm_ra, "decMasYr": pm_dec},
        "distance": choose_distance(plx, plx_err, measurements),
        "redshift": _rounded(row.get("rvz_redshift"), 6),
        "radialVelocityKms": _rounded(row.get("rvz_radvel"), 2),
        "size": None if major is None else {"majorArcmin": major, "minorArcmin": minor},
        "references": int(_float(row.get("refs")) or 0),
        "links": links(main_id),
        "credit": CREDIT,
    }


def field_json(rows: list[dict[str, Any]], ra: float, dec: float, radius: float) -> dict[str, Any]:
    """The ``/api/field-objects`` answer from :func:`field_query` rows (already in order)."""
    objects = []
    for row in rows:
        main_id, obj_ra, obj_dec = _position(row)
        otype = _text(row.get("otype"))
        kind = category(otype, _text(row.get("path")))
        objects.append(
            {
                "id": main_id,
                "name": common_name(identifiers(row), main_id, kind),
                "otype": otype,
                "typeLabel": _text(row.get("description")) or otype,
                "category": kind,
                "ra": round(obj_ra, 7),
                "dec": round(obj_dec, 7),
                "separationArcmin": round(separation_arcsec(ra, dec, obj_ra, obj_dec) / 60, 2),
                "magnitudes": {band: _rounded(row.get(band), 3) for band in FIELD_BANDS},
                "references": int(_float(row.get("refs")) or 0),
            }
        )
    return {"objects": objects, "radiusDeg": radius, "total": len(objects), "credit": CREDIT}


async def object_at(
    client: httpx.AsyncClient, url: str, ra: float, dec: float, radius: float
) -> dict[str, Any]:
    """The most-studied object within ``radius`` degrees: one query, two without a good parallax."""
    rows = await run_query(client, url, object_query(ra, dec, radius))
    if not rows:
        raise NotFound(
            f"SIMBAD lists no object within {radius * 3600:.0f}″ of this position. "
            "Try a position closer to a catalogued object."
        )
    row = rows[0]
    measurements: list[dict[str, Any]] = []
    if not good_parallax(_float(row.get("plx_value")), _float(row.get("plx_err"))):
        oid = _float(row.get("oid"))
        if oid is not None:
            measurements = await run_query(client, url, distances_query(int(oid)))
    return object_json(row, measurements, ra, dec)


async def field_objects(
    client: httpx.AsyncClient, url: str, ra: float, dec: float, radius: float, limit: int
) -> dict[str, Any]:
    """The ``limit`` most-studied objects within ``radius`` degrees, in one query."""
    rows = await run_query(client, url, field_query(ra, dec, radius, limit))
    return field_json(rows, ra, dec, radius)
