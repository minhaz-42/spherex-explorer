import json
from collections.abc import AsyncIterator
from pathlib import Path

import httpx
import pytest
import respx

from spherex_explorer.api.cachekeys import (
    candidates_key,
    cutout_key,
    known_key,
    object_key,
    observations_key,
)
from spherex_explorer.assistant import chat, evidence, grounding, knowledge, live
from spherex_explorer.assistant.chat import ChatMessage, ChatRequest
from spherex_explorer.assistant.evidence import ViewContext, ViewTarget
from spherex_explorer.assistant.local_model import Health, ModelUnavailable, ThinkStripper
from spherex_explorer.assistant.prompts import ANSWER_REMINDER
from spherex_explorer.cache import Store
from spherex_explorer.config import Settings
from spherex_explorer.main import create_app
from spherex_explorer.objects import simbad
from spherex_explorer.ratelimit import RateLimiter
from spherex_explorer.science.grid import make_grid
from spherex_explorer.services import Services

RA, DEC, FOV = 161.29678, 2.44824, 0.3
KEY_B = (
    "qr2/level2/2025W49_1A/l2b-v20-2025-339/2/level2_2025W49_1A_0423_1D2_spx_l2b-v20-2025-339.fits"
)
KEY_A = (
    "qr2/level2/2025W49_1A/l2b-v20-2025-339/2/level2_2025W49_1A_0332_1D2_spx_l2b-v20-2025-339.fits"
)


def payload(obs_id: str, iso: str, mjd: float, wl: float, bw: float, flux: float | None) -> dict:
    return {
        "key": "k",
        "obsId": obs_id,
        "detector": 2,
        "release": "qr2",
        "time": {"isoMid": iso, "mjdMid": mjd},
        "wavelength": {"atTargetUm": wl, "bandwidthUm": bw},
        "target": {"pixel": [1, 1], "inFrame": True, "flags": ["SOURCE"]},
        "mask": {"maskedFlags": ["TRANSIENT", "BLOOM"]},
        "background": {"levelMJySr": 0.4},
        "photometry": {
            "fluxMicroJy": flux,
            "errorMicroJy": 760.0 if flux else None,
            "snr": 252.0 if flux else None,
            "reasons": [],
        },
    }


# --- knowledge ---------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("question", "entry"),
    [
        ("What is a linear variable filter?", "lvf"),
        ("Why can't I subtract these two frames?", "difference"),
        ("Could SPHEREx find Planet Nine?", "planet-x"),
        ("what does MJy/sr mean", "units"),
        ("how did you measure the brightness", "photometry"),
        ("which asteroids does JPL know here", "known"),
    ],
)
def test_knowledge_finds_the_right_note(question: str, entry: str) -> None:
    found = knowledge.search(question)
    assert found and found[0].id == entry


def test_small_talk_finds_no_note() -> None:
    assert knowledge.search("hello there") == []


# --- think tags ----------------------------------------------------------------------------------


def test_think_blocks_are_stripped_even_across_chunks() -> None:
    s = ThinkStripper()
    chunks = ["Hello <th", "ink>secret plan</thi", "nk>world", " and <think>more</think>!"]
    out = "".join(s.feed(c) for c in chunks) + s.flush()
    assert out == "Hello world and !"


def test_text_that_only_looks_like_a_tag_survives() -> None:
    s = ThinkStripper()
    out = s.feed("a < b and <thin") + s.feed("king") + s.flush()
    assert out == "a < b and <thinking"


# --- grounding -----------------------------------------------------------------------------------


def test_numbers_are_checked_with_rounding_and_units() -> None:
    ev = "[E1] brightness 191,207 µJy at 1.50813 µm; 9.7 h apart; 1475 sources [E2]"
    g = grounding.check(
        "Iris measured 191 mJy [E1] at 1.51 µm, 9.7 hours apart, from 1,475 sources.", ev
    )
    assert g.unverified == []
    assert g.checked == 4


def test_invented_numbers_are_reported() -> None:
    g = grounding.check(
        "It is 3.2 au away and moves 45″ per hour, in 2 of 4 frames.", "[E1] 40″ per hour"
    )
    assert g.unverified == ["3.2", "45"]


