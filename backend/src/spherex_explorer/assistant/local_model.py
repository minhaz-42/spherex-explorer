"""Language models running on this machine, behind one small interface.

Two adapters:

- ``OllamaModel`` uses Ollama's native chat API (``POST /api/chat``), which can switch a model's
  thinking off and keep the model loaded between questions;
- ``OpenAICompatModel`` uses the OpenAI-style ``POST /v1/chat/completions`` that LM Studio,
  llama.cpp's server and MLX's server all expose.

Both stream text. Neither ever receives images: the assistant only phrases evidence the app has
already measured.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Protocol

import httpx


class ModelUnavailable(Exception):
    """The local model server is not running, or the model is not installed."""


@dataclass(frozen=True)
class Health:
    reachable: bool
    model_installed: bool
    detail: str


class LocalModel(Protocol):
    name: str

    async def health(self) -> Health: ...

    def stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]: ...


class ThinkStripper:
    """Remove ``<think> … </think>`` spans from a stream of text chunks.

    Hybrid reasoning models can emit their scratch work inside think tags even when asked not to;
    it must never reach the user. Tags may be split across chunks, so the stripper buffers a
    possible partial tag at the end of each chunk.
    """

    OPEN, CLOSE = "<think>", "</think>"

    def __init__(self) -> None:
        self._inside = False
        self._carry = ""

    def feed(self, chunk: str) -> str:
        text = self._carry + chunk
        self._carry = ""
        out: list[str] = []
        while text:
            tag = self.CLOSE if self._inside else self.OPEN
            i = text.find(tag)
            if i >= 0:
                if not self._inside:
                    out.append(text[:i])
                text = text[i + len(tag) :]
                self._inside = not self._inside
                continue
            # Keep a possible partial tag for the next chunk.
            keep = 0
            for k in range(min(len(tag) - 1, len(text)), 0, -1):
                if tag.startswith(text[-k:]):
                    keep = k
                    break
            if not self._inside:
                out.append(text[: len(text) - keep])
            self._carry = text[len(text) - keep :]
            text = ""
        return "".join(out)

    def flush(self) -> str:
        rest = "" if self._inside else self._carry
        self._carry = ""
        return rest


class OllamaModel:
    def __init__(
        self,
        client: httpx.AsyncClient,
        url: str,
        name: str,
        *,
        max_tokens: int,
        context_tokens: int,
        temperature: float,
        keep_alive: str,
        timeout_s: float,
    ) -> None:
        self.client = client
        self.url = url.rstrip("/")
        self.name = name
        self.max_tokens = max_tokens
        self.context_tokens = context_tokens
        self.temperature = temperature
        self.keep_alive = keep_alive
        self.timeout_s = timeout_s

    async def health(self) -> Health:
        try:
            response = await self.client.get(f"{self.url}/api/tags", timeout=3.0)
            response.raise_for_status()
            names = {m.get("name", "") for m in response.json().get("models", [])}
        except (httpx.HTTPError, ValueError) as exc:
            return Health(
                False, False, f"Ollama is not answering at {self.url} ({type(exc).__name__})."
            )
        installed = self.name in names or f"{self.name}:latest" in names
        detail = (
            "ready"
            if installed
            else f"Model {self.name} is not installed (run: ollama pull {self.name})."
        )
        return Health(True, installed, detail)

    async def stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        body = {
            "model": self.name,
            "messages": messages,
            "stream": True,
            "think": False,
            "keep_alive": self.keep_alive,
            "options": {
                "temperature": self.temperature,
                "num_ctx": self.context_tokens,
                "num_predict": self.max_tokens,
            },
        }
        stripper = ThinkStripper()
        try:
            async with self.client.stream(
                "POST", f"{self.url}/api/chat", json=body, timeout=self.timeout_s
            ) as response:
                if response.status_code == 404:
                    raise ModelUnavailable(f"Model {self.name} is not installed.")
                if response.status_code >= 400:
                    text = (await response.aread()).decode(errors="replace")[:200]
                    raise ModelUnavailable(f"Ollama answered HTTP {response.status_code}: {text}")
                async for line in response.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        event = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    if event.get("error"):
                        raise ModelUnavailable(str(event["error"])[:200])
                    piece = stripper.feed(str(event.get("message", {}).get("content", "")))
                    if piece:
                        yield piece
                    if event.get("done"):
                        break
        except httpx.ConnectError as exc:
            raise ModelUnavailable(f"Ollama is not running at {self.url}.") from exc
        except httpx.TimeoutException as exc:
            raise ModelUnavailable("The local model took too long to answer.") from exc
        rest = stripper.flush()
        if rest:
            yield rest


class OpenAICompatModel:
    def __init__(
        self,
        client: httpx.AsyncClient,
        url: str,
        name: str,
        *,
        max_tokens: int,
        temperature: float,
        timeout_s: float,
    ) -> None:
        self.client = client
        self.url = url.rstrip("/")
        self.name = name
        self.max_tokens = max_tokens
        self.temperature = temperature
        self.timeout_s = timeout_s

    async def health(self) -> Health:
        try:
            response = await self.client.get(f"{self.url}/v1/models", timeout=3.0)
            response.raise_for_status()
            names = {m.get("id", "") for m in response.json().get("data", [])}
        except (httpx.HTTPError, ValueError) as exc:
            return Health(
                False, False, f"No model server is answering at {self.url} ({type(exc).__name__})."
            )
        installed = not names or self.name in names
        return Health(
            True, installed, "ready" if installed else f"Model {self.name} is not loaded."
        )

    async def stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        body = {
            "model": self.name,
            "messages": messages,
            "stream": True,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
        }
        stripper = ThinkStripper()
        try:
            async with self.client.stream(
                "POST", f"{self.url}/v1/chat/completions", json=body, timeout=self.timeout_s
            ) as response:
                if response.status_code >= 400:
                    text = (await response.aread()).decode(errors="replace")[:200]
                    raise ModelUnavailable(
                        f"The model server answered HTTP {response.status_code}: {text}"
                    )
                async for line in response.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        break
                    try:
                        event = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    choices = event.get("choices") or [{}]
                    piece = stripper.feed(str((choices[0].get("delta") or {}).get("content") or ""))
                    if piece:
                        yield piece
        except httpx.ConnectError as exc:
            raise ModelUnavailable(f"No model server is running at {self.url}.") from exc
        except httpx.TimeoutException as exc:
            raise ModelUnavailable("The local model took too long to answer.") from exc
        rest = stripper.flush()
        if rest:
            yield rest
