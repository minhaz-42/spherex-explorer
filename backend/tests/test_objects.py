"""SIMBAD object facts, hips2fits survey images and DSS plates, tested on recorded real answers."""

import asyncio
import base64
import io
import math
import struct
import zlib
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs

import httpx
import numpy as np
import pytest
import respx
from astropy.io import fits
from fastapi import FastAPI
from numpy.typing import NDArray

from spherex_explorer.api import compute
from spherex_explorer.api.cachekeys import (
    field_objects_key,
    object_image_key,
    object_key,
    plate_key,
)
from spherex_explorer.cache import DiskStore
from spherex_explorer.config import Settings
from spherex_explorer.errors import NotFound, UpstreamError
from spherex_explorer.objects import images, plates, simbad
from spherex_explorer.objects.categories import category

M31 = {"ra": 10.684708, "dec": 41.26875}
# Where 7 Iris was caught (see sia_iris_d2.csv); nothing is catalogued within 36″ of it.
IRIS_FIELD = {"ra": 161.29678, "dec": 2.44824}
# Barnard's Star (J2000); the recorded plate is a 2′ POSS-I cutout there.
BARNARD = {"ra": 269.452083, "dec": 4.693364}
JPEG_HEADERS = {"content-type": "image/jpeg"}
FITS_HEADERS = {"content-type": "image/x-fits"}


def decode_png(data: bytes) -> NDArray[np.uint8]:
    """Pixels of an 8-bit greyscale PNG, checking its chunk CRCs and per-row filter bytes."""
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    pos, idat, kinds = 8, b"", []
    while pos < len(data):
        length, kind = struct.unpack(">I4s", data[pos : pos + 8])
        body = data[pos + 8 : pos + 8 + length]
        (crc,) = struct.unpack(">I", data[pos + 8 + length : pos + 12 + length])
        assert crc == zlib.crc32(kind + body)
        if kind == b"IHDR":
            width, height, depth, colour, *_ = struct.unpack(">IIBBBBB", body)
        elif kind == b"IDAT":
            idat += body
        kinds.append(kind)
        pos += 12 + length
    assert kinds[0] == b"IHDR" and kinds[-1] == b"IEND"
    assert (depth, colour) == (8, 0)
    rows = np.frombuffer(zlib.decompress(idat), dtype=np.uint8).reshape(height, width + 1)
    assert not rows[:, 0].any()  # filter type 0 on every row
    return rows[:, 1:]


def png_of(plate: dict[str, Any]) -> NDArray[np.uint8]:
    prefix, encoded = plate["png"].split(",", 1)
    assert prefix == "data:image/png;base64"
    return decode_png(base64.b64decode(encoded))


def tap_query(request: httpx.Request) -> str:
    return parse_qs(request.content.decode())["query"][0]


def simbad_replies(fixtures: Path, cone: str, distances: str | None = None) -> Any:
    """Answer the cone query with one recorded answer and a mesDistance query with another."""

    def reply(request: httpx.Request) -> httpx.Response:
        name = distances if "FROM mesDistance" in tap_query(request) else cone
        assert name is not None, f"unexpected query: {tap_query(request)}"
        return httpx.Response(200, text=(fixtures / name).read_text())

    return reply


def recorded_rows(fixtures: Path, name: str) -> list[dict[str, Any]]:
    return simbad.parse_tap(200, (fixtures / name).read_text())


# --- parsing ---------------------------------------------------------------------------------


