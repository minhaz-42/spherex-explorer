# Development log

Newest entries first. Each entry says what changed, why, and what was verified.

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
