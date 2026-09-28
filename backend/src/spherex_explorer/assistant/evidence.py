"""The evidence the assistant answers from, built fresh for every question.

Real data → the app's own measurements → numbered evidence → the language model phrases it.

Everything here comes from the server's own data: what the viewer has already loaded (read from
the cache, never recomputed or fetched on the assistant's behalf, except a quick name lookup the
visitor asked for), the curated Discover cases, and the knowledge notes. Numbers the browser sends
are never used as facts; the browser only says *which* target and frames are on screen.
"""

from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal, TypeGuard
from urllib.parse import urlencode

from pydantic import BaseModel, Field

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
from ..errors import ExplorerError
from ..objects.simbad import DEFAULT_RADIUS_DEG as DEFAULT_OBJECT_RADIUS_DEG
from ..resolve import coords
from ..resolve.target import describe
from ..science.grid import make_grid
from ..services import Services
from . import knowledge

MATCH_ARCSEC = 12.3


class ViewTarget(BaseModel):
    ra: float = Field(ge=0, lt=360)
    dec: float = Field(ge=-90, le=90)
    name: str | None = Field(default=None, max_length=120)


class ViewContext(BaseModel):
    """What the visitor has on screen. Identifiers only; the server looks up every value."""

    page: Literal["landing", "explore", "discover", "about", "ask", "other"] = "other"
    target: ViewTarget | None = None
    frameKey: str | None = Field(default=None, max_length=200)
    referenceKey: str | None = Field(default=None, max_length=200)
    compare: Literal["single", "blink", "side", "diff"] | None = None
    fov: float | None = Field(default=None, ge=0.03, le=0.5)
    sequenceMode: Literal["pass", "wavelength"] | None = None
    sequenceKeys: list[str] = Field(default_factory=list, max_length=60)
    frameIndex: int | None = Field(default=None, ge=0, le=10_000)
    frameCount: int | None = Field(default=None, ge=0, le=10_000)


Kind = Literal["view", "jpl", "search", "case", "method", "lookup"]
_PREFIX: dict[str, str] = {
    "view": "E",
    "jpl": "E",
    "search": "E",
    "lookup": "E",
    "case": "E",
    "method": "K",
}


@dataclass
class Item:
    tag: str
    kind: Kind
    title: str
    text: str
    source: str = ""

    def render(self) -> str:
        return f"[{self.tag}] {self.title}: {self.text}"


@dataclass
class Action:
    label: str
    href: str


@dataclass
class Evidence:
    items: list[Item] = field(default_factory=list)
    actions: list[Action] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)  # e.g. "the frame has not loaded yet"

    def add(self, kind: Kind, title: str, text: str, source: str = "") -> Item:
        prefix = _PREFIX[kind]
        n = sum(1 for i in self.items if i.tag.startswith(prefix)) + 1
        item = Item(f"{prefix}{n}", kind, title, text, source)
        self.items.append(item)
        return item

    def render(self) -> str:
        return (
            "\n".join(i.render() for i in self.items)
            if self.items
            else "(no evidence for this question)"
        )

    def to_json(self) -> dict[str, Any]:
        return {
            "sources": [
                {"tag": i.tag, "kind": i.kind, "title": i.title, "text": i.text, "source": i.source}
                for i in self.items
            ],
            "actions": [{"label": a.label, "href": a.href} for a in self.actions],
            "notes": self.notes,
        }


# ---------------------------------------------------------------------------------------------
# Formatting


def _flux(ujy: float | None) -> str:
    if ujy is None or not math.isfinite(ujy):
        return "not measured"
    a = abs(ujy)
    if a >= 1e6:
        return f"{ujy / 1e6:.3g} Jy"
    if a >= 1e3:
        return f"{ujy / 1e3:.3g} mJy"
    return f"{ujy:.3g} µJy"


def _when(iso: str | None) -> str:
    if not iso:
        return "unknown time"
    d = datetime.fromisoformat(iso.replace("Z", ""))
    return f"{d.day} {d.strftime('%b %Y')} {d.strftime('%H:%M:%S')} UTC"


def _date(iso: str | None) -> str:
    if not iso:
        return "an unknown date"
    d = datetime.fromisoformat(iso.replace("Z", ""))
    return f"{d.day} {d.strftime('%b %Y')}"


