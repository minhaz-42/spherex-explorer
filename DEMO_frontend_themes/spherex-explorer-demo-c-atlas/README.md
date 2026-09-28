# SPHEREx Explorer, Demo C, Atlas

A design demo for the SPHEREx Explorer frontend, inspired by the SPACED travel concept (your first image).

Deep navy and dust with tan hairline boxes, condensed capitals over a typewriter body, a five-cell search bar, diamond section marks, band tabs and a stacked diagram of the six detector filters.

It is built with plain HTML, CSS, JavaScript, Vite and Tailwind CSS, and comes with the shared Python data
service in `backend/`. The four demos (A to D) share the same backend, the same interactions and the same
content, so you can compare only the look.

## What you need

- **Python 3.10 or newer**: <https://www.python.org/downloads/>. On Windows, tick "Add python.exe to PATH".
- **Node.js 20.19 or newer** (the LTS version is fine): <https://nodejs.org>

Nothing else. No accounts, API keys or cloud credentials are needed, and every package is installed inside
this folder (`backend/.venv` and `frontend/node_modules`).

## Start it

| | Windows | macOS | Linux |
|---|---|---|---|
| Double-click | `start.bat` | `start.command` | |
| Or in a terminal | `py start.py` | `python3 start.py` | `python3 start.py` |

The first run installs everything, which takes a minute or two. Then open <http://localhost:5173>.
Press Ctrl+C in the terminal to stop.

On macOS, if double-clicking `start.command` is blocked, right-click it and choose Open, or run
`chmod +x start.command` once.

Other commands:

| Command | What it does |
|---|---|
| `python start.py` | Development: data service on :8000, web app with hot reload on :5173 |
| `python start.py --prod` | Builds the web app, then serves it and the API together on <http://127.0.0.1:8000> |
| `python start.py --setup` | Installs dependencies only |
| `python start.py --test` | Runs the backend tests |
| `python start.py --open` | Also opens the app in your browser |
| `--api-port 8001 --web-port 5174` | Uses other ports if the defaults are taken |

### Running the parts by hand

If you'd rather not use `start.py`:

```bash
# data service
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
source .venv/bin/activate        # macOS / Linux
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000

# web app, in a second terminal
cd frontend
npm install
npm run dev
```

## What's real and what's generated

- **Real:** the search forms. They call the data service, which resolves names with CDS Sesame (or reads
  coordinates directly) and asks IRSA's SIA2 service for every SPHEREx image covering the position, across
  Quick Releases 2 and 3, Wide and Deep Survey. The answer appears under the form, narrowed by the Release, Survey and Band fields.
- **Generated:** the frames, spectrum and light curve in the Explore preview. They show how the controls
  behave, including the rule that a difference image is refused unless both frames saw the target at the
  same wavelength. The page says so next to the preview. Showing real frames needs a cutout endpoint,
  which is the next backend step.

Search needs internet access to `cds.unistra.fr` and `irsa.ipac.caltech.edu`. Coordinates don't need the
name resolver, so `10.6847 +41.2690` works even when CDS is down.

## Project structure

```text
start.py                 one command to set up and run everything (Windows, macOS, Linux)
start.bat, start.command double-click launchers for Windows and macOS
.env.example             optional settings; copy to .env to change them
backend/                 Python data service (FastAPI), identical in all four demos
  app/
    main.py              app factory: /api routes, serves frontend/dist when built
    routes.py            /api/health, /api/bands, /api/resolve, /api/frames
    coords.py            decimal, sexagesimal and galactic coordinate parsing
    sesame.py            CDS Sesame name resolver
    sia.py               IRSA SIA2 search across QR2 and QR3
    cache.py             in-memory cache with expiry
    config.py            SPHEREX_* settings
  tests/                 pytest suite (no network needed)
frontend/
  index.html             the page: all text lives here, so edit it directly
  vite.config.js         Tailwind plugin, and /api forwarded to the data service
  src/
    main.js              entry point
    styles/main.css      this style's colours, fonts and components (light and dark)
    styles/base.css      shared behaviour: theme reveal, text effects, explorer layout
    lib/                 shared modules, identical in all four demos
      boot.js            starts everything below
      theme.js           light/dark switch with the circular reveal
      effects.js         scramble, hover roll, rolling digits, glitch, preloader
      search.js, api.js  search forms and the data-service client
      explorer.js        the Explore preview (timeline, compare modes, plots)
      sky.js, data.js    preview frames, star fields, band table
    features/bands.js   interaction specific to this style
```

## Changing the look

- **Colours:** the custom properties at the top of `frontend/src/styles/main.css`. There's one set for
  light mode and one for dark (it appears twice so it also works before JavaScript runs).
- **Fonts:** Barlow Condensed for headings, DM Mono for body text, loaded from Google Fonts in `index.html`. Change the link there and
  `--font-*` in `main.css`.
- **Theme reveal shape:** `data-theme-variant` on `<html>`: `circle` (default), `wipe` or `diamond`.
- **Effects:** add or remove these attributes on any element:

| Attribute | Effect |
|---|---|
| `data-scramble` | letters scramble, then settle, once the page loads |
| `data-scramble-view` | the same, when scrolled into view |
| `data-scramble-hover` | re-scrambles on hover or focus |
| `data-roll` | the label rolls up to a copy of itself on hover |
| `data-odometer="102"` | digits roll up to the number when scrolled into view |
| `data-glitch` | coloured split-image flicker, on hover and now and then |

All motion switches off when the visitor's system asks for reduced motion.

## Data service API

| Endpoint | Returns |
|---|---|
| `GET /api/health` | `{"status": "ok"}` |
| `GET /api/bands` | the six bands with wavelength range, resolving power and detector |
| `GET /api/resolve?q=M31` | position in degrees (ICRS) for a name or coordinates |
| `GET /api/frames?ra=10.6847&dec=41.269` | every image covering the position, with per-collection counts |

Interactive docs are at <http://127.0.0.1:8000/docs> while the service runs.

## Troubleshooting

- **"Port 8000 is already in use"**: another copy is running (maybe another demo). Stop it, or run
  `python start.py --api-port 8001 --web-port 5174`.
- **"The data service isn't running"** under a search: the backend stopped. Check the terminal for the
  reason and run `python start.py` again.
- **Search is slow**: IRSA usually answers in about 10 seconds. Repeat searches are cached.
- **`py` or `python` not found on Windows**: reinstall Python with "Add python.exe to PATH" ticked, then open
  a new terminal.
