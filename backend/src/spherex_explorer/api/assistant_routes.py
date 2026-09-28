"""The assistant's routes: what it can do right now, and one streamed answer."""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from ..assistant import chat
from ..services import Services

router = APIRouter()


def _svc(request: Request) -> Services:
    svc: Services = request.app.state.services
    return svc


@router.get("/assistant/status")
async def status(request: Request) -> dict[str, Any]:
    svc = _svc(request)
    health = await chat.model_health(svc)
    settings = svc.settings
    local = settings.assistant_url.startswith(
        ("http://127.0.0.1", "http://localhost", "http://[::1]")
    )
    return {
        "mode": "local-model"
        if health and health.reachable and health.model_installed
        else "built-in",
        "provider": settings.assistant_provider,
        "model": svc.assistant.name if svc.assistant is not None else None,
        "local": local,
        "detail": health.detail
        if health
        else "The assistant answers from the app's own data only.",
    }


@router.post("/assistant/chat")
async def ask(
    request: Request, body: chat.ChatRequest, source: Literal["live", "snapshot"] = "live"
) -> StreamingResponse:
    """One answer, streamed as server-sent events (see ``assistant/chat.py``)."""
    svc = _svc(request)
    client = request.client.host if request.client else "unknown"
    svc.limiter.check(client, cost=3)
    return StreamingResponse(
        chat.run(svc, body, source),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
