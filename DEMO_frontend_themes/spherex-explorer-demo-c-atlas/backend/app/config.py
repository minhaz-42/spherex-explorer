"""Settings, read from SPHEREX_* environment variables.

Every setting is optional. See .env.example at the project root.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = BACKEND_DIR.parent


def _float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return float(raw)
    except ValueError as exc:
        raise ValueError(f"{name} must be a number, got {raw!r}") from exc


@dataclass(frozen=True)
class Settings:
    # Search radius around the target, in degrees.
    search_radius_deg: float = field(default_factory=lambda: _float("SPHEREX_SEARCH_RADIUS_DEG", 0.01))
    # How long to wait for IRSA or CDS before giving up, in seconds.
    upstream_timeout_s: float = field(default_factory=lambda: _float("SPHEREX_UPSTREAM_TIMEOUT_S", 60.0))
    # How long answers stay in the in-memory cache, in seconds.
    resolve_ttl_s: float = field(default_factory=lambda: _float("SPHEREX_RESOLVE_TTL_S", 86400.0))
    frames_ttl_s: float = field(default_factory=lambda: _float("SPHEREX_FRAMES_TTL_S", 3600.0))
    # Built web app to serve at "/". Defaults to ../frontend/dist.
    frontend_dist: Path = field(
        default_factory=lambda: Path(os.environ.get("SPHEREX_FRONTEND_DIST", PROJECT_DIR / "frontend" / "dist"))
    )
