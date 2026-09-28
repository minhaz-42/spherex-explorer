"""Caching for upstream responses and computed cutouts.

Three layers, checked in order:

1. an in-process LRU with expiry, for repeated requests in one session;
2. a gzip-JSON store on disk, so a restart does not re-download what we already have;
3. the demo snapshot: a read-only copy of layer 2 for the curated cases, used only when the
   visitor explicitly chooses demo data.

Identical requests that arrive while the first is still running share its result.
"""

import asyncio
import gzip
import hashlib
import json
import time
from collections import OrderedDict
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any, Literal

from .errors import NotInSnapshot

Source = Literal["live", "snapshot"]
JSON = dict[str, Any]


def cache_key(*parts: object) -> str:
    """A stable key from values that identify a request. Floats are rounded to 1e-7."""
    norm = [round(p, 7) if isinstance(p, float) else p for p in parts]
    raw = json.dumps(norm, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


class MemoryCache:
    def __init__(self, max_entries: int = 2048) -> None:
        self._data: OrderedDict[str, tuple[float, JSON]] = OrderedDict()
        self._max = max_entries

    def get(self, key: str) -> JSON | None:
        item = self._data.get(key)
        if item is None:
            return None
        expires, value = item
        if expires < time.monotonic():
            del self._data[key]
            return None
        self._data.move_to_end(key)
        return value

    def put(self, key: str, value: JSON, ttl_s: float) -> None:
        self._data[key] = (time.monotonic() + ttl_s, value)
        self._data.move_to_end(key)
        while len(self._data) > self._max:
            self._data.popitem(last=False)


class DiskStore:
    """``<root>/<namespace>/<key>.json.gz`` files holding ``{"stored_at", "value"}``."""

    def __init__(self, root: Path, *, read_only: bool = False) -> None:
        self.root = root
        self.read_only = read_only

    def _path(self, namespace: str, key: str) -> Path:
        return self.root / namespace / f"{key}.json.gz"

    def get(self, namespace: str, key: str, max_age_s: float | None = None) -> JSON | None:
        path = self._path(namespace, key)
        try:
            with gzip.open(path, "rt", encoding="utf-8") as fh:
                record = json.load(fh)
        except (FileNotFoundError, NotADirectoryError):
            return None
        except (OSError, json.JSONDecodeError):
            # A torn write or foreign file: treat as a miss rather than failing the request.
            return None
        if max_age_s is not None and time.time() - float(record.get("stored_at", 0)) > max_age_s:
            return None
        value = record.get("value")
        return value if isinstance(value, dict) else None

    def put(self, namespace: str, key: str, value: JSON) -> None:
        if self.read_only:
            return
        path = self._path(namespace, key)
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        with gzip.open(tmp, "wt", encoding="utf-8", compresslevel=6) as fh:
            json.dump({"stored_at": time.time(), "value": value}, fh, separators=(",", ":"))
        tmp.replace(path)


class Store:
    def __init__(self, cache_dir: Path, snapshot_dir: Path) -> None:
        self.memory = MemoryCache()
        self.disk = DiskStore(cache_dir)
        self.snapshot = DiskStore(snapshot_dir, read_only=True)
        self._inflight: dict[str, asyncio.Future[JSON]] = {}

    def peek(self, namespace: str, key: str, source: Source = "live") -> JSON | None:
        """What is already stored, without computing anything (the assistant's evidence)."""
        if source == "snapshot":
            return self.snapshot.get(namespace, key)
        return self.memory.get(f"{namespace}:{key}") or self.disk.get(namespace, key)

    def put(self, namespace: str, key: str, value: JSON, ttl_s: float) -> None:
        """Store a value computed elsewhere (for example, header facts found while cutting out)."""
        self.memory.put(f"{namespace}:{key}", value, ttl_s)
        self.disk.put(namespace, key, value)

    async def get_or_compute(
        self,
        namespace: str,
        key: str,
        compute: Callable[[], Awaitable[JSON]],
        *,
        ttl_s: float,
        source: Source = "live",
        persist: bool = True,
    ) -> JSON:
        if source == "snapshot":
            value = self.snapshot.get(namespace, key)
            if value is None:
                raise NotInSnapshot(
                    "This view is not part of the demo snapshot. "
                    "Switch back to live data to load it."
                )
            return value

        full = f"{namespace}:{key}"
        hit = self.memory.get(full)
        if hit is not None:
            return hit
        if persist:
            stored = self.disk.get(namespace, key, max_age_s=ttl_s)
            if stored is not None:
                self.memory.put(full, stored, ttl_s)
                return stored

        running = self._inflight.get(full)
        if running is not None:
            return await asyncio.shield(running)

        future: asyncio.Future[JSON] = asyncio.get_running_loop().create_future()
        self._inflight[full] = future
        try:
            value = await compute()
        except BaseException as exc:
            future.set_exception(exc)
            # Mark the exception as retrieved so an unshared failure is not logged twice.
            future.exception()
            raise
        else:
            future.set_result(value)
            self.memory.put(full, value, ttl_s)
            if persist:
                await asyncio.to_thread(self.disk.put, namespace, key, value)
            return value
        finally:
            self._inflight.pop(full, None)
