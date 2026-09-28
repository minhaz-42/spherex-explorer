"""Answers without a language model, from the same evidence.

When no local model is running, the assistant still helps: it describes the view on screen,
returns the most relevant method note, and offers the links the question asked for. It never
guesses: it only rearranges the evidence.
"""

from __future__ import annotations

from .evidence import Evidence


def answer(question: str, ev: Evidence) -> str:
    view = [i for i in ev.items if i.kind in ("view", "jpl", "search")]
    lookups = [i for i in ev.items if i.kind == "lookup"]
    cases = [i for i in ev.items if i.kind == "case"]
    methods = [i for i in ev.items if i.kind == "method"]
    parts: list[str] = []

    if lookups:
        parts.append(" ".join(f"{i.text} [{i.tag}]" for i in lookups))
    if cases:
        titles = "; ".join(i.title.removeprefix("Discover case — ") for i in cases)
        parts.append(
            f"These Discover cases fit your question: {titles}. "
            f"Each opens in the viewer. [{cases[0].tag}]"
        )
    if methods and not (cases or lookups):
        top = methods[0]
        parts.append(f"{top.title}. {top.text} [{top.tag}]")
        if len(methods) > 1:
            parts.append("See also: " + "; ".join(m.title for m in methods[1:]) + ".")
    if view and not (lookups or cases) and (not methods or _asks_about_view(question)):
        parts = [" ".join(f"{i.title}: {i.text} [{i.tag}]" for i in view[:4])] + (
            parts if methods else []
        )
    if ev.notes and view:
        parts.append(" ".join(ev.notes))
    if not parts:
        parts.append(
            "I can explain what is on screen, how SPHEREx and this app work, and point you to "
            "interesting cases. Try “What am I looking at?”, “What is a linear variable filter?” "
            "or “Show me something that moved”."
        )
    return "\n\n".join(parts)


_VIEW_WORDS = (
    "this",
    "here",
    "looking at",
    "on screen",
    "frame",
    "image",
    "view",
    "what changed",
    "a and b",
    "moved",
)


def _asks_about_view(question: str) -> bool:
    q = question.lower()
    return any(w in q for w in _VIEW_WORDS)
