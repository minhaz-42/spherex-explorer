"""Put picture and sound together: build/video/picture.mp4 + build/audio/master*.wav →
build/delivery/

  SPHEREx-Explorer-film.mp4            the film, narrated
  SPHEREx-Explorer-film-captioned.mp4  the same with English captions burned in
  SPHEREx-Explorer-film-no-voice.mp4   music and effects only, to narrate live
  SPHEREx-Explorer-film.en.srt         captions for players that take a sidecar file
  poster.jpg                           a still for thumbnails

and check every file is under four minutes.

CUT=short (the 30-second film) and CUT=demo (the app demonstration) deliver those cuts from
build/<cut>/ in the same way, each with its own name and limit. A cut without narration gets one
file, with its music.
"""

import json
import os
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
FILM = Path(__file__).resolve().parent
CUT = os.environ.get("CUT", "")
B = FILM / "build" / CUT
OUT = B / "delivery"
NAME = {"": "SPHEREx-Explorer-film", "short": "SPHEREx-Explorer-30s", "demo": "SPHEREx-Explorer-app-demo"}.get(CUT, f"SPHEREx-Explorer-{CUT}")
LIMIT_S = {"": 240.0, "short": 30.0}.get(CUT, 3600.0)
EDIT = FILM / "cuts" / CUT / "edit.json" if CUT else FILM / "edit.json"
META = ["-metadata", "title=SPHEREx Explorer", "-metadata", "comment=NASA Space Apps Challenge 2026 pitch film. SPHEREx data: NASA/JPL-Caltech/IPAC."]


def run(args):
    subprocess.run([FF, "-y", "-loglevel", "error", *args], check=True)


def duration(path):
    out = subprocess.run([FF, "-hide_banner", "-i", str(path)], capture_output=True, text=True).stderr
    hms = out.split("Duration: ")[1].split(",")[0]
    h, m, s = hms.split(":")
    return int(h) * 3600 + int(m) * 60 + float(s)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    pic = B / "video" / "picture.mp4"
    audio = {"": B / "audio" / "master.wav", "-no-voice": B / "audio" / "master_no_voice.wav"}
    narrated = (B / "vo" / "lines.json").exists() and json.loads((B / "vo" / "lines.json").read_text())
    if not narrated:
        audio.pop("-no-voice")
    for suffix, wav in audio.items():
        dst = OUT / f"{NAME}{suffix}.mp4"
        run(["-i", str(pic), "-i", str(wav), "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "320k",
             "-shortest", "-movflags", "+faststart", *META, str(dst)])
        print("✓", dst.name)
    # Captions burned in: a re-encode of the picture with the narration's text at the bottom.
    if narrated:
        ass = OUT / "captions.ass"
        dst = OUT / f"{NAME}-captioned.mp4"
        vf = f"subtitles={ass}:fontsdir={FILM / 'render' / 'fonts'}"
        run(["-i", str(pic), "-i", str(audio[""]), "-map", "0:v", "-map", "1:a", "-vf", vf, "-c:v", "libx264", "-preset", "slow",
             "-crf", "16", "-pix_fmt", "yuv420p", "-tune", "film", "-c:a", "aac", "-b:a", "320k", "-shortest", "-movflags", "+faststart",
             *META, str(dst)])
        print("✓", dst.name)
    # The poster: the main film's is the name, crisp, under the dark field (51.9 s on the source
    # timeline); another cut names its moment in its edit.json ("poster", on its own clock).
    edit = json.loads(EDIT.read_text())
    t, at = edit.get("poster"), 0.0
    for p in edit["pieces"]:
        d = p.get("dur") or p["src"][1] - p["src"][0]
        if t is None and not CUT and "src" in p and p["src"][0] <= 51.9 < p["src"][1]:
            t = at + 51.9 - p["src"][0]
        at += d
    t = t if t is not None else at / 2
    run(["-ss", f"{t:.2f}", "-i", str(pic), "-frames:v", "1", "-q:v", "2", str(OUT / "poster.jpg")])
    print("✓ poster.jpg")
    ok = True
    for f in sorted(OUT.glob("*.mp4")):
        d = duration(f)
        flag = "OK" if d < LIMIT_S else "TOO LONG"
        ok &= d < LIMIT_S
        print(f"  {f.name}: {int(d // 60)}:{d % 60:05.2f}  {f.stat().st_size / 1e6:.0f} MB  {flag}")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