def test_m31_answer_is_parsed(fixtures: Path) -> None:
    [row] = recorded_rows(fixtures, "simbad_m31_object.json")
    distances = recorded_rows(fixtures, "simbad_m31_distances.json")
    body = simbad.object_json(row, distances, **M31)
    assert body["id"] == "M  31"
    assert body["name"] == "Andromeda Galaxy"
    assert (body["otype"], body["typeLabel"], body["category"]) == (
        "AGN",
        "Active Galaxy Nucleus",
        "galaxy",
    )
    # Galaxy catalogues first, spacing tidied; the main id and NAME entries are left out.
    assert body["aliases"][:4] == ["NGC 224", "UGC 454", "LEDA 2557", "MCG+07-02-016"]
    assert len(body["aliases"]) == 8
    assert not any(a == "M 31" or a.startswith(("NAME", "[")) for a in body["aliases"])
    # No parallax, so the median of 14 published distances (in pc, kpc and Mpc), in kpc.
    assert body["distance"] == {
        "value": 774.0,
        "unit": "kpc",
        "lightYears": 2530000.0,
        "method": "median of 14 published measurements",
    }
    assert body["size"] == {"majorArcmin": 199.53, "minorArcmin": 70.79}
    assert body["morphology"] == "SA(s)b" and body["spectralType"] is None
    assert body["magnitudes"] == {
        "B": 4.36,
        "V": 3.44,
        "G": None,
        "J": 2.094,
        "H": 1.283,
        "K": 0.984,
    }
    assert body["parallaxMas"] is None and body["properMotion"] is None
    assert body["redshift"] == pytest.approx(-0.001) and body["radialVelocityKms"] == -300
    assert body["references"] == 13822
    assert body["separationArcsec"] < 0.01
    assert body["links"]["simbad"] == "https://simbad.cds.unistra.fr/simbad/sim-id?Ident=M%2031"
    assert body["links"]["ned"] == "https://ned.ipac.caltech.edu/byname?objname=M%2031"
    assert body["credit"] == "SIMBAD, CDS, Strasbourg"


def test_star_with_a_good_parallax(fixtures: Path) -> None:
    [row] = recorded_rows(fixtures, "simbad_36sex_object.json")
    body = simbad.object_json(row, [], 161.2894, 2.48797)
    assert (body["id"], body["name"], body["category"]) == ("*  36 Sex", None, "star")
    assert body["spectralType"] == "K2III" and body["parallaxMas"] == 6.8
    assert body["properMotion"] == {"raMasYr": -47.53, "decMasYr": -22.3}
    assert body["distance"] == {
        "value": 147.0,
        "unit": "pc",
        "lightYears": 480.0,
        "method": "parallax",
    }
    assert body["aliases"][:3] == ["HD 93102", "HIP 52584", "HR 4201"]
    assert body["size"] is None


PUBLISHED = [
    {"dist": 0.78, "unit": "Mpc "},
    {"dist": 779, "unit": "kpc "},
    {"dist": 752, "unit": "kpc"},
]


@pytest.mark.parametrize(
    ("plx", "plx_err", "rows", "expected"),
    [
        # A large, well-measured parallax wins over published distances.
        (10.0, 0.5, PUBLISHED, (100.0, "pc", "parallax")),
        # Too small (≤ 0.5 mas), too uncertain (≥ 20 %) or without an error: published median.
        (0.4, 0.01, PUBLISHED, (779.0, "kpc", "median of 3 published measurements")),
        (2.0, 0.5, PUBLISHED, (779.0, "kpc", "median of 3 published measurements")),
        (5.0, None, PUBLISHED, (779.0, "kpc", "median of 3 published measurements")),
        # Rows without a usable unit or a positive distance are ignored.
        (
            None,
            None,
            [{"dist": 12, "unit": None}, {"dist": -1, "unit": "pc"}, {"dist": 50, "unit": "pc  "}],
            (50.0, "pc", "1 published measurement"),
        ),
        # The unit is chosen after rounding: 999.7 pc reads as 1 kpc; Mpc from 1000 kpc up.
        (None, None, [{"dist": 999.7, "unit": "pc"}], (1.0, "kpc", "1 published measurement")),
        (None, None, [{"dist": 16.5, "unit": "Mpc"}], (16.5, "Mpc", "1 published measurement")),
    ],
)
def test_distance_rule(
    plx: float | None,
    plx_err: float | None,
    rows: list[dict[str, Any]],
    expected: tuple[float, str, str],
) -> None:
    distance = simbad.choose_distance(plx, plx_err, rows)
    assert distance is not None
    assert (distance["value"], distance["unit"], distance["method"]) == expected
    parsecs = distance["value"] * {"pc": 1, "kpc": 1e3, "Mpc": 1e6}[distance["unit"]]
    assert distance["lightYears"] == pytest.approx(parsecs * 3.26156, rel=0.01)


def test_no_parallax_and_no_published_distance_is_null() -> None:
    assert simbad.choose_distance(None, None, []) is None
    assert simbad.choose_distance(0.1, 0.5, []) is None


