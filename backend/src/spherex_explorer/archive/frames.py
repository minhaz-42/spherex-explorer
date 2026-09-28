"""Turn SIA rows into the app's own ``Frame`` records and group them in time.

The archive speaks ObsCore (``t_min``, ``em_min``, ``energy_bandpassname``…); the rest of the app
speaks frames, passes and pointings. This module is the only place that knows both.

- A **frame** is one detector's image from one exposure.
- A **pointing** is the run of up to four small steps (``_1`` … ``_4``, about 2 minutes apart)
  that SPHEREx takes at one position, each step moving the sky onto a new part of the filter.
- A **pass** is a cluster of pointings; the whole sky is covered about every six months, so the
  frames of one place fall into passes separated by months.
"""

from __future__ import annotations

import math
import re
from dataclasses import asdict, dataclass
from typing import Any

from astropy.time import Time

from .footprint import estimate_wavelength, parse_polygon, target_pixel

ARCHIVE_PREFIX = "/ibe/data/spherex/"
PASS_GAP_DAYS = 20.0
_OBS_ID = re.compile(r"^(?P<pointing>\d{4}W\d{2}_[0-9][A-Z]_\d{4})_(?P<step>\d)$")


@dataclass
class Frame:
    id: str
    obsId: str
    pointing: str
    step: int
    detector: int
    collection: str
    release: str
    deep: bool
    key: str
    irsaUrl: str
    mjdStart: float
    mjdEnd: float
    mjdMid: float
    isoMid: str
    exposureS: float | None
    bandMinUm: float | None
    bandMaxUm: float | None
    resolvingPower: float | None
    footprint: list[list[float]]
    wavelengthUm: float | None
    bandwidthUm: float | None
    targetPixel: list[float] | None
    passIndex: int = -1

    def to_json(self) -> dict[str, Any]:
        return asdict(self)


def _float(row: dict[str, str], key: str) -> float | None:
    try:
        value = float(row.get(key, "") or "nan")
    except ValueError:
        return None
    return value if math.isfinite(value) else None


def frame_from_row(row: dict[str, str], ra: float, dec: float) -> Frame | None:
    """One SIA row as a ``Frame``, or None if the row lacks what the app needs."""
    url = row.get("access_url", "")
    if ARCHIVE_PREFIX not in url or not url.endswith(".fits"):
        return None
    key = url.split(ARCHIVE_PREFIX, 1)[1]
    band = row.get("energy_bandpassname", "")
    if not band.startswith("SPHEREx-D") or not band[-1].isdigit():
        return None
    detector = int(band[-1])
    t0, t1 = _float(row, "t_min"), _float(row, "t_max")
    if t0 is None:
        return None
    t1 = t1 if t1 is not None else t0
    mid = (t0 + t1) / 2
    obs_id = row.get("obs_id", "")
    match = _OBS_ID.match(obs_id)
    collection = row.get("obs_collection", "")
    release = key.split("/", 1)[0]

    pixel = target_pixel(row.get("s_region", ""), ra, dec)
    wavelength = bandwidth = None
    if pixel is not None:
        est = estimate_wavelength(release, detector, *pixel)
        if est is not None:
            wavelength, bandwidth = est
    try:
        footprint = [[round(a, 5), round(b, 5)] for a, b in parse_polygon(row.get("s_region", ""))]
    except ValueError:
        footprint = []

    em_min, em_max = _float(row, "em_min"), _float(row, "em_max")
    return Frame(
        id=row.get("obs_publisher_did", "") or f"{collection}?{obs_id}/D{detector}",
        obsId=obs_id,
        pointing=match.group("pointing") if match else obs_id,
        step=int(match.group("step")) if match else 0,
        detector=detector,
        collection=collection,
        release=release,
        deep=collection.endswith("_deep"),
        key=key,
        irsaUrl=url,
        mjdStart=t0,
        mjdEnd=t1,
        mjdMid=mid,
        isoMid=Time(mid, format="mjd", scale="utc").isot[:23],
        exposureS=_float(row, "t_exptime"),
        bandMinUm=round(em_min * 1e6, 4) if em_min else None,
        bandMaxUm=round(em_max * 1e6, 4) if em_max else None,
        resolvingPower=_float(row, "em_res_power"),
        footprint=footprint,
        wavelengthUm=round(wavelength, 4) if wavelength is not None else None,
        bandwidthUm=round(bandwidth, 4) if bandwidth is not None else None,
        targetPixel=[round(pixel[0], 1), round(pixel[1], 1)] if pixel is not None else None,
    )


def normalise(rows: list[dict[str, str]], ra: float, dec: float) -> list[Frame]:
    """Frames sorted by time, without duplicates and without frames whose footprint misses."""
    seen: set[str] = set()
    frames: list[Frame] = []
    for row in rows:
        frame = frame_from_row(row, ra, dec)
        if frame is None or frame.id in seen:
            continue
        # SIA matches a 1″ circle; drop frames where the target sits outside the pixel grid.
        if frame.targetPixel is not None:
            x, y = frame.targetPixel
            if not (-0.5 <= x <= 2039.5 and -0.5 <= y <= 2039.5):
                continue
        seen.add(frame.id)
        frames.append(frame)
    frames.sort(key=lambda f: (f.mjdMid, f.detector))
    return frames


def group_passes(frames: list[Frame]) -> list[dict[str, Any]]:
    """Split time-sorted frames into passes wherever there is a gap of more than 20 days."""
    passes: list[dict[str, Any]] = []
    current: list[Frame] = []

    def close() -> None:
        if not current:
            return
        detectors: dict[str, int] = {}
        for f in current:
            detectors[str(f.detector)] = detectors.get(str(f.detector), 0) + 1
        start, end = current[0].mjdStart, current[-1].mjdEnd
        passes.append(
            {
                "index": len(passes),
                "mjdStart": start,
                "mjdEnd": end,
                "isoStart": Time(start, format="mjd").isot[:10],
                "isoEnd": Time(end, format="mjd").isot[:10],
                "frames": len(current),
                "pointings": len({f.pointing for f in current}),
                "detectors": detectors,
                "releases": sorted({f.release for f in current}),
            }
        )

    for frame in frames:
        if current and frame.mjdStart - current[-1].mjdEnd > PASS_GAP_DAYS:
            close()
            current = []
        frame.passIndex = len(passes)
        current.append(frame)
    close()
    return passes
