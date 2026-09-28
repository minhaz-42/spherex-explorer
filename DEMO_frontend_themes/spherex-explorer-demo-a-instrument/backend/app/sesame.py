"""Resolve object names to positions with CDS Sesame."""

from __future__ import annotations

import re
from urllib.parse import quote

import httpx

SESAME_URL = "https://cds.unistra.fr/cgi-bin/nph-sesame/-ox/SNV"

_RA = re.compile(r"<jradeg>\s*([-+0-9.eE]+)\s*</jradeg>")
_DEC = re.compile(r"<jdedeg>\s*([-+0-9.eE]+)\s*</jdedeg>")
_NAME = re.compile(r"<oname>\s*([^<]+?)\s*</oname>")


class NameNotFound(LookupError):
    """Sesame answered, but doesn't know the name."""


async def resolve_name(client: httpx.AsyncClient, name: str, timeout_s: float) -> tuple[float, float, str]:
    """Returns (ra, dec, canonical name) in degrees, ICRS."""
    response = await client.get(f"{SESAME_URL}?{quote(name.strip())}", timeout=timeout_s)
    response.raise_for_status()
    return parse_sesame_xml(response.text, name)


def parse_sesame_xml(text: str, name: str) -> tuple[float, float, str]:
    ra, dec = _RA.search(text), _DEC.search(text)
    if not ra or not dec:
        raise NameNotFound(name)
    canonical = _NAME.search(text)
    return float(ra.group(1)), float(dec.group(1)), canonical.group(1) if canonical else name.strip()