# NAME identifiers as SIMBAD lists them for these objects.
@pytest.mark.parametrize(
    ("main_id", "kind", "names", "expected"),
    [
        ("M  42", "nebula", ["Great Orion Nebula", "Ori Nebula", "Orion Nebula"], "Orion Nebula"),
        (
            "M  51",
            "galaxy",
            ["Whirlpool", "Question Mark Galaxy", "Whirlpool Galaxy"],
            "Whirlpool Galaxy",
        ),
        (
            "M   1",
            "nebula",
            ["CRAB NEB", "Crab", "Crab Nebula", "Tau A", "Taurus A"],
            "Crab Nebula",
        ),
        (
            "NGC  3372",
            "nebula",
            ["Keyhole", "Car Nebula", "Carina Nebula", "eta Car Nebula", "Keyhole Nebula"],
            "Carina Nebula",
        ),
        (
            "NGC  7000",
            "cluster",
            ["NORTH AMER NEB", "North America", "North America Nebula", "Bermuda Cluster"],
            "North America Nebula",
        ),
        ("M  81", "galaxy", ["M 81*", "Bode's Galaxy"], "Bode's Galaxy"),
        ("* alf UMi", "star", ["Lodestar", "Polaris", "North Star"], "Polaris"),
        ("Cl Melotte   22", "cluster", ["Pleiades", "Seven Sisters"], "Pleiades"),
        ("NAME Sgr A*", "other", ["Sagittarius A*", "Sgr A*", "Sgr A"], "Sgr A*"),
        ("HD  93102", "star", [], None),
    ],
)
def test_common_names(main_id: str, kind: Any, names: list[str], expected: str | None) -> None:
    ids = [f"NAME {name}" for name in names] + ["HD 1"]
    assert simbad.common_name(ids, main_id, kind) == expected


@pytest.mark.parametrize(
    ("otype", "path", "expected"),
    [
        ("AGN", "G > AGN", "galaxy"),
        ("ClG", "ClG", "galaxy"),
        ("LeQ", "grv > gLS > LeI > LeQ", "galaxy"),
        ("PM*", "* > PM*", "star"),
        ("PN", "* > Ev* > PN", "nebula"),
        ("HII", "ISM > HII", "nebula"),
        ("GlC", "Cl* > GlC", "cluster"),
        ("X", "X", "other"),
        ("var", None, "other"),
        ("Zz*", None, "star"),
        (None, None, "other"),
    ],
)
def test_categories_follow_the_simbad_hierarchy(
    otype: str | None, path: str | None, expected: str
) -> None:
    assert category(otype, path) == expected


def test_adql_uses_fixed_point_numbers_and_the_fast_sort() -> None:
    query = simbad.object_query(1e-5, -0.5, 0.01)
    assert "CIRCLE('ICRS', 0.0000100, -0.5000000, 0.0100000)" in query
    assert "b.nbref + 0 AS refs" in query and query.endswith("ORDER BY refs DESC, sep ASC")
    assert simbad.field_query(10, 20, 0.15, 60).startswith("SELECT TOP 60 ")
    assert simbad.distances_query(1575544).endswith("WHERE oidref = 1575544")
    with pytest.raises(ValueError):
        simbad.object_query(math.nan, 0, 0.01)


def test_a_rejected_query_is_an_upstream_error(fixtures: Path) -> None:
    with pytest.raises(UpstreamError) as err:
        simbad.parse_tap(400, (fixtures / "simbad_error.xml").read_text())
    assert 'Was expecting one of: <EOF> "," ";" "ASC" "DESC"' in (err.value.detail or "")
    with pytest.raises(UpstreamError):
        simbad.parse_tap(200, "<html>maintenance</html>")


# --- /api/object and /api/field-objects ------------------------------------------------------


async def test_object_route_for_m31(
    api: httpx.AsyncClient, settings: Settings, fixtures: Path
) -> None:
    replies = simbad_replies(fixtures, "simbad_m31_object.json", "simbad_m31_distances.json")
    with respx.mock:
        route = respx.post(settings.simbad_tap_url).mock(side_effect=replies)
        first = await api.get("/api/object", params=M31)
        again = await api.get("/api/object", params=M31)
    assert first.status_code == 200, first.text
    body = first.json()
    assert (body["id"], body["name"], body["category"]) == ("M  31", "Andromeda Galaxy", "galaxy")
    assert body["distance"]["method"] == "median of 14 published measurements"
    assert again.json() == body
    assert route.call_count == 2  # the object, then its distances; the repeat came from the cache
    sent = parse_qs(route.calls[0].request.content.decode())
    assert (sent["request"], sent["lang"], sent["format"]) == (["doQuery"], ["adql"], ["json"])
    assert "CIRCLE('ICRS', 10.6847080, 41.2687500, 0.0100000)" in sent["query"][0]