def _gap(days: float) -> str:
    minutes = abs(days) * 1440
    if minutes < 90:
        return f"{minutes:.0f} min"
    hours = minutes / 60
    if hours < 48:
        return f"{hours:.1f} h"
    if abs(days) < 60:
        return f"{abs(days):.1f} days"
    return f"{abs(days) / 30.44:.1f} months"


def _sep_arcsec(ra1: float, dec1: float, ra2: float, dec2: float) -> float:
    a = math.sin(math.radians(dec2 - dec1) / 2) ** 2
    b = (
        math.cos(math.radians(dec1))
        * math.cos(math.radians(dec2))
        * math.sin(math.radians(ra2 - ra1) / 2) ** 2
    )
    return math.degrees(2 * math.asin(min(1.0, math.sqrt(a + b)))) * 3600


def case_link(case: dict[str, Any], source: Source) -> str:
    params: dict[str, str] = {
        "ra": str(case["target"]["ra"]),
        "dec": str(case["target"]["dec"]),
        "name": str(case["target"]["name"]),
    }
    for k, v in case.get("viewer", {}).items():
        params[str(k)] = str(v)
    if source == "snapshot":
        params["source"] = "snapshot"
    return "/explore?" + urlencode(params)


# ---------------------------------------------------------------------------------------------
# The view on screen


def _lower_first(text: str) -> str:
    """'Pixels in …' to 'pixels in …' mid-sentence; leaves 'QR3 …' alone."""
    return text[0].lower() + text[1:] if len(text) > 1 and text[1].islower() else text


def _frame_text(p: dict[str, Any]) -> str:
    wl, bw = p["wavelength"]["atTargetUm"], p["wavelength"]["bandwidthUm"]
    phot = p["photometry"]
    parts = [
        f"observation {p['obsId']}, detector D{p['detector']}, {p['release'].upper()}",
        f"mid-exposure {_when(p['time']['isoMid'])}",
        f"wavelength at the target {wl:.3f} µm (bandwidth {bw:.3f} µm)"
        if wl and bw
        else "wavelength unknown",
    ]
    if phot["fluxMicroJy"] is not None:
        err = f" ± {_flux(phot['errorMicroJy'])}" if phot["errorMicroJy"] is not None else ""
        snr = f", signal-to-noise {phot['snr']:.0f}" if phot["snr"] is not None else ""
        parts.append(f"brightness at the target {_flux(phot['fluxMicroJy'])}{err}{snr}")
    else:
        parts.append("brightness at the target not measurable")
    if phot["reasons"]:
        parts.append("caveats: " + "; ".join(_lower_first(r.rstrip(".")) for r in phot["reasons"]))
    flagged = [f for f in p["target"]["flags"] if f in p["mask"]["maskedFlags"]]
    if flagged:
        parts.append(
            f"the target's own pixels are flagged {', '.join(flagged)} "
            "(filled in for display, not measured)"
        )
    bg = p["background"]
    if bg["levelMJySr"] is not None:
        parts.append(f"local background {bg['levelMJySr']:.3g} MJy/sr (subtracted)")
    return "; ".join(parts) + "."


def _compatibility(a: dict[str, Any], b: dict[str, Any], motion: str | None = None) -> str:
    """Whether frames A and B can be compared, and how.

    ``motion`` is the reason the brightness at the target differs, when a known body explains it;
    it comes first, and then the colour caveat (true for sources that stay put) is left out so
    that it is not taken as the reason.
    """
    wa, wb = a["wavelength"]["atTargetUm"], b["wavelength"]["atTargetUm"]
    ba, bb = a["wavelength"]["bandwidthUm"], b["wavelength"]["bandwidthUm"]
    ta, tb = a["time"]["mjdMid"], b["time"]["mjdMid"]
    parts = [f"{_gap(tb - ta)} apart"]
    if motion:
        parts.append(motion)
    ok = a["detector"] == b["detector"]
    if not ok:
        parts.append(
            f"different detectors (D{a['detector']} and D{b['detector']}), "
            "so a difference image is not valid"
        )
    if wa is not None and wb is not None and ba and bb:
        half = 0.5 * min(ba, bb)
        dl = abs(wb - wa)
        if dl > half:
            ok = False
            colour = (
                ""
                if motion
                else ": brightness differences between these frames may be the sources' colours "
                "rather than changes in time"
            )
            parts.append(
                f"{dl:.3f} µm apart in wavelength, more than half a spectral channel "
                f"({half:.3f} µm), so a difference image is not valid{colour}; "
                "positions can still be compared by blinking"
            )
        else:
            parts.append(
                f"{dl:.3f} µm apart in wavelength, within half a spectral channel ({half:.3f} µm)"
            )
    if ok:
        parts.append("a difference image (B minus A) is valid")
    if a["release"] != b["release"]:
        parts.append(
            f"they mix data releases ({a['release'].upper()} and {b['release'].upper()}), "
            "calibrated differently"
        )
    return "; ".join(parts) + "."


