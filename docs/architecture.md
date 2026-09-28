# Architecture

## Shape of the system

```text
 Browser (React + TypeScript)                 Python service (FastAPI)                 Upstream (public)
 ───────────────────────────                 ────────────────────────                 ─────────────────
 Search ───── /api/resolve ─────────────────► Sesame adapter ──────────────────────► CDS Sesame
 Timeline ─── /api/observations ────────────► SIA adapter → Frame normaliser ──────► IRSA SIA v2
                                              footprint → wavelength estimate
 Viewer ───── /api/cutout ──────────────────► FITS range reader ───────────────────► AWS S3 nasa-irsa-spherex
   canvas render, shared stretch,             (IBE cutout fallback) ───────────────► IRSA IBE cutout
   blink, diff, pixel readout                 align to common grid, mask flags,
                                              background, aperture photometry
 Known objects /api/known-objects ──────────► JPL adapters + parallax ─────────────► JPL SBIdent, Horizons
 Discover ─── /api/cases ───────────────────► curated JSON (built by a script from real data)
 Ask ──────── /api/assistant/chat ──────────► evidence from the cache → local model ► Ollama on the same
   (server-sent events)                       → checks (or built-in answers)          machine, not upstream
```

The browser never talks to NASA, JPL or CDS directly. The Python service owns every upstream call,
so it can validate input, cap sizes, time out, cache, and hide protocol details from the UI. The
assistant's language model runs next to the service, on the same machine, and receives only text
evidence the service has assembled.

### Why this split

- **Python for the science.** SPHEREx images are multi-extension FITS files with TAN-SIP
  distortion and a tabulated spectral WCS. Astropy handles both correctly; re-implementing them in the
  browser would be a source of silent errors.
- **The browser for rendering.** The service returns aligned float32 arrays in physical units, not
  PNGs. The browser applies one stretch to every frame of a sequence, computes blink and difference
  views instantly, and shows the pixel value under the cursor. A server-made PNG would bake in a
  per-image stretch and make a stretch change look like a brightness change.
- **One deployable.** In production FastAPI serves the built frontend, so the app is one process or
  one container. In development Vite serves the frontend and proxies `/api` to FastAPI.
- **Vite + React rather than Next.js.** The backend has to be Python, so Next.js server features would
  go unused and add a second server runtime. The pages are an interactive viewer, where server
  rendering adds little.

## Backend modules (`backend/src/spherex_explorer`)

| Module | Responsibility |
|---|---|
| `config.py` | Settings from environment variables with safe defaults |
| `http.py` | One pooled `httpx.AsyncClient` per upstream, timeouts, retry on connect errors |
| `cache.py` | In-memory TTL cache plus a small on-disk cache for cutouts and upstream responses |
| `resolve/coords.py` | Parse decimal and sexagesimal coordinates; validate ranges |
| `resolve/sesame.py` | Name → RA/Dec through CDS Sesame |
| `archive/sia.py` | Build SIA v2 queries, parse CSV, detect error documents |
| `archive/frames.py` | Normalise SIA rows into `Frame` objects; group into passes and visits |
| `archive/footprint.py` | Estimate the detector pixel of the target from the footprint polygon |
| `archive/spectral.py` | Evaluate the WCS-WAVE lookup table (wavelength and bandwidth at a pixel) |
| `archive/fits_range.py` | Read headers and pixel rows from a remote FITS file with HTTP byte ranges |
| `science/grid.py` | Common north-up tangent-plane grid; resample a cutout onto it |
| `science/background.py` | Sigma-clipped local background |
| `science/photometry.py` | Aperture photometry in native pixels with variance-based uncertainty |
| `science/compat.py` | Decide whether two frames can be differenced, and why not |
| `science/sources.py` | Point-source detection and candidate moving-source tracks |
| `solar_system/jpl.py` | SBIdent and Horizons adapters |
| `solar_system/parallax.py` | Geocentric → SPHEREx-centric direction using the header state vector |
| `api/*.py` | HTTP routes and response schemas; `api/cachekeys.py` builds the cache keys the routes and the assistant share |
| `assistant/evidence.py` | The numbered evidence for one question, read from the server's own cached results |
| `assistant/knowledge.py` | Core facts and short method notes, with keyword retrieval |
| `assistant/prompts.py` | The system prompt and the reminder after each question |
| `assistant/local_model.py` | Ollama and OpenAI-compatible adapters; strips think tags |
| `assistant/grounding.py` | Checks an answer's numbers, dates and citations against its evidence |
| `assistant/builtin.py` | Answers from the evidence without a model |
| `assistant/chat.py` | One turn: evidence, then the model or the built-in answer, streamed as events |
| `ratelimit.py` | Per-client token bucket for expensive routes |