async def test_object_route_needs_no_distance_query_for_a_parallax(
    api: httpx.AsyncClient, settings: Settings, fixtures: Path
) -> None:
    with respx.mock:
        route = respx.post(settings.simbad_tap_url).mock(
            side_effect=simbad_replies(fixtures, "simbad_36sex_object.json")
        )
        response = await api.get("/api/object", params={"ra": 161.2894, "dec": 2.48797})
    assert response.status_code == 200, response.text
    assert response.json()["distance"]["method"] == "parallax"
    assert route.call_count == 1


async def test_nothing_within_the_radius_is_an_answer_and_is_cached(
    api: httpx.AsyncClient, settings: Settings, fixtures: Path
) -> None:
    with respx.mock:
        route = respx.post(settings.simbad_tap_url).mock(
            return_value=httpx.Response(200, text=(fixtures / "simbad_empty.json").read_text())
        )
        first = await api.get("/api/object", params=IRIS_FIELD)
        again = await api.get("/api/object", params=IRIS_FIELD)
    assert first.status_code == 200, first.text
    body = first.json()
    assert body["object"] is None
    assert "36″" in body["message"]
    assert body["credit"] == simbad.CREDIT
    # An empty spot is not asked about again while the answer is cached.
    assert again.json() == body
    assert route.call_count == 1


async def test_compute_object_at_still_raises_not_found_for_the_assistant(
    api: httpx.AsyncClient, app: FastAPI, settings: Settings, fixtures: Path
) -> None:
    svc = app.state.services
    with respx.mock:
        route = respx.post(settings.simbad_tap_url).mock(
            return_value=httpx.Response(200, text=(fixtures / "simbad_empty.json").read_text())
        )
        # A miss asks SIMBAD, caches the empty answer and raises; a hit raises from the cache.
        for _ in range(2):
            with pytest.raises(NotFound, match="36″"):
                await compute.object_at(svc, IRIS_FIELD["ra"], IRIS_FIELD["dec"], "live", "test")
    assert route.call_count == 1
    cached = svc.store.peek("object", object_key(IRIS_FIELD["ra"], IRIS_FIELD["dec"]), "live")
    assert cached is not None and compute.no_object(cached)


async def test_field_objects_route(
    api: httpx.AsyncClient, settings: Settings, fixtures: Path
) -> None:
    with respx.mock:
        route = respx.post(settings.simbad_tap_url).mock(
            return_value=httpx.Response(200, text=(fixtures / "simbad_field_iris.json").read_text())
        )
        response = await api.get("/api/field-objects", params=IRIS_FIELD)
    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body) == {"objects", "radiusDeg", "total", "credit"}
    assert (body["radiusDeg"], body["total"], body["credit"]) == (
        0.15,
        25,
        "SIMBAD, CDS, Strasbourg",
    )
    first = body["objects"][0]
    assert set(first) == {
        "id",
        "name",
        "otype",
        "typeLabel",
        "category",
        "ra",
        "dec",
        "separationArcmin",
        "magnitudes",
        "references",
    }
    assert (first["id"], first["typeLabel"], first["category"]) == (
        "*  36 Sex",
        "High Proper Motion Star",
        "star",
    )
    assert first["magnitudes"] == {"V": 6.271, "K": 3.486}
    assert first["separationArcmin"] == pytest.approx(2.42, abs=0.01)
    references = [o["references"] for o in body["objects"]]
    assert references == sorted(references, reverse=True)
    assert all(o["separationArcmin"] <= 9.0 for o in body["objects"])  # 0.15° is 9′
    assert {o["category"] for o in body["objects"]} == {"star", "galaxy"}
    assert route.call_count == 1
    assert tap_query(route.calls[0].request).startswith("SELECT TOP 25 ")


