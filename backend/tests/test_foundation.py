import asyncio
from pathlib import Path

import httpx
import pytest

from spherex_explorer.cache import DiskStore, MemoryCache, Store, cache_key
from spherex_explorer.errors import NotInSnapshot, RateLimited
from spherex_explorer.ratelimit import RateLimiter


async def test_health_reports_ok(api: httpx.AsyncClient) -> None:
    response = await api.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["snapshotAvailable"] is False


async def test_security_headers_are_set(api: httpx.AsyncClient) -> None:
    response = await api.get("/api/health")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert "frame-ancestors 'none'" in response.headers["content-security-policy"]


async def test_unknown_api_route_is_json_404(api: httpx.AsyncClient) -> None:
    response = await api.get("/api/nope")
    assert response.status_code == 404


def test_cache_key_is_stable_and_rounds_floats() -> None:
    assert cache_key("a", 1.00000001, 2) == cache_key("a", 1.0, 2)
    assert cache_key("a", 1.0) != cache_key("a", 1.1)


def test_memory_cache_expires_and_evicts() -> None:
    cache = MemoryCache(max_entries=2)
    cache.put("a", {"v": 1}, ttl_s=60)
    cache.put("b", {"v": 2}, ttl_s=-1)
    assert cache.get("a") == {"v": 1}
    assert cache.get("b") is None
    cache.put("c", {"v": 3}, ttl_s=60)
    cache.put("d", {"v": 4}, ttl_s=60)
    assert cache.get("a") is None  # least recently used went first


def test_disk_store_round_trip_and_age(tmp_path: Path) -> None:
    store = DiskStore(tmp_path)
    store.put("ns", "k", {"x": [1, 2]})
    assert store.get("ns", "k") == {"x": [1, 2]}
    assert store.get("ns", "k", max_age_s=-1) is None
    assert store.get("ns", "missing") is None


def test_disk_store_ignores_corrupt_files(tmp_path: Path) -> None:
    (tmp_path / "ns").mkdir()
    (tmp_path / "ns" / "k.json.gz").write_bytes(b"not gzip")
    assert DiskStore(tmp_path).get("ns", "k") is None


async def test_store_coalesces_concurrent_computations(tmp_path: Path) -> None:
    store = Store(tmp_path / "c", tmp_path / "s")
    calls = 0

    async def compute() -> dict[str, int]:
        nonlocal calls
        calls += 1
        await asyncio.sleep(0.05)
        return {"n": calls}

    results = await asyncio.gather(
        *[store.get_or_compute("ns", "k", compute, ttl_s=60) for _ in range(5)]
    )
    assert calls == 1
    assert all(r == {"n": 1} for r in results)
    # A second call is served from memory without computing again.
    assert await store.get_or_compute("ns", "k", compute, ttl_s=60) == {"n": 1}
    assert calls == 1


async def test_store_does_not_cache_failures(tmp_path: Path) -> None:
    store = Store(tmp_path / "c", tmp_path / "s")
    attempts = 0

    async def flaky() -> dict[str, int]:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise RuntimeError("upstream down")
        return {"ok": 1}

    with pytest.raises(RuntimeError):
        await store.get_or_compute("ns", "k", flaky, ttl_s=60)
    assert await store.get_or_compute("ns", "k", flaky, ttl_s=60) == {"ok": 1}


async def test_snapshot_mode_never_computes(tmp_path: Path) -> None:
    DiskStore(tmp_path / "s").put("ns", "have", {"demo": True})
    store = Store(tmp_path / "c", tmp_path / "s")

    async def compute() -> dict[str, int]:
        raise AssertionError("snapshot mode must not call upstream")

    assert await store.get_or_compute("ns", "have", compute, ttl_s=60, source="snapshot") == {
        "demo": True
    }
    with pytest.raises(NotInSnapshot):
        await store.get_or_compute("ns", "missing", compute, ttl_s=60, source="snapshot")


def test_rate_limiter_blocks_after_burst_and_refills() -> None:
    limiter = RateLimiter(per_minute=60, burst=2)
    limiter.check("a")
    limiter.check("a")
    with pytest.raises(RateLimited):
        limiter.check("a")
    limiter.check("b")  # other clients are unaffected
    limiter._buckets["a"].updated -= 2  # two seconds later, two tokens are back
    limiter.check("a")


async def test_a_refused_answer_is_returned_but_not_cached(tmp_path) -> None:  # type: ignore[no-untyped-def]
    from spherex_explorer.cache import Store

    store = Store(tmp_path / "c", tmp_path / "s")
    calls = 0

    async def compute() -> dict:  # type: ignore[type-arg]
        nonlocal calls
        calls += 1
        return {"partial": True}

    for _ in range(2):
        value = await store.get_or_compute(
            "x", "k", compute, ttl_s=60, keep=lambda v: not v.get("partial")
        )
        assert value == {"partial": True}
    assert calls == 2
    assert store.peek("x", "k") is None
