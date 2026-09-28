import json
import math

import httpx
import pytest
import respx

from spherex_explorer.config import Settings
from spherex_explorer.errors import UpstreamError
from spherex_explorer.solar_system.jpl import (
    dms_to_deg,
    hms_to_deg,
    horizons_command,
    parse_horizons,
    parse_sbident,
)
from spherex_explorer.solar_system.parallax import from_spacecraft, separation_arcsec

from .synthetic import make_level2

KEY = (
    "qr2/level2/2025W49_1A/l2b-v20-2025-339/2/level2_2025W49_1A_0332_1D2_spx_l2b-v20-2025-339.fits"
)


def test_sexagesimal_parsing() -> None:
    assert hms_to_deg("00:44:07.41") == pytest.approx(11.030875)
    assert dms_to_deg("+40 23'11.6\"") == pytest.approx(40.386556, abs=1e-6)
    assert dms_to_deg("-00 30'00\"") == pytest.approx(-0.5)


def test_sbident_answer_is_parsed(fixtures) -> None:
    body = json.loads((fixtures / "sbident_m31.json").read_text())
    objects = parse_sbident(body)
    assert len(objects) == body["n_second_pass"] == 13
    first = objects[0]
    assert first.name == "278696 (2008 RX131)"
    assert first.ra == pytest.approx(hms_to_deg("00:44:07.41"))
    assert first.vmag == pytest.approx(20.6)
    assert first.ra_rate == pytest.approx(18.01)


def test_empty_sbident_answer() -> None:
    assert parse_sbident({"n_second_pass": 0}) == []


@pytest.mark.parametrize(
    ("name", "command"),
    [
        ("7 Iris (A847 PA)", "7;"),
        ("278696 (2008 RX131)", "278696;"),
        ("(2011 AB12)", "DES=2011 AB12;"),
        ("C/2019 Y4 (ATLAS)", "DES=C/2019 Y4;CAP;NOFRAG;"),
        ("29P/Schwassmann-Wachmann", "DES=29P;CAP;NOFRAG;"),
        ("Something odd", None),
    ],
)
def test_horizons_commands(name: str, command: str | None) -> None:
    assert horizons_command(name) == command


def test_horizons_answer_is_parsed(fixtures) -> None:
    fx = json.loads((fixtures / "horizons_iris.json").read_text())
    [p] = parse_horizons(fx["geocentric"])
    assert p.ra == pytest.approx(161.204080867)
    assert p.dec == pytest.approx(2.507409068)
    assert p.delta_au == pytest.approx(2.06978488301747)
    with pytest.raises(UpstreamError):
        parse_horizons("No ephemeris for target")


def test_parallax_matches_horizons_seen_from_spherex(fixtures) -> None:
    """Our correction of the geocentric position with the frame header's spacecraft position
    reproduces JPL's own SPHEREx-centred answer."""
    fx = json.loads((fixtures / "horizons_iris.json").read_text())
    [geo] = parse_horizons(fx["geocentric"])
    [truth] = parse_horizons(fx["spherex_centric"])
    ra, dec = from_spacecraft(geo.ra, geo.dec, geo.delta_au, tuple(fx["spacecraft_km"]))
    # The correction itself is about 0.6″ here; what remains is well under a tenth of a pixel.
    assert separation_arcsec(geo.ra, geo.dec, truth.ra, truth.dec) > 0.4
    assert separation_arcsec(ra, dec, truth.ra, truth.dec) < 0.1


def test_parallax_of_a_nearby_body_is_large() -> None:
    # 0.01 au away, seen from 7,000 km off Earth's centre at right angles: about 16 arcmin... of
    # which the formula must give back the geometric value.
    ra, dec = from_spacecraft(0.0, 0.0, 0.01, (0.0, 7000.0, 0.0))
    expected = math.degrees(math.atan2(7000.0, 0.01 * 149_597_870.7)) * 3600
    assert separation_arcsec(0.0, 0.0, ra, dec) == pytest.approx(expected, rel=1e-6)


async def test_known_objects_route(api: httpx.AsyncClient, settings: Settings, fixtures) -> None:
    syn = make_level2()
    sbident = {
        "signature": {"version": "1.1"},
        "n_second_pass": 1,
        "fields_second": [
            "Object name",
            "Astrometric RA (hh:mm:ss)",
            "Astrometric Dec (dd mm'ss\")",
            'Dist. from center RA (")',
            'Dist. from center Dec (")',
            'Dist. from center Norm (")',
            "Visual magnitude (V)",
            'RA rate ("/h)',
            'Dec rate ("/h)',
        ],
        "data_second_pass": [
            [
                "7 Iris (A847 PA)",
                "10:45:12.00",
                "+02 27'00.0\"",
                "0",
                "0",
                "0",
                "10.2",
                "30.0",
                "-20.0",
            ]
        ],
    }
    horizons = json.loads((fixtures / "horizons_iris.json").read_text())["geocentric"]
    # Move the fixture's position onto the synthetic field so the body is inside it.
    horizons = horizons.replace("161.204080867,   2.507409068", "161.300000000,   2.450000000")

    def ranges(request: httpx.Request) -> httpx.Response:
        a, b = request.headers["range"].removeprefix("bytes=").split("-")
        start, end = int(a), min(int(b), len(syn.raw) - 1)
        return httpx.Response(
            206,
            content=syn.raw[start : end + 1],
            headers={"Content-Range": f"bytes {start}-{end}/{len(syn.raw)}"},
        )

    with respx.mock:
        respx.get(settings.s3_url + KEY).mock(side_effect=ranges)
        sb = respx.get(url__startswith=settings.sbident_url).mock(
            return_value=httpx.Response(200, json=sbident)
        )
        respx.get(url__startswith=settings.horizons_url).mock(
            return_value=httpx.Response(200, json={"result": horizons})
        )
        response = await api.post(
            "/api/known-objects", json={"ra": 161.3, "dec": 2.45, "size": 0.1, "keys": [KEY]}
        )
    assert response.status_code == 200, response.text
    body = response.json()
    assert sb.called
    sent = sb.calls[0].request.url.params
    assert sent["xobs"].startswith("5481.95")  # the frame header's spacecraft position
    assert sent["two-pass"] == "true"
    [obj] = body["objects"]
    assert obj["name"] == "7 Iris (A847 PA)"
    assert obj["positions"][0]["inField"] is True
    assert "not detections" in body["method"]


