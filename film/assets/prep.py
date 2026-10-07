"""Turn the fetched data in build/assets into the images the film's scenes draw (build/img).

- Iris: a clean star field (the median of all 19 frames, where the moving asteroid drops out) plus,
  for each frame, the same field with that frame's own pixels around the asteroid put back. The
  asteroid in every image is the real one, where SPHEREx recorded it. Also the raw frames.
- The 1930 reconstruction: the POSS-I plate of the discovery field as a glass negative, with Pluto
  drawn at JPL's positions for 23 and 29 January 1930.
- Barnard's Star in five surveys on one grid, and where its catalogued motion puts it each time.
- The sky: JPEGs of the SPHEREx maps and tiles, with the Galactic-centre gap of the QR2 map filled.
"""

import base64
import io
import json
from pathlib import Path

import cv2
import numpy as np
from astropy.io import fits
from PIL import Image, ImageFilter

FILM = Path(__file__).resolve().parents[1]
A = FILM / "build" / "assets"
OUT = FILM / "build" / "img"


def tan_xy(ra, dec, ra0, dec0, scale_arcsec, cx, cy):
    """Pixel of (ra, dec) on a north-up, east-left gnomonic grid centred at (ra0, dec0)."""
    r, d, r0, d0 = map(np.radians, (ra, dec, ra0, dec0))
    cosc = np.sin(d0) * np.sin(d) + np.cos(d0) * np.cos(d) * np.cos(r - r0)
    xi = np.cos(d) * np.sin(r - r0) / cosc
    eta = (np.cos(d0) * np.sin(d) - np.sin(d0) * np.cos(d) * np.cos(r - r0)) / cosc
    s = np.radians(scale_arcsec / 3600)
    return float(cx - xi / s), float(cy - eta / s)


def asinh8(img, lo, hi, soft=0.04):
    x = np.clip((img - lo) / (hi - lo), 0, None)
    y = np.arcsinh(x / soft) / np.arcsinh(1 / soft)
    return (np.clip(y, 0, 1) * 255).astype(np.uint8)


def fill_flagged(a, bad, rounds=8):
    """Fill flagged or missing pixels from their brightest valid neighbours, so saturated cores
    read as bright rather than as holes. Display only; nothing is measured from these images."""
    a = a.copy()
    bad = bad.copy()
    for _ in range(rounds):
        if not bad.any():
            break
        v = np.where(bad, -np.inf, a).astype(np.float32)
        d = cv2.dilate(v, np.ones((3, 3), np.uint8))
        take = bad & np.isfinite(d)
        a[take] = d[take]
        bad = bad & ~take
    a[bad] = np.nanmedian(a[~bad]) if (~bad).any() else 0
    return a


def app_array(path, mask_path=None):
    """A cutout array from the app's API: its grid has row 0 to the south, so flip it north-up.
    Pixels with no data (beyond the detector's edge) become the background level."""
    a = np.load(path).astype(np.float64)
    nodata = ~np.isfinite(a)
    flagged = np.zeros_like(nodata)
    if mask_path is not None:
        m = np.load(mask_path)
        nodata |= (m & 2) > 0
        flagged = ((m & 1) > 0) & ~nodata
    a[nodata] = np.nan
    a = fill_flagged(np.where(nodata, -np.inf, a), flagged)
    a[nodata] = np.nanmedian(a[~nodata]) if (~nodata).any() else 0
    return np.flipud(a)


def save(img, path, quality=93):
    path.parent.mkdir(parents=True, exist_ok=True)
    im = Image.fromarray(img) if isinstance(img, np.ndarray) else img
    if path.suffix == ".png":
        im.save(path, optimize=False, compress_level=3)
    else:
        im.convert("RGB").save(path, quality=quality, subsampling=0)