async def test_simbad_failures_are_upstream_errors(
    api: httpx.AsyncClient, settings: Settings, fixtures: Path
) -> None:
    rejection = httpx.Response(400, text=(fixtures / "simbad_error.xml").read_text())
    with respx.mock:
        respx.post(settings.simbad_tap_url).mock(return_value=rejection)
        rejected = await api.get("/api/field-objects", params=IRIS_FIELD)
    assert rejected.status_code == 502
    assert rejected.json()["error"] == {
        "code": "upstream_error",
        "message": "SIMBAD could not run the query.",
        "service": "CDS SIMBAD database",
    }
    with respx.mock:
        respx.post(settings.simbad_tap_url).mock(side_effect=httpx.ReadTimeout("slow"))
        slow = await api.get("/api/object", params=M31)
    assert slow.status_code == 504
    assert slow.json()["error"]["code"] == "upstream_timeout"


# --- /api/object-image -----------------------------------------------------------------------


def test_surveys_are_a_fixed_whitelist() -> None:
    assert {name: survey.hips for name, survey in images.SURVEYS.items()} == {
        "dss": "CDS/P/DSS2/color",
        "2mass": "CDS/P/2MASS/color",
        "wise": "CDS/P/allWISE/color",
    }


def test_image_requests_are_quantised_before_caching() -> None:
    q = images.quantise(10.68470833, 41.26871, 0.123456, "dss", 300)
    assert (q.ra, q.dec, q.fov, q.size) == (10.6847, 41.2687, 0.123, 384)
    assert images.quantise(359.99996, 0, 1, "dss", 64).ra == 0.0
    sizes = [images.quantise(0, 0, 1, "dss", s).size for s in (64, 65, 128, 200, 256, 511, 512)]
    assert sizes == [64, 128, 128, 256, 256, 512, 512]
    assert images.quantise(0, 0, 3.0, "dss", 64).projection == "TAN"
    assert images.quantise(0, 0, 3.5, "dss", 64).projection == "SIN"
    # Nearly identical views share one cache entry; a different one does not.
    key = object_image_key(10.68471, 41.26872, 0.5, "dss", 256)
    assert object_image_key(10.68468, 41.26868, 0.50004, "dss", 250) == key
    assert object_image_key(10.6849, 41.26872, 0.5, "dss", 256) != key
    assert object_image_key(10.68471, 41.26872, 0.5, "wise", 256) != key
    # The SIMBAD keys include every parameter that changes the answer.
    assert object_key(1.0, 2.0) == object_key(1.0, 2.0, 0.01) != object_key(1.0, 2.0, 0.02)
    assert field_objects_key(1.0, 2.0, 0.15, 25) != field_objects_key(1.0, 2.0, 0.15, 26)


async def test_image_route_serves_the_jpeg(
    api: httpx.AsyncClient, settings: Settings, fixtures: Path
) -> None:
    jpeg = (fixtures / "hips2fits_dss_m31_64.jpg").read_bytes()
    with respx.mock:
        route = respx.get(url__startswith=settings.hips2fits_url).mock(
            return_value=httpx.Response(200, content=jpeg, headers=JPEG_HEADERS)
        )
        response = await api.get(
            "/api/object-image", params={**M31, "fov": 0.5, "survey": "dss", "size": 64}
        )
        nearby = {"ra": 10.68468, "dec": 41.26868, "fov": 0.50004, "survey": "dss", "size": 64}
        again = await api.get("/api/object-image", params=nearby)
    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "image/jpeg"
    assert response.content == jpeg
    assert response.headers["cache-control"] == "public, max-age=604800"
    assert response.headers["x-image-credit"] == "DSS2 (STScI/AURA) via CDS hips2fits"
    assert again.content == jpeg
    assert route.call_count == 1  # the snapped repeat came from the cache
    assert dict(route.calls[0].request.url.params) == {
        "hips": "CDS/P/DSS2/color",
        "width": "64",
        "height": "64",
        "fov": "0.5",
        "projection": "TAN",
        "coordsys": "icrs",
        "ra": "10.6847",
        "dec": "41.2687",
        "format": "jpg",
    }


