"""A small per-client token bucket for the routes that call upstream services.

It keeps a public deployment from being turned into a bulk downloader for the archive. It is
in-process, which is enough for the single-process deployment this app targets.
"""

import time
from dataclasses import dataclass

from .errors import RateLimited


@dataclass
class _Bucket:
    tokens: float
    updated: float


class RateLimiter:
    def __init__(self, per_minute: int, *, burst: int | None = None, max_clients: int = 10_000):
        self.rate = per_minute / 60.0
        self.capacity = float(burst if burst is not None else max(per_minute // 2, 1))
        self.max_clients = max_clients
        self._buckets: dict[str, _Bucket] = {}

    def check(self, client: str, cost: float = 1.0) -> None:
        now = time.monotonic()
        bucket = self._buckets.get(client)
        if bucket is None:
            if len(self._buckets) >= self.max_clients:
                self._buckets.clear()
            bucket = _Bucket(tokens=self.capacity, updated=now)
            self._buckets[client] = bucket
        bucket.tokens = min(self.capacity, bucket.tokens + (now - bucket.updated) * self.rate)
        bucket.updated = now
        if bucket.tokens < cost:
            raise RateLimited(
                "Too many requests in a short time. Wait a few seconds and try again."
            )
        bucket.tokens -= cost
