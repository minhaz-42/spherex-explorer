"""Loudness-normalise the mixes for delivery: -14 LUFS integrated, -1 dBTP (two-pass loudnorm),
48 kHz stereo. build/audio/{mix,bed}_pre.wav → build/audio/{master,master_no_voice}.wav"""

import json
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
A = Path(__file__).resolve().parents[1] / "build" / "audio"
TARGET = "I=-14:TP=-1.0:LRA=11"


def master(src: Path, dst: Path) -> None:
    probe = subprocess.run([FF, "-hide_banner", "-i", str(src), "-af", f"loudnorm={TARGET}:print_format=json", "-f", "null", "-"],
                           capture_output=True, text=True).stderr
    m = json.loads(probe[probe.rindex("{") : probe.rindex("}") + 1])
    af = (f"loudnorm={TARGET}:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
          f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    subprocess.run([FF, "-y", "-loglevel", "error", "-i", str(src), "-af", af, "-ar", "48000", str(dst)], check=True)
    check = subprocess.run([FF, "-hide_banner", "-i", str(dst), "-af", f"loudnorm={TARGET}:print_format=json", "-f", "null", "-"],
                           capture_output=True, text=True).stderr
    c = json.loads(check[check.rindex("{") : check.rindex("}") + 1])
    print(f"✓ {dst.name}: {c['input_i']} LUFS, true peak {c['input_tp']} dBTP (from {m['input_i']} LUFS)")


if __name__ == "__main__":
    master(A / "mix_pre.wav", A / "master.wav")
    master(A / "bed_pre.wav", A / "master_no_voice.wav")
