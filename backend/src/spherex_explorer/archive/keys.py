"""Archive file keys: the only way a client can name a file.

The cutout route takes an S3 key rather than a URL, and accepts only keys shaped exactly like
SPHEREx Level 2 spectral images. The server then builds the URL itself, so the route cannot be
used to fetch anything else.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from ..errors import InvalidQuery

_VERSION = r"l2b(?:_[a-z]+)?-v\d{1,3}-\d{4}-\d{3}"
_PERIOD = r"\d{4}W\d{2}_[0-9][A-Z]"
KEY_PATTERN = re.compile(
    rf"^(?P<release>qr\d)/level2/(?P<period>{_PERIOD})/(?P<version>{_VERSION})/(?P<det>[1-6])/"
    rf"level2_(?P<obs>(?P=period)_\d{{4}}_\d)D(?P=det)_spx_(?P=version)\.fits$"
)


@dataclass(frozen=True)
class FrameKey:
    key: str
    release: str
    obs_id: str
    detector: int
    version: str

    @classmethod
    def parse(cls, key: str) -> FrameKey:
        match = KEY_PATTERN.fullmatch(key.strip())
        if match is None:
            raise InvalidQuery("That is not the key of a SPHEREx Level 2 image.")
        return cls(
            key=match.group(0),
            release=match.group("release"),
            obs_id=match.group("obs"),
            detector=int(match.group("det")),
            version=match.group("version"),
        )

    def url(self, base: str) -> str:
        return base.rstrip("/") + "/" + self.key