def iris():
    d = A / "iris"
    frames = json.loads((d / "frames.json").read_text())
    known = json.loads((d / "known-objects.json").read_text())
    cands = json.loads((d / "candidates.json").read_text())
    stack = np.array([app_array(d / f"{f['obsId']}.npy", d / f"{f['obsId']}_mask.npy") for f in frames])
    n = stack.shape[1]
    grid = frames[0]["grid"]
    scale = grid["scaleArcsec"]
    c = (n - 1) / 2
    median = np.median(stack, axis=0)
    lo, hi = np.percentile(median, 8), np.percentile(median, 99.7)

    up = 6  # upsample so the shots can move without showing pixels
    def render(a):
        a = cv2.GaussianBlur(a.astype(np.float32), (0, 0), 0.6)
        u = cv2.resize(a, (n * up, n * up), interpolation=cv2.INTER_LINEAR)
        u = cv2.GaussianBlur(u, (0, 0), up * 0.4)
        return asinh8(u, lo * 0.6, hi * 0.6)

    pos = {p["key"]: p for p in known["objects"][0]["positions"]}
    meta = {"size": n * up, "scaleArcsec": scale / up, "frames": [], "candidates": []}
    save(render(median), OUT / "iris" / "median.png")
    yy, xx = np.mgrid[0:n, 0:n]
    for i, f in enumerate(frames):
        p = pos[f["key"]]
        x, y = tan_xy(p["ra"], p["dec"], grid["ra"], grid["dec"], scale, c, c)
        frame = stack[i]
        # Put this frame's own pixels back in a soft disc around the asteroid (JPL's position).
        w = np.exp(-(((xx - x) ** 2 + (yy - y) ** 2) / (2 * 2.6**2)))
        comp = median * (1 - w) + frame * w
        save(render(comp), OUT / "iris" / f"comp_{i:02d}.png")
        save(render(frame), OUT / "iris" / f"raw_{i:02d}.png")
        meta["frames"].append({"i": i, "obsId": f["obsId"], "isoMid": f["isoMid"], "wavelengthUm": round(f["wavelengthUm"], 4),
                               "iris": [x * up + up / 2, y * up + up / 2], "inField": 0 <= x < n and 0 <= y < n})
    for cnd in cands["candidates"]:
        pts = [tan_xy(s["ra"], s["dec"], grid["ra"], grid["dec"], scale, c, c) for s in cnd["sightings"]]
        meta["candidates"].append({"id": cnd["id"], "strength": cnd["strength"], "rate": cnd["rateArcsecPerHour"],
                                   "points": [[px * up + up / 2, py * up + up / 2] for px, py in pts]})
    # 36 Sextantis, the bright star, for framing: the brightest blob of the median.
    sm = cv2.GaussianBlur(median.astype(np.float32), (0, 0), 3)
    sy, sx = np.unravel_index(np.argmax(sm), sm.shape)
    meta["star36Sex"] = [float(sx * up + up / 2), float(sy * up + up / 2)]
    meta["jpl"] = {"name": known["objects"][0]["name"], "rate": known["objects"][0]["rateArcsecPerHour"],
                   "vmag": known["objects"][0]["vmag"]}
    # Point sources of the clean field, brightest first, for the opening's star-by-star reveal.
    sm = cv2.GaussianBlur(median.astype(np.float32), (0, 0), 0.8)
    noise = 1.4826 * np.median(np.abs(sm - np.median(sm)))
    peaks = (sm == cv2.dilate(sm, np.ones((5, 5), np.uint8))) & (sm > np.median(sm) + 5 * noise)
    ys, xs = np.nonzero(peaks)
    order = np.argsort(-sm[ys, xs])
    meta["stars"] = [[float(xs[k] * up + up / 2), float(ys[k] * up + up / 2), float(sm[ys[k], xs[k]])] for k in order]
    (OUT / "iris" / "iris.json").write_text(json.dumps(meta, indent=1))
    print(" ✓ iris", n, "px →", n * up)


