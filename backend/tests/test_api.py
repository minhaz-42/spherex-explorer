import base64
import io
from pathlib import Path

import httpx
import numpy as np
import pytest
import respx
from asgi_lifespan import LifespanManager
from astropy.io import fits

from spherex_explorer.cache import DiskStore, cache_key
from spherex_explorer.config import Settings
from spherex_explorer.main import create_app

from .synthetic import make_level2

KEY = (
    "qr2/level2/2025W49_1A/l2b-v20-2025-339/2/level2_2025W49_1A_0332_1D2_spx_l2b-v20-2025-339.fits"
)
RA, DEC = 161.3, 2.45


def serve_ranges(raw: bytes):
    def reply(request: httpx.Request) -> httpx.Response:
        spec = request.headers["range"].removeprefix("bytes=")
        if spec.startswith("-"):
            start = max(len(raw) - int(spec[1:]), 0)
            end = len(raw) - 1
        else:
            a, b = spec.split("-")
            start, end = int(a), min(int(b), len(raw) - 1)
        return httpx.Response(
            206,
            content=raw[start : end + 1],
            headers={"Content-Range": f"bytes {start}-{end}/{len(raw)}"},
        )

    return reply


# --- resolve ---------------------------------------------------------------------------------


async def test_resolve_coordinates_needs_no_network(api: httpx.AsyncClient) -> None:
    with respx.mock(assert_all_called=False) as mock:
        response = await api.get("/api/resolve", params={"q": "00:42:44.3 +41:16:08"})
        assert not mock.calls
    body = response.json()
    assert response.status_code == 200
    assert body["ra"] == pytest.approx(10.684583, abs=1e-5)
    assert body["constellation"] == "Andromeda"
    assert body["resolver"] == "coordinates"


async def test_resolve_name_through_sesame(
    api: httpx.AsyncClient, settings: Settings, fixtures: Path
) -> None:
    with respx.mock:
        route = respx.get(url__startswith=settings.sesame_url).mock(
            return_value=httpx.Response(200, text=(fixtures / "sesame_m31.xml").read_text())
        )
        first = await api.get("/api/resolve", params={"q": "M31"})
        second = await api.get("/api/resolve", params={"q": "m31"})
    assert first.status_code == 200
    assert first.json()["name"] == "M 31"
    assert first.json()["kind"] == "Galaxy with an active nucleus"
    assert second.json() == first.json()
    assert route.call_count == 1  # the second lookup came from the cache


async def test_resolve_unknown_name_is_404(
    api: httpx.AsyncClient, settings: Settings, fixtures: Path
) -> None:
    with respx.mock:
        respx.get(url__startswith=settings.sesame_url).mock(
            return_value=httpx.Response(200, text=(fixtures / "sesame_notfound.xml").read_text())
        )
        response = await api.get("/api/resolve", params={"q": "NotARealObjectXYZ"})
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


async def test_resolve_upstream_failures(api: httpx.AsyncClient, settings: Settings) -> None:
    with respx.mock:
        respx.get(url__startswith=settings.sesame_url).mock(side_effect=httpx.ConnectError("down"))
        down = await api.get("/api/resolve", params={"q": "Vega"})
    assert down.status_code == 502
    assert down.json()["error"]["service"] == "CDS Sesame name resolver"
    with respx.mock:
        respx.get(url__startswith=settings.sesame_url).mock(side_effect=httpx.ReadTimeout("slow"))
        slow = await api.get("/api/resolve", params={"q": "Deneb"})
    assert slow.status_code == 504
    assert slow.json()["error"]["code"] == "upstream_timeout"


async def test_invalid_input_is_400(api: httpx.AsyncClient) -> None:
    assert (await api.get("/api/resolve", params={"q": "10 95"})).status_code == 400
    assert (await api.get("/api/resolve")).status_code == 400
    bad = await api.get("/api/observations", params={"ra": 400, "dec": 0})
    assert bad.status_code == 400
    assert "ra" in bad.json()["error"]["message"]


# --- observations ----------------------------------------------------------------------------


