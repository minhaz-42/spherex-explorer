"""Candidate moving sources in one pass: a transparent, deliberately simple search.

Stars stay put; anything in the Solar System moves. On frames already aligned to one grid:

1. **Detect** point sources in each frame: local maxima of a lightly smoothed image more than
   ``DETECT_SIGMA`` times the smoothed noise above the background, away from missing data, the
   frame edge and the wings of very bright stars.
2. **Remove the static sky**: a detection that has a counterpart within ``STATIC_RADIUS_PX`` in a
   frame from a *different pointing* (taken at least ``POINTING_GAP_H`` apart) is a fixed source.
3. **Confirm within a pointing**: SPHEREx takes up to four exposures about 2 minutes apart at each
   pointing. A real object appears at almost the same place in at least two of them; a cosmic
   ray or a glitch appears once. Surviving detections that repeat within a pointing form a
   *sighting*.
4. **Link sightings across pointings** into straight tracks at a constant rate, between
   ``MIN_RATE`` and ``MAX_RATE``. Three or more sightings on one line make a candidate; two make a
   weak candidate, reported as such.

Everything this finds is a *candidate*. Matching it with JPL's predictions for catalogued bodies is
the next step; an unmatched candidate may be an artefact, a faint known body, or something new,
and only further analysis could tell.
"""

from __future__ import annotations

import itertools
import math
from dataclasses import dataclass, field

import numpy as np
from numpy.typing import NDArray
from scipy import ndimage

DETECT_SIGMA = 5.0
STATIC_RADIUS_PX = 1.5
SIGHTING_RADIUS_PX = 1.5
LINK_TOLERANCE_PX = 2.0
POINTING_GAP_H = 0.5
BRIGHT_WING_SIGMA = 400.0  # detections this far above noise mask their surroundings
BRIGHT_WING_RADIUS_PX = 9
MIN_RATE_PX_PER_H = 0.3  # below this, "moving" is indistinguishable from static over a pass
MAX_RATE_PX_PER_H = 25.0  # about 150″/h, well above main-belt rates near quadrature


@dataclass(frozen=True)
class FrameImage:
    key: str
    pointing: str
    mjd: float
    # Background-subtracted, on the common grid (row 0 = south), with flagged pixels already
    # filled from their neighbours. Detection runs on this image: the pipeline flags the core of
    # a bright moving source (TRANSIENT, SUR_ERROR), so refusing flagged pixels would discard
    # exactly the objects being looked for. An isolated flagged pixel is filled from its
    # neighbours and cannot make a peak; an unflagged glitch fails the repeat-within-a-pointing
    # test below.
    image: NDArray[np.float32]
    bad: NDArray[np.bool_]  # no data (outside the frame)
    rms: float


@dataclass(frozen=True)
class Detection:
    frame: int
    x: float
    y: float
    snr: float


@dataclass
class Sighting:
    pointing: str
    mjd: float
    x: float
    y: float
    snr: float
    detections: list[Detection] = field(default_factory=list)


@dataclass
class Candidate:
    sightings: list[Sighting]
    rate_px_per_h: float
    position_angle_deg: float  # direction of motion, east of north
    residual_px: float

    @property
    def strength(self) -> str:
        return "candidate" if len(self.sightings) >= 3 else "weak candidate"


def detect(frame: FrameImage, index: int) -> list[Detection]:
    img = np.where(frame.bad | ~np.isfinite(frame.image), 0.0, frame.image).astype(np.float64)
    smooth = ndimage.gaussian_filter(img, 0.8, mode="nearest")
    valid = ~frame.bad & np.isfinite(frame.image)
    values = smooth[valid]
    if values.size < 50:
        return []
    median = float(np.median(values))
    mad = float(np.median(np.abs(values - median))) * 1.4826
    noise = mad if mad > 0 else float(np.std(values))
    if noise <= 0:
        return []
    peaks = (smooth == ndimage.maximum_filter(smooth, size=3)) & (
        smooth > median + DETECT_SIGMA * noise
    )
    # Away from missing data and the frame edge, where a maximum can be an artefact.
    near_bad = ndimage.binary_dilation(~valid, iterations=1)
    peaks &= ~near_bad
    peaks[:2, :] = peaks[-2:, :] = False
    peaks[:, :2] = peaks[:, -2:] = False
    # Mask the wings of very bright stars, where the point-spread function makes false peaks.
    bright = peaks & (smooth > median + BRIGHT_WING_SIGMA * noise)
    if bright.any():
        yy, xx = np.nonzero(bright)
        wing = np.zeros_like(peaks)
        for y, x in zip(yy, xx, strict=True):
            y0, y1 = max(y - BRIGHT_WING_RADIUS_PX, 0), y + BRIGHT_WING_RADIUS_PX + 1
            x0, x1 = max(x - BRIGHT_WING_RADIUS_PX, 0), x + BRIGHT_WING_RADIUS_PX + 1
            wing[y0:y1, x0:x1] = True
        wing[bright] = False
        peaks &= ~wing
    out = []
    for y, x in zip(*np.nonzero(peaks), strict=True):
        patch = smooth[max(y - 1, 0) : y + 2, max(x - 1, 0) : x + 2] - median
        patch = np.clip(patch, 0, None)
        total = patch.sum()
        if total <= 0:
            continue
        py, px = np.mgrid[max(y - 1, 0) : y + 2, max(x - 1, 0) : x + 2]
        out.append(
            Detection(
                frame=index,
                x=float((px * patch).sum() / total),
                y=float((py * patch).sum() / total),
                snr=float((smooth[y, x] - median) / noise),
            )
        )
    return out