def pluto():
    d = A / "pluto"
    p = json.loads((d / "pluto.json").read_text())
    h = fits.open(d / "plate.fits")[0]
    img = np.flipud(h.data.astype(np.float64))
    H, W = img.shape
    scale = 3600 * 60 / 60 / W  # the plate was cut 60' wide
    ra0 = (p["jan23"][0] + p["jan29"][0]) / 2
    dec0 = (p["jan23"][1] + p["jan29"][1]) / 2
    cx, cy = (W - 1) / 2, (H - 1) / 2  # the plate was cut centred between the two positions
    img = img[: int(H * 0.94)]  # drop the strip beyond the plate's edge (y positions are unchanged)
    H = img.shape[0]
    lo, hi = np.percentile(img, 25), np.percentile(img, 99.6)
    pos = {}
    for k in ("jan23", "jan29"):
        x, y = tan_xy(*p[k], ra0, dec0, scale, cx, cy)
        pos[k] = [x, y]
    # A photographic plate is a negative: dark stars on clear glass. Pluto was about magnitude 15:
    # drawn like a faint star of the plate, at JPL's position for each night.
    base = asinh8(img, lo, hi, soft=0.12).astype(np.float64)
    yy, xx = np.mgrid[0:H, 0:W]
    out = {}
    for k, (x, y) in pos.items():
        dot = 175 * np.exp(-(((xx - x) ** 2 + (yy - y) ** 2) / (2 * 2.0**2)))
        pos_img = np.clip(np.maximum(base, dot), 0, 255)
        neg = 255 - pos_img
        out[k] = neg
        save(neg.astype(np.uint8), OUT / "pluto" / f"plate_{k}.png")
    (OUT / "pluto" / "pluto.json").write_text(json.dumps({"size": [W, H], "scaleArcsec": scale, "pluto": pos,
                                                          "plate": h.header.get("PLATEID"), "plateDate": h.header.get("DATE-OBS")}))
    print(" ✓ pluto plate", W, H, pos)


def barnard():
    d = A / "barnard"
    ra, dec = 269.452076, 4.693364 + 0.03
    pmra, pmdec = -801.551, 10362.394
    size, fov = 512, 0.4
    scale = fov * 3600 / size
    c = (size - 1) / 2
    tiles = []

    def where(year):
        dra = pmra * (year - 2000) / 3.6e6 / np.cos(np.radians(4.693364))
        ddec = pmdec * (year - 2000) / 3.6e6
        return tan_xy(269.452076 + dra, 4.693364 + ddec, ra, dec, scale, c, c)

    def from_png(name):
        j = json.loads((d / f"{name}.json").read_text())
        im = Image.open(io.BytesIO(base64.b64decode(j["png"].split(",", 1)[1]))).convert("L").resize((size, size), Image.LANCZOS)
        return np.asarray(im).astype(np.float64), j

    def norm(a, plo=20, phi=99.7, soft=0.08):
        lo, hi = np.nanpercentile(a, plo), np.nanpercentile(a, phi)
        return asinh8(np.nan_to_num(a, nan=lo), lo, hi, soft)

    for name, label, year, when in (("poss1", "POSS-I · Palomar", 1950.52, "1950"), ("poss2", "POSS-II · Palomar", 1991.46, "1991")):
        a, j = from_png(name)
        save(norm(a, 30, 99.8, 0.25), OUT / "barnard" / f"{name}.png")
        tiles.append({"id": name, "label": label, "when": j["epoch"][:4], "year": year, "xy": where(year)})
    for name, label, year, when in (("2mass", "2MASS · near-infrared", 1999.0, "1997–2001"), ("wise", "AllWISE · mid-infrared", 2010.5, "2010–2011")):
        a = np.flipud(fits.open(d / f"{name}.fits")[0].data.astype(np.float64))
        save(norm(a, 25, 99.8, 0.06), OUT / "barnard" / f"{name}.png")
        tiles.append({"id": name, "label": label, "when": when, "year": year, "xy": where(year)})
    s = app_array(d / "spherex.npy")
    sj = json.loads((d / "spherex.json").read_text())
    s = cv2.resize(s, (size, size), interpolation=cv2.INTER_CUBIC)
    save(norm(s, 20, 99.85, 0.05), OUT / "barnard" / "spherex.png")
    year = 2026 + (int(sj["isoMid"][5:7]) - 0.5) / 12
    tiles.append({"id": "spherex", "label": "SPHEREx", "when": sj["isoMid"][:4], "year": year, "xy": where(year),
                  "date": sj["isoMid"][:10]})
    (OUT / "barnard" / "barnard.json").write_text(json.dumps({"size": size, "fovDeg": fov, "tiles": tiles}, indent=1))
    print(" ✓ barnard", [(t["id"], [round(v) for v in t["xy"]]) for t in tiles])


