# The pitch film

A 3 minute 58 second film for the NASA Space Apps judging ("240 seconds of glory"), built entirely
from code, public data and recordings of the real app. It follows the four-part model:

| Part | Time | Title | What happens |
|---|---|---|---|
| Who / attention | 0:00–1:00 | The Dot | Real SPHEREx stars of the field around asteroid (7) Iris appear one by one; one point moves; freeze. The view pulls back through the SPHEREx maps to the whole sky in six bands. Code, commits and the app at work; the name. |
| Why | 1:00–2:00 | The Blink | 1930: Tombaugh's blink comparator and Pluto (a labelled reconstruction). Barnard's Star across 75 years of real surveys to SPHEREx. Three real SPHEREx frames of Iris. "The method is simple. The scale isn't." Searching by hand. |
| What | 2:00–3:00 | The demo | Real footage of SPHEREx Explorer on live data: search, blink, our own moving-source search, JPL's check, the honest difference view, the decades blink, the game, Bangla, the assistant. |
| Impact | 3:00–3:58 | The Invitation | Stay on the discovery; pull back to Iris's orbit and to Earth; every generation's way of seeing; more data, more people; "A student. A citizen scientist. An astronomer."; the first shot's dot, caught; the name. |

The narration, with timecodes, is in [SCRIPT.md](SCRIPT.md).

## The files

`make -C film deliver` writes the finished film to `film/build/delivery/`, and
`make -C film release` copies it into [`release/`](release/). The captions and the poster are
tracked in git; the three videos (200–300 MB each) are too large for this repository, so share them
another way (a drive link, or a GitHub release):

- `SPHEREx-Explorer-film.mp4`: the film, 1920×1080, 30 fps, narrated.
- `SPHEREx-Explorer-film-captioned.mp4`: the same with English captions burned in, for rooms
  where the sound is poor.
- `SPHEREx-Explorer-film-no-voice.mp4`: music and effects only, for narrating live over the film.
- `SPHEREx-Explorer-film.en.srt`: captions as a separate file.
- `poster.jpg`: a still for thumbnails.

Sound is mastered to −14 LUFS with peaks at −1 dBTP.

## What is real

- **Real data:** every sky image. The SPHEREx frames of Iris and Barnard's Star come from IRSA
  through the app's own API; the colour and per-detector all-sky maps are the SPHEREx QR2 HiPS at
  CDS; the plates are the Digitized Sky Survey; 2MASS and AllWISE come through hips2fits; Pluto's
  1930 positions and the orbits come from JPL Horizons; JPL's prediction for Iris and the app's
  candidate C1 are the app's own results.
- **Real app:** every shot of the interface is a screen recording of the app running on live data
  (`capture/`). The pointer is drawn over it, because headless browsers draw none.
- **Reconstruction, labelled on screen:** the 1930 plates are a 1954 Palomar plate of the same field
  with Pluto drawn at JPL's positions for 23 and 29 January 1930.
- **Adjusted for display:** the QR2 colour map has unfinished tiles at the Galactic centre; they are
  smoothed over, and the end card says so. The opening field is the median of the 19 frames, with
  each frame's own pixels around the asteroid, so the moving point is the real one.
- **Generated:** the narration is a synthetic voice (Kokoro); the music and effects are synthesised
  by `audio/score.py`. No samples or third-party music.

## Changing it

The picture's timing is fixed; words, voice, end card and team footage can change without
touching the code.

| To change | Edit | Then |
|---|---|---|
| A narration line | `text` and `say` in `script.json` | `make voice audio deliver` |
| The voice: your own | Record each line as `voice/<id>.wav` (ids in `script.json`); any sample rate | `make voice audio deliver` |
| The end card's team line or tagline | `config.json` | `make render deliver` |
| Footage of the team at work | `footage/team.mp4`, about 5 s, landscape | `make team render deliver` |

`audio/voice.py` warns when a line runs into the next one. "We're a team from Bangladesh" is a
placeholder for the team's name: change it in `script.json` (line `q1e`) and in `config.json`.

A recorded human voice will sound better than the synthetic one, and judges score authenticity: if
you can, record the script in a quiet room, one file per line, and rebuild.

## Building from scratch

Needs: macOS or Linux, Node 20+, [uv](https://docs.astral.sh/uv/), the app's dependencies
(`make setup` at the repository root) and network access.

```bash
make -C film setup        # Python environment, the voice model (about 350 MB), ffmpeg
make serve                # in another terminal: the app on :8000 (and Ollama for the assistant)
make -C film assets       # real data from IRSA, CDS, STScI and JPL (about 20 minutes)
make -C film capture      # record the app
make -C film all          # narration, sound, picture (about 20 minutes), delivery
```

`make -C film preview` renders a contact sheet of the whole film in about a minute;
`node render/render.mjs stills 12.5 95` renders single frames. Each frame is a pure function of
time, so any frame can be rendered alone.

## How it is made

- `assets/fetch.py`, `assets/prep.py`: download and prepare the imagery.
- `capture/`: Playwright scripts that drive the app and record Chrome's screencast at 2× density,
  with a log of the pointer and of where key elements were.
- `render/`: the film as an HTML canvas page. `film.js` holds the timeline; `scenes/q1.js`–`q4.js`
  draw each part; `render.mjs` steps it frame by frame in headless Chromium, in parallel, into
  H.264. The scenes also export the sound cues (`render.mjs cues`).
- `audio/`: narration (`voice.py`), score and mix (`score.py`), loudness (`master.py`), captions
  (`captions.py`).
- `deliver.py`: the final files, and a check that each is under four minutes.
