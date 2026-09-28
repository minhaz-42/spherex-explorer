"""Background and aperture photometry on native (not resampled) pixels.

This is deliberately simple and says so in every result: a circular aperture on the Level 2
image, a local sigma-clipped background, and an uncertainty from the pipeline's VARIANCE plane.
There is no PSF fitting and no aperture correction, so absolute fluxes are low by the fraction of
the PSF outside the aperture. Comparisons between frames at the same wavelength are what these
numbers are for.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
from astropy.stats import sigma_clipped_stats
from numpy.typing import NDArray

ARCSEC2_TO_SR = (math.pi / (180 * 3600)) ** 2
AB_ZERO_JY = 3631.0

APERTURE_RADIUS_PX = 2.0
# Below this fraction of usable aperture weight, no brightness is reported.
MIN_USABLE_APERTURE = 0.5
ANNULUS_PX = (5.0, 9.0)


@dataclass(frozen=True)
class Background:
    level: float  # MJy/sr
    rms: float  # MJy/sr
    pixels: int


def estimate_background(
    image: NDArray[np.float32], usable: NDArray[np.bool_], *, min_pixels: int = 25
) -> Background | None:
    """Sigma-clipped median and standard deviation of the usable pixels."""
    values = image[usable & np.isfinite(image)]
    if values.size < min_pixels:
        return None
    _, median, std = sigma_clipped_stats(values, sigma=3.0, maxiters=5)
    return Background(level=float(median), rms=float(std), pixels=int(values.size))


@dataclass(frozen=True)
class Photometry:
    flux_ujy: float | None
    error_ujy: float | None
    ab_mag: float | None
    snr: float | None
    background: float | None  # MJy/sr, from the annulus
    aperture_radius_arcsec: float
    pixels_used: float
    masked_in_aperture: int
    overflow_in_aperture: bool
    reliable: bool
    reasons: tuple[str, ...]

    def to_json(self) -> dict[str, object]:
        return {
            "fluxMicroJy": _round(self.flux_ujy, 4),
            "errorMicroJy": _round(self.error_ujy, 4),
            "abMag": _round(self.ab_mag, 4),
            "snr": _round(self.snr, 2),
            "backgroundMJySr": _round(self.background, 6),
            "apertureRadiusArcsec": round(self.aperture_radius_arcsec, 2),
            "pixelsUsed": round(self.pixels_used, 2),
            "maskedInAperture": self.masked_in_aperture,
            "overflowInAperture": self.overflow_in_aperture,
            "reliable": self.reliable,
            "reasons": list(self.reasons),
            "method": (
                "Circular aperture of radius 2 px (12.3″) on the Level 2 image, local "
                "sigma-clipped background from a 5–9 px annulus, uncertainty from the "
                "pipeline VARIANCE plane. Not aperture-corrected."
            ),
        }


def _no_measurement(radius_arcsec: float, reason: str) -> Photometry:
    return Photometry(
        flux_ujy=None,
        error_ujy=None,
        ab_mag=None,
        snr=None,
        background=None,
        aperture_radius_arcsec=radius_arcsec,
        pixels_used=0.0,
        masked_in_aperture=0,
        overflow_in_aperture=False,
        reliable=False,
        reasons=(reason,),
    )


def _round(v: float | None, digits: int) -> float | None:
    return None if v is None or not math.isfinite(v) else round(v, digits)


def _overlap_weights(
    shape: tuple[int, int], cx: float, cy: float, r: float, sub: int = 5
) -> NDArray[np.float64]:
    """Fraction of each pixel inside a circle, by ``sub``×``sub`` supersampling."""
    h, w = shape
    offsets = (np.arange(sub) + 0.5) / sub - 0.5
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
    weight = np.zeros(shape, dtype=np.float64)
    for oy in offsets:
        for ox in offsets:
            weight += ((xx + ox - cx) ** 2 + (yy + oy - cy) ** 2) <= r * r
    return weight / (sub * sub)


def aperture_photometry(
    image: NDArray[np.float32],
    variance: NDArray[np.float32] | None,
    usable: NDArray[np.bool_],
    overflow: NDArray[np.bool_],
    cx: float,
    cy: float,
    pixel_sr: float,
    *,
    variance_rows: tuple[int, int] | None = None,
) -> Photometry:
    """Aperture flux at ``(cx, cy)`` (0-based, in the arrays' own pixel coordinates).

    ``variance`` may cover only some rows of ``image``: ``variance_rows = (first row, count)``.
    """
    reasons: list[str] = []
    r_in, r_out = ANNULUS_PX
    yy, xx = np.mgrid[0 : image.shape[0], 0 : image.shape[1]]
    dist = np.hypot(xx - cx, yy - cy)
    annulus = (dist >= r_in) & (dist <= r_out) & usable & np.isfinite(image)
    bg = estimate_background(image, annulus, min_pixels=12)
    aperture_radius_arcsec = APERTURE_RADIUS_PX * math.sqrt(pixel_sr / ARCSEC2_TO_SR)

    weights = _overlap_weights(image.shape, cx, cy, APERTURE_RADIUS_PX)
    in_aperture = weights > 0
    if not in_aperture.any() or weights.sum() < 0.5 * math.pi * APERTURE_RADIUS_PX**2:
        return _no_measurement(aperture_radius_arcsec, "The target is at the edge of the frame.")
    if bg is None:
        return _no_measurement(
            aperture_radius_arcsec,
            "Too few clean pixels around the target to estimate the background.",
        )

    good = in_aperture & usable & np.isfinite(image)
    masked = int((in_aperture & ~usable).sum())
    # A sum over the few unflagged pixels of a mostly flagged aperture is not a measurement: it
    # would report a bright source as nearly zero. QR3 flags saturated cores as BLOOM, for one.
    usable_weight = float(np.sum(np.where(good, weights, 0.0)))
    if usable_weight < MIN_USABLE_APERTURE * float(weights.sum()):
        return _no_measurement(
            aperture_radius_arcsec,
            f"{masked} of the aperture's pixels are flagged, so the target is not measurable "
            "in this frame.",
        )
    overflowed = bool((in_aperture & overflow).any())
    w = np.where(good, weights, 0.0)
    # Select rather than multiply: 0 × NaN is NaN, and masked pixels may hold NaN.
    signal = float(np.sum(np.where(good, w * (image - bg.level), 0.0)))
    flux_mjy = signal * pixel_sr  # MJy/sr × sr = MJy
    flux_ujy = flux_mjy * 1e12

    error_ujy: float | None = None
    if variance is not None and variance_rows is not None:
        start, count = variance_rows
        var_full = np.full(image.shape, np.nan, dtype=np.float64)
        stop = min(start + count, image.shape[0])
        if start < image.shape[0] and stop > max(start, 0):
            var_full[max(start, 0) : stop] = variance[max(-start, 0) : stop - start]
        pixel_var = np.nansum(w**2 * np.where(np.isfinite(var_full), var_full, 0.0))
        missing_var = bool(np.any(good & ~np.isfinite(var_full)))
        bg_var = (w.sum() ** 2) * (bg.rms**2) / max(bg.pixels, 1)
        error_ujy = math.sqrt(pixel_var + bg_var) * pixel_sr * 1e12
        if missing_var:
            reasons.append("Part of the aperture has no variance estimate.")

    ab = -2.5 * math.log10(flux_ujy * 1e-6 / AB_ZERO_JY) if flux_ujy > 0 else None
    if masked:
        reasons.append(f"{masked} flagged pixel{'s' if masked != 1 else ''} inside the aperture.")
    if overflowed:
        reasons.append("Pixels in the aperture reached the overflow limit (possibly saturated).")
    snr = flux_ujy / error_ujy if error_ujy else None
    return Photometry(
        flux_ujy=flux_ujy,
        error_ujy=error_ujy,
        ab_mag=ab,
        snr=snr,
        background=bg.level,
        aperture_radius_arcsec=aperture_radius_arcsec,
        pixels_used=float(w.sum()),
        masked_in_aperture=masked,
        overflow_in_aperture=overflowed,
        reliable=not reasons,
        reasons=tuple(reasons),
    )