def fill_galactic_centre(g):
    """The QR2 maps have a patchy, unfinished block at the Galactic centre. Carry the band across it
    row by row from either side and add star texture from the band nearby, rather than show
    processing seams as if they were sky. Disclosed in the credits."""
    rgb = g[..., :3].astype(np.float64)
    alpha = g[..., 3] if g.ndim == 3 and g.shape[2] == 4 else None
    H, W = rgb.shape[:2]
    k = W / 4000
    cx, cy = W // 2, H // 2
    x0, x1, y0, y1 = cx - int(118 * k), cx + int(68 * k), cy - int(62 * k), cy + int(128 * k)
    strip = max(4, int(14 * k))
    left = rgb[y0:y1, x0 - strip : x0].mean(axis=1)
    right = rgb[y0:y1, x1 : x1 + strip].mean(axis=1)
    left = cv2.GaussianBlur(left[:, None, :].astype(np.float32), (0, 0), 3 * k)[:, 0, :]
    right = cv2.GaussianBlur(right[:, None, :].astype(np.float32), (0, 0), 3 * k)[:, 0, :]
    t = np.linspace(0, 1, x1 - x0)[None, :, None]
    t = t * t * (3 - 2 * t)
    base = left[:, None, :] * (1 - t) + right[:, None, :] * t
    off = int(300 * k)
    donor = rgb[y0:y1, x0 - off : x1 - off]
    texture = donor - cv2.GaussianBlur(donor.astype(np.float32), (0, 0), 6 * k)
    patch = base + texture
    e = max(3, int(12 * k))
    feather = np.ones((y1 - y0, x1 - x0), np.float32)
    feather = cv2.copyMakeBorder(feather[e:-e, e:-e], e, e, e, e, cv2.BORDER_CONSTANT, value=0)
    feather = cv2.GaussianBlur(feather, (0, 0), e / 2)[..., None]
    rgb[y0:y1, x0:x1] = rgb[y0:y1, x0:x1] * (1 - feather) + patch * feather
    fixed = np.clip(rgb, 0, 255).astype(np.uint8)
    if alpha is not None:
        fixed = np.where(alpha[..., None] > 0, fixed, 0)
    return fixed


def fill_band_holes(g, alpha):
    """The single-detector maps have empty tiles (no data, transparent) along the Galactic plane
    near the centre. Inpaint them from the surrounding band, with a little noise to match."""
    H, W = g.shape
    cx, cy = W // 2, H // 2
    hole = np.zeros_like(g)
    rx, ry = int(W * 0.16), int(H * 0.12)
    hole[cy - ry : cy + ry, cx - rx : cx + rx] = (alpha[cy - ry : cy + ry, cx - rx : cx + rx] == 0).astype(np.uint8) * 255
    hole = cv2.dilate(hole, np.ones((5, 5), np.uint8))
    out = cv2.inpaint(g, hole, 6, cv2.INPAINT_TELEA).astype(np.float64)
    m = cv2.GaussianBlur(hole, (0, 0), 2) / 255.0
    out += np.random.default_rng(3).normal(0, 10, g.shape) * m * (out / 255.0 + 0.2)
    return np.clip(out, 0, 255).astype(np.uint8)


