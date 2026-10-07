"""Synthesise the narration, one WAV per line, with the Kokoro voice model.

Writes build/vo/<id>.wav (48 kHz mono, silence trimmed) and build/vo/lines.json with each line's
duration, so the mixer and the subtitles can place it. A recorded human take replaces a line: put
it at voice/<id>.wav and it is used instead of the synthetic one.
"""

import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

FILM = Path(__file__).resolve().parents[1]
OUT = FILM / "build" / "vo"
HUMAN = FILM / "voice"
RATE = 48000


def trim(x: np.ndarray, rate: int, floor_db: float = -45.0, pad_s: float = 0.04) -> np.ndarray:
    """Cut leading and trailing silence, keeping a short pad so consonants are not clipped."""
    win = int(rate * 0.01)
    env = np.sqrt(np.convolve(x**2, np.ones(win) / win, mode="same"))
    loud = np.where(env > 10 ** (floor_db / 20) * max(np.abs(x).max(), 1e-9))[0]
    if loud.size == 0:
        return x
    pad = int(rate * pad_s)
    return x[max(loud[0] - pad, 0) : loud[-1] + pad]


def main() -> None:
    script = json.loads((FILM / "script.json").read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    only = set(sys.argv[1:])
    kokoro = None
    lines = []
    for line in script["lines"]:
        dest = OUT / f"{line['id']}.wav"
        human = HUMAN / f"{line['id']}.wav"
        if human.exists():
            audio, rate = sf.read(human, always_2d=True)
            audio = audio.mean(axis=1)
            source = "recorded"
        elif only and line["id"] not in only and dest.exists():
            audio, rate = sf.read(dest)
            source = "synthetic"
        else:
            if kokoro is None:
                from kokoro_onnx import Kokoro

                kokoro = Kokoro(str(FILM / "models" / "kokoro-v1.0.onnx"), str(FILM / "models" / "voices-v1.0.bin"))
            audio, rate = kokoro.create(line["say"], voice=script["voice"], speed=script["speed"], lang="en-us")
            source = "synthetic"
        if rate != RATE:
            audio = resample_poly(audio, RATE, rate)
            rate = RATE
        audio = trim(np.asarray(audio, dtype=np.float64), rate)
        audio = audio / max(np.abs(audio).max(), 1e-9) * 0.89
        sf.write(dest, audio.astype(np.float32), rate)
        dur = len(audio) / rate
        lines.append({**line, "dur": round(dur, 3), "end": round(line["at"] + dur, 3), "source": source})
        print(f"{line['id']}  {line['at']:7.2f} → {line['at'] + dur:7.2f}  ({dur:4.2f}s, {source})  {line['text'][:60]}")

    for a, b in zip(lines, lines[1:]):
        if a["end"] + 0.25 > b["at"]:
            print(f"  ! {a['id']} ends at {a['end']:.2f}, too close to {b['id']} at {b['at']:.2f}")
    (OUT / "lines.json").write_text(json.dumps(lines, indent=1))


if __name__ == "__main__":
    main()
