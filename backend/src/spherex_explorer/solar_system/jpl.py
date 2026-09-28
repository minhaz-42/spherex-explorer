"""Known Solar System bodies from JPL's Solar System Dynamics APIs.

Two services, used together:

- **SBIdent** (``ssd-api.jpl.nasa.gov/sb_ident.api``) answers "which catalogued asteroids and
  comets are in this field at this time, seen from this observer". SPHEREx is passed as the
  observer through ``xobs``, its geocentric state vector from the frame header. The accurate
  two-pass mode integrates orbits numerically and takes about a minute.
- **Horizons** (``ssd.jpl.nasa.gov/api/horizons.api``) then gives each body's astrometric
  position at every frame time in about a second per body.

Positions are JPL predictions for catalogued objects. They say where a known body should be; they
do not detect anything in the image.
"""

from __future__ import annotations

import asyncio
import math
import re
from dataclasses import dataclass
from typing import Any

import httpx

from ..errors import UpstreamError
from ..http import upstream

SBIDENT = "JPL Small-Body Identification"
HORIZONS = "JPL Horizons"


@dataclass(frozen=True)
class Candidate:
    name: str
    ra: float
    dec: float
    vmag: float | None
    ra_rate: float | None  # arcsec per hour
    dec_rate: float | None


def hms_to_deg(text: str) -> float:
    h, m, s = (float(v) for v in re.split(r"[:\s]+", text.strip())[:3])
    return 15 * (h + m / 60 + s / 3600)


def dms_to_deg(text: str) -> float:
    t = text.strip().replace("'", " ").replace('"', " ")
    sign = -1.0 if t.startswith("-") else 1.0
    parts = [float(v) for v in re.split(r"[\s:]+", t.lstrip("+-").strip()) if v]
    d, m, s = [*parts, 0.0, 0.0, 0.0][:3]
    return sign * (d + m / 60 + s / 3600)


def _sexa(value: float, *, hours: bool) -> str:
    """JPL's FOV format: ``hh-mm-ss.ss`` / ``dd-mm-ss.s`` with a leading ``M`` for negatives."""
    v = value / 15 if hours else abs(value)
    a = int(v)
    b = int((v - a) * 60)
    c = ((v - a) * 60 - b) * 60
    prefix = "M" if (not hours and value < 0) else ""
    return f"{prefix}{a:02d}-{b:02d}-{c:05.2f}"


def _float(text: Any) -> float | None:
    try:
        value = float(str(text).strip())
    except ValueError:
        return None
    return value if math.isfinite(value) else None


def parse_sbident(body: dict[str, Any]) -> list[Candidate]:
    fields: list[str] = body.get("fields_second") or body.get("fields_first") or []
    rows: list[list[str]] = body.get("data_second_pass") or body.get("data_first_pass") or []
    if not fields or not rows:
        return []

    def col(prefix: str) -> int:
        for i, name in enumerate(fields):
            if name.startswith(prefix):
                return i
        raise UpstreamError(
            SBIDENT, "JPL changed its answer format.", detail=f"no {prefix!r} column"
        )

    i_name, i_ra, i_dec = col("Object name"), col("Astrometric RA"), col("Astrometric Dec")
    i_v, i_ra_rate, i_dec_rate = col("Visual magnitude"), col("RA rate"), col("Dec rate")
    out = []
    for row in rows:
        try:
            out.append(
                Candidate(
                    name=" ".join(str(row[i_name]).split()),
                    ra=hms_to_deg(row[i_ra]),
                    dec=dms_to_deg(row[i_dec]),
                    vmag=_float(row[i_v]),
                    ra_rate=_float(row[i_ra_rate]),
                    dec_rate=_float(row[i_dec_rate]),
                )
            )
        except (ValueError, IndexError):
            continue
    return out


async def identify(
    client: httpx.AsyncClient,
    url: str,
    *,
    jd_utc: float,
    position_km: tuple[float, float, float],
    velocity_kms: tuple[float, float, float] | None,
    ra: float,
    dec: float,
    half_width_deg: float,
    vmag_limit: float,
    timeout_s: float,
) -> list[Candidate]:
    state = list(position_km) + (list(velocity_kms) if velocity_kms else [])
    # The RA half-width is in RA degrees; widen it by 1/cos(dec) so the box covers the angle.
    ra_half = min(half_width_deg / max(math.cos(math.radians(dec)), 0.05), 30.0)
    params = {
        "xobs": ",".join(f"{v:.6f}" for v in state),
        "obs-time": f"{jd_utc:.6f}",
        "fov-ra-center": _sexa(ra, hours=True),
        "fov-dec-center": _sexa(dec, hours=False),
        "fov-ra-hwidth": f"{ra_half:.4f}",
        "fov-dec-hwidth": f"{half_width_deg:.4f}",
        "two-pass": "true",
        "suppress-first-pass": "true",
        "mag-required": "true",
        "vmag-lim": f"{vmag_limit:.1f}",
    }
    async with upstream(SBIDENT):
        response = await client.get(url, params=params, timeout=timeout_s)
        if response.status_code == 400:
            detail = response.text[:300]
            raise UpstreamError(SBIDENT, "JPL rejected the field description.", detail=detail)
        response.raise_for_status()
    try:
        body = response.json()
    except ValueError as exc:
        raise UpstreamError(SBIDENT, "JPL sent an unreadable answer.") from exc
    return parse_sbident(body)