def mollweide_gal_to_eq(gal, ra0, dec0, out_w=4000):
    """Resample a galactic Mollweide map (centre l=0, longitude increasing to the left) into an
    equatorial Mollweide map centred on (ra0, dec0) — the frame hips2fits uses, east to the left."""
    from astropy.coordinates import SkyCoord
    import astropy.units as u

    H, W = out_w // 2, out_w
    R = W / (4 * np.sqrt(2))
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float64)
    x = xs + 0.5 - W / 2
    y = H / 2 - (ys + 0.5)
    theta = np.arcsin(np.clip(y / (np.sqrt(2) * R), -1, 1))
    lat = np.arcsin(np.clip((2 * theta + np.sin(2 * theta)) / np.pi, -1, 1))
    lon = -np.pi * x / (2 * np.sqrt(2) * R * np.cos(theta))
    inside = np.abs(lon) <= np.pi
    # Rotate so that (ra0, dec0) sits at the centre: (lon, lat) are offsets in a frame centred there.
    c = SkyCoord(lon=lon[inside] * u.rad, lat=lat[inside] * u.rad, frame=SkyCoord(ra0 * u.deg, dec0 * u.deg).skyoffset_frame())
    g = c.transform_to("galactic")
    l = (g.l.rad + np.pi) % (2 * np.pi) - np.pi
    b = g.b.rad
    # Forward Mollweide into the galactic map.
    th = b.copy()
    for _ in range(12):
        f = 2 * th + np.sin(2 * th) - np.pi * np.sin(b)
        th -= f / (2 + 2 * np.cos(2 * th) + 1e-12)
    gh, gw = gal.shape[:2]
    Rg = gw / (4 * np.sqrt(2))
    # Stay a few pixels inside the map's edge at l = ±180°, so the seam never samples the black outside.
    lmax = np.pi - 7.0 / ((2 * np.sqrt(2) / np.pi) * Rg * np.maximum(np.cos(th), 0.05))
    l = np.clip(l, -lmax, lmax)
    gx = gw / 2 - (2 * np.sqrt(2) / np.pi) * Rg * l * np.cos(th) - 0.5
    gy = gh / 2 - np.sqrt(2) * Rg * np.sin(th) - 0.5
    mapx = np.full((H, W), -1, np.float32)
    mapy = np.full((H, W), -1, np.float32)
    mapx[inside] = gx
    mapy[inside] = gy
    return cv2.remap(gal, mapx, mapy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)


def sky():
    s = A / "sky"
    o = OUT / "sky"
    o.mkdir(parents=True, exist_ok=True)
    g = cv2.imread(str(s / "allsky_gal.png"), cv2.IMREAD_UNCHANGED)
    fixed = fill_galactic_centre(g)
    cv2.imwrite(str(o / "allsky_gal.jpg"), fixed, [cv2.IMWRITE_JPEG_QUALITY, 94])
    for det in range(1, 7):
        band = cv2.imread(str(s / f"allsky_D{det}.png"), cv2.IMREAD_UNCHANGED)
        cv2.imwrite(str(o / f"allsky_D{det}.jpg"), fill_band_holes(band[..., 0], band[..., 3]), [cv2.IMWRITE_JPEG_QUALITY, 92])
    # The equatorial map centred on Iris, reprojected from the repaired galactic map so both agree.
    cv2.imwrite(str(o / "allsky_eq_iris.jpg"), mollweide_gal_to_eq(fixed, 161.29678, 2.44824), [cv2.IMWRITE_JPEG_QUALITY, 94])
    for p in sorted(s.glob("*.png")):
        if p.stem.startswith(("allsky", "prev")):
            continue
        save(Image.open(p).convert("RGB"), o / f"{p.stem}.jpg", 93)
    print(" ✓ sky")


