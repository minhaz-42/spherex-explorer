"""Long-lived objects shared by every request, created once when the app starts."""

import asyncio
from dataclasses import dataclass, field

import httpx

from .assistant.local_model import Health, LocalModel, OllamaModel, OpenAICompatModel
from .cache import Store
from .config import Settings
from .ratelimit import RateLimiter


def make_assistant(settings: Settings, client: httpx.AsyncClient) -> LocalModel | None:
    if settings.assistant_provider == "ollama":
        return OllamaModel(
            client,
            settings.assistant_url,
            settings.assistant_model,
            max_tokens=settings.assistant_max_tokens,
            context_tokens=settings.assistant_context_tokens,
            temperature=settings.assistant_temperature,
            keep_alive=settings.assistant_keep_alive,
            timeout_s=settings.assistant_timeout_s,
        )
    if settings.assistant_provider == "openai":
        return OpenAICompatModel(
            client,
            settings.assistant_url,
            settings.assistant_model,
            max_tokens=settings.assistant_max_tokens,
            temperature=settings.assistant_temperature,
            timeout_s=settings.assistant_timeout_s,
        )
    return None


@dataclass
class Services:
    settings: Settings
    client: httpx.AsyncClient
    store: Store
    limiter: RateLimiter
    assistant: LocalModel | None = None
    # Caps concurrent range-read jobs so one visitor cannot saturate the S3 link.
    s3_slots: asyncio.Semaphore = field(init=False)
    # One answer at a time: a laptop runs one local model, and two generations would only slow
    # each other down.
    assistant_slot: asyncio.Semaphore = field(init=False)
    assistant_health: tuple[float, Health] | None = field(default=None, init=False)

    def __post_init__(self) -> None:
        self.s3_slots = asyncio.Semaphore(self.settings.s3_concurrency)
        self.assistant_slot = asyncio.Semaphore(1)
