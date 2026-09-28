import httpx
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

SESAME_XML = "<Sesame><Target><Resolver><oname>M  31</oname><jradeg>10.6847083</jradeg><jdedeg>41.2687500</jdedeg></Resolver></Target></Sesame>"
CSV = "obs_id,t_min,em_min,em_max,energy_bandpassname,access_url,cloud_access\nA,60800.5,1.1e-6,1.62e-6,SPHEREx-D2,u,\n"


def make_client(handler, tmp_path):
    settings = Settings(frontend_dist=tmp_path)  # no built frontend
    return TestClient(create_app(settings, transport=httpx.MockTransport(handler)))


def test_health(tmp_path):
    with make_client(lambda r: httpx.Response(500), tmp_path) as client:
        assert client.get("/api/health").json()["status"] == "ok"
        assert len(client.get("/api/bands").json()) == 6


def test_resolve_coordinates_needs_no_network(tmp_path):
    def handler(request):
        raise AssertionError("should not call upstream")

    with make_client(handler, tmp_path) as client:
        body = client.get("/api/resolve", params={"q": "10.6847 +41.2690"}).json()
        assert body["frame"] == "icrs" and abs(body["ra"] - 10.6847) < 1e-6


def test_resolve_name_and_cache(tmp_path):
    calls = []

    def handler(request):
        calls.append(request.url)
        return httpx.Response(200, text=SESAME_XML)

    with make_client(handler, tmp_path) as client:
        for _ in range(2):
            body = client.get("/api/resolve", params={"q": "M31"}).json()
        assert body["name"] == "M  31" and body["frame"] == "name"
        assert len(calls) == 1  # second answer came from the cache


def test_resolve_unknown_name(tmp_path):
    with make_client(lambda r: httpx.Response(200, text="<Sesame></Sesame>"), tmp_path) as client:
        response = client.get("/api/resolve", params={"q": "Nowhere Nebula"})
        assert response.status_code == 404 and "No object" in response.json()["detail"]


def test_resolve_bad_coordinates(tmp_path):
    with make_client(lambda r: httpx.Response(500), tmp_path) as client:
        response = client.get("/api/resolve", params={"q": "400 10"})
        assert response.status_code == 400


def test_frames_merges_collections(tmp_path):
    def handler(request):
        if request.url.params["COLLECTION"] == "spherex_qr3_deep":
            return httpx.Response(503)
        return httpx.Response(200, text=CSV)

    with make_client(handler, tmp_path) as client:
        body = client.get("/api/frames", params={"ra": 10.68, "dec": 41.27}).json()
        assert body["count"] == 3
        errors = {c["collection"]: c["error"] for c in body["collections"]}
        assert errors["spherex_qr3_deep"] and errors["spherex_qr2"] is None


def test_frames_all_failing_is_an_error(tmp_path):
    with make_client(lambda r: httpx.Response(503), tmp_path) as client:
        response = client.get("/api/frames", params={"ra": 10.68, "dec": 41.27})
        assert response.status_code == 502


def test_frames_rejects_bad_position(tmp_path):
    with make_client(lambda r: httpx.Response(200, text=CSV), tmp_path) as client:
        assert client.get("/api/frames", params={"ra": 400, "dec": 0}).status_code == 422
