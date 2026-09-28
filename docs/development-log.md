# Development log

Newest entries first. Each entry says what changed, why, and what was verified.

## 2026-09-28 · About the object, across the decades, where SPHEREx was, share and play, Bangla

**Why.** The user asked for a more informative Explore page "with proper objects", a clearer place
for the dark theme and the chat, and a better design overall; the team's plan added a decades blink,
exports, a globe, a game, a judges' tour and a Bangla switch.

**What.**
- Four API routes proxy the services the browser may not reach: SIMBAD facts at a position and in a
  field, hips2fits survey images, and scanned Palomar plates from the Digitized Sky Survey.
- Explore opens every search with the object's profile (its type in plain words, distance, size,
  brightness, other names), an all-sky locator, the same patch in other light, and the catalogued
  objects in view. The start page has an atlas of 24 objects.
- "Across the decades" blinks one field from a 1950s POSS-I plate to the latest SPHEREx frame that
  covers it. "Where was SPHEREx?" draws Earth, the orbit and the line of sight from a frame's
  header, in the game, the decades view, the tour and the frame panel.
- Blinks export as GIFs or videos with captions and credits; share cards; `/embed/<case>`;
  "Spot the mover" at `/play`; a 90-second tour at `/tour`; a Bangla/English switch.

**Verified on real data.**
- Barnard's Star moves 13.1′ between the POSS-I plate of 9 July 1950 (E164) and the SPHEREx frame of
  11 March 2026, as its Gaia proper motion predicts; it sits 8.5′ south of centre on the 1950 plate
  and 1.5′ south on the 1991 one.
- The globe first put the Sun 0.38° from astropy's position: the solar formula gives coordinates of
  date, while the headers are ICRF-aligned. With the longitude carried back to J2000 and the Earth
  rotation angle instead of sidereal time, the Sun is within 0.03°, the rotation within 0.001° and
  the ground point within 0.2° of astropy, on a real Iris frame (652 km up, 7.53 km/s).
- SIMBAD classes Andromeda as an "Active Galaxy Nucleus", Centaurus A as a "BL Lac" and M33 as a
  "Galaxy towards a Group of Galaxies". The profile now names galaxies by their morphology (SA(s)b is
  a spiral) and keeps SIMBAD's class underneath; the mapping is tested on the codes SIMBAD returns
  for ten well-known galaxies.
- Sorting a SIMBAD cone on `nbref` takes 11–20 s; on the computed `nbref + 0`, under a second.
- "Nothing catalogued here" is now a cached answer (`{"object": null}`), so an empty spot is not
  asked about again on every visit, and the browser console stays clean; the assistant still sees
  it as "no object".

**Bangla.** Every page switches between English and Bangla (the header button, or `?lang=bn`),
except what the server writes: case texts, photometry reasons, JPL notes, SIMBAD's type labels and
the assistant's answers stay in English, and credits keep the exact wording the services ask for.
- Each feature keeps `defineMessages({ en, bn })` next to its components; TypeScript refuses a
  Bangla table that misses or adds a key. English output was checked unchanged, state by state,
  before and after, and the unit and end-to-end tests still assert the English.
- Bangla is set in Noto Sans Bengali, loaded only when Bengali text is on screen. Headings get more
  line height and no negative letter-spacing; numbers keep their units on the same line; a word
  joiner after each hyphen that meets a Bangla letter keeps "SPHEREx-এর" from breaking (it broke
  at 30 of 241 widths tested without one). Numbers stay in Western digits; large distances read in
  lakh and crore ("প্রায় 25 লক্ষ আলোকবর্ষ").
- The validity rules keep their exact meaning: a difference across more than half a spectral
  channel "would mostly show the sources' colours, not a change in time" in both languages.
- A page sweep in both languages at 1440 and 390 px finds no console errors and no sideways
  scrolling.

**JPL.** A transient Horizons failure had been cached as "no known objects" for the Hebe field for
30 days (the snapshot had Hebe; a fresh live lookup found it again in 27 s). The other session made
such answers uncacheable; the known-objects panel now says when JPL's list may be incomplete and
offers a fresh lookup.

## 2026-09-28 · Ask fetches live data; a fuller chat sidebar

**Why.** The user asked whether the chat could use live data, and whether that would be better, for
every object in the atlas's galaxies, nebulae and clusters. It is better. Before, the chat read only
what the viewer had already loaded, so it answered "the JPL check has not been run".