@pytest.mark.parametrize(
    ("survey", "hips", "credit"),
    [
        ("dss", "CDS/P/DSS2/color", "DSS2 (STScI/AURA) via CDS hips2fits"),
        ("2mass", "CDS/P/2MASS/color", "2MASS (UMass/IPAC-Caltech, NASA/NSF) via CDS hips2fits"),
        ("wise", "CDS/P/allWISE/color", "AllWISE (NASA/JPL-Caltech/UCLA) via CDS hips2fits"),
    ],
)
async def test_each_survey_uses_its_hips_and_wide_fields_use_sin(
    api: httpx.AsyncClient, settings: Settings, fixtures: Path, survey: str, hips: str, credit: str
) -> None:
    jpeg = (fixtures / "hips2fits_dss_m31_64.jpg").read_bytes()
    with respx.mock:
        route = respx.get(url__startswith=settings.hips2fits_url).mock(
            return_value=httpx.Response(200, content=jpeg, headers=JPEG_HEADERS)
        )
        response = await api.get(
            "/api/object-image", params={"ra": 83.82, "dec": -5.39, "fov": 4, "survey": survey}
        )
    assert response.status_code == 200, response.text
    assert response.headers["x-image-credit"] == credit
    sent = route.calls[0].request.url.params
    assert (sent["hips"], sent["projection"], sent["width"]) == (hips, "SIN", "256")


async def test_an_upstream_answer_that_is_not_a_jpeg_is_502(
    api: httpx.AsyncClient, settings: Settings
) -> None:
    params = {**M31, "fov": 0.5, "survey": "dss"}
    page = httpx.Response(
        200, text="<html>maintenance</html>", headers={"content-type": "text/html"}
    )
    unknown = httpx.Response(400, json={"title": "Unknown HiPS", "description": "No such HiPS"})
    for upstream_answer in (page, unknown):
        with respx.mock:
            respx.get(url__startswith=settings.hips2fits_url).mock(return_value=upstream_answer)
            response = await api.get("/api/object-image", params=params)
        assert response.status_code == 502
        assert response.json()["error"]["service"] == "CDS hips2fits image service"


# --- /api/plate ------------------------------------------------------------------------------


def test_plate_facts_from_a_recorded_header(fixtures: Path) -> None:
    header, image = plates.read_plate((fixtures / "dss_barnard_poss1_2arcmin.fits").read_bytes())
    assert image.shape == (71, 71)
    # Minutes above 59: a known DSS quirk, so only the date is kept.
    assert header["DATE-OBS"] == "1950-07-09T06:75:00"
    assert plates.plate_facts(header) == {
        "label": "POSS-I",
        "band": "red (E)",
        "epoch": "1950-07-09",
        "plate": "E164",
        "telescope": "Palomar Schmidt",
        "exposureMin": 45.0,
    }


@pytest.mark.parametrize(
    ("cards", "expected"),
    [
        # The POSS-II plate of the same field, as its header reads.
        (
            {
                "SURVEY": "POSSII-F",
                "DATE-OBS": "1991-06-16T07:80:00",
                "TELESCOP": "Oschin Schmidt - D",
                "PLTLABEL": "SF04022 ",
                "EXPOSURE": 85.0,
            },
            ("POSS-II", "red (F)", "1991-06-16", "SF04022", "Oschin Schmidt", 85.0),
        ),
        # A southern second-epoch plate from the UK Schmidt.
        (
            {
                "SURVEY": "AAO-SES",
                "DATE-OBS": "1991-02-11T14:50:00",
                "TELESCOP": "UK Schmidt - Doubl",
                "PLTLABEL": "OR14137",
                "EXPOSURE": 40,
            },
            ("AAO-SES", "red (R)", "1991-02-11", "OR14137", "UK Schmidt", 40.0),
        ),
        # Missing or unreadable keywords give nulls rather than guesses.
        ({"SURVEY": "XYZ", "DATE-OBS": "unknown"}, ("XYZ", "red", None, None, None, None)),
    ],
)
def test_plate_facts_handle_header_variants(
    cards: dict[str, Any], expected: tuple[Any, ...]
) -> None:
    facts = plates.plate_facts(fits.Header(cards))
    keys = ("label", "band", "epoch", "plate", "telescope", "exposureMin")
    assert tuple(facts[k] for k in keys) == expected


