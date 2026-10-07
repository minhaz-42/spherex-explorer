# SPHEREx Explorer · the four-minute pitch film. From the repository root: make -C film <target>
# The whole film is rebuilt from code and public data: `make -C film setup all`.

PY := .venv/bin/python
NODE := node
export FFMPEG = $(shell $(PY) -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())" 2>/dev/null)

.PHONY: help setup all assets capture team voice cues audio render deliver release preview clean

help:
	@echo "make setup      Python env (TTS, ffmpeg, astropy), voice model"
	@echo "make assets     fetch real data (IRSA, CDS, STScI, JPL) and prepare images"
	@echo "make capture    record the app (needs 'make serve' at the repo root and Ollama running)"
	@echo "make team       use footage/team.mp4 (you, at work) in the montage (the current cut leaves it out)"
	@echo "make voice      synthesise narration from script.json (voice/<id>.wav overrides a line)"
	@echo "make audio      score, effects, mix, -14 LUFS masters, captions"
	@echo "make render     render the picture (about 15–25 minutes)"
	@echo "make deliver    final MP4s in build/delivery/"
	@echo "make release    copy the final files into release/ (captions and poster are tracked; the videos are not)"
	@echo "make preview    a contact sheet of the whole film, one frame every 4 s"

setup:
	uv venv -q .venv --python 3.12
	uv pip install -q --python $(PY) kokoro-onnx soundfile scipy numpy pillow faster-whisper astropy opencv-python-headless truststore imageio-ffmpeg
	mkdir -p models
	test -f models/kokoro-v1.0.onnx || curl -sL -o models/kokoro-v1.0.onnx https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
	test -f models/voices-v1.0.bin || curl -sL -o models/voices-v1.0.bin https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin

all: voice cues audio render deliver

assets:
	$(PY) assets/fetch.py
	$(PY) assets/prep.py

capture:
	$(NODE) capture/clips.mjs

team:
	rm -rf build/footage/team && mkdir -p build/footage/team
	$(FFMPEG) -loglevel error -i footage/team.mp4 -t 4.8 -vf "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30" -q:v 2 build/footage/team/%05d.jpg
	echo "{\"count\": $$(ls build/footage/team/*.jpg | wc -l | tr -d ' ')}" > build/footage/team/frames.json

voice:
	$(PY) audio/voice.py

cues:
	$(NODE) render/render.mjs cues

audio: cues
	$(PY) audio/score.py
	$(PY) audio/master.py
	$(PY) audio/captions.py

render:
	$(NODE) render/render.mjs video --workers 6

deliver:
	$(PY) deliver.py

release:
	mkdir -p release
	cp build/delivery/SPHEREx-Explorer-film.mp4 build/delivery/SPHEREx-Explorer-film-captioned.mp4 \
	   build/delivery/SPHEREx-Explorer-film-no-voice.mp4 build/delivery/SPHEREx-Explorer-film.en.srt \
	   build/delivery/poster.jpg release/

preview:
	$(NODE) render/render.mjs sheet 0 238 4

clean:
	rm -rf build/video build/stills build/delivery
