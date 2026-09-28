"""Live data the assistant fetches for a question: what the question needs and the cache lacks.

The evidence builder only ever reads the cache. This module fills it first, through the same
computations the routes use (``api/compute.py``), so a visitor does not have to press the viewer's
buttons before asking, and an answer about an object rests on catalogue facts and SPHEREx
coverage fetched for it:

- the frames on screen, if they have not loaded yet;
- what SIMBAD catalogues at the target, and at an object or position named in the question;
- for a question about motion in a one-pass view: JPL's known objects and this app's
  moving-source search;
- SPHEREx coverage of an object or position named in the question.

In the demo snapshot nothing is fetched: the snapshot holds recorded answers only, and the
evidence builder reads them directly. Every step is reported, because a JPL check takes up to two
minutes the first time.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Literal

from ..api import compute
from ..api.cachekeys import (
    candidates_key,
    cutout_key,
    known_key,
    object_key,
    observations_key,
    resolve_key,
)
from ..archive.keys import FrameKey
from ..cache import Source
from ..errors import ExplorerError, NotFound
from ..objects import simbad
from ..resolve import coords
from ..science.grid import make_grid
from ..services import Services
from .evidence import ViewContext, named_object, question_position

log = logging.getLogger("spherex_explorer.assistant")

# Words that make a question about motion, which JPL's check and the search answer.
MOTION = (
    "move",
    "moving",
    "moved",
    "motion",
    "asteroid",
    "comet",
    "jpl",
    "known object",
    "track",
    "shift",
    "chang",
    "what is that",
    "dot",
    "blink",
    "solar system",
)
# JPL's check is only offered for a pass shorter than this, as in the viewer.
MAX_PASS_DAYS = 20.0
VMAG_LIMIT = 20.0


@dataclass(frozen=True)
class Update:
    kind: Literal["progress", "problem"]
    message: str


def asks_about_motion(question: str) -> bool:
    q = question.lower()
    return any(w in q for w in MOTION)


def _problem(what: str, exc: ExplorerError) -> Update:
    return Update("problem", f"{what} could not be fetched: {exc.message}")


async def gather(
    svc: Services, question: str, view: ViewContext | None, source: Source, client: str
) -> AsyncIterator[Update]:
    """Fetch what the question needs into the cache, yielding what is being done."""
    if source != "live":
        return
    store = svc.store
    if view is not None and view.target is not None:
        t = view.target
        if view.fov is not None:
            grid = make_grid(t.ra, t.dec, view.fov)
            for label, key in (("B", view.frameKey), ("A", view.referenceKey)):
                if not key or (label == "A" and view.compare in (None, "single")):
                    continue
                try:
                    frame = FrameKey.parse(key)
                except ExplorerError:
                    continue
                if store.peek("cutout", cutout_key(frame.key, grid), source) is None:
                    yield Update("progress", f"Loading frame {label} from the SPHEREx archive…")
                    try:
                        await compute.cutout(svc, frame, grid, source, client)
                    except ExplorerError as exc:
                        yield _problem(f"Frame {label}", exc)

        async for update in _object(svc, t.ra, t.dec, "at the target", client):
            yield update

        if view.fov is not None and view.sequenceMode == "pass" and asks_about_motion(question):
            async for update in _motion(svc, view, client):
                yield update

    position = question_position(question)
    if position is not None:
        ra, dec, label = position
        async for update in _object(svc, ra, dec, "at that position", client):
            yield update
        async for update in _coverage(svc, ra, dec, label, client):
            yield update
        return

    name = named_object(question)
    if name is None:
        return
    if store.peek("resolve", resolve_key(name), source) is None:
        yield Update("progress", f"Looking up “{name}” with CDS Sesame…")
    try:
        hit = await compute.resolve_name(svc, name, source, client)
    except NotFound:
        return
    except ExplorerError as exc:
        yield _problem(f"The position of “{name}”", exc)
        return
    label = str(hit.get("name") or name)
    async for update in _object(svc, float(hit["ra"]), float(hit["dec"]), f"for {label}", client):
        yield update
    async for update in _coverage(svc, float(hit["ra"]), float(hit["dec"]), label, client):
        yield update


async def _object(
    svc: Services, ra: float, dec: float, where: str, client: str
) -> AsyncIterator[Update]:
    if svc.store.peek("object", object_key(ra, dec, simbad.DEFAULT_RADIUS_DEG), "live") is not None:
        return
    yield Update("progress", f"Asking SIMBAD what is catalogued {where}…")
    try:
        await compute.object_at(svc, ra, dec, "live", client)
    except NotFound:
        return  # Nothing catalogued there: the evidence simply has no catalogue entry.
    except ExplorerError as exc:
        yield _problem("SIMBAD's catalogue facts", exc)


async def _coverage(
    svc: Services, ra: float, dec: float, label: str, client: str
) -> AsyncIterator[Update]:
    key = observations_key(ra, dec, svc.settings.wide_collections, None)
    if svc.store.peek("observations", key, "live") is not None:
        return
    yield Update("progress", f"Searching the SPHEREx archive for images of {label}…")
    try:
        await compute.observations(svc, ra, dec, "live", client)
    except ExplorerError as exc:
        yield _problem("SPHEREx coverage", exc)


async def _motion(svc: Services, view: ViewContext, client: str) -> AsyncIterator[Update]:
    """JPL's known objects and the moving-source search for the pass on screen."""
    assert view.target is not None and view.fov is not None
    t = view.target
    store = svc.store
    keys = sorted({k for k in (_key(k) for k in view.sequenceKeys) if k})
    if not keys:
        return
    obs = store.peek(
        "observations", observations_key(t.ra, t.dec, svc.settings.wide_collections, None), "live"
    )
    frames = [f for f in (obs or {}).get("frames", []) if f.get("key") in set(keys)]
    if len(frames) < len(keys):
        return  # The pass is not known here; the viewer's own buttons still work.
    mjds = [float(f["mjdMid"]) for f in frames]
    if max(mjds) - min(mjds) >= MAX_PASS_DAYS:
        return

    if store.peek("known", known_key(t.ra, t.dec, view.fov, keys, VMAG_LIMIT), "live") is None:
        yield Update(
            "progress",
            "Asking JPL which catalogued asteroids and comets crossed this field. The first check "
            "of a field takes up to two minutes…",
        )
        try:
            await compute.known(svc, t.ra, t.dec, view.fov, keys, VMAG_LIMIT, "live", client)
        except ExplorerError as exc:
            yield _problem("JPL's predictions", exc)

    pointings = {f.get("pointing") for f in frames}
    grid = make_grid(t.ra, t.dec, view.fov)
    if (
        len(pointings) >= 2
        and store.peek("candidates", candidates_key(t.ra, t.dec, grid.size_px, keys), "live")
        is None
    ):
        yield Update(
            "progress",
            f"Running the moving-source search over the {len(keys)} frames of this pass…",
        )
        try:
            await compute.candidates(svc, t.ra, t.dec, view.fov, keys, "live", client)
        except ExplorerError as exc:
            yield _problem("The moving-source search", exc)


def _key(text: str) -> str | None:
    try:
        return FrameKey.parse(text).key
    except ExplorerError:
        return None


__all__ = ["MOTION", "Update", "asks_about_motion", "coords", "gather"]
