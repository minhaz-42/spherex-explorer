"""Run the moving-source search on cutout payloads and describe the result."""

from __future__ import annotations

import base64
from typing import Any

import numpy as np

from .grid import Grid
from .sources import MAX_RATE_PX_PER_H, MIN_RATE_PX_PER_H, FrameImage, find_candidates

METHOD = (
    "Point sources were detected in each aligned frame, 5σ above the local noise, away from "
    "missing data and bright-star wings. Flagged pixels are filled from their neighbours "
    "first, because the pipeline flags the cores of bright moving sources. Sources seen again "
    "at the same place in another pointing were treated as fixed stars and galaxies. What "
    "remained had to repeat within one pointing, whose exposures are about 2 minutes apart, "
    "to rule out single-frame glitches, and then line up at a constant rate across pointings. "
    "This is a simple, transparent search, not a survey pipeline."
)


def _frame(payload: dict[str, Any]) -> FrameImage:
    n = int(payload["image"]["width"])
    image = np.frombuffer(base64.b64decode(payload["image"]["data"]), dtype="<f4").reshape(n, n)
    mask = np.frombuffer(base64.b64decode(payload["mask"]["data"]), dtype=np.uint8).reshape(n, n)
    obs_id = str(payload["obsId"])
    return FrameImage(
        key=str(payload["key"]),
        pointing=obs_id.rsplit("_", 1)[0],
        mjd=float(payload["time"]["mjdMid"]),
        image=image,
        # No data only: flagged pixels (bit 1) are already filled and are kept for detection.
        bad=(mask & 2) != 0,
        rms=float(payload["background"]["rmsMJySr"] or 0.0),
    )


def moving_candidates(grid: Grid, payloads: list[dict[str, Any]]) -> dict[str, Any]:
    frames = sorted((_frame(p) for p in payloads), key=lambda f: f.mjd)
    found, stats = find_candidates(frames)
    wcs = grid.wcs()
    scale = grid.scale_arcsec
    out = []
    for i, cand in enumerate(found):
        sightings = []
        for s in cand.sightings:
            ra, dec = wcs.pixel_to_world_values(s.x, s.y)
            sightings.append(
                {
                    "mjd": round(s.mjd, 6),
                    "ra": round(float(ra), 7),
                    "dec": round(float(dec), 7),
                    "snr": round(s.snr, 1),
                    "keys": [frames[d.frame].key for d in s.detections],
                }
            )
        out.append(
            {
                "id": f"C{i + 1}",
                "strength": cand.strength,
                "sightings": sightings,
                "rateArcsecPerHour": round(cand.rate_px_per_h * scale, 1),
                "positionAngleDeg": round(cand.position_angle_deg, 1),
                "residualArcsec": round(cand.residual_px * scale, 2),
            }
        )
    return {
        "field": grid.to_json(),
        "candidates": out,
        "stats": stats,
        "limits": {
            "minRateArcsecPerHour": round(MIN_RATE_PX_PER_H * scale, 1),
            "maxRateArcsecPerHour": round(MAX_RATE_PX_PER_H * scale, 1),
        },
        "method": METHOD,
        "caution": (
            "These are candidates from an automatic search. Compare them with JPL's known objects; "
            "an unmatched candidate may be an artefact, a faint catalogued body, or something new, "
            "and only further analysis could tell."
        ),
    }
