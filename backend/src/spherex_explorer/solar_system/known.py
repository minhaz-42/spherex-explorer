"""Which catalogued Solar System bodies crossed a field during a sequence, and where.

1. Read each frame's mid-exposure time and spacecraft position from its header.
2. Ask SBIdent, once, for known bodies in a box around the field at the middle frame's time,
   seen from SPHEREx. The box is widened by how far a main-belt asteroid can move during the
   sequence, so bodies that enter or leave the field are included.
3. Ask Horizons for each body's geocentric position at every frame time and convert it to the
   direction seen from SPHEREx at that moment.
4. Keep the bodies that fall inside the field in at least one frame.
"""

from __future__ import annotations

import asyncio
import math
from typing import Any

from ..archive.keys import FrameKey
from ..archive.meta import frame_meta
from ..errors import UpstreamError
from ..services import Services
from .jpl import HORIZONS, Candidate, ephemeris, horizons_command, identify
from .parallax import from_spacecraft, separation_arcsec

# Main-belt asteroids move up to about 0.3° a day near quadrature, where SPHEREx looks.
MAX_RATE_DEG_PER_DAY = 0.35
MAX_BODIES = 40


class _Failed:
    """A body whose positions could not be fetched."""


FAILED = _Failed()


def tangent_offsets(ra: float, dec: float, ra0: float, dec0: float) -> tuple[float, float]:
    """Gnomonic offsets (degrees, east and north) of ``(ra, dec)`` from ``(ra0, dec0)``."""
    a, d, a0, d0 = (math.radians(v) for v in (ra, dec, ra0, dec0))
    cos_c = math.sin(d0) * math.sin(d) + math.cos(d0) * math.cos(d) * math.cos(a - a0)
    xi = math.cos(d) * math.sin(a - a0) / cos_c
    eta = (math.cos(d0) * math.sin(d) - math.sin(d0) * math.cos(d) * math.cos(a - a0)) / cos_c
    return math.degrees(xi), math.degrees(eta)


async def known_objects(
    svc: Services, ra: float, dec: float, size_deg: float, keys: list[str], vmag_limit: float
) -> dict[str, Any]:
    frames = [FrameKey.parse(k) for k in keys]
    metas = await asyncio.gather(*(frame_meta(svc, f) for f in frames))
    usable = [m for m in metas if m["mjdMid"] is not None and m["positionKm"] is not None]
    if not usable:
        raise UpstreamError(
            "SPHEREx archive (S3)", "No frame had a usable time and spacecraft position."
        )
    usable.sort(key=lambda m: m["mjdMid"])
    reference = usable[len(usable) // 2]
    span_days = usable[-1]["mjdMid"] - usable[0]["mjdMid"]
    half_width = min(size_deg / 2 * 1.15 + MAX_RATE_DEG_PER_DAY * span_days + 0.02, 3.0)

    candidates = await identify(
        svc.client,
        svc.settings.sbident_url,
        jd_utc=reference["mjdMid"] + 2400000.5,
        position_km=tuple(reference["positionKm"]),
        velocity_kms=tuple(reference["velocityKmS"]) if reference["velocityKmS"] else None,
        ra=ra,
        dec=dec,
        half_width_deg=half_width,
        vmag_limit=vmag_limit,
        timeout_s=svc.settings.jpl_timeout_s,
    )
    candidates.sort(key=lambda c: c.vmag if c.vmag is not None else 99)
    candidates = candidates[:MAX_BODIES]

    jds = [m["mjdMid"] + 2400000.5 for m in usable]
    slots = asyncio.Semaphore(3)  # be gentle with Horizons

    async def track(c: Candidate) -> dict[str, Any] | _Failed | None:
        command = horizons_command(c.name)
        if command is None:
            return None
        async with slots:
            try:
                points = await ephemeris(svc.client, svc.settings.horizons_url, command, jds)
            except UpstreamError:
                # Not the same as "not in the field": the answer is unknown, and must not be
                # reported, or cached, as an empty field.
                return FAILED
        positions = []
        inside_any = False
        for meta, p in zip(usable, points, strict=True):
            sra, sdec = from_spacecraft(p.ra, p.dec, p.delta_au, tuple(meta["positionKm"]))
            east, north = tangent_offsets(sra, sdec, ra, dec)
            inside = abs(east) <= size_deg / 2 and abs(north) <= size_deg / 2
            inside_any |= inside
            positions.append(
                {
                    "key": meta["key"],
                    "mjd": meta["mjdMid"],
                    "ra": round(sra, 7),
                    "dec": round(sdec, 7),
                    "inField": inside,
                    "distanceAu": round(p.delta_au, 5),
                }
            )
        if not inside_any:
            return None
        # Average apparent rate over the sequence. SBIdent's own rate is instantaneous from the
        # orbiting spacecraft and swings with SPHEREx's 7.5 km/s orbital motion.
        first, last = positions[0], positions[-1]
        hours = (last["mjd"] - first["mjd"]) * 24
        mean_rate = (
            round(separation_arcsec(first["ra"], first["dec"], last["ra"], last["dec"]) / hours, 2)
            if hours > 0.1
            else None
        )
        return {
            "name": c.name,
            "vmag": c.vmag,
            "rateArcsecPerHour": mean_rate,
            "instantRateArcsecPerHour": (
                round(math.hypot(c.ra_rate or 0.0, c.dec_rate or 0.0), 2)
                if c.ra_rate is not None or c.dec_rate is not None
                else None
            ),
            "positions": positions,
        }

    results = await asyncio.gather(*(track(c) for c in candidates))
    tracks = [r for r in results if isinstance(r, dict)]
    failed = [c.name for c, r in zip(candidates, results, strict=True) if r is FAILED]
    trackable = sum(1 for c in candidates if horizons_command(c.name) is not None)
    if failed and len(failed) == trackable:
        raise UpstreamError(
            HORIZONS,
            f"{HORIZONS} did not answer for any of the {trackable} catalogued bodies near this "
            "field. Try again in a moment.",
        )
    skipped = [m["key"] for m in metas if m not in usable]
    result = {
        "field": {"ra": ra, "dec": dec, "sizeDeg": size_deg},
        "searched": {
            "referenceKey": reference["key"],
            "referenceMjd": reference["mjdMid"],
            "halfWidthDeg": round(half_width, 4),
            "vmagLimit": vmag_limit,
            "candidates": len(candidates),
        },
        "objects": tracks,
        "framesWithoutState": skipped,
        "source": f"JPL Small-Body Identification (two-pass) and {HORIZONS}",
        "method": (
            "Known bodies in the field at the middle frame's time were identified by JPL SBIdent "
            "for SPHEREx's position. Horizons geocentric positions at each frame's mid-exposure "
            "time were corrected to SPHEREx's position from the frame header. These are "
            "predictions for catalogued objects, not detections."
        ),
    }
    if failed:
        # A partial list is returned so the visitor sees what is known, but is not cached.
        result["incomplete"] = {
            "horizonsFailed": failed,
            "message": (
                f"{HORIZONS} did not answer for {len(failed)} of {trackable} catalogued bodies "
                "near this field, so this list may be incomplete. Try again in a moment."
            ),
        }
    return result
