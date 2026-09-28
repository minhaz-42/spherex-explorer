"""HTTP routes. Each route validates its input, then hands off to the data and science layers."""

from typing import Literal

from fastapi import APIRouter, Request

from .. import __version__
from ..services import Services

router = APIRouter()


def services(request: Request) -> Services:
    svc: Services = request.app.state.services
    return svc


def client_id(request: Request) -> str:
    return request.client.host if request.client else "unknown"


@router.get("/health")
async def health(request: Request) -> dict[str, object]:
    svc = services(request)
    return {
        "status": "ok",
        "version": __version__,
        "snapshotAvailable": svc.settings.snapshot_dir.is_dir(),
    }


SourceParam = Literal["live", "snapshot"]
