"""Subtitles for the film from the narration as placed (build/vo/lines.json): an .srt for players
and an .ass file styled for burning in. Long lines are split at sentence or clause breaks, timed
by their share of the characters."""

import json
import re
from pathlib import Path

FILM = Path(__file__).resolve().parents[1]
OUT = FILM / "build" / "delivery"


def pieces(text, a, b, limit=62):
    """Split at the sentence or clause break nearest the middle (else the middle word), recursively."""
    if len(text) <= limit:
        return [(text, a, b)]
    # Punctuation is the best place to break; before a joining word is next best.
    breaks = [(m.end(), 0) for m in re.finditer(r"[.?!:,;]\s+", text)]
    breaks += [(m.start() + 1, 8) for m in re.finditer(r"\s(?=(because|who|and|so|between|of|live|to)\b)", text)]
    breaks = [(i, w) for i, w in breaks if 12 <= i <= len(text) - 12]
    if breaks:
        cut = min(breaks, key=lambda b: abs(b[0] - len(text) / 2) + b[1])[0]
    else:
        spaces = [m.start() for m in re.finditer(" ", text)]
        cut = min(spaces, key=lambda i: abs(i - len(text) / 2)) + 1
    left, right = text[:cut].strip(), text[cut:].strip()
    mid = a + (b - a) * len(left) / (len(left) + len(right))
    return pieces(left, a, mid, limit) + pieces(right, mid, b, limit)


def stamp(t, sep=","):
    h, r = divmod(t, 3600)
    m, s = divmod(r, 60)
    return f"{int(h):02d}:{int(m):02d}:{int(s):02d}{sep}{int(round((s - int(s)) * 1000)):03d}"


def ass_stamp(t):
    h, r = divmod(t, 3600)
    m, s = divmod(r, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def main():
    lines = json.loads((FILM / "build" / "vo" / "lines.json").read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    cues = []
    for ln in lines:
        cues.extend(pieces(ln["text"].replace("…", "").strip(), ln["at"] - 0.05, ln["end"] + 0.35))
    srt = []
    for i, (txt, a, b) in enumerate(cues, 1):
        srt.append(f"{i}\n{stamp(a)} --> {stamp(b)}\n{txt}\n")
    (OUT / "SPHEREx-Explorer-film.en.srt").write_text("\n".join(srt))
    head = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Plus Jakarta Sans,38,&H00F4F4F4,&H000000FF,&H00000000,&H96000000,0,0,0,0,100,100,0.4,0,1,0,1.5,2,200,200,46,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ev = [f"Dialogue: 0,{ass_stamp(a)},{ass_stamp(b)},Default,,0,0,0,,{{\\fad(120,160)}}{txt}" for txt, a, b in cues]
    (OUT / "captions.ass").write_text(head + "\n".join(ev) + "\n")
    print(f"✓ {len(cues)} captions")


if __name__ == "__main__":
    main()
