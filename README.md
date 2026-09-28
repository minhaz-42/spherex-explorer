# SPHEREx Explorer

An interactive web explorer for visualizing how the infrared sky changes across SPHEREx observations
over time and wavelength.

> **Status:** working end to end on live data. Search, the timeline viewer, comparisons, brightness
> plots, JPL known objects, the moving-source search and the Discover cases are built and tested;
> see [docs/development-log.md](docs/development-log.md). If something here doesn't match the code,
> the README is out of date: please fix it in your next commit.

## What the project does

[SPHEREx](https://spherex.caltech.edu/) is a NASA mission that images the whole sky in 102
narrow spectral channels from 0.75 to 5.0 µm, mapping the entire sky four times over about two years.
SPHEREx Explorer lets you pick a position on the sky, finds every SPHEREx spectral image that covers
it, and lets you browse those images by **observation time** and by **wavelength**.

**Where → when → what changed:**

- **Search** by object name (CDS Sesame) or coordinates in decimal, sexagesimal or galactic form.
- **Timeline** of every frame from Quick Releases 2 and 3, grouped into survey passes and pointings,
  with play, speeds and keyboard control. Each frame shows the wavelength that fell on the target.
- **Compare** frames by single view, blink, side by side, or difference. A difference is only shown
  when the two frames saw the target at the same wavelength; otherwise the app says why not.
- **Measure** brightness at the target, plotted against wavelength (a spectrum) or against time at
  one matched wavelength (a fair light curve).
- **Moving objects:**
  - JPL's predicted positions of catalogued asteroids and comets, as seen from SPHEREx;
  - the app's own moving-source search, whose candidates are matched against those predictions.
- **Discover:** curated cases built from live data by a script, each with its evidence and cautions,
  such as asteroid (7) Iris caught moving past 36 Sextantis.

Everything shown is real SPHEREx data. The demo snapshot is a labelled recording of real data, used
only when the visitor chooses it. The app never claims a discovery; see
[docs/limitations.md](docs/limitations.md).

## Data sources

All data comes from the public SPHEREx archive at [IRSA](https://irsa.ipac.caltech.edu/) (NASA/IPAC).
No account, API key or AWS credentials are needed.

| What | Where | Used for |
|---|---|---|
| Image search (IVOA SIA2) | `https://irsa.ipac.caltech.edu/SIA?COLLECTION=…` | Finding the images that cover a sky position |
| Cutout service | an image's `access_url` + `?center=RA,Dec&size=deg` | Fetching a small region instead of a full image |
| Cloud mirror (AWS S3) | bucket `nasa-irsa-spherex`, region `us-east-1`, anonymous access | Reading full image files directly |
| Browsable directories | `https://irsa.ipac.caltech.edu/ibe/data/spherex/qr2/` and `…/qr3/` | Manual inspection and bulk downloads |

SIA2 collections. Quick Releases 2 and 3 are consecutive time slices, not reprocessings of the same
data, so a timeline has to query both:

| Collection | Contents | Time span (UTC) |
|---|---|---|
| `spherex_qr2` | Wide Survey spectral images (uniform all-sky coverage) | 2025-04-24 → 2026-07-20 |
| `spherex_qr2_deep` | Deep Survey spectral images (many more visits near the ecliptic poles) | 2025-04-24 → 2026-07-20 |
| `spherex_qr3` | Wide Survey spectral images, pipeline R7 | 2026-07-20 → 2026-08-17 |
| `spherex_qr3_deep` | Deep Survey spectral images, pipeline R7 | 2026-07-20 → 2026-08-17 |
| `spherex_qr2_cal`, `spherex_qr3_cal` | calibration files | |

A few facts about the data that shape the app:

- **One pointing gives six images**, one per detector array (D1–D6). Each detector covers one band:

  | Band | Wavelength (µm) | Resolving power R |
  |---|---|---|
  | 1 | 0.75–1.09 | 39 |
  | 2 | 1.10–1.62 | 41 |
  | 3 | 1.63–2.41 | 41 |
  | 4 | 2.42–3.82 | 35 |
  | 5 | 3.83–4.41 | 112 |
  | 6 | 4.42–5.00 | 128 |

- **Wavelength varies across each image.** The detectors sit behind linear variable filters, so the
  wavelength changes along one axis of the array. The per-pixel wavelength comes from the image's
  spectral WCS (`WCS-WAVE`) rather than a single value in the header.
- **Images are large multi-extension FITS files** (2040 × 2040 per detector). Prefer cutouts or
  byte-range reads over downloading whole files.
- **The archive grows weekly.** New images show up in the browsable directories first; SIA2 lags by
  about a day. The current public releases are Quick Release 2 (QR2) and Quick Release 3 (QR3,
  released 2026-09-16). The SPHEREx team advises caution when combining the two, because QR3 uses
  new calibrations.
- **Two exposures of one place usually see different wavelengths.** A star lands on a different part
  of the filter each time, so a brightness difference between two dates may be its spectrum, not a
  change. The app shows the wavelength at the target on every frame for this reason.

### Check that you can reach the archive

This query asks for Wide Survey images covering M31. It should return a few hundred rows in about
10 seconds:

```bash
curl -s "https://irsa.ipac.caltech.edu/SIA?COLLECTION=spherex_qr2&POS=circle+10.6847+41.2690+0.01&RESPONSEFORMAT=CSV" \
  -o m31.csv && wc -l m31.csv
```

The columns the app relies on are `access_url` (on-prem file URL), `cloud_access` (S3 location),
`t_min` (observation start, MJD), `em_min`/`em_max` (wavelength range, metres),
`energy_bandpassname` and `obs_id`.

## Getting started

Prerequisites:

- `git` and an SSH key with access to this repository
- Python 3.12 or newer and [uv](https://docs.astral.sh/uv/) 0.5 or newer
- Node.js 20.19 or newer with npm
- `make` (preinstalled on macOS and most Linux distributions)

No accounts, API keys or AWS credentials are needed. Every setting is optional; see
[.env.example](.env.example).

```bash
git clone git@github.com:minhaz-42/spherex-explorer.git
cd spherex-explorer
make setup     # backend virtualenv (uv sync), frontend packages (npm ci), Playwright's Chromium
make dev       # API on http://127.0.0.1:8000, web app with hot reload on http://localhost:5173
```

Open <http://localhost:5173>. The web app proxies `/api` to the API server.

| Command | What it does |
|---|---|
| `make check` | Lint (ruff, ESLint), type-check (mypy, tsc) and unit tests (pytest, Vitest) |
| `make test-live` | Backend tests that call the real IRSA and JPL services |
| `make test-e2e` | Browser tests with Playwright |
| `make build` | Production build of the web app into `frontend/dist` |
| `make serve` | Build, then serve the API and the app from one process on <http://127.0.0.1:8000> |
| `make snapshot` | Rebuild the Discover cases (`data/cases.json`) and the demo snapshot (`data/snapshot/`) from live data; takes several minutes |

`make test-e2e` runs Playwright against the committed demo snapshot, so it needs no network. It
starts its own API server on port 8010 and web server on port 5183.

### Live data and demo mode

By default every view asks IRSA, AWS S3, JPL and CDS at request time, through the server's cache
(`backend/.cache/`, safe to delete). Add `source=snapshot` to an Explore link, or use *Open the demo
snapshot* on Discover, to use only the recorded answers in `data/snapshot/`. A badge on every data
view says which mode is in use, and nothing outside the snapshot is ever substituted.

### Deployment

The app is one process. `make build` produces `frontend/dist`, which the FastAPI app serves at `/`,
with the API under `/api`. To deploy:

1. Run `uv run uvicorn spherex_explorer.main:app --host 0.0.0.0 --port 8000` from `backend/`, behind
   any HTTPS reverse proxy.
2. Give it a writable `SPHEREX_CACHE_DIR`.

It needs outbound HTTPS to irsa.ipac.caltech.edu, nasa-irsa-spherex.s3.us-east-1.amazonaws.com,
ssd-api.jpl.nasa.gov, ssd.jpl.nasa.gov and cds.unistra.fr. A server in a US region reads frames many
times faster than a distant one.

## Project structure

```text
backend/                   Python data service (FastAPI)
  src/spherex_explorer/
    main.py                app factory: /api routes, security headers, serves frontend/dist
    config.py              settings from SPHEREX_* environment variables
    cache.py               memory + disk cache, demo snapshot store
    http.py                pooled upstream HTTP client
    api/                   HTTP routes
    archive/               IRSA SIA, FITS byte-range reader, frame normalisation
    science/               alignment, background, photometry, change tools
    solar_system/          JPL SBIdent and Horizons, parallax
    resolve/               coordinate parsing, CDS Sesame
  scripts/                 build_cases.py (Discover + snapshot), extract_wave_tables.py
  tests/                   pytest suite with fixtures recorded from real responses
frontend/                  Web app (Vite, React, TypeScript, Tailwind CSS)
  src/app/                 router, layout, error boundary
  src/pages/               Landing, Explore, Discover, About
  src/features/            search, viewer, timeline, wavelength, known objects, discover
  src/lib/                 API client and helpers
  src/components/space/    pencil-drawn solar system, sky globe, spectrum and sketches (landing page)
  src/styles/index.css     design tokens (pencil-on-paper light theme) and base styles
  tests/, e2e/             Vitest and Playwright tests
data/cases.json            curated Discover cases (built by backend/scripts/build_cases.py)
data/snapshot/             demo snapshot: recorded API answers for those cases
docs/                      research, architecture, requirements, methods, limitations, demo guide
Makefile                   setup, dev, check, build, serve
```

## Working on the project

- **Branch:** everyone works on `main` for now. Run `git pull --rebase` before you start and before
  you push.
- **Commit identity:** check that `git config user.name` and `git config user.email` are set to your
  own identity before your first commit.
- **Commit messages:** use [Conventional Commits](https://www.conventionalcommits.org/). The subject
  line is `type(scope): summary`, in the imperative, at most 72 characters. The body explains *why*
  the change was made. Types: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `chore`.

  ```text
  feat(search): query SIA2 for images covering a sky position

  Uses the spherex_qr2 collection and keeps only the columns the
  timeline needs, which cuts the response size about tenfold.
  ```

- **One logical change per commit**, pushed soon after it is made so the remote is always current.
- **Never force-push `main`.** If a push is rejected, run `git pull --rebase` and push again.
- **Do not commit** downloaded FITS files, sample data dumps, virtual environments, `node_modules`,
  build output or secrets.
- **Keep this README accurate.** A change to setup, run commands, configuration or project layout
  includes the README update in the same commit.

## Documentation

| Document | What it covers |
|---|---|
| [docs/research/spherex-data-research.md](docs/research/spherex-data-research.md) | Every archive service, verified with real requests |
| [docs/architecture.md](docs/architecture.md) | System shape, modules, API, risks, plan |
| [docs/product-requirements.md](docs/product-requirements.md) | Who it is for and what it must do |
| [docs/scientific-methods.md](docs/scientific-methods.md) | Every method, with the check that validates it |
| [docs/limitations.md](docs/limitations.md) | What the app cannot do or conclude |
| [docs/demo-guide.md](docs/demo-guide.md) | A three-minute demo, with a fallback |
| [docs/development-log.md](docs/development-log.md) | What was built, when, and what was verified |

## References

- [SPHEREx at IRSA](https://irsa.ipac.caltech.edu/Missions/spherex.html): mission data home
- [SPHEREx Explanatory Supplement (QR)](https://irsa.ipac.caltech.edu/data/SPHEREx/docs/SPHEREx_Expsupp_QR.pdf)
- [IRSA SIA2 service](https://irsa.ipac.caltech.edu/ibe/sia.html) and [cutout service](https://irsa.ipac.caltech.edu/ibe/cutouts.html)
- [IRSA cloud access](https://irsa.ipac.caltech.edu/cloud_access/#spherex)
- [IRSA Python tutorials](https://caltech-ipac.github.io/irsa-tutorials/): SPHEREx intro, cutouts, PSF, source discovery
