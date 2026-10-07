"""Fetch the real imagery the film is built from into build/assets/.

Everything here is public data:
- SPHEREx QR2 HiPS (colour and the six detectors), via CDS hips2fits and the HiPS tile server.
  Courtesy NASA/JPL-Caltech.
- The 19 SPHEREx frames of asteroid (7) Iris near 36 Sextantis, via SPHEREx Explorer's own API
  (start the app first: `make serve`), which reads them from IRSA.
- Barnard's Star across the decades: DSS plates through the app's /api/plate, 2MASS and AllWISE
  through hips2fits, and a SPHEREx frame.
- A Palomar (POSS-I) plate of the field where Clyde Tombaugh found Pluto, and Pluto's positions on
  his two discovery plates from JPL Horizons, for the 1930 reconstruction.

Re-running skips files that already exist.
"""

import base64
import concurrent.futures as cf
import gzip
import io
import json
import random
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
import truststore
from PIL import Image

# Use the system's certificate store (some networks re-sign TLS with a local authority).
truststore.inject_into_ssl()

FILM = Path(__file__).resolve().parents[1]
OUT = FILM / "build" / "assets"
APP = "http://127.0.0.1:8000/api"
HIPS2FITS = "https://alasky.cds.unistra.fr/hips-image-services/hips2fits"
HIPS_TILES = "https://alasky.cds.unistra.fr/SPHEREx/color"
HORIZONS = "https://ssd.jpl.nasa.gov/api/horizons.api"
UA = {"User-Agent": "spherex-explorer-film/1.0 (NASA Space Apps 2026)"}

IRIS = {"ra": 161.29678, "dec": 2.44824}
BARNARD = {"ra": 269.452076, "dec": 4.693364, "pmra": -801.551, "pmdec": 10362.394}  # J2000, mas/yr


def get(url: str, timeout: float = 180, tries: int = 4) -> bytes:
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
                body = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    body = gzip.decompress(body)
                return body
        except Exception as e:  # noqa: BLE001 - retried, then raised
            if attempt == tries - 1:
                raise
            print(f"   retry {url[:90]}… ({e})")
            time.sleep(2 + 3 * attempt)
    raise AssertionError


def hips2fits(dest: Path, hips: str, ra: float, dec: float, fov: float, w: int, h: int,
              projection: str = "TAN", coordsys: str = "icrs", fmt: str = "png", rotation: float = 0) -> None:
    if dest.exists():
        return
    q = {"hips": hips, "ra": ra, "dec": dec, "fov": fov, "width": w, "height": h,
         "projection": projection, "coordsys": coordsys, "format": fmt, "rotation_angle": rotation}
    if fmt != "fits":
        q["stretch"] = "linear"
    body = get(f"{HIPS2FITS}?{urllib.parse.urlencode(q)}")
    dest.write_bytes(body)
    print(f" ✓ {dest.relative_to(FILM)}")


def allsky() -> None:
    d = OUT / "sky"
    d.mkdir(parents=True, exist_ok=True)
    # The whole sky in Mollweide, galactic, Milky Way across the middle.
    hips2fits(d / "allsky_gal.png", "CDS/P/SPHEREx/QR2/color", 266.40499, -28.93617, 360, 4000, 2000, "MOL", "galactic")
    # Equatorial, centred on Iris's field, to finish the zoom-out from it.
    hips2fits(d / "allsky_eq_iris.png", "CDS/P/SPHEREx/QR2/color", IRIS["ra"], IRIS["dec"], 360, 4000, 2000, "MOL", "icrs")
    # A powers-of-ten zoom out from the Iris field, each level 3x wider, all centred on it.
    for fov in (0.6, 1.8, 5.4, 16.2, 48.6, 145.8):
        hips2fits(d / f"iris_zoom_{fov:g}.png", "CDS/P/SPHEREx/QR2/color", IRIS["ra"], IRIS["dec"], fov, 1920, 1920,
                  "TAN" if fov < 100 else "STG")
    # Showcase fields in colour and in each detector, for "102 colours".
    fields = {
        "orion": (84.0, -5.0, 14),
        "ophiuchus": (247.0, -24.0, 9),
        "cygnus": (308.0, 41.0, 14),
        "galcentre": (266.4, -29.0, 16),
        "carina": (161.0, -59.7, 8),
        "lmc": (80.9, -69.4, 9),
        "andromeda": (10.68, 41.27, 3.2),
        "pleiades": (56.75, 24.12, 3.0),
    }
    for name, (ra, dec, fov) in fields.items():
        hips2fits(d / f"{name}_color.png", "CDS/P/SPHEREx/QR2/color", ra, dec, fov, 1920, 1080)
    for det in range(1, 7):
        hips2fits(d / f"ophiuchus_D{det}.png", f"CDS/P/SPHEREx/QR2/D{det}", *fields["ophiuchus"], 1920, 1080)
    # The whole sky in each detector's band, for "102 colours".
    for det in range(1, 7):
        hips2fits(d / f"allsky_D{det}.png", f"CDS/P/SPHEREx/QR2/D{det}", 266.40499, -28.93617, 360, 2000, 1000, "MOL", "galactic")


