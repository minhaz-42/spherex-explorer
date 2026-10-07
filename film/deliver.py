"""Put picture and sound together: build/video/picture.mp4 + build/audio/master*.wav →
build/delivery/

  SPHEREx-Explorer-film.mp4            the film, narrated
  SPHEREx-Explorer-film-captioned.mp4  the same with English captions burned in
  SPHEREx-Explorer-film-no-voice.mp4   music and effects only, to narrate live
  SPHEREx-Explorer-film.en.srt         captions for players that take a sidecar file
  poster.jpg                           a still for thumbnails

and check every file is under four minutes.
"""

import json
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
FILM = Path(__file__).resolve().parent
B = FILM / "build"
OUT = B / "delivery"
LIMIT_S = 240.0
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
    for suffix, wav in audio.items():
        dst = OUT / f"SPHEREx-Explorer-film{suffix}.mp4"
        run(["-i", str(pic), "-i", str(wav), "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "320k",
             "-shortest", "-movflags", "+faststart", *META, str(dst)])
        print("✓", dst.name)
    # Captions burned in: a re-encode of the picture with the narration's text at the bottom.
    ass = OUT / "captions.ass"
    dst = OUT / "SPHEREx-Explorer-film-captioned.mp4"
    vf = f"subtitles={ass}:fontsdir={FILM / 'render' / 'fonts'}"
    run(["-i", str(pic), "-i", str(audio[""]), "-map", "0:v", "-map", "1:a", "-vf", vf, "-c:v", "libx264", "-preset", "slow",
         "-crf", "16", "-pix_fmt", "yuv420p", "-tune", "film", "-c:a", "aac", "-b:a", "320k", "-shortest", "-movflags", "+faststart",
         *META, str(dst)])
    print("✓", dst.name)
    run(["-ss", "51.9", "-i", str(pic), "-frames:v", "1", "-q:v", "2", str(OUT / "poster.jpg")])
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