## Internal data model

Names follow our model, not the archive's. Adapters translate.

```text
Target        name?, ra, dec (ICRS deg), galactic l/b, ecliptic λ/β, constellation, resolver
Frame         id (obs_publisher_did), obsId, detector 1–6, band, collection, release,
              tStart/tMid/tEnd (MJD + ISO UTC), exposure s, footprint polygon,
              file (S3 key, IRSA URL), wavelengthAtTarget {value, bandwidth, source: estimate|wcs}
Pass          frames that fall within one survey pass (gaps > 20 days split passes)
Visit         frames of one pointing sequence (gaps > 30 minutes split visits)
Cutout        frameId, grid (centre, size, scale), image float32 MJy/sr, mask uint8,
              background, wavelength and bandwidth at target (from the frame's own WCS),
              photometry {flux, error, unit, aperture}, flags at target, provenance
ChangeResult  type, frames compared, measurement, unit, method, uncertainty, limitations
KnownObject   designation, V mag, per-frame predicted position, rate, source
```

## API

All routes are under `/api`, return JSON (the chat route streams server-sent events), and validate
their parameters. POST bodies are capped at 64 KB.

| Route | Purpose | Notes |
|---|---|---|
| `GET /api/health` | Liveness and whether a demo snapshot exists | |
| `GET /api/resolve?q=` | Name or coordinates → target with context | Coordinates parsed locally; names via Sesame; cached 7 days |
| `GET /api/observations?ra&dec` | Every frame covering the point, grouped into passes | Cached 6 h; deep collections only for an explicit window of ≤ 31 days |
| `GET /api/cutout?key&ra&dec&size` | One frame aligned onto the target grid, with measurements | Cached 30 days; size 0.03–0.5° |
| `GET /api/measure?key&ra&dec` | Wavelength, time and brightness at the target, no pixels | Reads a 0.05° window; used for full-pass spectra |
| `POST /api/known-objects` | Catalogued bodies crossing the field, with per-frame predicted positions | JPL SBIdent + Horizons; 30 s–2 min the first time |
| `POST /api/candidates` | The moving-source search over a pass | Needs the pass's cutouts |
| `GET /api/cases` | Curated Discover cases | From `data/cases.json` |
| `GET /api/assistant/status` | Whether answers come from a local model or are built in | Model health cached 20 s |
| `POST /api/assistant/chat` | One answer, as server-sent events `meta`, `notice`, `delta`, then `done` or `error` | Up to 16 messages of 2,000 characters; one answer at a time; costs 3 rate-limit tokens |

Every data route accepts `source=live|snapshot`. In snapshot mode only recorded answers are served,
and anything else is a `404 not_in_snapshot`. Errors are JSON `{"error": {"code", "message",
"service"?}}` with 400 (invalid input), 404, 429 (rate limit), 502 (upstream failed) or 504
(upstream timed out).

Frames are named to the cutout routes by their archive key
(`qr2/level2/2025W49_1A/l2b-v20-2025-339/2/level2_2025W49_1A_0332_1D2_spx_l2b-v20-2025-339.fits`).
The server accepts only keys matching the Level 2 naming pattern and builds the URL itself, so the
routes cannot be used as an open proxy.

## Reading pixels without downloading files

A Level 2 file is 72 MB: six extensions of which we need four small windows. The layout is:

```text
PRIMARY (1 block) │ IMAGE hdr (7–8 blocks) + 2040² float32 │ FLAGS hdr (5) + 2040² int32 │
VARIANCE hdr (4) + 2040² float32 │ ZODI hdr (4) + 2040² float32 │ PSF hdr (15) + 101²×121 │ WCS-WAVE
```