def tiles(n: int = 360) -> None:
    """Order-3 HiPS tiles (each about 7° across) for the wall of sky."""
    d = OUT / "tiles"
    d.mkdir(parents=True, exist_ok=True)
    rng = random.Random(7)
    picks = sorted(rng.sample(range(768), n))

    def one(npix: int) -> None:
        dest = d / f"t{npix:03d}.jpg"
        if dest.exists():
            return
        body = get(f"{HIPS_TILES}/Norder3/Dir0/Npix{npix}.png", timeout=60)
        im = Image.open(io.BytesIO(body)).convert("RGB").resize((192, 192), Image.LANCZOS)
        im.save(dest, quality=88)

    with cf.ThreadPoolExecutor(8) as pool:
        list(pool.map(one, picks))
    print(f" ✓ {len(list(d.glob('*.jpg')))} sky tiles")


def app_json(path: str, **q) -> dict:
    return json.loads(get(f"{APP}/{path}?{urllib.parse.urlencode(q)}", timeout=300))


def decode_frame(c: dict) -> dict:
    img = c["image"]
    data = np.frombuffer(base64.b64decode(img["data"]), dtype="<f4").reshape(img["height"], img["width"])
    mask = np.frombuffer(base64.b64decode(c["mask"]["data"]), dtype="u1").reshape(img["height"], img["width"])
    return {"data": data, "mask": mask}


def iris_frames() -> None:
    """All 19 detector-2 frames of the Iris pass, aligned north-up on one grid, as float arrays."""
    d = OUT / "iris"
    d.mkdir(parents=True, exist_ok=True)
    if (d / "frames.json").exists():
        return
    obs = app_json("observations", **IRIS)
    frames = [f for f in obs["frames"] if f["detector"] == 2 and f["isoMid"].startswith("2025-12-0")]
    meta = []
    for f in frames:
        c = app_json("cutout", key=f["key"], size=0.5, **IRIS)
        fr = decode_frame(c)
        np.save(d / f"{f['obsId']}.npy", fr["data"])
        np.save(d / f"{f['obsId']}_mask.npy", fr["mask"])
        meta.append({"obsId": f["obsId"], "isoMid": c["time"]["isoMid"], "wavelengthUm": c["wavelength"]["atTargetUm"],
                     "grid": c["grid"], "key": f["key"]})
        print(f" ✓ Iris frame {f['obsId']}  {c['time']['isoMid']}  {c['wavelength']['atTargetUm']:.3f} µm")
    (d / "frames.json").write_text(json.dumps(meta, indent=1))
    # JPL's predicted track and the app's own moving-source search, for the "caught it" overlays.
    body = json.dumps({"ra": IRIS["ra"], "dec": IRIS["dec"], "keys": [m["key"] for m in meta], "size": 0.3}).encode()
    for route in ("known-objects", "candidates"):
        try:
            req = urllib.request.Request(f"{APP}/{route}", data=body, headers={"Content-Type": "application/json"})
            (d / f"{route}.json").write_bytes(urllib.request.urlopen(req, timeout=600).read())
            print(f" ✓ Iris {route}")
        except Exception as e:  # noqa: BLE001 - the overlays fall back to the case's evidence
            print(f"   (no {route}: {e})")