def synthetic_plate(east_right: bool, north_down: bool) -> bytes:
    """A plate with one star 20 px east and 30 px north of its centre, stored mirrored and/or
    upside down if asked."""
    scale = 1.7 / 3600
    header = fits.Header()
    header["CTYPE1"], header["CTYPE2"] = "RA---TAN", "DEC--TAN"
    header["CRVAL1"], header["CRVAL2"] = 150.0, 20.0
    header["CRPIX1"] = header["CRPIX2"] = 51.0
    header["CD1_1"] = scale if east_right else -scale
    header["CD2_2"] = -scale if north_down else scale
    header["CD1_2"] = header["CD2_1"] = 0.0
    image = np.full((101, 101), 1000, dtype=np.int16)
    x = 50 + (20 if east_right else -20)
    y = 50 + (-30 if north_down else 30)
    image[y - 1 : y + 2, x - 1 : x + 2] = 20000
    buffer = io.BytesIO()
    fits.PrimaryHDU(image, header).writeto(buffer)
    return buffer.getvalue()


@pytest.mark.parametrize("east_right", [False, True])
@pytest.mark.parametrize("north_down", [False, True])
def test_plates_are_drawn_north_up_east_left(east_right: bool, north_down: bool) -> None:
    request = plates.PlateRequest(150.0, 20.0, 101 * 1.7 / 3600, "poss1", 101)
    pixels = png_of(plates.plate_json(synthetic_plate(east_right, north_down), request))
    assert pixels.shape == (101, 101)
    rows, cols = np.nonzero(pixels == pixels.max())
    # 30 px north of the centre is 30 rows above it; 20 px east is 20 columns to its left.
    assert (rows.mean(), cols.mean()) == pytest.approx((50 - 30, 50 - 20), abs=0.5)


async def test_plate_route(api: httpx.AsyncClient, settings: Settings, fixtures: Path) -> None:
    raw = (fixtures / "dss_barnard_poss1_2arcmin.fits").read_bytes()
    params = {**BARNARD, "fov": 0.05, "survey": "poss1", "size": 128}
    with respx.mock:
        route = respx.get(url__startswith=settings.dss_url).mock(
            return_value=httpx.Response(200, content=raw, headers=FITS_HEADERS)
        )
        response = await api.get("/api/plate", params=params)
        again = await api.get("/api/plate", params=params)
    assert response.status_code == 200, response.text
    body = response.json()
    assert list(body) == [
        "survey",
        "label",
        "band",
        "epoch",
        "plate",
        "telescope",
        "exposureMin",
        "png",
        "credit",
    ]
    assert {k: v for k, v in body.items() if k != "png"} == {
        "survey": "poss1",
        "label": "POSS-I",
        "band": "red (E)",
        "epoch": "1950-07-09",
        "plate": "E164",
        "telescope": "Palomar Schmidt",
        "exposureMin": 45.0,
        "credit": plates.CREDIT,
    }
    pixels = png_of(body)
    assert pixels.shape == (128, 128)
    # The 2′ recorded cutout fills the middle of this 3′ view; outside it the view is black.
    assert pixels[0, 0] == 0 and pixels[40:88, 40:88].std() > 5
    assert again.json() == body and route.call_count == 1
    assert dict(route.calls[0].request.url.params) == {
        "v": "poss1_red",
        "r": "269.45210",
        "d": "4.69340",
        "e": "J2000",
        "h": "3.18",
        "w": "3.18",
        "f": "fits",
        "c": "none",
    }
    assert plate_key(**BARNARD, fov=0.05, survey="poss1", size=100) == plate_key(
        269.45212, 4.69338, 0.05001, "poss1", 128
    )


async def test_a_plate_the_survey_never_took_is_404(
    api: httpx.AsyncClient, settings: Settings, fixtures: Path
) -> None:
    page = (fixtures / "dss_poss1_not_covered.html").read_text()
    with respx.mock:
        respx.get(url__startswith=settings.dss_url).mock(
            return_value=httpx.Response(200, text=page, headers={"content-type": "text/html"})
        )
        response = await api.get(
            "/api/plate", params={"ra": 150.0, "dec": -60.0, "fov": 0.1, "survey": "poss1"}
        )
    assert response.status_code == 404
    error = response.json()["error"]
    assert error["code"] == "not_found" and "try poss2" in error["message"]