def test_month_and_year_are_checked_as_a_pair() -> None:
    ev = "[E2] 243 frames between 25 Apr 2025 and 26 May 2026."
    g = grounding.check("Seen from April to May 2025, and again in May 2026.", ev)
    assert g.unverified == ["May 2025"]
    assert grounding.check("Seen in April 2025 [E2].", ev).unverified == []


def test_citations_of_missing_sources_are_reported() -> None:
    g = grounding.check(
        "Iris moved [E1, E3]. The star stayed put [E8]. See [C1].", "", tags={"E1", "E3"}
    )
    assert g.unknown_tags == ["E8"]  # [C1] names a search candidate, not a source


def test_tags_and_detector_names_are_not_numbers() -> None:
    assert grounding.numbers_in("See [E3] and D2 in QR3, observation 2025W49_1A") == []


# --- evidence ------------------------------------------------------------------------------------


@pytest.fixture
def svc(tmp_path: Path) -> Services:
    settings = Settings(
        cache_dir=tmp_path / "c",
        snapshot_dir=tmp_path / "s",
        cases_file=tmp_path / "cases.json",
        assistant_provider="off",
    )
    (tmp_path / "cases.json").write_text(
        json.dumps(
            {
                "cases": [
                    {
                        "id": "iris",
                        "kind": "moving",
                        "title": "Asteroid (7) Iris crosses a field in Sextans",
                        "summary": "A point of light moves.",
                        "evidence": ["JPL predicts 7 Iris in 14 of 19 frames."],
                        "target": {"ra": RA, "dec": DEC, "name": "Iris"},
                        "viewer": {
                            "seq": "pass",
                            "det": 2,
                            "f": "x",
                            "fa": "y",
                            "cmp": "blink",
                            "fov": FOV,
                        },
                    }
                ]
            }
        )
    )
    return Services(
        settings=settings,
        client=httpx.AsyncClient(),
        store=Store(settings.cache_dir, settings.snapshot_dir),
        limiter=RateLimiter(1000),
    )


FIXTURES = Path(__file__).parent / "fixtures"


def simbad_object(name: str, ra: float, dec: float) -> dict:
    rows = simbad.parse_tap(200, (FIXTURES / name).read_text())
    return simbad.object_json(rows[0], [], ra, dec)


def seed_view(svc: Services) -> ViewContext:
    grid = make_grid(RA, DEC, FOV)
    svc.store.put(
        "object",
        object_key(RA, DEC, simbad.DEFAULT_RADIUS_DEG),
        simbad_object("simbad_36sex_object.json", RA, DEC),
        60,
    )
    svc.store.put(
        "cutout",
        cutout_key(KEY_B, grid),
        payload(
            "2025W49_1A_0423_1", "2025-12-02T21:49:19.724", 61011.909, 1.50813, 0.03706, 191206.6
        ),
        60,
    )
    svc.store.put(
        "cutout",
        cutout_key(KEY_A, grid),
        payload("2025W49_1A_0332_1", "2025-12-02T12:06:59.475", 61011.505, 1.12939, 0.02689, 156.9),
        60,
    )
    keys = [KEY_A, KEY_B]
    iris = {
        "name": "7 Iris (A847 PA)",
        "vmag": 10.2,
        "rateArcsecPerHour": 40.0,
        "positions": [
            {"key": KEY_A, "ra": 161.2041, "dec": 2.5074, "inField": True},
            {"key": KEY_B, "ra": RA, "dec": DEC, "inField": True},
        ],
    }
    svc.store.put(
        "known",
        known_key(RA, DEC, FOV, keys, 20.0),
        {"objects": [iris], "searched": {"vmagLimit": 20.0}},
        60,
    )
    svc.store.put(
        "candidates",
        candidates_key(RA, DEC, grid.size_px, keys),
        {
            "stats": {"detections": 1405, "transient": 99, "sightings": 10},
            "candidates": [
                {
                    "id": "C1",
                    "strength": "candidate",
                    "rateArcsecPerHour": 39.3,
                    "sightings": [
                        {"ra": 161.2041, "dec": 2.5074, "keys": [KEY_A]},
                        {"ra": RA, "dec": DEC, "keys": [KEY_B]},
                    ],
                }
            ],
        },
        60,
    )
    return ViewContext(
        page="explore",
        target=ViewTarget(ra=RA, dec=DEC, name="Iris near 36 Sextantis"),
        frameKey=KEY_B,
        referenceKey=KEY_A,
        compare="blink",
        fov=FOV,
        sequenceMode="pass",
        sequenceKeys=keys,
        frameIndex=1,
        frameCount=2,
    )


