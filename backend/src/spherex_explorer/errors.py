"""Errors the API turns into structured JSON responses.

Every error carries a machine-readable ``code`` and a sentence a visitor can act on.
"""


class ExplorerError(Exception):
    status = 500
    code = "internal_error"

    def __init__(self, message: str, *, detail: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.detail = detail


class InvalidQuery(ExplorerError):
    status = 400
    code = "invalid_query"


class NotFound(ExplorerError):
    status = 404
    code = "not_found"


class NotInSnapshot(ExplorerError):
    status = 404
    code = "not_in_snapshot"


class UpstreamError(ExplorerError):
    """An archive or ephemeris service failed, timed out or answered with something unusable."""

    status = 502
    code = "upstream_error"

    def __init__(self, service: str, message: str, *, detail: str | None = None) -> None:
        super().__init__(message, detail=detail)
        self.service = service


class UpstreamTimeout(UpstreamError):
    status = 504
    code = "upstream_timeout"


class RateLimited(ExplorerError):
    status = 429
    code = "rate_limited"
