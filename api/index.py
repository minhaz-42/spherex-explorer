"""Vercel entry point: the FastAPI app as one serverless function.

Vercel serves frontend/dist from its CDN and rewrites /api/* here (see vercel.json). The function's
filesystem is read-only except /tmp, and there is no local language model, so those two settings
default differently from a self-hosted server; SPHEREX_* project variables still override them.
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend" / "src"))

os.environ.setdefault("SPHEREX_CACHE_DIR", "/tmp/spherex-explorer-cache")
os.environ.setdefault("SPHEREX_ASSISTANT_PROVIDER", "off")

from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware  # noqa: E402

from spherex_explorer.main import app as explorer  # noqa: E402

# Vercel's edge sets X-Forwarded-For to the visitor's address (any value the client sent is
# replaced), so the per-visitor rate limit can trust it, as with uvicorn's --proxy-headers.
app = ProxyHeadersMiddleware(explorer, trusted_hosts="*")