async def test_evidence_describes_the_view_from_the_servers_own_data(svc: Services) -> None:
    view = seed_view(svc)
    ev = await evidence.build(svc, "What am I looking at?", view, "live")
    text = ev.render()
    assert "[E1] Target on screen" in text and "Sextans" in text
    assert "wavelength at the target 1.508 µm" in text
    assert "191 mJy" in text
    assert "more than half a spectral channel" in text and "not valid" in text
    assert "7 Iris (A847 PA) (V 10.2)" in text and "including the frame on screen" in text
    assert "matches JPL's prediction for 7 Iris (A847 PA)" in text
    # Why the brightness at the target jumps: Iris is inside the aperture in B only.
    assert (
        "is predicted 0.0″ from the target in frame B and 6.6′ from the target in frame A" in text
    )
    comparison = next(i for i in ev.items if i.title == "Comparison of A and B").text
    assert comparison.startswith(
        "9.7 h apart; the brightness measured at the target includes the light of "
        "7 Iris (A847 PA) in frame B but not in frame A"
    )
    # The colour caveat would read as the reason, so it is left out when motion explains it.
    assert "colours" not in comparison
    assert ev.notes == []


async def test_without_jpl_the_colour_caveat_stays(svc: Services) -> None:
    view = seed_view(svc)
    ev = await evidence.build(
        svc, "What changed?", view.model_copy(update={"sequenceKeys": []}), "live"
    )
    comparison = next(i for i in ev.items if i.title == "Comparison of A and B").text
    assert "may be the sources' colours rather than changes in time" in comparison


async def test_frames_not_yet_loaded_are_noted_not_invented(svc: Services) -> None:
    view = ViewContext(
        page="explore", target=ViewTarget(ra=RA, dec=DEC), frameKey=KEY_B, fov=FOV, compare="single"
    )
    ev = await evidence.build(svc, "What am I looking at?", view, "live")
    assert "Frame B has not loaded yet." in ev.notes
    assert "wavelength at the target" not in ev.render()


async def test_bad_keys_in_the_view_are_ignored(svc: Services) -> None:
    view = ViewContext(
        target=ViewTarget(ra=RA, dec=DEC),
        frameKey="../../etc/passwd",
        fov=FOV,
        sequenceKeys=["nope"],
    )
    ev = await evidence.build(svc, "hi", view, "live")
    assert all(i.kind == "view" for i in ev.items)


async def test_coordinates_in_a_question_become_a_link(svc: Services) -> None:
    ev = await evidence.build(svc, "Take me to 10.6847 41.2690 please", None, "live")
    assert ev.actions[0].href == "/explore?ra=10.684700&dec=41.269000"
    assert "Andromeda" in ev.render()


async def test_moving_questions_offer_discover_cases(svc: Services) -> None:
    ev = await evidence.build(svc, "Show me something that moved", None, "snapshot")
    assert [i.tag for i in ev.items if i.kind == "case"] == ["E1"]
    assert ev.actions and ev.actions[0].href.startswith("/explore?ra=161.29678")
    assert "source=snapshot" in ev.actions[0].href
    assert not [i for i in ev.items if i.kind == "lookup"]  # "something that moved" is not a name


@respx.mock
async def test_named_objects_are_looked_up_live(svc: Services, fixtures: Path) -> None:
    respx.get(url__startswith=svc.settings.sesame_url).mock(
        return_value=httpx.Response(200, text=(fixtures / "sesame_m31.xml").read_text())
    )

    def tap(request: httpx.Request) -> httpx.Response:
        body = request.content.decode()
        name = "simbad_m31_distances.json" if "mesDistance" in body else "simbad_m31_object.json"
        return httpx.Response(200, text=(fixtures / name).read_text())

    respx.post(url__startswith=svc.settings.simbad_tap_url).mock(side_effect=tap)
    respx.get(url__startswith=svc.settings.sia_url).mock(
        return_value=httpx.Response(200, text=(fixtures / "sia_m31.csv").read_text())
    )
    question = "Tell me about the Andromeda Galaxy in infrared"
    updates = [u async for u in live.gather(svc, question, None, "live", "test")]
    assert [u.kind for u in updates] == ["progress"] * 3
    assert updates[0].message == "Looking up “Andromeda Galaxy” with CDS Sesame…"
    ev = await evidence.build(svc, question, None, "live")
    text = ev.render()
    assert "Catalogue facts — " in text and "galaxy" in text
    assert "million light-years" in text
    assert "SPHEREx coverage of" in text and "frames in" in text
    assert ev.actions[0].href == "/explore?q=Andromeda+Galaxy"
    # Asked again, everything comes from the cache.
    assert [u async for u in live.gather(svc, question, None, "live", "test")] == []


