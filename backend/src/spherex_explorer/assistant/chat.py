"""One assistant turn: evidence, then a local model's phrasing of it, streamed as events.

Event stream (``text/event-stream``), in order:

- ``progress``: optional, before ``meta``, while live data the question needs is fetched (a frame,
  catalogue facts, SPHEREx coverage, JPL's predictions, the moving-source search);
- ``meta``: the mode (``local-model`` or ``built-in``), the model name, the numbered sources the
  answer may use, and the links (actions) the server built for the question;
- ``notice``: optional, when the local model is unavailable and a built-in answer follows;
- ``delta``: pieces of the answer text, as they are generated;
- ``done``: the grounding check (numbers in the answer not found in the evidence);
- ``error``: instead of ``done``, if the model is busy or stops part-way.
"""

from __future__ import annotations

import asyncio
import json
import time
from collections.abc import AsyncIterator
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from ..cache import Source
from ..services import Services
from . import builtin, grounding, live
from .evidence import Evidence, ViewContext, build
from .knowledge import CORE_FACTS
from .local_model import Health, ModelUnavailable
from .prompts import ANSWER_REMINDER, SYSTEM_PROMPT

HISTORY_MESSAGES = 6
HISTORY_CHARS = 1200
HEALTH_TTL_S = 20.0
# How long a question waits for the model to finish someone else's answer.
BUSY_WAIT_S = 30.0


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=16)
    view: ViewContext | None = None

    @field_validator("messages")
    @classmethod
    def ends_with_question(cls, messages: list[ChatMessage]) -> list[ChatMessage]:
        if messages[-1].role != "user":
            raise ValueError("the last message must be the visitor's question")
        return messages


def sse(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


async def model_health(svc: Services) -> Health | None:
    """Cached health of the configured local model, or None when the assistant has no model."""
    model = svc.assistant
    if model is None:
        return None
    now = time.monotonic()
    cached = svc.assistant_health
    if cached is not None and now - cached[0] < HEALTH_TTL_S:
        return cached[1]
    health = await model.health()
    svc.assistant_health = (now, health)
    return health


def prompt(question: str, history: list[ChatMessage], ev: Evidence) -> list[dict[str, str]]:
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for m in history[-HISTORY_MESSAGES:]:
        messages.append({"role": m.role, "content": m.content[:HISTORY_CHARS]})
    notes = ("\nNot available yet: " + " ".join(ev.notes)) if ev.notes else ""
    messages.append(
        {
            "role": "user",
            "content": (
                f"Evidence for this question:\n{ev.render()}{notes}\n\n"
                f"Question: {question}\n\n{ANSWER_REMINDER}"
            ),
        }
    )
    return messages


async def run(
    svc: Services, req: ChatRequest, source: Source, client: str = "unknown"
) -> AsyncIterator[str]:
    question = req.messages[-1].content.strip()
    history = req.messages[:-1]
    problems: list[str] = []
    async for update in live.gather(svc, question, req.view, source, client):
        if update.kind == "progress":
            yield sse("progress", {"message": update.message})
        else:
            problems.append(update.message)
    ev = await build(svc, question, req.view, source)
    ev.notes.extend(problems)
    # What an answer's numbers may come from: this question's evidence and the standing facts.
    evidence_text = f"{ev.render()}\n{CORE_FACTS}"
    tags = {i.tag for i in ev.items}
    health = await model_health(svc)
    use_model = health is not None and health.reachable and health.model_installed
    model_name = svc.assistant.name if svc.assistant is not None else None

    yield sse(
        "meta",
        {"mode": "local-model" if use_model else "built-in", "model": model_name, **ev.to_json()},
    )

    if not use_model:
        if health is not None:
            yield sse(
                "notice", {"message": f"{health.detail} Answering from the app's own data instead."}
            )
        text = builtin.answer(question, ev)
        yield sse("delta", {"text": text})
        yield sse(
            "done",
            {
                "grounding": grounding.check(text, evidence_text, question, tags).to_json(),
                "mode": "built-in",
            },
        )
        return

    assert svc.assistant is not None
    pieces: list[str] = []
    try:
        await asyncio.wait_for(svc.assistant_slot.acquire(), timeout=BUSY_WAIT_S)
    except TimeoutError:
        yield sse(
            "error",
            {"message": "The local model is busy with another question. Try again in a moment."},
        )
        return
    try:
        async for piece in svc.assistant.stream(prompt(question, history, ev)):
            pieces.append(piece)
            yield sse("delta", {"text": piece})
    except ModelUnavailable as exc:
        svc.assistant_health = None
        if not pieces:
            yield sse("notice", {"message": f"{exc} Answering from the app's own data instead."})
            text = builtin.answer(question, ev)
            yield sse("delta", {"text": text})
            yield sse(
                "done",
                {
                    "grounding": grounding.check(text, evidence_text, question, tags).to_json(),
                    "mode": "built-in",
                },
            )
            return
        yield sse("error", {"message": "The local model stopped part-way through its answer."})
        return
    finally:
        svc.assistant_slot.release()
    text = "".join(pieces)
    yield sse(
        "done",
        {
            "grounding": grounding.check(text, evidence_text, question, tags).to_json(),
            "mode": "local-model",
        },
    )
