"""Object names to positions with the CDS Sesame service (SIMBAD, NED, VizieR).

``GET https://cds.unistra.fr/cgi-bin/nph-sesame/-oxp/SNV?M31`` returns XML with one ``Resolver``
element per service that knew the name. Sesame does not know solar-system bodies.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import quote
from xml.etree.ElementTree import ParseError

import httpx
from defusedxml import ElementTree

from ..errors import NotFound, UpstreamError
from ..http import upstream

SERVICE = "CDS Sesame name resolver"

# Plain-language labels for the SIMBAD object types a visitor is most likely to meet.
OTYPES = {
    "*": "Star",
    "**": "Double star",
    "PM*": "High proper-motion star",
    "V*": "Variable star",
    "Mi*": "Mira variable star",
    "LP*": "Long-period variable star",
    "EB*": "Eclipsing binary star",
    "Ce*": "Cepheid variable star",
    "RR*": "RR Lyrae variable star",
    "C*": "Carbon star",
    "s*r": "Red supergiant",
    "RG*": "Red giant",
    "WD*": "White dwarf",
    "Y*O": "Young stellar object",
    "Or*": "Young variable star",
    "TT*": "T Tauri star",
    "G": "Galaxy",
    "GiG": "Galaxy in a group",
    "GiC": "Galaxy in a cluster",
    "SBG": "Starburst galaxy",
    "Sy1": "Seyfert galaxy",
    "Sy2": "Seyfert galaxy",
    "AGN": "Active galaxy",
    "QSO": "Quasar",
    "ClG": "Galaxy cluster",
    "GlC": "Globular star cluster",
    "OpC": "Open star cluster",
    "Cl*": "Star cluster",
    "HII": "Star-forming nebula (H II region)",
    "PN": "Planetary nebula",
    "SNR": "Supernova remnant",
    "RNe": "Reflection nebula",
    "MoC": "Molecular cloud",
    "DNe": "Dark nebula",
    "ISM": "Interstellar matter",
    "SN*": "Supernova",
}

_SOLAR_SYSTEM = re.compile(
    r"^\(?\d+\)?\s+[A-Za-z]|^(ceres|pallas|juno|vesta|hebe|iris|flora|metis|hygiea|eros|"
    r"psyche|bennu|apophis|pluto|eris|makemake|haumea|sedna|mars|jupiter|saturn|uranus|"
    r"neptune|venus|mercury|moon|sun|planet x|planet nine)$",
    re.I,
)


@dataclass(frozen=True)
class Resolved:
    name: str
    ra: float
    dec: float
    otype: str | None
    kind: str | None
    resolver: str


def parse_sesame(xml_text: str, query: str) -> Resolved:
    try:
        root = ElementTree.fromstring(xml_text)
    except ParseError as exc:
        raise UpstreamError(SERVICE, "The name resolver sent an unreadable answer.") from exc
    for resolver in root.iter("Resolver"):
        ra, dec = resolver.findtext("jradeg"), resolver.findtext("jdedeg")
        if ra is None or dec is None:
            continue
        label = resolver.get("name", "")
        service = label.split("=", 1)[-1].split("(", 1)[0].strip() or "Sesame"
        otype = (resolver.findtext("otype") or "").strip() or None
        name = " ".join((resolver.findtext("oname") or query).split())
        return Resolved(
            name=name,
            ra=float(ra),
            dec=float(dec),
            otype=otype,
            kind=OTYPES.get(otype or ""),
            resolver=service,
        )
    raise NotFound(_not_found_message(query))


def _not_found_message(query: str) -> str:
    if _SOLAR_SYSTEM.search(query.strip()):
        return (
            f"“{query}” looks like a planet, moon or asteroid. Those move across the sky, so they "
            "have no fixed position to search. See Discover for asteroids SPHEREx caught moving."
        )
    return (
        f"No object called “{query}” was found in SIMBAD, NED or VizieR. "
        "Check the spelling, or search by coordinates."
    )


async def resolve_name(client: httpx.AsyncClient, base_url: str, name: str) -> Resolved:
    async with upstream(SERVICE):
        response = await client.get(f"{base_url}?{quote(name)}", timeout=20)
        response.raise_for_status()
    return parse_sesame(response.text, name)