@pytest.mark.parametrize(
    ("question", "name"),
    [
        ("Show me M31", "M31"),
        ("Tell me about the Orion Nebula in infrared", "Orion Nebula"),
        ("What is M42?", "M42"),
        ("How far away is Betelgeuse?", "Betelgeuse"),
        ("What is SPHEREx?", None),
        ("What is a linear variable filter?", None),
        ("What is the PSF?", None),
        ("Could SPHEREx find Planet Nine?", None),
        ("What am I looking at?", None),
    ],
)
def test_names_in_questions(question: str, name: str | None) -> None:
    assert evidence.named_object(question) == name


async def test_a_motion_question_runs_jpl_and_the_search_for_the_pass(
    svc: Services, monkeypatch: pytest.MonkeyPatch
) -> None:
    # A pass whose frames and image list are known, with no JPL check or search yet.
    view = ViewContext(
        page="explore",
        target=ViewTarget(ra=RA, dec=DEC, name="Iris"),
        frameKey=KEY_B,
        referenceKey=KEY_A,
        compare="blink",
        fov=FOV,
        sequenceMode="pass",
        sequenceKeys=[KEY_A, KEY_B],
        frameIndex=1,
        frameCount=2,
    )
    grid = make_grid(RA, DEC, FOV)
    svc.store.put(
        "cutout",
        cutout_key(KEY_B, grid),
        payload("0423_1", "2025-12-02T21:49:19", 61011.909, 1.508, 0.037, 1.0),
        60,
    )
    svc.store.put(
        "cutout",
        cutout_key(KEY_A, grid),
        payload("0332_1", "2025-12-02T12:06:59", 61011.505, 1.129, 0.027, 1.0),
        60,
    )
    svc.store.put(
        "object",
        object_key(RA, DEC, simbad.DEFAULT_RADIUS_DEG),
        simbad_object("simbad_36sex_object.json", RA, DEC),
        60,
    )
    frames = [
        {"key": KEY_A, "mjdMid": 61011.505, "pointing": "0332"},
        {"key": KEY_B, "mjdMid": 61011.909, "pointing": "0423"},
    ]
    svc.store.put(
        "observations",
        observations_key(RA, DEC, svc.settings.wide_collections, None),
        {"frames": frames, "summary": {"frames": 2, "passes": 1, "first": None, "last": None}},
        60,
    )
    calls: list[str] = []

    async def fake_known(svc_, ra, dec, size, keys, vmag, source, client):  # type: ignore[no-untyped-def]
        calls.append("known")
        assert (size, keys, vmag) == (FOV, sorted([KEY_A, KEY_B]), 20.0)
        return {}

    async def fake_candidates(svc_, ra, dec, size, keys, source, client):  # type: ignore[no-untyped-def]
        calls.append("candidates")
        return {}

    monkeypatch.setattr(live.compute, "known", fake_known)
    monkeypatch.setattr(live.compute, "candidates", fake_candidates)
    updates = [u async for u in live.gather(svc, "Did anything move here?", view, "live", "t")]
    assert calls == ["known", "candidates"]
    assert updates[0].message.startswith("Asking JPL which catalogued asteroids and comets")
    assert updates[1].message == "Running the moving-source search over the 2 frames of this pass…"
    # A question that is not about motion leaves JPL alone.
    calls.clear()
    assert [
        u async for u in live.gather(svc, "What is the brightness here?", view, "live", "t")
    ] == []
    assert calls == []


async def test_nothing_is_fetched_in_the_demo_snapshot(svc: Services) -> None:
    view = ViewContext(target=ViewTarget(ra=RA, dec=DEC), frameKey=KEY_B, fov=FOV, compare="single")
    assert [u async for u in live.gather(svc, "Tell me about M31", view, "snapshot", "t")] == []


