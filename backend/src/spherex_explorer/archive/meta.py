"""Per-frame facts from the IMAGE header: mid-exposure time and the spacecraft's state.

Search results do not carry the spacecraft position, so the known-object check reads each frame's
header (one 58 KB range request) and caches the few numbers it needs.
"""

from __future__ import annotations

from typing import Any

from astropy.io import fits

from ..errors import UpstreamError
from ..services import Services
from .fits_range import HttpRangeSource, parse_header, read_header_at
from .keys import FrameKey

META_TTL_S = 30 * 86400.0


def meta_from_header(frame: FrameKey, header: fits.Header) -> dict[str, Any]:
    def num(key: str) -> float | None:
        value = header.get(key)
        return float(value) if isinstance(value, int | float) else None

    position = [num("X_SC"), num("Y_SC"), num("Z_SC")]
    velocity = [num("VX_SC"), num("VY_SC"), num("VZ_SC")]
    return {
        "key": frame.key,
        "obsId": frame.obs_id,
        "detector": frame.detector,
        "mjdMid": num("MJD-AVG"),
        "isoMid": str(header.get("DATE-AVG", "")) or None,
        "positionKm": position if all(v is not None for v in position) else None,
        "velocityKmS": velocity if all(v is not None for v in velocity) else None,
        "frame": str(header.get("XYZ_SC_SYSTEM", "GEOCENTER")),
    }


async def frame_meta(svc: Services, frame: FrameKey) -> dict[str, Any]:
    async def compute() -> dict[str, Any]:
        async with svc.s3_slots:
            source = HttpRangeSource(
                svc.client, frame.url(svc.settings.s3_url), "SPHEREx archive (S3)"
            )
            head = await source.read(0, 20 * 2880)
            primary = parse_header(head)
            if primary is None:
                raise UpstreamError(
                    "SPHEREx archive (S3)", "The file does not start with a header."
                )
            parsed = parse_header(head[primary[1] :])
            header = parsed[0] if parsed else (await read_header_at(source, primary[1]))[0]
        return meta_from_header(frame, header)

    return await svc.store.get_or_compute("meta", frame.key, compute, ttl_s=META_TTL_S)