def horizons_command(name: str) -> str | None:
    """Horizons ``COMMAND`` for an SBIdent object name, or None if we cannot tell."""
    n = " ".join(name.split())
    if m := re.match(
        r"^(\d+)\b", n
    ):  # numbered asteroid: "7 Iris (A847 PA)", "278696 (2008 RX131)"
        return f"{m.group(1)};"
    if m := re.match(
        r"^(\d+[PDI])(?:/|\b)", n
    ):  # numbered periodic comet: "29P/Schwassmann-Wachmann"
        return f"DES={m.group(1)};CAP;NOFRAG;"
    if m := re.match(
        r"^([CPDXA]/\d{4} [A-Z]{1,2}\d*)", n
    ):  # comet designation: "C/2019 Y4 (ATLAS)"
        return f"DES={m.group(1)};CAP;NOFRAG;"
    if m := re.match(r"^\(?(\d{4} [A-Z]{2}\d*)\)?$", n):  # provisional: "(2011 AB12)"
        return f"DES={m.group(1)};"
    return None


@dataclass(frozen=True)
class EphemerisPoint:
    jd: float
    ra: float
    dec: float
    delta_au: float


def parse_horizons(result: str) -> list[EphemerisPoint]:
    if "$$SOE" not in result:
        reason = result.strip().splitlines()[-1] if result.strip() else "no ephemeris"
        raise UpstreamError(HORIZONS, "Horizons did not return an ephemeris.", detail=reason[:300])
    header_block, rest = result.split("$$SOE", 1)
    body = rest.split("$$EOE", 1)[0]
    header_line = next(
        (line for line in reversed(header_block.splitlines()) if "R.A." in line and "DEC" in line),
        "",
    )
    names = [h.strip() for h in header_line.split(",")]

    def index(prefix: str) -> int:
        for i, h in enumerate(names):
            if h.startswith(prefix):
                return i
        raise UpstreamError(HORIZONS, "Horizons changed its answer format.", detail=prefix)

    i_ra, i_dec, i_delta = index("R.A."), index("DEC"), index("delta")
    points = []
    for line in body.strip().splitlines():
        cells = [c.strip() for c in line.split(",")]
        try:
            points.append(
                EphemerisPoint(
                    jd=0.0,
                    ra=float(cells[i_ra]),
                    dec=float(cells[i_dec]),
                    delta_au=float(cells[i_delta]),
                )
            )
        except (ValueError, IndexError):
            continue
    return points


async def ephemeris(
    client: httpx.AsyncClient, url: str, command: str, jds: list[float], *, timeout_s: float = 60
) -> list[EphemerisPoint]:
    """Geocentric astrometric RA/Dec (ICRF) and distance at each Julian date (UTC)."""
    params = {
        "format": "json",
        "COMMAND": f"'{command}'",
        "OBJ_DATA": "'NO'",
        "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'OBSERVER'",
        "CENTER": "'500@399'",
        "TLIST": ",".join(f"'{jd:.8f}'" for jd in jds),
        "TLIST_TYPE": "'JD'",
        "TIME_TYPE": "'UT'",
        "QUANTITIES": "'1,20'",
        "ANG_FORMAT": "'DEG'",
        "CSV_FORMAT": "'YES'",
        "EXTRA_PREC": "'YES'",
    }
    for attempt in range(2):
        async with upstream(HORIZONS):
            response = await client.get(url, params=params, timeout=timeout_s)
            if response.status_code == 503 and attempt == 0:
                await asyncio.sleep(2.0)
                continue
            response.raise_for_status()
        break
    try:
        result = str(response.json().get("result", ""))
    except ValueError as exc:
        raise UpstreamError(HORIZONS, "Horizons sent an unreadable answer.") from exc
    points = parse_horizons(result)
    if len(points) != len(jds):
        raise UpstreamError(HORIZONS, "Horizons returned a different number of times than asked.")
    return [EphemerisPoint(jd, p.ra, p.dec, p.delta_au) for jd, p in zip(jds, points, strict=True)]