async def test_questions_about_live_data_say_where_the_data_came_from(svc: Services) -> None:
    view = seed_view(svc)
    live_ev = await evidence.build(svc, "Is this data live?", view, "live")
    assert (
        "Data mode: live: the frames, JPL's predictions and the catalogue facts" in live_ev.render()
    )
    demo = await evidence.build(svc, "Is this data live?", view, "snapshot")
    assert "Data mode: this view uses the demo snapshot" in demo.render()
    assert knowledge.search("Is this data live?")[0].id == "live"
    other = await evidence.build(svc, "What am I looking at?", view, "live")
    assert "Data mode" not in other.render()


async def test_a_cached_nothing_catalogued_is_no_evidence_and_no_new_lookup(svc: Services) -> None:
    view = ViewContext(target=ViewTarget(ra=RA, dec=DEC), fov=FOV)
    svc.store.put(
        "object",
        object_key(RA, DEC, simbad.DEFAULT_RADIUS_DEG),
        {"object": None, "message": "SIMBAD lists no object within 36″ of this position."},
        60,
    )
    ev = await evidence.build(svc, "What am I looking at?", view, "live")
    assert not [i for i in ev.items if i.title == "Catalogued at the target"]
    assert [u async for u in live.gather(svc, "What am I looking at?", view, "live", "t")] == []


async def test_an_incomplete_jpl_answer_says_so(svc: Services) -> None:
    view = seed_view(svc)
    keys = sorted([KEY_A, KEY_B])
    message = (
        "JPL Horizons did not answer for 1 of 3 catalogued bodies near this field, "
        "so this list may be incomplete. Try again in a moment."
    )
    svc.store.put(
        "known",
        known_key(RA, DEC, FOV, keys, 20.0),
        {
            "objects": [],
            "searched": {"vmagLimit": 20.0},
            "incomplete": {"horizonsFailed": ["x"], "message": message},
        },
        60,
    )
    ev = await evidence.build(svc, "Did anything move here?", view, "live")
    jpl = next(i for i in ev.items if i.title == "JPL known objects in this field").text
    assert "may be incomplete" in jpl and "whether the others did is not known" in jpl
    assert "JPL knows no asteroid" not in jpl


async def test_the_target_s_catalogue_entry_is_evidence(svc: Services) -> None:
    view = seed_view(svc)
    ev = await evidence.build(svc, "What am I looking at?", view, "live")
    item = next(i for i in ev.items if i.title == "Catalogued at the target")
    assert "36 Sex" in item.text or "HD" in item.text


# --- the chat route ------------------------------------------------------------------------------


def events(body: str) -> list[tuple[str, dict]]:
    out = []
    for block in body.strip().split("\n\n"):
        lines = block.splitlines()
        out.append((lines[0].removeprefix("event: "), json.loads(lines[1].removeprefix("data: "))))
    return out


async def test_built_in_answers_without_a_model(api: httpx.AsyncClient) -> None:
    r = await api.post(
        "/api/assistant/chat",
        json={"messages": [{"role": "user", "content": "What is a linear variable filter?"}]},
    )
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/event-stream")
    ev = events(r.text)
    assert [e for e, _ in ev] == ["meta", "delta", "done"]
    assert ev[0][1]["mode"] == "built-in"
    assert "filter" in ev[1][1]["text"]
    assert ev[2][1]["grounding"]["unverified"] == []


async def test_status_without_a_model(api: httpx.AsyncClient) -> None:
    body = (await api.get("/api/assistant/status")).json()
    assert body["mode"] == "built-in" and body["provider"] == "off"


def ollama_settings(settings: Settings) -> Settings:
    return settings.model_copy(
        update={"assistant_provider": "ollama", "assistant_url": "http://127.0.0.1:11999"}
    )


async def chat_with(settings: Settings, question: str) -> list[tuple[str, dict]]:
    from asgi_lifespan import LifespanManager

    app = create_app(settings)
    async with LifespanManager(app):
        client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t")
        r = await client.post(
            "/api/assistant/chat", json={"messages": [{"role": "user", "content": question}]}
        )
        await client.aclose()
    assert r.status_code == 200, r.text
    return events(r.text)


