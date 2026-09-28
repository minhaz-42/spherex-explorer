"""Checking a reply's numbers against the evidence it was given.

A small local model can misquote a number or invent one. Every number in the reply is looked for
in the evidence and core facts, allowing for rounding ("0.38" for 0.379) and for the unit changes
the app itself makes (µJy, mJy, Jy). Numbers that cannot be found are reported with the reply, so
the visitor can see what was not checked; nothing is silently corrected.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# A number not glued to letters or other digits: skips "D2", "E3", "QR3", "2025W49", "±", tags.
_NUMBER = re.compile(
    # 1,475 or 12 015 819 (grouped thousands), else a plain integer or decimal.
    r"(?<![\w.])[-−+]?\d{1,3}(?:[,\u202f]\d{3})+(?:\.\d+)?(?![\w.])"
    r"|(?<![\w.])[-−+]?\d+(?:\.\d+)?(?![\w])"
)
_TAG = re.compile(r"\[[EKC]\d+\]")
# Unit scalings the app uses: a value may be restated in another flux unit.
_SCALES = (1.0, 1e3, 1e-3, 1e6, 1e-6)


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


@dataclass(frozen=True)
class Grounding:
    checked: int
    unverified: list[str]

    def to_json(self) -> dict[str, object]:
        return {"checked": self.checked, "unverified": self.unverified}


def check(reply: str, evidence_text: str, question: str = "") -> Grounding:
    """Which numbers in ``reply`` do not appear, within rounding, in the evidence or question."""
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
    return Grounding(checked=checked, unverified=unverified)
