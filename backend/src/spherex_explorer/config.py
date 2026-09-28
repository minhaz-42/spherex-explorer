"""Runtime settings, read from environment variables prefixed with ``SPHEREX_``."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SPHEREX_", env_file=".env", extra="ignore")

    # Upstream services. Defaults are the public endpoints verified in
    # docs/research/spherex-data-research.md.
    sia_url: str = "https://irsa.ipac.caltech.edu/SIA"
    irsa_data_url: str = "https://irsa.ipac.caltech.edu/ibe/data/spherex/"
    s3_url: str = "https://nasa-irsa-spherex.s3.us-east-1.amazonaws.com/"
    sesame_url: str = "https://cds.unistra.fr/cgi-bin/nph-sesame/-oxp/SNV"
    sbident_url: str = "https://ssd-api.jpl.nasa.gov/sb_ident.api"
    horizons_url: str = "https://ssd.jpl.nasa.gov/api/horizons.api"

    wide_collections: list[str] = Field(default=["spherex_qr2", "spherex_qr3"])
    deep_collections: list[str] = Field(default=["spherex_qr2_deep", "spherex_qr3_deep"])

    # Where fetched responses and cutouts are cached, and where the demo snapshot lives.
    cache_dir: Path = REPO_ROOT / "backend" / ".cache"
    snapshot_dir: Path = REPO_ROOT / "data" / "snapshot"
    cases_file: Path = REPO_ROOT / "data" / "cases.json"
    # Built frontend to serve at "/" in production. Ignored when the folder does not exist.
    frontend_dist: Path = REPO_ROOT / "frontend" / "dist"

    upstream_timeout_s: float = 60.0
    jpl_timeout_s: float = 150.0
    s3_concurrency: int = 8
    max_cutout_deg: float = 0.5
    max_frames_per_request: int = 60
    rate_limit_per_minute: int = 240
    # Extra browser origins allowed to call the API (the bundled frontend needs none).
    cors_origins: list[str] = Field(default=[])

    # The assistant's language model, running on this machine. "ollama" uses Ollama's own API;
    # "openai" is any OpenAI-compatible local server (LM Studio, llama.cpp, MLX); "off" answers
    # from the app's data only. A 4B model keeps answers to a few seconds on a 16 GB laptop.
    assistant_provider: Literal["ollama", "openai", "off"] = "ollama"
    assistant_url: str = "http://127.0.0.1:11434"
    assistant_model: str = "qwen3:4b-instruct-2507-q4_K_M"
    assistant_max_tokens: int = 600
    assistant_context_tokens: int = 8192
    assistant_temperature: float = 0.2
    assistant_keep_alive: str = "10m"
    assistant_timeout_s: float = 120.0


@lru_cache
def get_settings() -> Settings:
    return Settings()