@respx.mock
async def test_answers_stream_from_ollama(settings: Settings) -> None:
    s = ollama_settings(settings)
    respx.get(f"{s.assistant_url}/api/tags").mock(
        return_value=httpx.Response(200, json={"models": [{"name": s.assistant_model}]})
    )
    lines = [
        {"message": {"content": "<think>hidden</think>A linear variable filter "}, "done": False},
        {"message": {"content": "changes wavelength across the detector [K1]."}, "done": False},
        {"message": {"content": ""}, "done": True},
    ]
    chat_route = respx.post(f"{s.assistant_url}/api/chat").mock(
        return_value=httpx.Response(200, content="\n".join(json.dumps(x) for x in lines).encode())
    )
    ev = await chat_with(s, "What is a linear variable filter?")
    names = [e for e, _ in ev]
    assert names[0] == "meta" and names[-1] == "done"
    assert ev[0][1]["mode"] == "local-model"
    text = "".join(d["text"] for e, d in ev if e == "delta")
    assert text == "A linear variable filter changes wavelength across the detector [K1]."
    sent = json.loads(chat_route.calls[0].request.content)
    assert sent["think"] is False and sent["stream"] is True
    assert (
        sent["messages"][0]["role"] == "system"
        and "Never claim a discovery" in sent["messages"][0]["content"]
    )
    assert "Evidence for this question" in sent["messages"][-1]["content"]


@respx.mock
async def test_a_stopped_model_falls_back_to_built_in(settings: Settings) -> None:
    s = ollama_settings(settings)
    respx.get(f"{s.assistant_url}/api/tags").mock(side_effect=httpx.ConnectError("refused"))
    ev = await chat_with(s, "What is a linear variable filter?")
    assert [e for e, _ in ev] == ["meta", "notice", "delta", "done"]
    assert ev[0][1]["mode"] == "built-in"
    assert "not answering" in ev[1][1]["message"]


@respx.mock
async def test_a_missing_model_says_how_to_install_it(settings: Settings) -> None:
    s = ollama_settings(settings)
    respx.get(f"{s.assistant_url}/api/tags").mock(
        return_value=httpx.Response(200, json={"models": []})
    )
    ev = await chat_with(s, "hello")
    assert "ollama pull" in ev[1][1]["message"]


@respx.mock
async def test_openai_compatible_servers_stream_too(settings: Settings) -> None:
    s = settings.model_copy(
        update={
            "assistant_provider": "openai",
            "assistant_url": "http://127.0.0.1:12345",
            "assistant_model": "local",
        }
    )
    respx.get(f"{s.assistant_url}/v1/models").mock(
        return_value=httpx.Response(200, json={"data": [{"id": "local"}]})
    )
    sse_body = (
        'data: {"choices":[{"delta":{"content":"Hello "}}]}\n\n'
        'data: {"choices":[{"delta":{"content":"sky."}}]}\n\n'
        "data: [DONE]\n\n"
    )
    respx.post(f"{s.assistant_url}/v1/chat/completions").mock(
        return_value=httpx.Response(200, text=sse_body)
    )
    ev = await chat_with(s, "hi")
    assert "".join(d["text"] for e, d in ev if e == "delta") == "Hello sky."


async def test_chat_requests_are_validated(api: httpx.AsyncClient) -> None:
    last_not_user = await api.post(
        "/api/assistant/chat",
        json={
            "messages": [{"role": "user", "content": "a"}, {"role": "assistant", "content": "b"}]
        },
    )
    assert last_not_user.status_code == 400
    too_long = await api.post(
        "/api/assistant/chat", json={"messages": [{"role": "user", "content": "x" * 2001}]}
    )
    assert too_long.status_code == 400
    empty = await api.post("/api/assistant/chat", json={"messages": []})
    assert empty.status_code == 400


# --- one turn, with a stand-in model --------------------------------------------------------------


class FakeModel:
    name = "fake-model"

    def __init__(self, pieces: list[str], fail_at: int | None = None) -> None:
        self.pieces = pieces
        self.fail_at = fail_at
        self.prompts: list[list[dict[str, str]]] = []

    async def health(self) -> Health:
        return Health(True, True, "ready")

    async def stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        self.prompts.append(messages)
        for i, piece in enumerate(self.pieces):
            if i == self.fail_at:
                raise ModelUnavailable("The local model took too long to answer.")
            yield piece


async def turn(svc: Services, req: ChatRequest) -> list[tuple[str, dict]]:
    return events("".join([chunk async for chunk in chat.run(svc, req, "live")]))


def ask(question: str, view: ViewContext | None = None) -> ChatRequest:
    return ChatRequest(messages=[ChatMessage(role="user", content=question)], view=view)


