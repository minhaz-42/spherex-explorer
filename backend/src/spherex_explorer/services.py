"""Long-lived objects shared by every request, created once when the app starts."""

import asyncio
from dataclasses import dataclass, field

import httpx

from .cache import Store
from .config import Settings
from .ratelimit import RateLimiter


@dataclass
class Services:
    settings: Settings
    client: httpx.AsyncClient
    store: Store
    limiter: RateLimiter
    # Caps concurrent range-read jobs so one visitor cannot saturate the S3 link.
    s3_slots: asyncio.Semaphore = field(init=False)

    def __post_init__(self) -> None:
        self.s3_slots = asyncio.Semaphore(self.settings.s3_concurrency)
