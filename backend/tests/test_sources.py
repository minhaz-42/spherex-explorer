import numpy as np
import pytest

from spherex_explorer.science.sources import FrameImage, find_candidates


def star(img: np.ndarray, x: float, y: float, flux: float, fwhm: float = 1.3) -> None:
    sigma = fwhm / 2.3548
    yy, xx = np.mgrid[0 : img.shape[0], 0 : img.shape[1]]
    g = np.exp(-((xx - x) ** 2 + (yy - y) ** 2) / (2 * sigma**2))
    img += (g / g.sum() * flux).astype(np.float32)


def field(seed: int = 0, n: int = 81) -> tuple[list[FrameImage], dict[str, object]]:
    """Four pointings, four steps each, 2 minutes apart; pointings 6 hours apart.

    A fixed star field, one moving object at 2.2 px/h, a cosmic ray in a single frame, and a
    star that is only bright at some "wavelengths" (it must not be mistaken for a mover).
    """
    rng = np.random.default_rng(seed)
    stars = rng.uniform(8, n - 8, size=(25, 2))
    frames = []
    start = 61011.5
    velocity = (2.0, -1.0)  # px per hour; stays inside the field for all 18 hours
    origin = (20.0, 60.0)
    truth = []
    for p in range(4):
        for step in range(4):
            mjd = start + p * 0.25 + step * (2 / 1440)
            hours = (mjd - start) * 24
            img = rng.normal(0, 1.0, (n, n)).astype(np.float32)
            for i, (x, y) in enumerate(stars):
                flux = 150.0 if i != 0 or step % 2 == 0 else 10.0  # star 0 fades in odd steps
                star(img, x, y, flux)
            mx, my = origin[0] + velocity[0] * hours, origin[1] + velocity[1] * hours
            star(img, mx, my, 120.0)
            truth.append((mjd, mx, my))
            if p == 1 and step == 2:
                img[40, 40] += 60.0  # a cosmic ray: one pixel, one frame
            frames.append(
                FrameImage(
                    key=f"k{p}{step}",
                    pointing=f"P{p}",
                    mjd=mjd,
                    image=img,
                    bad=np.zeros((n, n), dtype=bool),
                    rms=1.0,
                )
            )
    return frames, {"velocity": velocity, "truth": truth}


def test_finds_the_mover_and_nothing_else() -> None:
    frames, info = field()
    candidates, stats = find_candidates(frames)
    assert stats["detections"] > 25 * 16 * 0.8
    assert len(candidates) == 1, [c.sightings for c in candidates]
    [c] = candidates
    assert c.strength == "candidate"
    assert len(c.sightings) == 4
    assert c.rate_px_per_h == pytest.approx(np.hypot(*info["velocity"]), rel=0.05)
    # Moving +x (west) and −y (south): position angle between south (180°) and west (270°).
    assert 180 < c.position_angle_deg < 270
    for s in c.sightings:
        _, tx, ty = min(info["truth"], key=lambda t: abs(t[0] - s.mjd))
        assert np.hypot(s.x - tx, s.y - ty) < 1.0


def test_two_pointings_give_only_a_weak_candidate() -> None:
    frames, _ = field()
    two = [f for f in frames if f.pointing in ("P0", "P2")]
    candidates, _ = find_candidates(two)
    assert len(candidates) == 1
    assert candidates[0].strength == "weak candidate"


def test_a_static_field_has_no_candidates() -> None:
    frames, _ = field(seed=3)
    rng = np.random.default_rng(9)
    still = []
    for f in frames:
        img = rng.normal(0, 1.0, f.image.shape).astype(np.float32)
        for x, y in [(20, 20), (50, 30), (60, 60)]:
            star(img, x, y, 150.0)
        still.append(FrameImage(f.key, f.pointing, f.mjd, img, f.bad, 1.0))
    candidates, stats = find_candidates(still)
    assert candidates == []
    assert stats["sightings"] == 0


def test_missing_data_is_not_detected() -> None:
    frames, _ = field()
    f = frames[0]
    bad = np.zeros_like(f.bad)
    bad[10:15, 10:15] = True
    img = f.image.copy()
    img[12, 12] = 500.0
    candidates, _ = find_candidates(
        [FrameImage(f.key, f.pointing, f.mjd, img, bad, 1.0), *frames[1:]]
    )
    for c in candidates:
        for s in c.sightings:
            assert not (10 <= s.x <= 15 and 10 <= s.y <= 15)