async def test_plate_downloads_are_capped_and_have_a_deadline(
    api: httpx.AsyncClient, settings: Settings, fixtures: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    raw = (fixtures / "dss_barnard_poss1_2arcmin.fits").read_bytes()
    params = {**BARNARD, "fov": 0.05, "survey": "poss1"}
    monkeypatch.setattr(plates, "MAX_BYTES", 10_000)

    async def trickle() -> AsyncIterator[bytes]:
        for start in range(0, len(raw), 4096):
            yield raw[start : start + 4096]

    # Refused from the declared length, and while reading an answer that declares none.
    for answer in (httpx.Response(200, content=raw), httpx.Response(200, content=trickle())):
        with respx.mock:
            respx.get(url__startswith=settings.dss_url).mock(return_value=answer)
            too_big = await api.get("/api/plate", params=params)
        assert too_big.status_code == 502
        assert too_big.json()["error"]["message"] == "The plate cutout was too large."

    monkeypatch.setattr(plates, "TIMEOUT_S", 0.05)

    async def stall(request: httpx.Request) -> httpx.Response:
        await asyncio.sleep(1)
        return httpx.Response(200, content=raw)

    with respx.mock:
        respx.get(url__startswith=settings.dss_url).mock(side_effect=stall)
        slow = await api.get("/api/plate", params=params)
    assert slow.status_code == 504
    assert "smaller field of view" in slow.json()["error"]["message"]


# --- validation and snapshot mode ------------------------------------------------------------


@pytest.mark.parametrize(
    ("path", "params"),
    [
        ("/api/object", {"ra": 10, "dec": 41, "radius": 0.06}),
        ("/api/object", {"ra": 10, "dec": 41, "radius": 0}),
        ("/api/object", {"ra": 360, "dec": 41}),
        ("/api/field-objects", {"ra": 10, "dec": 41, "radius": 0.6}),
        ("/api/field-objects", {"ra": 10, "dec": 41, "limit": 61}),
        ("/api/object-image", {"ra": 10, "dec": 41, "fov": 0.01, "survey": "dss"}),
        ("/api/object-image", {"ra": 10, "dec": 41, "fov": 6, "survey": "dss"}),
        ("/api/object-image", {"ra": 10, "dec": 41, "fov": 1, "survey": "sdss"}),
        ("/api/object-image", {"ra": 10, "dec": 41, "fov": 1}),
        ("/api/object-image", {"ra": 10, "dec": 41, "fov": 1, "survey": "dss", "size": 32}),
        ("/api/object-image", {"ra": 10, "dec": 41, "fov": 1, "survey": "dss", "size": 1024}),
        ("/api/plate", {"ra": 10, "dec": 41, "fov": 0.04, "survey": "poss1"}),
        ("/api/plate", {"ra": 10, "dec": 41, "fov": 1.1, "survey": "poss1"}),
        ("/api/plate", {"ra": 10, "dec": 41, "fov": 0.5, "survey": "poss3"}),
        ("/api/plate", {"ra": 10, "dec": 41, "fov": 0.5}),
        ("/api/plate", {"ra": 10, "dec": 41, "fov": 0.5, "survey": "poss2", "size": 127}),
        ("/api/plate", {"ra": 10, "dec": 41, "fov": 0.5, "survey": "poss2", "size": 513}),
    ],
)
async def test_bad_input_is_refused_before_any_upstream_call(
    api: httpx.AsyncClient, path: str, params: dict[str, Any]
) -> None:
    with respx.mock(assert_all_called=False) as mock:
        response = await api.get(path, params=params)
        assert not mock.calls
    # The app answers every validation failure as 400 invalid_query (see main.py).
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_query"


async def test_snapshot_mode_never_calls_upstream(
    api: httpx.AsyncClient, settings: Settings
) -> None:
    recorded = {"id": "M  31", "demo": True}
    DiskStore(settings.snapshot_dir).put("object", object_key(M31["ra"], M31["dec"]), recorded)
    with respx.mock(assert_all_called=False) as mock:
        hit = await api.get("/api/object", params={**M31, "source": "snapshot"})
        misses = [
            await api.get("/api/object", params={"ra": 1.5, "dec": 2.5, "source": "snapshot"}),
            await api.get("/api/field-objects", params={**IRIS_FIELD, "source": "snapshot"}),
            await api.get(
                "/api/object-image",
                params={**M31, "fov": 0.5, "survey": "dss", "source": "snapshot"},
            ),
            await api.get(
                "/api/plate",
                params={**BARNARD, "fov": 0.1, "survey": "poss1", "source": "snapshot"},
            ),
        ]
        assert not mock.calls
    assert hit.status_code == 200 and hit.json() == recorded
    assert [m.status_code for m in misses] == [404, 404, 404, 404]
    assert {m.json()["error"]["code"] for m in misses} == {"not_in_snapshot"}
