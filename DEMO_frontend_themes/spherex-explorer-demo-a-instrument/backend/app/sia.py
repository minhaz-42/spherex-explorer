"""Find SPHEREx images covering a sky position, with IRSA's SIA2 service.

Quick Releases 2 and 3 are consecutive slices of time, not reprocessings of
the same data, so every search asks all four spectral-image collections.
"""

from __future__ import annotations

import asyncio
import csv
import io
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone

import httpx

SIA_URL = "https://irsa.ipac.caltech.edu/SIA"

# collection -> (release, survey)
COLLECTIONS: dict[str, tuple[str, str]] = {
    "spherex_qr2": ("QR2", "wide"),
    "spherex_qr2_deep": ("QR2", "deep"),
    "spherex_qr3": ("QR3", "wide"),
    "spherex_qr3_deep": ("QR3", "deep"),
}

# band -> (min µm, max µm, resolving power, detector)
BANDS: dict[int, tuple[float, float, int, str]] = {
    1: (0.75, 1.09, 39, "D1"),
    2: (1.10, 1.62, 41, "D2"),
    3: (1.63, 2.41, 41, "D3"),
    4: (2.42, 3.82, 35, "D4"),
    5: (3.83, 4.41, 112, "D5"),
    6: (4.42, 5.00, 128, "D6"),
}

_MJD_EPOCH = datetime(1858, 11, 17, tzinfo=timezone.utc)
_REQUIRED = ("obs_id", "t_min", "em_min", "em_max")


@dataclass(frozen=True)
class Frame:
    obs_id: str
    collection: str
    release: str
    survey: str
    t_min_mjd: float
    time_utc: str
    em_min_um: float
    em_max_um: float
    band: int | None
    bandpass_name: str
    access_url: str
    cloud_access: str

    def to_dict(self) -> dict:
        return asdict(self)


def mjd_to_iso(mjd: float) -> str:
    return (_MJD_EPOCH + timedelta(days=mjd)).isoformat(timespec="seconds").replace("+00:00", "Z")


def band_for(micron_min: float, micron_max: float) -> int | None:
    """The band whose range contains the middle of the image's wavelength range."""
    mid = (micron_min + micron_max) / 2
    for band, (lo, hi, _, _) in BANDS.items():
        if lo - 0.005 <= mid <= hi + 0.005:
            return band
    return None


def _float(value: str | None) -> float | None:
    try:
        return float(value) if value not in (None, "") else None
    except ValueError:
        return None


def parse_sia_csv(text: str, collection: str) -> list[Frame]:
    """Turns an SIA2 CSV answer into frames, skipping rows that lack the essentials."""
    release, survey = COLLECTIONS[collection]
    reader = csv.DictReader(io.StringIO(text))
    frames: list[Frame] = []
    for row in reader:
        if any(not (row.get(col) or "").strip() for col in _REQUIRED):
            continue
        t_min, em_min, em_max = _float(row["t_min"]), _float(row["em_min"]), _float(row["em_max"])
        if t_min is None or em_min is None or em_max is None:
            continue
        lo_um, hi_um = em_min * 1e6, em_max * 1e6  # SIA gives metres
        frames.append(
            Frame(
                obs_id=row["obs_id"].strip(),
                collection=collection,
                release=release,
                survey=survey,
                t_min_mjd=t_min,
                time_utc=mjd_to_iso(t_min),
                em_min_um=round(lo_um, 5),
                em_max_um=round(hi_um, 5),
                band=band_for(lo_um, hi_um),
                bandpass_name=(row.get("energy_bandpassname") or "").strip(),
                access_url=(row.get("access_url") or "").strip(),
                cloud_access=(row.get("cloud_access") or "").strip(),
            )
        )
    return frames


async def query_collection(
    client: httpx.AsyncClient, collection: str, ra: float, dec: float, radius_deg: float, timeout_s: float
) -> list[Frame]:
    params = {"COLLECTION": collection, "POS": f"circle {ra} {dec} {radius_deg}", "RESPONSEFORMAT": "CSV"}
    response = await client.get(SIA_URL, params=params, timeout=timeout_s)
    response.raise_for_status()
    return parse_sia_csv(response.text, collection)


@dataclass
class CollectionResult:
    collection: str
    release: str
    survey: str
    count: int
    error: str | None


async def query_all(
    client: httpx.AsyncClient, ra: float, dec: float, radius_deg: float, timeout_s: float
) -> tuple[list[Frame], list[CollectionResult]]:
    """Queries every collection at once. One failing collection doesn't sink the rest."""
    names = list(COLLECTIONS)
    results = await asyncio.gather(
        *(query_collection(client, c, ra, dec, radius_deg, timeout_s) for c in names), return_exceptions=True
    )
    frames: list[Frame] = []
    summary: list[CollectionResult] = []
    for name, result in zip(names, results):
        release, survey = COLLECTIONS[name]
        if isinstance(result, BaseException):
            summary.append(CollectionResult(name, release, survey, 0, describe_error(result)))
        else:
            frames.extend(result)
            summary.append(CollectionResult(name, release, survey, len(result), None))
    frames.sort(key=lambda f: (f.t_min_mjd, f.band or 0))
    return frames, summary


def describe_error(exc: BaseException) -> str:
    if isinstance(exc, httpx.TimeoutException):
        return "IRSA didn't answer in time."
    if isinstance(exc, httpx.HTTPStatusError):
        return f"IRSA answered with HTTP {exc.response.status_code}."
    if isinstance(exc, httpx.HTTPError):
        return "Couldn't reach IRSA."
    return "The answer from IRSA couldn't be read."
