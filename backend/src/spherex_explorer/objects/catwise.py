"""Known moving stars and brown dwarfs in a field, from the CatWISE2020 catalogue at NASA/IPAC IRSA.

CatWISE2020 (Marocco et al. 2021, ApJS 253, 8) measured the motion of 1.9 billion sources across
the whole sky from ten years of NASA's WISE and NEOWISE images. Its ``ra_pm``/``dec_pm`` are each
source's position at epoch MJD 57170 (2015.4) from the fit that includes motion, and ``pmra``/
``pmdec`` its apparent motion in arcseconds per year (the RA part already times cos dec). Moved on
to the date of a SPHEREx frame, a position says where a catalogued mover should appear in it, which
is how a user tells a known brown dwarf from a new one.

``POST https://irsa.ipac.caltech.edu/TAP/sync`` with ``QUERY=<ADQL>&FORMAT=csv`` answers CSV; a
6′ cone takes 12–18 s. Only motions faster than 0.1″/yr and measured at better than 5σ are asked
for. CatWISE splits the fastest movers into several entries along their track (WISE 0855−0714
appears three times), so entries within 6″ of each other at the catalogue epoch whose motions agree
to 1″/yr are merged, keeping the best measured.

ADQL text is built only from validated floats, never from strings a visitor sent.
"""

from __future__ import annotations

import csv
import io
import math
from typing import Any

import httpx

from ..errors import UpstreamError
from ..http import upstream

SERVICE = "NASA/IPAC IRSA (CatWISE2020)"
CREDIT = "CatWISE2020 (Marocco et al. 2021) from NASA's WISE and NEOWISE, via NASA/IPAC IRSA"
TIMEOUT_S = 90.0
EPOCH_MJD = 57170.0
# Bump when the JSON these functions return changes shape, so cached answers are not reused.
FORMAT_VERSION = 1
MIN_PM_ARCSEC_YR = 0.1
MIN_PM_SIGMA = 5.0
MAX_ROWS = 400
MERGE_ARCSEC = 6.0
MERGE_PM_ARCSEC_YR = 1.0
MAX_MOVERS = 60

COLUMNS = "source_name, ra_pm, dec_pm, pmra, pmdec, sigpmra, sigpmdec, w1mpro, w2mpro"


def _deg(value: float) -> str:
    if not math.isfinite(value):
        raise ValueError("angles must be finite")
    return f"{value:.7f}"


def movers_query(ra: float, dec: float, radius: float) -> str:
    min_pm2 = MIN_PM_ARCSEC_YR**2
    sigma2 = MIN_PM_SIGMA**2
    return (
        f"SELECT TOP {MAX_ROWS} {COLUMNS} FROM catwise_2020 "  # noqa: S608 (numbers only)
        f"WHERE CONTAINS(POINT('ICRS', ra, dec), CIRCLE('ICRS', {_deg(ra)}, {_deg(dec)}, "
        f"{_deg(radius)})) = 1 "
        f"AND pmra*pmra + pmdec*pmdec > {min_pm2:g} "
        f"AND pmra*pmra + pmdec*pmdec > {sigma2:g}*(sigpmra*sigpmra + sigpmdec*sigpmdec)"
    )


def _float(value: str | None) -> float | None:
    try:
        number = float(value) if value not in (None, "") else None
    except ValueError:
        return None
    return number if number is not None and math.isfinite(number) else None


def parse_rows(status: int, text: str) -> list[dict[str, Any]]:
    if status >= 400:
        raise UpstreamError(SERVICE, f"{SERVICE} answered with HTTP {status}.", detail=text[:300])
    if "QUERY_STATUS" in text[:2000] and "ERROR" in text[:2000]:
        raise UpstreamError(SERVICE, "IRSA could not run the CatWISE query.", detail=text[:300])
    rows: list[dict[str, Any]] = []
    for row in csv.DictReader(io.StringIO(text)):
        values = {k: _float(row.get(k)) for k in ("ra_pm", "dec_pm", "pmra", "pmdec")}
        if any(v is None for v in values.values()):
            continue
        sig = [_float(row.get(k)) for k in ("sigpmra", "sigpmdec")]
        rows.append(
            {
                "name": f"CWISE {row.get('source_name', '').strip()}",
                "ra": values["ra_pm"],
                "dec": values["dec_pm"],
                "pmRa": values["pmra"],
                "pmDec": values["pmdec"],
                "pmError": math.hypot(*(s or 0.0 for s in sig)),
                "w1": _float(row.get("w1mpro")),
                "w2": _float(row.get("w2mpro")),
            }
        )
    return rows


def _separation_arcsec(a: dict[str, Any], b: dict[str, Any]) -> float:
    dra = (a["ra"] - b["ra"] + 180) % 360 - 180
    return math.hypot(dra * math.cos(math.radians(a["dec"])), a["dec"] - b["dec"]) * 3600


def merge(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """One entry per mover: fragments of the same fast source collapse onto the best measured."""
    kept: list[dict[str, Any]] = []
    for row in sorted(rows, key=lambda r: r["pmError"]):
        twin = next(
            (
                k
                for k in kept
                if _separation_arcsec(k, row) < MERGE_ARCSEC
                and math.hypot(k["pmRa"] - row["pmRa"], k["pmDec"] - row["pmDec"])
                < MERGE_PM_ARCSEC_YR
            ),
            None,
        )
        if twin is None:
            kept.append(row)
    return kept


def movers_json(rows: list[dict[str, Any]], ra: float, dec: float, radius: float) -> dict[str, Any]:
    movers = []
    for r in merge(rows):
        pm = math.hypot(r["pmRa"], r["pmDec"])
        w1, w2 = r["w1"], r["w2"]
        movers.append(
            {
                "name": r["name"],
                "ra": round(r["ra"], 7),
                "dec": round(r["dec"], 7),
                "pmRa": round(r["pmRa"], 4),
                "pmDec": round(r["pmDec"], 4),
                "pm": round(pm, 4),
                "w1": w1,
                "w2": w2,
                "w1w2": round(w1 - w2, 3) if w1 is not None and w2 is not None else None,
            }
        )
    movers.sort(key=lambda m: -m["pm"])
    return {
        "field": {"ra": ra, "dec": dec, "radiusDeg": radius},
        "epochMjd": EPOCH_MJD,
        "catalog": "CatWISE2020",
        "credit": CREDIT,
        "movers": movers[:MAX_MOVERS],
    }


async def field_movers(
    client: httpx.AsyncClient, url: str, ra: float, dec: float, radius: float
) -> dict[str, Any]:
    """The catalogued movers within ``radius`` degrees, fastest first."""
    async with upstream(SERVICE):
        response = await client.post(
            url, data={"QUERY": movers_query(ra, dec, radius), "FORMAT": "csv"}, timeout=TIMEOUT_S
        )
    return movers_json(parse_rows(response.status_code, response.text), ra, dec, radius)