def _near(a: Detection | Sighting, b: Detection | Sighting, r: float) -> bool:
    return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 <= r * r


def find_candidates(frames: list[FrameImage]) -> tuple[list[Candidate], dict[str, int]]:
    detections = [detect(f, i) for i, f in enumerate(frames)]
    stats = {"frames": len(frames), "detections": sum(len(d) for d in detections)}

    # 2. Static sky: seen again at the same place in another pointing.
    transient: list[Detection] = []
    for i, dets in enumerate(detections):
        for d in dets:
            static = False
            for j, other in enumerate(detections):
                if j == i or frames[j].pointing == frames[i].pointing:
                    continue
                if abs(frames[j].mjd - frames[i].mjd) * 24 < POINTING_GAP_H:
                    continue
                if any(_near(d, o, STATIC_RADIUS_PX) for o in other):
                    static = True
                    break
            if not static:
                transient.append(d)
    stats["transient"] = len(transient)

    # 3. Sightings: transient detections repeated within one pointing.
    by_pointing: dict[str, list[Detection]] = {}
    for d in transient:
        by_pointing.setdefault(frames[d.frame].pointing, []).append(d)
    sightings: list[Sighting] = []
    for pointing, dets in by_pointing.items():
        used: set[int] = set()
        for a_i, a in enumerate(dets):
            if a_i in used:
                continue
            group = [a]
            for b_i, b in enumerate(dets):
                if (
                    b_i != a_i
                    and b_i not in used
                    and b.frame != a.frame
                    and _near(a, b, SIGHTING_RADIUS_PX)
                ):
                    group.append(b)
                    used.add(b_i)
            if len({g.frame for g in group}) < 2:
                continue
            used.add(a_i)
            sightings.append(
                Sighting(
                    pointing=pointing,
                    mjd=float(np.mean([frames[g.frame].mjd for g in group])),
                    x=float(np.mean([g.x for g in group])),
                    y=float(np.mean([g.y for g in group])),
                    snr=float(np.max([g.snr for g in group])),
                    detections=group,
                )
            )
    stats["sightings"] = len(sightings)

    # 4. Link sightings from different pointings on straight, constant-rate tracks. Every pair
    # proposes a track and gathers the sightings that lie on it; then the longest, best-fitting
    # tracks are accepted first, each sighting belonging to at most one track.
    sightings.sort(key=lambda s: s.mjd)
    proposals: list[tuple[frozenset[int], Candidate]] = []
    seen: set[frozenset[int]] = set()
    for (i, first), (j, second) in itertools.combinations(enumerate(sightings), 2):
        if first.pointing == second.pointing:
            continue
        dt_h = (second.mjd - first.mjd) * 24
        if dt_h < POINTING_GAP_H:
            continue
        vx, vy = (second.x - first.x) / dt_h, (second.y - first.y) / dt_h
        if not MIN_RATE_PX_PER_H <= math.hypot(vx, vy) <= MAX_RATE_PX_PER_H:
            continue
        members: dict[int, Sighting] = {i: first, j: second}
        for k, third in enumerate(sightings):
            if k in members or third.pointing in {m.pointing for m in members.values()}:
                continue
            dt = (third.mjd - first.mjd) * 24
            if (
                math.hypot(first.x + vx * dt - third.x, first.y + vy * dt - third.y)
                <= LINK_TOLERANCE_PX
            ):
                members[k] = third
        ids = frozenset(members)
        if ids in seen:
            continue
        seen.add(ids)
        ordered = sorted(members.values(), key=lambda s: s.mjd)
        ts = np.array([(s.mjd - ordered[0].mjd) * 24 for s in ordered])
        xs = np.array([s.x for s in ordered])
        ys = np.array([s.y for s in ordered])
        fx, fy = np.polyfit(ts, xs, 1), np.polyfit(ts, ys, 1)
        residual = float(
            np.sqrt(np.mean((np.polyval(fx, ts) - xs) ** 2 + (np.polyval(fy, ts) - ys) ** 2))
        )
        rate = math.hypot(fx[0], fy[0])
        if residual > LINK_TOLERANCE_PX or not MIN_RATE_PX_PER_H <= rate <= MAX_RATE_PX_PER_H:
            continue
        # Grid x grows westward (east is left) and y grows northward.
        pa = math.degrees(math.atan2(-fx[0], fy[0])) % 360
        proposals.append(
            (
                ids,
                Candidate(
                    sightings=ordered,
                    rate_px_per_h=rate,
                    position_angle_deg=pa,
                    residual_px=residual,
                ),
            )
        )
    proposals.sort(key=lambda p: (-len(p[0]), p[1].residual_px))
    candidates: list[Candidate] = []
    taken: set[int] = set()
    for ids, cand in proposals:
        if ids & taken:
            continue
        candidates.append(cand)
        taken |= ids
    candidates.sort(key=lambda c: (-len(c.sightings), c.residual_px))
    stats["candidates"] = len(candidates)
    return candidates, stats