async def test_known_objects_validates_input(api: httpx.AsyncClient) -> None:
    bad = await api.post("/api/known-objects", json={"ra": 10, "dec": 10, "size": 0.1, "keys": []})
    assert bad.status_code == 400
    foreign = await api.post(
        "/api/known-objects", json={"ra": 10, "dec": 10, "size": 0.1, "keys": ["../x"]}
    )
    assert foreign.status_code == 400


def _jpl_mocks(settings: Settings, fixtures, bodies: list[str], horizons):  # type: ignore[no-untyped-def]
    """S3, SBIdent and Horizons for a synthetic frame; ``horizons`` answers each Horizons call."""
    syn = make_level2()
    row = ["10:45:12.00", "+02 27'00.0\"", "0", "0", "0", "10.2", "30.0", "-20.0"]
    sbident = {
        "signature": {"version": "1.1"},
        "n_second_pass": len(bodies),
        "fields_second": [
            "Object name",
            "Astrometric RA (hh:mm:ss)",
            "Astrometric Dec (dd mm'ss\")",
            'Dist. from center RA (")',
            'Dist. from center Dec (")',
            'Dist. from center Norm (")',
            "Visual magnitude (V)",
            'RA rate ("/h)',
            'Dec rate ("/h)',
        ],
        "data_second_pass": [[name, *row] for name in bodies],
    }

    def ranges(request: httpx.Request) -> httpx.Response:
        a, b = request.headers["range"].removeprefix("bytes=").split("-")
        start, end = int(a), min(int(b), len(syn.raw) - 1)
        return httpx.Response(
            206,
            content=syn.raw[start : end + 1],
            headers={"Content-Range": f"bytes {start}-{end}/{len(syn.raw)}"},
        )

    respx.get(settings.s3_url + KEY).mock(side_effect=ranges)
    sb = respx.get(url__startswith=settings.sbident_url).mock(
        return_value=httpx.Response(200, json=sbident)
    )
    respx.get(url__startswith=settings.horizons_url).mock(side_effect=horizons)
    return sb


def _iris_result(fixtures) -> str:  # type: ignore[no-untyped-def]
    text = json.loads((fixtures / "horizons_iris.json").read_text())["geocentric"]
    return text.replace("161.204080867,   2.507409068", "161.300000000,   2.450000000")


BODY = {"ra": 161.3, "dec": 2.45, "size": 0.1, "keys": [KEY]}


async def test_a_failed_horizons_is_an_error_not_an_empty_field(
    api: httpx.AsyncClient, settings: Settings, fixtures
) -> None:
    with respx.mock:
        sb = _jpl_mocks(settings, fixtures, ["7 Iris (A847 PA)"], lambda r: httpx.Response(503))
        first = await api.post("/api/known-objects", json=BODY)
        second = await api.post("/api/known-objects", json=BODY)
    assert first.status_code == 502
    assert first.json()["error"]["service"] == "JPL Horizons"
    # Nothing was cached: the second request asked JPL again.
    assert second.status_code == 502
    assert sb.call_count == 2


async def test_a_partly_failed_horizons_is_shown_but_not_cached(
    api: httpx.AsyncClient, settings: Settings, fixtures
) -> None:
    iris = _iris_result(fixtures)

    def horizons(request: httpx.Request) -> httpx.Response:
        if "6" in request.url.params["COMMAND"]:
            return httpx.Response(503)
        return httpx.Response(200, json={"result": iris})

    with respx.mock:
        sb = _jpl_mocks(settings, fixtures, ["7 Iris (A847 PA)", "6 Hebe (A847 NA)"], horizons)
        first = await api.post("/api/known-objects", json=BODY)
        await api.post("/api/known-objects", json=BODY)
    assert first.status_code == 200, first.text
    body = first.json()
    assert [o["name"] for o in body["objects"]] == ["7 Iris (A847 PA)"]
    assert body["incomplete"]["horizonsFailed"] == ["6 Hebe (A847 NA)"]
    assert "may be incomplete" in body["incomplete"]["message"]
    assert sb.call_count == 2  # not cached, so the next visitor gets a fresh answer
