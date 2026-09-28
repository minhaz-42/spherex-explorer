"""IRSA Simple Image Access (SIA v2) for SPHEREx.

``GET https://irsa.ipac.caltech.edu/SIA?COLLECTION=…&POS=circle ra dec r&RESPONSEFORMAT=CSV``

Repeating ``COLLECTION`` searches several collections at once. Errors come back as a VOTable with
``QUERY_STATUS = ERROR`` and HTTP 200, even when CSV was requested, so the body is checked.
"""

from __future__ import annotations

import csv
import io
import re

import httpx

from ..errors import UpstreamError
from ..http import upstream

SERVICE = "IRSA image search (SIA)"
# 1″: small enough to mean "images containing this point".
POINT_RADIUS_DEG = 1 / 3600
_STATUS = re.compile(r'<INFO name="QUERY_STATUS" value="ERROR">(.*?)</INFO>', re.S)


Params = list[tuple[str, str | int | float | bool | None]]


def sia_params(
    collections: list[str],
    ra: float,
    dec: float,
    *,
    radius_deg: float = POINT_RADIUS_DEG,
    time_range: tuple[float, float] | None = None,
) -> Params:
    params: Params = [("COLLECTION", c) for c in collections]
    params.append(("POS", f"circle {ra:.7f} {dec:.7f} {radius_deg:.7f}"))
    if time_range is not None:
        params.append(("TIME", f"{time_range[0]:.6f} {time_range[1]:.6f}"))
    params.append(("RESPONSEFORMAT", "CSV"))
    return params


def parse_sia_csv(text: str) -> list[dict[str, str]]:
    stripped = text.lstrip()
    if stripped.startswith("<"):
        match = _STATUS.search(stripped)
        reason = match.group(1).strip() if match else "unexpected XML response"
        raise UpstreamError(SERVICE, "The image search was rejected by IRSA.", detail=reason)
    if not stripped:
        return []
    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None or "access_url" not in reader.fieldnames:
        raise UpstreamError(SERVICE, "The image search returned an unexpected table.")
    return list(reader)


async def search(
    client: httpx.AsyncClient,
    url: str,
    collections: list[str],
    ra: float,
    dec: float,
    *,
    time_range: tuple[float, float] | None = None,
    timeout_s: float = 120.0,
) -> list[dict[str, str]]:
    async with upstream(SERVICE):
        response = await client.get(
            url, params=sia_params(collections, ra, dec, time_range=time_range), timeout=timeout_s
        )
        response.raise_for_status()
    return parse_sia_csv(response.text)