def barnard() -> None:
    """Barnard's Star in five surveys, 1950s to SPHEREx, on one 0.4° grid."""
    d = OUT / "barnard"
    d.mkdir(parents=True, exist_ok=True)
    ra, dec, fov = BARNARD["ra"], BARNARD["dec"] + 0.03, 0.4
    for survey in ("poss1", "poss2"):
        dest = d / f"{survey}.json"
        if not dest.exists():
            dest.write_text(json.dumps(app_json("plate", ra=f"{ra:.5f}", dec=f"{dec:.5f}", fov=fov, survey=survey, size=512)))
            print(f" ✓ Barnard {survey}")
    hips2fits(d / "2mass.fits", "CDS/P/2MASS/K", ra, dec, fov, 512, 512, fmt="fits")
    hips2fits(d / "wise.fits", "CDS/P/allWISE/W1", ra, dec, fov, 512, 512, fmt="fits")
    if not (d / "spherex.npy").exists():
        obs = app_json("observations", ra=ra, dec=dec)
        # A short-wavelength frame from the latest pass: the star is brightest and sharpest there.
        frames = sorted((f for f in obs["frames"] if f["detector"] in (1, 2)), key=lambda f: f["mjdMid"])
        f = frames[-1]
        c = app_json("cutout", key=f["key"], ra=ra, dec=dec, size=fov)
        np.save(d / "spherex.npy", decode_frame(c)["data"])
        (d / "spherex.json").write_text(json.dumps({"isoMid": c["time"]["isoMid"], "obsId": f["obsId"],
                                                    "wavelengthUm": c["wavelength"]["atTargetUm"], "grid": c["grid"]}))
        print(f" ✓ Barnard SPHEREx {f['obsId']} {c['time']['isoMid']}")


def horizons_pluto(date: str) -> tuple[float, float]:
    q = {"format": "json", "COMMAND": "'999'", "EPHEM_TYPE": "OBSERVER", "CENTER": "'690@399'",
         "START_TIME": f"'{date} 04:00'", "STOP_TIME": f"'{date} 05:00'", "STEP_SIZE": "'1 h'",
         "QUANTITIES": "'1'", "ANG_FORMAT": "DEG", "OBJ_DATA": "NO"}
    body = json.loads(get(f"{HORIZONS}?{urllib.parse.urlencode(q)}"))["result"]
    row = body.split("$$SOE")[1].split("$$EOE")[0].strip().splitlines()[0]
    parts = row.split()
    return float(parts[-2]), float(parts[-1])


def pluto_1930() -> None:
    """The discovery plates' field: a 1950s Palomar plate, with Pluto's 1930 positions from JPL."""
    d = OUT / "pluto"
    d.mkdir(parents=True, exist_ok=True)
    meta = d / "pluto.json"
    if not meta.exists():
        a = horizons_pluto("1930-01-23")
        b = horizons_pluto("1930-01-29")
        meta.write_text(json.dumps({"jan23": a, "jan29": b, "note": "J2000 astrometric RA/Dec from JPL Horizons, Lowell Observatory (690), 04:00 UT"}))
        print(f" ✓ Pluto positions {a} {b}")
    p = json.loads(meta.read_text())
    ra = (p["jan23"][0] + p["jan29"][0]) / 2
    dec = (p["jan23"][1] + p["jan29"][1]) / 2
    dest = d / "plate.fits"
    if not dest.exists():
        rah = ra / 15
        q = {"v": "poss1_red", "r": f"{rah:.6f}", "d": f"{dec:.6f}", "e": "J2000", "h": 40, "w": 60, "f": "fits",
             "c": "none", "fov": "NONE", "v3": ""}
        dest.write_bytes(get(f"https://archive.stsci.edu/cgi-bin/dss_search?{urllib.parse.urlencode(q)}", timeout=300))
        print(f" ✓ Pluto field POSS-I plate around RA {ra:.4f} Dec {dec:.4f}")


STEPS = {"allsky": allsky, "tiles": tiles, "iris": iris_frames, "barnard": barnard, "pluto": pluto_1930}

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name in sys.argv[1:] or STEPS:
        print(f"· {name}")
        STEPS[name]()
