"""Checking a reply's numbers against the evidence it was given.

A small local model can misquote a number or invent one. Every number in the reply is looked for
in the evidence and core facts, allowing for rounding ("0.38" for 0.379) and for the unit changes
the app itself makes (µJy, mJy, Jy), and every month-and-year pair ("May 2025") is looked for as a
pair. Whatever cannot be found is reported with the reply, so the visitor can see what was not
checked; nothing is silently corrected.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

# A number not glued to letters or other digits: skips "D2", "E3", "QR3", "2025W49", "±", tags.
_NUMBER = re.compile(
    # 1,475 or 12 015 819 (grouped thousands), else a plain integer or decimal.
    r"(?<![\w.])[-−+]?\d{1,3}(?:[,\u202f]\d{3})+(?:\.\d+)?(?![\w.])"
    r"|(?<![\w.])[-−+]?\d+(?:\.\d+)?(?![\w])"
)
_TAG = re.compile(r"\[[EKC]\d+\]")
# Unit scalings the app uses: a value may be restated in another flux unit.
_SCALES = (1.0, 1e3, 1e-3, 1e6, 1e-6)


# "May 2025", "Dec. 2025", "December, 2025": a month and year a reply can misquote as a pair even
# when each number appears somewhere in the evidence.
_MONTH_YEAR = re.compile(
    r"\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+((?:19|20)\d\d)\b", re.I
)


def month_years(text: str) -> list[tuple[str, tuple[str, str]]]:
    return [(m.group(0), (m.group(1).lower(), m.group(2))) for m in _MONTH_YEAR.finditer(text)]


def numbers_in(text: str) -> list[str]:
    return [m.group(0) for m in _NUMBER.finditer(_TAG.sub(" ", text))]


def _value(token: str) -> float | None:
    t = token.replace("−", "-").replace(",", "").replace(" ", "")
    try:
        return float(t)
    except ValueError:
        return None


def _decimals(token: str) -> int:
    return len(token.split(".", 1)[1]) if "." in token else 0


_CITATION = re.compile(r"\[([^\]\n]{1,40})\]")
_EVIDENCE_TAG = re.compile(r"^[EK]\d{1,2}$")


def cited_tags(reply: str) -> list[str]:
    """Evidence tags cited in a reply: "[E2]", "[E1, K3]"."""
    tags: list[str] = []
    for m in _CITATION.finditer(reply):
        for part in m.group(1).split(","):
            tag = part.strip()
            if _EVIDENCE_TAG.match(tag) and tag not in tags:
                tags.append(tag)
    return tags


@dataclass(frozen=True)
class Grounding:
    checked: int
    unverified: list[str]
    # Cited tags that are not among the evidence given with the question.
    unknown_tags: list[str] = field(default_factory=list)

    def to_json(self) -> dict[str, object]:
        return {
            "checked": self.checked,
            "unverified": self.unverified,
            "unknownTags": self.unknown_tags,
        }


def check(
    reply: str, evidence_text: str, question: str = "", tags: set[str] | None = None
) -> Grounding:
    """Which numbers in ``reply`` do not appear, within rounding, in the evidence or question.

    With ``tags``, also which cited evidence tags do not exist.
    """
    known = [
        v for v in (_value(t) for t in numbers_in(evidence_text + " " + question)) if v is not None
    ]
    unverified: list[str] = []
    checked = 0
    for token in numbers_in(reply):
        value = _value(token)
        if value is None:
            continue
        # Small whole numbers ("two frames", "step 1 of 4", list numbering) are not checked.
        if value == int(value) and abs(value) <= 10 and "." not in token:
            continue
        checked += 1
        places = _decimals(token)
        tolerance = 0.5 * 10 ** (-places) + 1e-9
        found = False
        for k in known:
            for scale in _SCALES:
                candidate = abs(k) * scale
                # Rounded to the reply's precision, or within 0.5 % for three-figure restatements.
                if abs(candidate - abs(value)) <= tolerance or (
                    candidate and abs(candidate - abs(value)) / candidate < 0.005
                ):
                    found = True
                    break
            if found:
                break
        if not found:
            unverified.append(token)
    known_dates = {pair for _, pair in month_years(evidence_text + " " + question)}
    for token, pair in month_years(reply):
        checked += 1
        if pair not in known_dates:
            unverified.append(token)
    unknown = [t for t in cited_tags(reply) if tags is not None and t not in tags]
    return Grounding(checked=checked, unverified=unverified, unknown_tags=unknown)