def tiles():
    src = sorted((A / "tiles").glob("*.jpg"))
    # Keep tiles with something in them; empty ones read as missing data.
    def ok(p):
        a = np.asarray(Image.open(p).convert("RGB")).astype(np.float64)
        if a.mean() <= 12:
            return False  # empty: reads as missing data
        hsv = cv2.cvtColor(a.astype(np.uint8), cv2.COLOR_RGB2HSV)
        loud = ((hsv[..., 1] > 150) & (hsv[..., 2] > 90)).mean()
        return loud < 0.02  # the QR2 map's unfinished Galactic-centre tiles are flat, saturated blocks

    keep = [p for p in src if ok(p)]
    sheet_cols = 24
    rows = (len(keep) + sheet_cols - 1) // sheet_cols
    sheet = Image.new("RGB", (sheet_cols * 192, rows * 192))
    for i, p in enumerate(keep):
        sheet.paste(Image.open(p).convert("RGB"), ((i % sheet_cols) * 192, (i // sheet_cols) * 192))
    save(sheet, OUT / "sky" / "tiles_sheet.jpg", 90)
    (OUT / "sky" / "tiles.json").write_text(json.dumps({"cols": sheet_cols, "count": len(keep), "tile": 192}))
    print(" ✓ tiles", len(keep))


def extras():
    """Orbits for the solar-system shot, coastlines for the globe, and real code and commits."""
    import subprocess
    import truststore
    import urllib.parse
    import urllib.request

    truststore.inject_into_ssl()
    o = OUT / "extras"
    o.mkdir(parents=True, exist_ok=True)
    dest = o / "orbits.json"
    if not dest.exists():
        bodies = {"Mercury": "199", "Venus": "299", "Earth": "399", "Mars": "499", "Jupiter": "599", "Iris": "'7;'"}
        out = {}
        for name, cmd in bodies.items():
            q = {"format": "json", "COMMAND": cmd if cmd.startswith("'") else f"'{cmd}'", "EPHEM_TYPE": "ELEMENTS",
                 "CENTER": "'500@10'", "START_TIME": "'2025-12-02 21:49'", "STOP_TIME": "'2025-12-02 22:49'",
                 "STEP_SIZE": "'1 h'", "OBJ_DATA": "NO", "REF_PLANE": "ECLIPTIC"}
            r = json.loads(urllib.request.urlopen("https://ssd.jpl.nasa.gov/api/horizons.api?" + urllib.parse.urlencode(q), timeout=120).read())["result"]
            block = r.split("$$SOE")[1].split("$$EOE")[0]
            el = {}
            for tok in block.replace("=", " = ").split():
                pass
            import re

            for k, v in re.findall(r"\b(EC|QR|IN|OM|W|Tp|N|MA|TA|A|AD|PR)\s*=\s*([-+0-9.E]+)", block):
                el.setdefault(k, float(v))
            out[name] = {"a": el["A"] / 1.495978707e8, "e": el["EC"], "i": el["IN"], "node": el["OM"], "peri": el["W"], "M": el["MA"]}
            print("   ", name, {k: round(v, 3) for k, v in out[name].items()})
        dest.write_text(json.dumps({"epoch": "2025-12-02T21:49Z", "bodies": out}, indent=1))
    land = json.loads((FILM.parent / "frontend" / "public" / "data" / "land-110m.json").read_text())
    (o / "land.json").write_text(json.dumps(land))
    log = subprocess.run(["git", "-C", str(FILM.parent), "log", "--reverse", "--format=%h %ad %s", "--date=format:%d %b"],
                         capture_output=True, text=True, check=True).stdout
    (o / "gitlog.txt").write_text(log)
    src = (FILM.parent / "backend" / "src" / "spherex_explorer" / "science" / "sources.py").read_text()
    start = src.index("def find_candidates")
    (o / "code.txt").write_text(src[start : start + 3200])
    print(" ✓ extras", len(log.splitlines()), "commits")


if __name__ == "__main__":
    import sys

    steps = {"iris": iris, "pluto": pluto, "barnard": barnard, "sky": sky, "tiles": tiles, "extras": extras}
    for name in sys.argv[1:] or steps:
        steps[name]()