def _match(candidate: dict[str, Any], bodies: list[dict[str, Any]]) -> tuple[str, float] | None:
    best: tuple[str, float] | None = None
    for body in bodies:
        pos = {p["key"]: p for p in body["positions"]}
        offsets = []
        for s in candidate["sightings"]:
            preds = [pos[k] for k in s["keys"] if k in pos]
            if preds:
                ra = sum(p["ra"] for p in preds) / len(preds)
                dec = sum(p["dec"] for p in preds) / len(preds)
                offsets.append(_sep_arcsec(s["ra"], s["dec"], ra, dec))
        if offsets:
            median = sorted(offsets)[len(offsets) // 2]
            if median <= MATCH_ARCSEC and (best is None or median < best[1]):
                best = (body["name"], median)
    return best


def _angle(arcsec: float) -> str:
    if arcsec < 60:
        return f"{arcsec:.1f}″"
    if arcsec < 3600:
        return f"{arcsec / 60:.1f}′"
    return f"{arcsec / 3600:.2f}°"


@dataclass
class _Offsets:
    """How far a known body is predicted from the target in the frames on screen (B, A)."""

    name: str
    seps: dict[str, float]

    @property
    def inside(self) -> set[str]:
        # Brightness is measured in a 2-pixel (12.3″) aperture at the target.
        return {label for label, sep in self.seps.items() if sep <= MATCH_ARCSEC}

    def where(self) -> str:
        parts = [
            f"{_angle(sep)} from the target in frame {label}"
            for label, sep in sorted(self.seps.items(), reverse=True)
        ]
        return f"{self.name} is predicted " + " and ".join(parts)

    def brightness_reason(self) -> str | None:
        """Why the brightness at the target differs between B and A, when this body explains it."""
        if len(self.inside) != 1 or len(self.seps) != 2:
            return None
        here = next(iter(self.inside))
        other = "A" if here == "B" else "B"
        return (
            f"the brightness measured at the target includes the light of {self.name} in frame "
            f"{here} but not in frame {other}: the difference comes from its motion, not from a "
            "change in the sky"
        )


def _offsets(body: dict[str, Any], t: ViewTarget, frames: dict[str, str]) -> _Offsets | None:
    seps: dict[str, float] = {}
    for label, key in frames.items():
        pos = next((p for p in body["positions"] if p["key"] == key), None)
        if pos is not None:
            seps[label] = _sep_arcsec(t.ra, t.dec, pos["ra"], pos["dec"])
    return _Offsets(str(body["name"]), seps) if seps else None


def _plural(n: int, one: str, many: str | None = None) -> str:
    return f"{n} {one if n == 1 else many or one + 's'}"


def add_view(ev: Evidence, svc: Services, view: ViewContext, source: Source) -> None:
    store = svc.store
    if view.target is None:
        return
    t = view.target
    info = describe(t.ra, t.dec)
    name = t.name or f"RA {t.ra:.4f}°, Dec {t.dec:+.4f}°"
    ev.add(
        "view",
        f"Target on screen — {name}",
        f"RA {info['raHms']}, Dec {info['decDms']} (ICRS), in {info['constellation']}; "
        "ecliptic latitude "
        f"{info['ecliptic']['lat']:.1f}°, galactic latitude {info['galactic']['b']:.1f}°"
        + (f"; inside the {info['deepField']}" if info["deepField"] else "")
        + ".",
        "Explore",
    )
    target_object = store.peek("object", object_key(t.ra, t.dec, DEFAULT_OBJECT_RADIUS_DEG), source)
    if catalogued(target_object):
        ev.add(
            "view",
            "Catalogued at the target",
            catalogue_text(target_object),
            "SIMBAD, CDS, Strasbourg",
        )
    obs = store.peek(
        "observations", observations_key(t.ra, t.dec, svc.settings.wide_collections, None), source
    )
    if obs:
        s = obs["summary"]
        if s["frames"]:
            ev.add(
                "view",
                "SPHEREx coverage",
                f"{s['frames']} frames in {s['passes']} survey passes between "
                f"{_date(s['first'])} and "
                f"{_date(s['last'])} (wide survey, Quick Releases 2 and 3).",
                "IRSA image search",
            )
    if view.fov is None:
        return
    grid = make_grid(t.ra, t.dec, view.fov)

    # The frames on screen (B, and A when comparing), and the sequence they belong to.
    shown: dict[str, str] = {}
    for label, key in (("B", view.frameKey), ("A", view.referenceKey)):
        if not key or (label == "A" and view.compare in (None, "single")):
            continue
        try:
            shown[label] = FrameKey.parse(key).key
        except ExplorerError:
            continue
    parsed: set[str] = set()
    for k in view.sequenceKeys:
        try:
            parsed.add(FrameKey.parse(k).key)
        except ExplorerError:
            continue
    # The same key set the known-object and search routes cache under.
    keys = sorted(parsed)
    known = (
        store.peek("known", known_key(t.ra, t.dec, view.fov, keys, 20.0), source) if keys else None
    )
    bodies: list[dict[str, Any]] = known["objects"] if known else []
    offsets = [o for o in (_offsets(b, t, shown) for b in bodies[:3]) if o is not None]

    payloads: dict[str, dict[str, Any]] = {}
    for label, key in shown.items():
        p = store.peek("cutout", cutout_key(key, grid), source)
        if p is None:
            ev.notes.append(f"Frame {label} has not loaded yet.")
            continue
        payloads[label] = p
        if label == "B":
            title = "Frame on screen" if "A" not in shown else "Frame on screen (B)"
            if view.frameIndex is not None and view.frameCount:
                title += f" (frame {view.frameIndex + 1} of {view.frameCount} in this sequence)"
        else:
            title = "Reference frame (A)"
        ev.add("view", title, _frame_text(p), "SPHEREx Level 2 image, measured by this app")
    if "A" in payloads and "B" in payloads and shown["A"] != shown["B"]:
        reason = next((r for r in (o.brightness_reason() for o in offsets) if r), None)
        ev.add(
            "view",
            "Comparison of A and B",
            _compatibility(payloads["A"], payloads["B"], reason),
            "Comparison rules",
        )

    if not keys:
        return
    if view.sequenceMode == "wavelength":
        ev.notes.append(
            "JPL's check and the moving-source search work on one survey pass; this view shows one "
            "wavelength across passes months apart."
        )
        return
    if known is not None:
        if bodies:
            lines = []
            for b in bodies[:5]:
                inside = [p for p in b["positions"] if p["inField"]]
                here = any(p["key"] == shown.get("B") and p["inField"] for p in b["positions"])
                rate = (
                    f", moving about {b['rateArcsecPerHour']:.0f}″ per hour"
                    if b.get("rateArcsecPerHour")
                    else ""
                )
                vmag = f" (V {b['vmag']:.1f})" if b.get("vmag") is not None else ""
                lines.append(
                    f"{b['name']}{vmag}{rate}, predicted inside the field in {len(inside)} of "
                    f"{len(b['positions'])} frames"
                    + (", including the frame on screen" if here else "")
                )
            where = "; ".join(o.where() for o in offsets)
            ev.add(
                "jpl",
                "JPL known objects in this field",
                "; ".join(lines)
                + ". These are predictions for catalogued objects, not detections."
                + (f" {where}." if where else ""),
                "NASA/JPL SBIdent and Horizons",
            )
        else:
            ev.add(
                "jpl",
                "JPL known objects in this field",
                f"JPL knows no asteroid or comet brighter than V {known['searched']['vmagLimit']} "
                "in this field during this pass.",
                "NASA/JPL SBIdent",
            )
    else:
        ev.notes.append("The JPL known-object check has not been run for this pass.")
    found = store.peek("candidates", candidates_key(t.ra, t.dec, grid.size_px, keys), source)
    if found is not None:
        st = found["stats"]
        strong = [c for c in found["candidates"] if c["strength"] == "candidate"]
        weak = [c for c in found["candidates"] if c["strength"] != "candidate"]
        parts = [
            f"{_plural(st['detections'], 'source')} detected, {st['transient']} not seen again at "
            f"the same place, {st['sightings']} repeated within a pointing; "
            f"{_plural(len(strong), 'candidate')} and {_plural(len(weak), 'weak candidate')}"
        ]
        for c in strong + weak[:2]:
            m = _match(c, bodies)
            verdict = (
                f"matches JPL's prediction for {m[0]} within {m[1]:.1f}″ (a known object)"
                if m
                else (
                    "no JPL match (unconfirmed; most often an artefact)"
                    if known is not None
                    else "not yet compared with JPL"
                )
            )
            parts.append(
                f"{c['id']} ({c['strength']}): {len(c['sightings'])} sightings at about "
                f"{c['rateArcsecPerHour']:.0f}″ per hour, {verdict}"
            )
        ev.add(
            "search",
            "Moving-source search in this pass",
            "; ".join(parts) + ".",
            "SPHEREx Explorer moving-source search",
        )
    else:
        ev.notes.append("The moving-source search has not been run for this pass.")


# ---------------------------------------------------------------------------------------------
# What the question asks for

_MOVING = (
    "moved",
    "moving",
    "move ",
    "asteroid",
    "comet",
    "motion",
    "jump",
    "track",
    "planet x",
    "planet nine",
    "solar system",
)
_SPECTRUM = ("spectrum", "spectra", "colour", "color", "102", "many wavelengths", "infrared light")
_CONTEXT = (
    "most observed",
    "deep field",
    "ecliptic pole",
    "observed most",
    "most watched",
    "every orbit",
)
_ANY = (
    "interesting",
    "example",
    "something cool",
    "show me something",
    "what can i see",
    "where should i start",
    "surprise",
)
_NAME = re.compile(
    r"\b(?:show me|find|where is|take me to|go to|open|look at|search for|zoom to|view)\s+"
    r"(?:the\s+)?(?P<name>[^?.!,;]{2,60})",
    re.I,
)
_NOT_A_NAME = re.compile(
    r"^(something|anything|a |an |region|where|what|how|me\b|it\b|this|that|here|there|more"
    r"|some|all|why)",
    re.I,
)
# "Tell me about the Orion Nebula", "what is M31?", "how far away is Betelgeuse?". Only proper
# names count here (a capital letter or a digit first), so "what is a linear variable filter?" is
# not looked up; the app's own terms are answered from the knowledge notes instead.
_ABOUT = re.compile(
    r"\b(?:tell me (?:more )?about|what(?:'s|’s| is| are| kind of object is)|who is|facts about"
    r"|info(?:rmation)? (?:on|about)|describe|how (?:far|big|old|bright|large|hot|massive)"
    r"(?: away)? (?:is|are))\s+(?:the\s+)?(?P<name>[^?.!,;]{2,60})",
    re.I,
)
_APP_TERMS = {
    "spherex",
    "spherex explorer",
    "jpl",
    "irsa",
    "nasa",
    "ipac",
    "qr2",
    "qr3",
    "psf",
    "lvf",
    "planet x",
    "planet nine",
    "planet 9",
    "sesame",
    "simbad",
    "horizons",
    "sbident",
    "mjy/sr",
    "ab magnitude",
    "ra",
    "dec",
    "a",
    "b",
    "e1",
    "k1",
}
_TRAILING = re.compile(
    r"\s+(?:in|with|on|using|from|and|for|seen|as|at|to|by|according|compared)\b.*$", re.I
)


def named_object(question: str) -> str | None:
    """The object a question names, if any: "show me M31", "tell me about the Orion Nebula"."""
    for pattern, proper in ((_NAME, False), (_ABOUT, True)):
        m = pattern.search(question)
        if not m:
            continue
        name = _TRAILING.sub("", m.group("name").strip()).strip().rstrip(".").strip()
        if not name or _NOT_A_NAME.match(name) or len(name.split()) > 5:
            continue
        if name.lower() in _APP_TERMS or name.lower().startswith(("spherex", "this ", "that ")):
            continue
        if proper and not re.match(r"[A-Z0-9]", name):
            continue
        return name
    return None


def question_position(question: str) -> tuple[float, float, str] | None:
    """Coordinates written in a question, as (RA, Dec, a label)."""
    for m in _COORDS.finditer(question):
        try:
            pos = coords.parse(m.group("c"))
        except ExplorerError:
            continue
        if pos is not None:
            return pos.ra, pos.dec, f"RA {pos.ra:.4f}°, Dec {pos.dec:+.4f}°"
    return None


_COORDS = re.compile(
    r"(?P<c>\d{1,3}(?:[.:\s]\d+){0,2}\.?\d*[\s,]+[+\-−]?\d{1,2}(?:[.:\s]\d+){0,2}\.?\d*)"
)


def _load_cases(svc: Services) -> list[dict[str, Any]]:
    try:
        return list(json.loads(svc.settings.cases_file.read_text()).get("cases", []))
    except (OSError, ValueError):
        return []


def add_cases(ev: Evidence, svc: Services, question: str, source: Source) -> None:
    q = f" {question.lower()} "
    wanted: list[str] = []
    if any(k in q for k in _MOVING):
        wanted.append("moving")
    if any(k in q for k in _SPECTRUM):
        wanted.append("spectrum")
    if any(k in q for k in _CONTEXT):
        wanted.append("context")
    if not wanted and any(k in q for k in _ANY):
        wanted = ["moving", "spectrum", "context"]
    if not wanted:
        return
    for case in [c for c in _load_cases(svc) if c.get("kind") in wanted][:3]:
        first = case["evidence"][0] if case.get("evidence") else ""
        ev.add(
            "case",
            f"Discover case — {case['title']}",
            f"{case['summary']} {first}".strip(),
            "Discover",
        )
        ev.actions.append(Action(f"Open: {case['title']}", case_link(case, source)))


async def add_lookup(ev: Evidence, svc: Services, question: str, source: Source) -> None:
    """A position or a named object in the question: where it is, what the catalogues say about
    it, how often SPHEREx saw it, and a link to explore it. Reads the cache only; ``live.gather``
    fetches what is missing before the evidence is built."""
    position = question_position(question)
    if position is not None:
        ra, dec, label = position
        info = describe(ra, dec)
        ev.add(
            "lookup",
            "Position in your question",
            f"RA {info['raHms']}, Dec {info['decDms']}, in {info['constellation']}.",
            "Coordinates",
        )
        _add_catalogue(ev, svc, ra, dec, "Catalogued at that position", source)
        _add_coverage(ev, svc, ra, dec, label, source)
        params = {"ra": f"{ra:.6f}", "dec": f"{dec:.6f}"}
        if source == "snapshot":
            params["source"] = "snapshot"
        ev.actions.append(Action(f"Explore {label}", "/explore?" + urlencode(params)))
        return
    name = named_object(question)
    if name is None:
        return
    hit: dict[str, Any] | None = svc.store.peek("resolve", resolve_key(name), source)
    if hit is None:
        return
    label = hit.get("name") or name
    kind = f" ({hit['kind']})" if hit.get("kind") else ""
    ev.add(
        "lookup",
        f"Looking up “{name}”",
        f"{label}{kind} is at RA {hit['ra']:.4f}°, Dec {hit['dec']:+.4f}° according to CDS Sesame.",
        "CDS Sesame",
    )
    _add_catalogue(
        ev, svc, float(hit["ra"]), float(hit["dec"]), f"Catalogue facts — {label}", source
    )
    _add_coverage(ev, svc, float(hit["ra"]), float(hit["dec"]), str(label), source)
    ev.actions.append(
        Action(
            f"Explore {label}",
            "/explore?"
            + urlencode({"q": name} if source == "live" else {"q": name, "source": "snapshot"}),
        )
    )


def _light_years(ly: float) -> str:
    if ly >= 1e9:
        return f"{ly / 1e9:.3g} billion light-years"
    if ly >= 1e6:
        return f"{ly / 1e6:.3g} million light-years"
    return f"{ly:,.0f} light-years" if ly >= 100 else f"{ly:.3g} light-years"


def catalogued(entry: dict[str, Any] | None) -> TypeGuard[dict[str, Any]]:
    """Whether a cached SIMBAD entry names an object. An entry can also record that nothing is
    catalogued at a position ({"object": null}), so the lookup is not repeated."""
    return bool(entry) and isinstance(entry, dict) and bool(entry.get("id"))


def catalogue_text(obj: dict[str, Any]) -> str:
    """SIMBAD's answer for an object, as one line of evidence."""
    display = obj.get("name") or obj["id"]
    parts = [f"{display} is catalogued as {str(obj.get('typeLabel') or obj.get('otype')).lower()}"]
    if obj.get("name") and obj["name"] != obj["id"]:
        parts[0] += f" (SIMBAD main identifier {obj['id']})"
    aliases = [a for a in obj.get("aliases", []) if a not in (obj.get("name"), obj["id"])][:4]
    if aliases:
        parts.append("also known as " + ", ".join(aliases))
    if obj.get("morphology"):
        parts.append(f"morphological type {obj['morphology']}")
    if obj.get("spectralType"):
        parts.append(f"spectral type {obj['spectralType']}")
    d = obj.get("distance")
    if d:
        parts.append(
            f"distance about {d['value']:g} {d['unit']} ({_light_years(float(d['lightYears']))}, "
            f"from {d['method']})"
        )
    z = obj.get("redshift")
    if z is not None and z > 0.01:
        parts.append(f"redshift {z:g}")
    size = obj.get("size")
    if size and size.get("majorArcmin"):
        minor = f" × {size['minorArcmin']:g}′" if size.get("minorArcmin") else ""
        parts.append(f"about {size['majorArcmin']:g}′{minor} across on the sky")
    mags = {k: v for k, v in (obj.get("magnitudes") or {}).items() if v is not None}
    shown = [f"{band} {mags[band]:g}" for band in ("V", "G", "K") if band in mags]
    if shown:
        parts.append("magnitudes " + ", ".join(shown))
    if obj.get("references"):
        parts.append(f"{obj['references']:,} papers refer to it")
    sep = obj.get("separationArcsec")
    if sep is not None and sep > 6:
        parts.append(f"its catalogued position is {sep:.0f}″ from the one asked about")
    return "; ".join(parts) + "."


def _add_catalogue(
    ev: Evidence, svc: Services, ra: float, dec: float, title: str, source: Source
) -> None:
    obj = svc.store.peek("object", object_key(ra, dec, DEFAULT_OBJECT_RADIUS_DEG), source)
    if catalogued(obj):
        ev.add("lookup", title, catalogue_text(obj), "SIMBAD, CDS, Strasbourg")


def _add_coverage(
    ev: Evidence, svc: Services, ra: float, dec: float, label: str, source: Source
) -> None:
    obs = svc.store.peek(
        "observations", observations_key(ra, dec, svc.settings.wide_collections, None), source
    )
    if not obs:
        return
    s = obs["summary"]
    text = (
        f"{s['frames']} frames in {s['passes']} survey passes between {_date(s['first'])} and "
        f"{_date(s['last'])} (wide survey, Quick Releases 2 and 3)."
        if s["frames"]
        else "no SPHEREx frames in the public Quick Releases cover this position yet."
    )
    ev.add("lookup", f"SPHEREx coverage of {label}", text, "IRSA image search")


def add_knowledge(ev: Evidence, question: str, limit: int = 3) -> None:
    for entry in knowledge.search(question, limit=limit):
        ev.add("method", entry.title, entry.text, entry.source)


_FRESHNESS = (
    "live",
    "real time",
    "real-time",
    "realtime",
    "latest",
    "up to date",
    "up-to-date",
    "current",
    "fresh",
    "snapshot",
    "demo",
    "recorded",
    "cached",
    "how old",
    "how recent",
    "coming from",
    "where does the data",
    "source of the data",
)


def add_data_mode(
    ev: Evidence, svc: Services, question: str, view: ViewContext | None, source: Source
) -> None:
    """Where this answer's data came from, for questions about whether it is live."""
    q = question.lower()
    if not any(w in q for w in _FRESHNESS):
        return
    retrieved = None
    if view is not None and view.target is not None:
        obs = svc.store.peek(
            "observations",
            observations_key(view.target.ra, view.target.dec, svc.settings.wide_collections, None),
            source,
        )
        retrieved = obs.get("retrievedAt") if obs else None
    when = f" on {_date(retrieved)}" if retrieved else ""
    if source == "snapshot":
        text = (
            f"this view uses the demo snapshot: real SPHEREx data recorded from IRSA{when}. "
            "Nothing is fetched live in this mode; choose live data to query the archive now."
        )
    else:
        listed = f" (this position's images were listed{when})" if when else ""
        text = (
            "live: the frames, JPL's predictions and the catalogue facts are fetched from IRSA, "
            f"JPL and CDS when they are first needed{listed}, and reused from the server's cache "
            "afterwards."
        )
    ev.add("view", "Data mode", text, "This app")


async def build(svc: Services, question: str, view: ViewContext | None, source: Source) -> Evidence:
    ev = Evidence()
    add_data_mode(ev, svc, question, view, source)
    if view is not None:
        add_view(ev, svc, view, source)
    await add_lookup(ev, svc, question, source)
    add_cases(ev, svc, question, source)
    add_knowledge(ev, question)
    return ev