async def test_observations_normalise_and_group(
    api: httpx.AsyncClient, settings: Settings, fixtures: Path
) -> None:
    with respx.mock:
        route = respx.get(url__startswith=settings.sia_url).mock(
            return_value=httpx.Response(200, text=(fixtures / "sia_iris_d2.csv").read_text())
        )
        response = await api.get("/api/observations", params={"ra": 161.29678, "dec": 2.44824})
    assert response.status_code == 200
    body = response.json()
    assert body["summary"]["frames"] == 14
    assert body["summary"]["detectors"] == {"2": 14}
    assert len(body["passes"]) == 1
    assert body["target"]["constellation"] == "Sextans"
    frame = body["frames"][0]
    assert frame["key"].startswith("qr2/level2/")
    assert 1.1 < frame["wavelengthUm"] < 1.2
    sent = route.calls[0].request.url
    assert sent.params.get_list("COLLECTION") == settings.wide_collections


async def test_observations_with_no_frames(
    api: httpx.AsyncClient, settings: Settings, fixtures: Path
) -> None:
    header_only = (fixtures / "sia_iris_d2.csv").read_text().splitlines()[0] + "\n"
    with respx.mock:
        respx.get(url__startswith=settings.sia_url).mock(
            return_value=httpx.Response(200, text=header_only)
        )
        body = (await api.get("/api/observations", params={"ra": 1.0, "dec": 1.0})).json()
    assert body["frames"] == [] and body["passes"] == [] and body["summary"]["first"] is None


async def test_observations_archive_error_is_502(
    api: httpx.AsyncClient, settings: Settings, fixtures: Path
) -> None:
    with respx.mock:
        respx.get(url__startswith=settings.sia_url).mock(
            return_value=httpx.Response(200, text=(fixtures / "sia_error.txt").read_text())
        )
        response = await api.get("/api/observations", params={"ra": 2.0, "dec": 2.0})
    assert response.status_code == 502
    assert response.json()["error"]["service"] == "IRSA image search (SIA)"


async def test_deep_window_rules(api: httpx.AsyncClient) -> None:
    outside = await api.get(
        "/api/observations", params={"ra": 10, "dec": 10, "deepStart": 61000, "deepEnd": 61010}
    )
    assert outside.status_code == 400
    too_long = await api.get(
        "/api/observations", params={"ra": 270, "dec": 66.56, "deepStart": 61000, "deepEnd": 61100}
    )
    assert too_long.status_code == 400


# --- cutouts ---------------------------------------------------------------------------------


async def test_cutout_from_s3_ranges(api: httpx.AsyncClient, settings: Settings) -> None:
    syn = make_level2()
    with respx.mock:
        respx.get(settings.s3_url + KEY).mock(side_effect=serve_ranges(syn.raw))
        response = await api.get(
            "/api/cutout", params={"key": KEY, "ra": RA, "dec": DEC, "size": 0.05}
        )
    assert response.status_code == 200, response.text
    body = response.json()
    n = body["image"]["width"]
    image = np.frombuffer(base64.b64decode(body["image"]["data"]), dtype="<f4")
    assert image.size == n * n
    assert body["access"]["via"] == "s3"
    assert body["obsId"] == "2025W49_1A_0332_1"
    assert body["wavelength"]["atTargetUm"] is not None
    assert response.headers.get("content-encoding") == "gzip"


async def test_cutout_falls_back_to_the_irsa_cutout_service(
    api: httpx.AsyncClient, settings: Settings
) -> None:
    syn = make_level2()
    # The IBE cutout of the whole synthetic frame: same file, with CRPIXnA marking parent pixel 0.
    hdul = fits.open(io.BytesIO(syn.raw))
    hdul["IMAGE"].header["CRPIX1A"] = 1.0
    hdul["IMAGE"].header["CRPIX2A"] = 1.0
    buf = io.BytesIO()
    hdul.writeto(buf)
    with respx.mock:
        respx.get(settings.s3_url + KEY).mock(return_value=httpx.Response(503))
        ibe = respx.get(url__startswith=settings.irsa_data_url + KEY).mock(
            return_value=httpx.Response(200, content=buf.getvalue())
        )
        response = await api.get(
            "/api/cutout", params={"key": KEY, "ra": RA, "dec": DEC, "size": 0.05}
        )
    assert response.status_code == 200, response.text
    assert ibe.called
    assert response.json()["access"]["via"] == "ibe"


