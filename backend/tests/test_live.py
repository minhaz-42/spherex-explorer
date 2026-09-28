"""Tests against the real IRSA, S3 and CDS services. Run with ``make test-live``.

They are deselected by default because they depend on the network and take tens of seconds.
"""

import io

import httpx
import numpy as np
import pytest
from astropy.io import fits

from spherex_explorer.archive import level2
from spherex_explorer.archive.fits_range import HttpRangeSource
from spherex_explorer.archive.level2 import Window, WindowRequest, read_window

pytestmark = pytest.mark.live

QR2_KEY = (
    "qr2/level2/2025W51_1A/l2b-v21-2025-354/3/level2_2025W51_1A_0684_2D3_spx_l2b-v21-2025-354.fits"
)
QR3_KEY = (
    "qr3/level2/2026W30_1B/l2b-v27-2026-222/6/level2_2026W30_1B_0051_1D6_spx_l2b-v27-2026-222.fits"
)
S3 = "https://nasa-irsa-spherex.s3.us-east-1.amazonaws.com/"
IBE = "https://irsa.ipac.caltech.edu/ibe/data/spherex/"


@pytest.mark.parametrize("key", [QR2_KEY, QR3_KEY], ids=["qr2", "qr3"])
async def test_range_reads_match_the_irsa_cutout_service(key: str) -> None:
    level2._learned_header_len.clear()
    x0, y0, w = 1000, 1010, 41
    async with httpx.AsyncClient(timeout=180) as client:
        ibe = await client.get(
            IBE + key, params={"center": f"{x0 + w // 2},{y0 + w // 2}pix", "size": f"{w}pix"}
        )
        ibe.raise_for_status()
        cut = fits.open(io.BytesIO(ibe.content))
        cx0 = round(1 - cut["IMAGE"].header["CRPIX1A"])
        cy0 = round(1 - cut["IMAGE"].header["CRPIX2A"])
        ch, cw = cut["IMAGE"].data.shape

        def choose(header, nx, ny):
            return WindowRequest(Window(cx0, cy0, cx0 + cw, cy0 + ch), target_row=cy0 + ch // 2)

        win = await read_window(HttpRangeSource(client, S3 + key, "S3"), key, choose)
    np.testing.assert_array_equal(win.image, cut["IMAGE"].data)
    np.testing.assert_array_equal(win.flags, cut["FLAGS"].data)


async def test_api_end_to_end_against_the_archive(api: httpx.AsyncClient) -> None:
    resolved = (await api.get("/api/resolve", params={"q": "M31"})).json()
    assert resolved["ra"] == pytest.approx(10.6847, abs=1e-3)
    obs = await api.get(
        "/api/observations", params={"ra": resolved["ra"], "dec": resolved["dec"]}, timeout=180
    )
    assert obs.status_code == 200, obs.text
    body = obs.json()
    assert body["summary"]["frames"] > 300
    assert len(body["passes"]) >= 3
    frame = body["frames"][0]
    cut = await api.get(
        "/api/cutout",
        params={"key": frame["key"], "ra": resolved["ra"], "dec": resolved["dec"], "size": 0.1},
        timeout=180,
    )
    assert cut.status_code == 200, cut.text
    payload = cut.json()
    assert payload["wavelength"]["atTargetUm"] == pytest.approx(frame["wavelengthUm"], abs=0.01)


async def test_the_local_model_answers_from_the_evidence(tmp_path) -> None:
    """One real question to the configured local model (Ollama must be running)."""
    import json

    from spherex_explorer.assistant import chat
    from spherex_explorer.assistant.chat import ChatMessage, ChatRequest
    from spherex_explorer.cache import Store
    from spherex_explorer.config import Settings
    from spherex_explorer.ratelimit import RateLimiter
    from spherex_explorer.services import Services, make_assistant

    settings = Settings(cache_dir=tmp_path / "c", snapshot_dir=tmp_path / "s")
    async with httpx.AsyncClient() as client:
        svc = Services(
            settings=settings,
            client=client,
            store=Store(settings.cache_dir, settings.snapshot_dir),
            limiter=RateLimiter(1000),
            assistant=make_assistant(settings, client),
        )
        health = await chat.model_health(svc)
        if not (health and health.model_installed):
            pytest.skip(health.detail if health else "no local model configured")
        req = ChatRequest(
            messages=[ChatMessage(role="user", content="What is a linear variable filter?")]
        )
        body = "".join([chunk async for chunk in chat.run(svc, req, "live")])
    events = [
        (b.splitlines()[0][7:], json.loads(b.splitlines()[1][6:]))
        for b in body.strip().split("\n\n")
    ]
    assert events[0][1]["mode"] == "local-model"
    assert events[-1][0] == "done"
    text = "".join(d["text"] for e, d in events if e == "delta")
    assert "<think>" not in text and len(text) > 40