async def test_invented_numbers_are_flagged_in_the_done_event(svc: Services) -> None:
    view = seed_view(svc)
    svc.assistant = FakeModel(["Iris is 191 mJy here [E2] ", "and 3.2 au from the Sun."])
    ev = await turn(svc, ask("What am I looking at?", view))
    assert [e for e, _ in ev] == ["meta", "delta", "delta", "done"]
    assert ev[-1][1] == {
        "grounding": {"checked": 2, "unverified": ["3.2"], "unknownTags": []},
        "mode": "local-model",
    }


async def test_a_model_that_stops_part_way_ends_with_an_error(svc: Services) -> None:
    svc.assistant = FakeModel(["A linear ", "variable filter"], fail_at=1)
    ev = await turn(svc, ask("What is a linear variable filter?"))
    assert [e for e, _ in ev] == ["meta", "delta", "error"]
    assert svc.assistant_health is None  # checked again before the next question


async def test_a_model_that_fails_at_once_is_replaced_by_the_built_in_answer(svc: Services) -> None:
    svc.assistant = FakeModel(["never sent"], fail_at=0)
    ev = await turn(svc, ask("What is a linear variable filter?"))
    assert [e for e, _ in ev] == ["meta", "notice", "delta", "done"]
    assert ev[-1][1]["mode"] == "built-in"


async def test_a_busy_model_asks_the_visitor_to_wait(
    svc: Services, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(chat, "BUSY_WAIT_S", 0.01)
    svc.assistant = FakeModel(["hi"])
    await svc.assistant_slot.acquire()
    ev = await turn(svc, ask("hello"))
    assert [e for e, _ in ev] == ["meta", "error"]
    assert "busy" in ev[-1][1]["message"]


async def test_the_prompt_keeps_recent_history_short(svc: Services) -> None:
    model = FakeModel(["ok"])
    svc.assistant = model
    history = [
        ChatMessage(role="user" if i % 2 == 0 else "assistant", content=f"turn {i} " + "x" * 1500)
        for i in range(10)
    ]
    req = ChatRequest(messages=[*history, ChatMessage(role="user", content="What is SPHEREx?")])
    await turn(svc, req)
    sent = model.prompts[0]
    assert sent[0]["role"] == "system"
    assert [m["content"][:7] for m in sent[1:-1]] == [f"turn {i} " for i in range(4, 10)]
    assert all(len(m["content"]) <= chat.HISTORY_CHARS for m in sent[1:-1])
    assert "Question: What is SPHEREx?" in sent[-1]["content"]
    assert sent[-1]["content"].endswith(ANSWER_REMINDER)
    assert "[K1] What SPHEREx is" in sent[-1]["content"]


async def test_questions_are_rate_limited(settings: Settings) -> None:
    from asgi_lifespan import LifespanManager

    app = create_app(settings.model_copy(update={"rate_limit_per_minute": 12}))
    body = {"messages": [{"role": "user", "content": "hello"}]}
    async with LifespanManager(app):
        client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t")
        codes = [
            (await client.post("/api/assistant/chat", json=body)).status_code for _ in range(3)
        ]
        await client.aclose()
    assert codes == [200, 200, 429]


@respx.mock
async def test_status_reports_a_ready_local_model(settings: Settings) -> None:
    from asgi_lifespan import LifespanManager

    s = ollama_settings(settings)
    respx.get(f"{s.assistant_url}/api/tags").mock(
        return_value=httpx.Response(200, json={"models": [{"name": s.assistant_model}]})
    )
    app = create_app(s)
    async with LifespanManager(app):
        client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t")
        body = (await client.get("/api/assistant/status")).json()
        await client.aclose()
    assert body == {
        "mode": "local-model",
        "provider": "ollama",
        "model": s.assistant_model,
        "local": True,
        "detail": "ready",
    }


async def test_built_in_answers_about_the_view_start_from_the_view(svc: Services) -> None:
    view = seed_view(svc)
    ev = await turn(svc, ask("Did anything move here?", view))
    text = "".join(d["text"] for e, d in ev if e == "delta")
    assert text.startswith("Target on screen")
    # JPL and the search come before the frame details for a question about motion.
    assert text.index("JPL known objects") < text.index("Frame on screen")
    assert "matches JPL's prediction for 7 Iris" in text
    assert "Discover cases on the same theme: Asteroid (7) Iris" in text