async def test_cutout_rejects_foreign_keys_and_big_fields(api: httpx.AsyncClient) -> None:
    bad_key = await api.get("/api/cutout", params={"key": "x" * 30, "ra": RA, "dec": DEC})
    assert bad_key.status_code == 400
    big = await api.get("/api/cutout", params={"key": KEY, "ra": RA, "dec": DEC, "size": 5})
    assert big.status_code == 400


async def test_cutout_outside_the_frame_is_404(api: httpx.AsyncClient, settings: Settings) -> None:
    syn = make_level2()
    with respx.mock:
        respx.get(settings.s3_url + KEY).mock(side_effect=serve_ranges(syn.raw))
        response = await api.get("/api/cutout", params={"key": KEY, "ra": 10.0, "dec": -40.0})
    assert response.status_code == 404


# --- snapshot mode and limits ----------------------------------------------------------------


async def test_snapshot_mode_serves_only_what_was_recorded(
    api: httpx.AsyncClient, settings: Settings
) -> None:
    DiskStore(settings.snapshot_dir).put(
        "observations",
        cache_key(12.5, 7.5, settings.wide_collections, None),
        {"frames": [], "demo": True},
    )
    with respx.mock(assert_all_called=False) as mock:
        hit = await api.get(
            "/api/observations", params={"ra": 12.5, "dec": 7.5, "source": "snapshot"}
        )
        miss = await api.get(
            "/api/observations", params={"ra": 1.5, "dec": 7.5, "source": "snapshot"}
        )
        assert not mock.calls
    assert hit.status_code == 200 and hit.json()["demo"] is True
    assert miss.status_code == 404
    assert miss.json()["error"]["code"] == "not_in_snapshot"


async def test_rate_limit_returns_429(settings: Settings, fixtures: Path) -> None:
    strict = settings.model_copy(update={"rate_limit_per_minute": 2})
    app = create_app(strict)
    async with LifespanManager(app):
        client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t")
        with respx.mock:
            respx.get(url__startswith=strict.sesame_url).mock(
                return_value=httpx.Response(200, text=(fixtures / "sesame_m31.xml").read_text())
            )
            codes = [
                (await client.get("/api/resolve", params={"q": f"obj{i}"})).status_code
                for i in range(4)
            ]
        await client.aclose()
    assert 429 in codes


async def test_measure_returns_numbers_without_pixels(
    api: httpx.AsyncClient, settings: Settings
) -> None:
    syn = make_level2()
    with respx.mock:
        respx.get(settings.s3_url + KEY).mock(side_effect=serve_ranges(syn.raw))
        response = await api.get("/api/measure", params={"key": KEY, "ra": RA, "dec": DEC})
    assert response.status_code == 200, response.text
    body = response.json()
    assert "image" not in body and "mask" not in body
    assert body["wavelength"]["atTargetUm"] is not None
    assert body["photometry"]["fluxMicroJy"] is not None
    assert body["time"]["isoMid"].startswith("2025-12-02")


async def test_cases_are_served(api: httpx.AsyncClient) -> None:
    body = (await api.get("/api/cases")).json()
    assert body["cases"][0]["id"] == "demo"


async def test_oversized_bodies_are_refused(api: httpx.AsyncClient) -> None:
    huge = {"ra": 10, "dec": 10, "size": 0.1, "keys": ["x" * 1000] * 100}
    response = await api.post("/api/candidates", json=huge)
    assert response.status_code == 413


async def test_only_embeds_may_be_framed(api: httpx.AsyncClient) -> None:
    page = await api.get("/explore")
    assert "frame-ancestors 'none'" in page.headers["content-security-policy"]
    for path in ("/embed", "/embed/blink"):
        embed = await api.get(path)
        csp = embed.headers["content-security-policy"]
        assert "frame-ancestors *" in csp and "script-src 'self'" in csp
    lookalike = await api.get("/embedded")
    assert "frame-ancestors 'none'" in lookalike.headers["content-security-policy"]