Each 2040² plane is exactly 16,646,400 bytes. Only the IMAGE header length varies, so one 46 KB
read gives the header (WCS, times, spacecraft position) and fixes every other offset. The service
then reads, in parallel, the rows of IMAGE and FLAGS that the cutout needs, a few VARIANCE rows round
the target, one ZODI row and the WCS-WAVE table. Each read starts at its extension's header and is
checked (`EXTNAME`, header length) before its bytes are used. If a check fails the reader falls back
to walking the headers, and if S3 fails it falls back to the IRSA cutout service. The pixels match
the IRSA cutout service bit for bit (verified; see the research notes).

## Explanations and the assistant

Every explanation in the app is written from the measured values: the wavelength gap between two
frames, why a difference is refused, what JPL predicts and how far a candidate lies from it.

The assistant (the **Ask** page, `/ask`) keeps to the same rule: **real data → the app's measurements →
numbered evidence → a local model phrases it → checks**, never images → model → conclusion.

1. **Evidence, gathered by the server for each question** (`assistant/evidence.py`). The viewer
   publishes what is on screen, and the Ask page keeps the last view until the visitor sets it
   aside. With a question the browser sends only identifiers: the target, the archive keys of frames
   B and A, the comparison mode, the field of view and the sequence's frame keys. It never sends
   values. The server reads its own
   cached results for exactly that view (`Store.peek`, with the routes' keys from `api/cachekeys.py`):
   - each frame's time, wavelength at the target, brightness and caveats;
   - whether A and B may be differenced, and why not;
   - JPL's predictions, with each body's distance from the target in A and B, so a brightness jump
     caused by an asteroid entering the aperture is explained by its motion rather than by colour;
   - the moving-source search and which candidates match JPL.

   It computes or fetches nothing for the assistant, except a name lookup the question asks for. It
   adds matching Discover cases and up to three method notes (`assistant/knowledge.py`). Items are
   tagged E (the app's data and cases) or K (method notes). What has not been loaded or run yet is
   listed as such, never guessed.
2. **A local model phrases it** (`assistant/local_model.py`). The default is Ollama with Qwen3 4B
   Instruct (`qwen3:4b-instruct-2507-q4_K_M`); any OpenAI-compatible server on the machine also
   works. The system prompt (`assistant/prompts.py`):
   - limits the model to the evidence and a few core facts, and asks it to cite tags;
   - forbids discovery and Planet X claims, and forbids speaking for NASA;
   - carries the wavelength caution.

   The model never sees images. Think tags are stripped from the stream, and one answer is generated
   at a time. Qwen3 4B was chosen after trying Qwen3 14B, which needed about 10 GB of memory and took
   about 30 seconds an answer on a 16 GB laptop, against 3–8 seconds for the 4B model.
3. **Links are made by the server**, not by the model: Discover cases, and views for a named object
   or coordinates in the question.
4. **Checks** (`assistant/grounding.py`). Each answer is checked against its evidence and the core
   facts:
   - every number, allowing for rounding and for restatement in µJy, mJy or Jy;
   - every month-and-year, as a pair;
   - every cited tag, which must be one of its sources.

   Anything not found is shown under the answer; nothing is silently corrected. The checks cover
   facts, not reasoning: a small model can still link two true facts wrongly.
5. **Without a model** (none configured, Ollama not running, or a failure before the first word),
   the assistant answers from the same evidence directly (`assistant/builtin.py`) and says so.

Questions go to this server only; the status route reports whether the model URL is local. Chats
are kept in the browser's local storage (`spherex-explorer.chats.v1`, at most 50), never on the
server, and the chat list deletes them one by one or all at once.

The page is a chat app of its own at `/ask` and `/ask/:chatId`, outside the site's header and
footer. It has a chat list, the conversation and a message box. The chat store lives outside React,
so an answer keeps streaming while the visitor switches chats or follows one of its links.

## Caching and limits

- SIA results: memory, 6 h. Sesame: memory, 7 days. JPL: disk, 30 days, keyed by frame set.
- Cutouts: disk, keyed by frame ID, centre and size; about 100–250 KB each.
- The browser fetches frames with a small concurrency limit, current frame first, then its
  neighbours, then the rest. TanStack Query deduplicates identical requests.
- The service allows at most 8 concurrent S3 cutout jobs and rate-limits expensive routes per client.

## Data modes

| Mode | Source | Shown as |
|---|---|---|
| Live | IRSA and S3 at request time (through the cache) | "Live · IRSA archive" |
| Demo snapshot | Real IRSA data saved by `scripts/build_demo_snapshot.py`, with the retrieval date | "Demo snapshot · real SPHEREx data retrieved on …" |
| Error | Upstream failed | Error panel with retry; demo snapshot offered only as a choice |

## Frontend structure (`frontend/src`)

```text
app/            router, layout (header with Ask and the theme toggle), error boundary
components/     ThemeToggle, Wordmark; space/: landing-page figures and the sky background
features/
  search/       SearchForm
  viewer/       Viewer, SkyCanvas (2D canvas), overlays, frame panel, sequence loading
  timeline/     frame strip, pass track, transport and speeds
  wavelength/   band picker, brightness against wavelength or time
  plots/        ScatterPlot (SVG)
  known/        JPL known objects and the moving-source search
  discover/     blink preview for the cases
  assistant/    conversation store, streaming client, safe answer rendering, the last view
pages/          Landing, Explore, Discover, Ask, About, NotFound
lib/            API client, queries, types, sequence and matching rules, formatting, WCS, pixels
styles/         index.css: design tokens for the light and dark themes, and components
```

## Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | **Wavelength confusion.** SPHEREx's filters vary across the detector, so two dates usually sample different wavelengths; a naive blink shows the spectrum, not a change. | Certain | High | Wavelength at the target on every frame; matched-wavelength filter; difference only within one channel; explained in the UI. |
| 2 | Slow upstream (SIA 3–70 s, JPL 20–80 s, S3 about 1 MB/s from Bangladesh) | High | High | Caching, progressive loading, trimmed range reads, deep collections only in deep fields, demo snapshot. |
| 3 | IRSA or S3 outage during the demo | Medium | High | Demo snapshot of real data, clearly labelled, chosen explicitly. |
| 4 | Misleading difference images (PSF changes across the detector, background, bright-star wings) | High | Medium | Compatibility rules, local background, masked flags, residual warning near bright stars. |
| 5 | Over-claiming moving sources | Medium | High | "Candidate" language, JPL comparison, minimum track length, explicit caution text. |
| 6 | Archive layout or release changes (QR3 appeared mid-project) | Medium | Medium | Collections in config, layout checks with fallbacks, tests on real fixtures. |
| 7 | Open-proxy abuse of the cutout route | Low | Medium | Only derived keys accepted, size caps, rate limits, timeouts. |
| 8 | Bright stars saturate and bloom | High | Low | Show FLAGS; mark photometry at flagged targets as unreliable. |

## MVP scope

1. Search by name or coordinates → frames grouped by pass and band.
2. Aligned cutouts streamed into a timeline viewer with play, blink, side by side.
3. Wavelength at target on every frame; band and matched-wavelength filters.
4. Difference view with compatibility rules.
5. Known asteroids from JPL drawn on each frame.
6. Aperture photometry per frame → spectrum and light-curve plots.
7. Discover: curated real cases, led by asteroid (7) Iris crossing the field near 36 Sextantis.
8. Landing, About, limitations, credits. Tests, docs, demo snapshot.

Stretch goals: candidate moving-source detection within a pass; deep-field paging across the NEP's
tens of thousands of frames.

## Development plan

| Phase | Deliverable | Gate |
|---|---|---|
| 0 | Research, requirements, architecture (this document) | Every endpoint verified with a real request |
| 1 | Repository, backend and frontend skeletons, design tokens, app shell, CI scripts | `make check` passes |
| 2 | Resolve, SIA, frame normalisation, range reader, cutouts | Real M31 and Iris frames through the API; tests on real fixtures |
| 3 | Search page, viewer canvas, metadata panel | Search → image in the browser |
| 4 | Timeline, playback, blink, side by side | e2e: search → play → metadata |
| 5 | Wavelength filters, spectrum and light-curve plots | Plots match API photometry |
| 6 | Difference view, known objects, method notes | Iris track matches JPL within 2 px |
| 7 | Discover cases, demo snapshot | Cases open in the viewer with evidence |
| 8 | Responsive layout, accessibility, empty and error states, docs | Manual review at phone and desktop widths |
| 9 | Full test run, build, security and claims review, final README | All checks green |