**What.**
- `assistant/live.py` fetches, before each answer, what the question needs and the cache lacks:
  - the frames on screen;
  - SIMBAD facts for the target or a named object;
  - that object's SPHEREx coverage;
  - for motion questions in a one-pass view, JPL's check and the moving-source search.
- Each step streams as a `progress` event.
- `api/compute.py` holds the routes' computations, so the chat and the routes share cache keys,
  lifetimes and rate-limit costs.
- Questions about live data get a data-mode source and a knowledge note: the archive is live, but
  images reach IRSA within 60 days, so the data is never real time.
- SIMBAD's AGN class now reads "Galaxy with an active nucleus", not "Active galaxy", for M31.
- The chat sidebar gained search and a per-chat menu with rename and delete. About credits SIMBAD,
  hips2fits, the DSS, 2MASS, AllWISE and Natural Earth.

**Verified on live services.**
- "Tell me about the Orion Nebula" answered in 10.7 s, from Sesame, SIMBAD and the archive:
  - an H II region, NGC 1976, 66′ across, about 1,540 light-years (SIMBAD's median distance);
  - 237 SPHEREx frames;
  - all 15 numbers checked.
- On a never-checked M31 pass, "Did any asteroid move through this field?" answered in 80 s:
  - the chat loaded two frames, asked SIMBAD, ran JPL's check (27 s) and the search over 18 frames;
  - it answered correctly that JPL knows no asteroid brighter than V 20 there.

## 2026-09-28 · Ask becomes a chat app; new fonts

**Why.** Asked for by the user: the chat as a proper chat window, like the big chat apps, and
different fonts across the site.

**Ask.**
- `/ask` and `/ask/:chatId` are a full-screen app outside the site layout: a chat list grouped by
  date, the conversation, and a message box with send and stop.
- Answers carry copy, ask again and a sources panel.
- Chats are saved in the browser's local storage only, and can be deleted one by one or all at once.
- The viewer's *Ask about this view* attaches that view to the message box.

**Fonts.** Three families, one job each:
- Sora for headings and the wordmark;
- Plus Jakarta Sans for text, controls and numbers, with tabular figures;
- JetBrains Mono for identifiers.

They were chosen after checking each candidate for the symbols the app prints (µ, ′, ″, ±, °, −)
and for tabular figures: DM Sans, the first choice, lacks the primes. Display sizes sit a step
lower, because Sora is wide.

**Found and fixed.** On phones the logo and the assistant's avatar lost their planet. The mark's
gradients had fixed ids, and the first copy sat in the hidden desktop sidebar. Each mark now has its
own ids.

**Verified.** Frontend: 18 assistant tests, including reload persistence, deletion, ask again and
copy. Playwright: 13, including the chat list surviving a reload and the drawer on a phone.

## 2026-09-28 · Ask gets its own page; the app gets new type

**Why.** Asked for by the user: the chat should be its own page, the problems fixed, and the text
styles across the app replaced.

**Found and fixed.**
- "HTTP 404" in the chat: a preview API started before the assistant existed, without reload. The
  page now says the assistant is not on that server and how to fix it, instead of waiting forever
  on "Checking the assistant…".
- The drawer covered the viewer's side panel. Ask is now `/ask`: the viewer's *Ask about this view*
  attaches that view, and the conversation survives following an answer's links.
- The compact search box cut its placeholder off mid-number.
- The orrery wrote SPHEREx as SPHEREX, because its labels were upper-cased.

**Type.** Inter everywhere, with its display cut at headline sizes, bold headings, sentence-case
labels and tabular figures. IBM Plex Mono only for identifiers. No gradient or italic headline text,
no letter-spaced capitals, nothing under 11 px.

**Verified.** Every page swept on desktop and phone, in light and dark: no console errors, no
failed requests, no sideways scroll. Frontend: 60 tests. Playwright: 13, including the Ask flow from
the viewer and on a phone.

## 2026-09-28 · The Ask assistant, on a local model

**What and why.** The brief makes AI optional; the project owner asked for a chat assistant that
uses local models. It is built the way the brief allows: real data → the app's measurements → numbered evidence → a local model phrases it →
checks. Details are in [architecture.md](architecture.md#explanations-and-the-assistant).
- Backend `assistant/`: evidence from the server's own cache for the view on screen (identifiers
  from the browser, never values), a small knowledge base, Ollama and OpenAI-compatible adapters,
  answer checks and built-in answers. Routes `GET /api/assistant/status` and
  `POST /api/assistant/chat` (server-sent events).
- Frontend: the Ask panel beside the theme toggle in the header, with streamed answers, citation
  chips that open the sources, server-built links, check warnings, Stop and Escape.

**Choosing the model.** Qwen3 14B needed about 10 GB and about 30 s an answer on the 16 GB
development laptop. Qwen3 4B Instruct 2507 (Q4_K_M, 2.5 GB) answers in 3–8 s and keeps to the
evidence, so it is the default.

**Found by reading real answers, and fixed.**
- The model misquoted "25 Apr 2025 – 26 May 2026" as "April to May 2025", and the number check
  passed it. Month-and-year pairs are now checked as pairs.
- It gave the wavelength gap as the reason Iris's frame was about 1,200 times brighter at the
  target. The real reason is that Iris moved into the aperture. The evidence now gives each JPL
  body's distance from the target in frames A and B, and states the motion as the reason when it
  applies. The colour caveat is then left out of that comparison, because the model took it as the
  reason.
- It cited a source that did not exist ([E8]). Citations are now checked against the sources.
- Discover cases were tagged C1, C2, the same as search candidates. Cases are now tagged E.
- Answers ran long and uncited. After a one-line reminder at the end of each question, every
  replayed answer was short and cited.
- Keyword retrieval matched inside words ("au" in "because"). It now matches whole words, with
  stems for longer keywords, and a longer match wins ("MJy/sr" is about units, not photometry).

**Verified.**
- Backend: 36 assistant tests, including mocked Ollama and OpenAI-compatible streams, fallback,
  busy and rate-limit cases. The live test against the real model passes.
- Frontend: 10 component and unit tests. Playwright: 3 assistant tests on the demo snapshot with
  the model off, among 12 passing.
- Totals: 140 backend and 56 frontend tests passing.

## 2026-09-28 · Phases 8–9: polish and validation

**Automated checks (all passing).**
- Backend: 104 unit and API tests, ruff, mypy --strict.
- Frontend: 35 unit and component tests, tsc, ESLint.
- End to end: 9 Playwright tests on the demo snapshot, desktop and phone.
- Live: 3 tests against IRSA/S3, byte ranges bit-identical to IRSA cutouts for QR2 and QR3, and the
  API end to end on M31.

**Found by inspecting real results, and fixed.**
- M31's core dropped to zero in a QR3 frame: the whole aperture was flagged BLOOM, and the
  photometry summed nothing. Photometry now refuses mostly flagged apertures, and the panel warns
  when the target is flagged.
- The moving-source search missed Iris, because the pipeline flags bright movers' cores. Detection
  now runs on the filled display image.
- A spectrum "peak" that was only the shortest unsaturated wavelength, a brightness quoted where the
  asteroid was not, and hand-written case summaries that disagreed with the data. The build script
  now derives these sentences from the data.
- A saturated star's core rendered as a black hole in the image. The display fill now widens until
  holes close.
- Phone: hover and keyboard hints were replaced with touch wording.

**Security review.**
- Every input is range- or pattern-checked, and archive keys match the Level 2 naming pattern.
- Every upstream URL is built server-side from configured hosts, so there is no open proxy.
- XML is parsed with defusedxml, and SPA serving is protected against path traversal.
- POST bodies are capped at 64 KB, with per-client rate limits and upstream timeouts.
- A strict CSP was checked in a production build with no violations.
- No secrets, accounts, cookies or analytics.
- Behind a proxy, uvicorn needs `--proxy-headers` for the rate limit (README).

**Scientific-claims review.**
- Every user-facing number is either measured (and reproducible from the snapshot) or cited.
  Mission facts are from the Explanatory Supplement and Bock et al.; the NEP deep-survey count is
  from our own SIA query, dated.
- "Candidate" and "known object" are kept distinct, and no text implies a discovery.
- Planet X is discussed only as what the app cannot find.

**Known gaps.**
- The deep survey is available through the API (windowed) but not in the viewer.
- No brightness-variation Discover case yet: none has been verified at matched wavelengths.
- Route-level code splitting was reverted because it broke a shell test; the bundle is 165 KB
  gzipped.
- The landing page is being redesigned in another session.

## 2026-09-28 · Phases 1–7: from scaffold to Discover

**Foundation** (`9559473`).
- Backend: FastAPI with uv, pooled upstream client, memory + disk cache with request coalescing and
  a read-only snapshot store, per-client rate limit, JSON errors, strict security headers.
- Frontend: Vite + React + TypeScript + Tailwind v4 on design tokens.
- One process in production.

**Data** (`02d0d05`, `8b4fad0`, `7f4dcbe`).
- **Reader.** A byte-range Level 2 reader for both releases, including QR3's RICE-compressed flags.
  It is bit-identical to IRSA's cutout service (live tests), and falls back to that service.
- **Pipeline.** Alignment on a north-up grid, the Mosaic Tool mask, local background, aperture
  photometry.
- **Routes.** Resolve, observations (SIA over QR2 + QR3, pass grouping, wavelength estimated from
  footprints) and cutouts.

**Viewer** (`6c5a1de`, `8caae9c`).
- Search; one shared stretch per sequence.
- Single, blink, side-by-side and difference views, with the rule that a difference needs matched
  wavelengths.
- Timeline of passes and frames with play and keyboard control.
- Frame panel; URL state by observation ID.

**Measurements and known objects** (`e5eecae`, `fe402b9`).
- Brightness against wavelength and time, and a full-pass spectrum through `/api/measure`.
- JPL SBIdent + Horizons, with SPHEREx as the observer and parallax from the frame header. The
  correction agrees with Horizons' SPHEREx-centred answer to 0.003″.
- The frame strip encodes wavelength by position, following the chart rules.

**Moving-source search** (`c3ee022`, `6a8d62c`).
- A transparent search: detect, drop the static sky, repeat within a pointing, link across pointings.
- A first version missed Iris because the pipeline flags bright movers' cores. Detection now runs on
  the filled display image, and the search recovers Iris within 1.4″ of JPL.
- A stale cached result exposed that caches need method versions; cutout and search keys now carry
  them.

**Discover** (this entry's commit).
- `scripts/build_cases.py` runs the API in-process for each curated case and writes `data/cases.json`
  with evidence sentences computed from the results.
- Its cache folder is the demo snapshot, so demo mode serves exactly the data the cases describe.
- The first M31 build wrote a misleading sentence: it claimed the spectrum peaked at 3.8 µm, when
  that was merely the shortest wavelength that had not reached the overflow threshold. The script
  now describes the whole measured shape and states the overflow caveat.

**Design** (other session): pencil theme (`f4e9234`…), then an "observatory atlas" redesign in
progress. The viewer keeps sky images unfiltered and uses the `*-on-image` tokens for overlays.

## 2026-09-28 · Phase 0: research and planning

**Environment.** Apple M5, 16 GB. Node 24.13, npm 11.6, pnpm 10.28, Python 3.13.5, uv 0.12.9,
git 2.50, gh 2.92. Playwright's Chromium is cached under `~/Library/Caches/ms-playwright`. There was
no existing SPHEREx project; the repository `minhaz-42/spherex-explorer` already had a README,
so it was cloned rather than created.

**What we verified** (details in [research/spherex-data-research.md](research/spherex-data-research.md)):

- SIA v2 finds frames in seconds and accepts both QR2 and QR3 collections in one request.
- S3 byte ranges reproduce IRSA cutouts bit for bit, for QR2 (uncompressed flags) and QR3
  (RICE-compressed flags), at a fraction of the size, because the PSF extension is skipped.
- The search footprint's vertices are the pixel-grid corners, so the wavelength at the target can
  be estimated before any pixels are read.
- The spectral lookup table is a fixed detector calibration. Astropy's alternate WCS must have SIP
  switched off; left on, it shifted wavelengths by about 0.006 µm.
- JPL SBIdent accepts the spacecraft's own state vector from the FITS header; Horizons returns
  positions for a list of frame times in about a second.
- Asteroid (7) Iris is visible moving across SPHEREx frames on 2025-12-02, exactly where Horizons
  predicts it, next to the fixed star 36 Sextantis.

**Decisions.**

- Python (FastAPI, astropy, numpy) for data access and science; Vite + React + TypeScript for the
  interface; FastAPI serves the built interface in production. See [architecture.md](architecture.md).
- The server sends aligned float arrays, not images, so one display stretch applies to a whole
  sequence and nothing on screen changes brightness because of the stretch.
- Every frame carries the wavelength that fell on the target; differences are allowed only within
  one spectral channel.
- Known-object overlays come from JPL; our own detections are always called candidates.

**Biggest risk.** The wavelength-versus-time confusion described above. It is handled in the data
model (wavelength at target on every frame), the interface (matched-wavelength filter) and the change
tools (compatibility rules).
