# Development log

Newest entries first. Each entry says what changed, why, and what was verified.

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
