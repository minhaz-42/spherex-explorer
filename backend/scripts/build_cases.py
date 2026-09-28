"""Build the Discover cases and the demo snapshot from live archive data.

Each case below names a place, a detector and a date. The script runs the app's own API
in-process for it (observations, aligned cutouts, JPL known objects, the moving-source search,
brightness measurements) and writes:

- ``data/cases.json``: the cases, with evidence sentences built from those real results;
- ``data/snapshot/``: every API answer the cases needed, which is the demo snapshot. In demo
  mode the app serves only these recorded answers, so it can run without a network while showing
  exactly the data the cases were built from.

Usage: ``make snapshot`` (or ``uv run python scripts/build_cases.py``). Takes several minutes.
"""

from __future__ import annotations

import asyncio
import json
import math
import shutil
import sys
from datetime import UTC, datetime
from typing import Any

import httpx
from asgi_lifespan import LifespanManager

from spherex_explorer.config import REPO_ROOT, Settings
from spherex_explorer.main import create_app

SNAPSHOT = REPO_ROOT / "data" / "snapshot"
CASES_FILE = REPO_ROOT / "data" / "cases.json"

CASES: list[dict[str, Any]] = [
    {
        "id": "iris-2025-12",
        "kind": "moving",
        "title": "Asteroid (7) Iris crosses a field in Sextans",
        "name": "Asteroid (7) Iris near 36 Sextantis",
        "ra": 161.29678,
        "dec": 2.44824,
        "detector": 2,
        "month": "2025-12",
        "fov": 0.3,
        "frame": "2025W49_1A_0423_1",
        "reference": "2025W49_1A_0332_1",
        "compare": "blink",
        # {placeholders} are filled from the data when the case is built.
        "summary": (
            "Over {hours} hours SPHEREx pointed at this patch of Sextans {pointings} times. The "
            "bright star 36 Sextantis stays put; a point of light beside it does not. It is the "
            "main-belt asteroid (7) Iris, {distance_au} au away, crossing one SPHEREx pixel "
            "about every {minutes_per_pixel} minutes."
        ),
    },
    {
        "id": "hebe-2025-05",
        "kind": "moving",
        "title": "Asteroid (6) Hebe in Aquarius",
        "name": "Asteroid (6) Hebe in Aquarius",
        "ra": 326.891,
        "dec": -7.683,
        "detector": 2,
        "month": "2025-05",
        "fov": 0.3,
        "compare": "side",
        "optional": True,
        "summary": (
            "In May 2025, in SPHEREx's first weeks of science, the main-belt asteroid (6) Hebe, "
            "{distance_au} au away, passed through this field. Compare the {pointings} pointings "
            "over {hours} hours: the stars keep their places, one source changes position."
        ),
    },
    {
        "id": "m31-spectrum",
        "kind": "spectrum",
        "title": "The core of the Andromeda Galaxy, from 0.75 to 5 µm",
        "query": "M31",
        "name": "Andromeda Galaxy (M31)",
        "detector": 3,
        "month": "2025-12",
        "fov": 0.2,
        "compare": "single",
        "measure_pass": True,
        "summary": (
            "SPHEREx never takes a colour picture. Each exposure sees a place through a slightly "
            "different part of its filters, and over one to two weeks the exposures add up to a "
            "spectrum in 102 colours. Here that spectrum is measured, frame by frame, at the "
            "centre of our neighbouring galaxy."
        ),
    },
    {
        "id": "nep-deep",
        "kind": "context",
        "title": "The north ecliptic pole, the most watched spot in the survey",
        "name": "North ecliptic pole",
        "ra": 270.0,
        "dec": 66.56,
        "detector": None,
        "month": None,
        # A small field keeps this case's 80-odd frames light in the demo snapshot.
        "fov": 0.1,
        "compare": "single",
        "summary": (
            "SPHEREx turns to look at the ecliptic poles on nearly every orbit, so this spot is "
            "seen far more often than the rest of the sky: the wide survey covers it in every "
            "pass, and a separate deep survey adds tens of thousands of frames."
        ),
    },
]


def iso_date(iso: str) -> str:
    d = datetime.fromisoformat(iso.replace("Z", ""))
    return f"{d.day} {d.strftime('%b %Y')}"


def fmt_flux(ujy: float) -> str:
    if abs(ujy) >= 1e6:
        return f"{ujy / 1e6:.3g} Jy"
    if abs(ujy) >= 1e3:
        return f"{ujy / 1e3:.3g} mJy"
    return f"{ujy:.3g} µJy"


def sep_arcsec(ra1: float, dec1: float, ra2: float, dec2: float) -> float:
    return math.hypot((ra1 - ra2) * math.cos(math.radians(dec1)), dec1 - dec2) * 3600


class Api:
    def __init__(self, client: httpx.AsyncClient) -> None:
        self.client = client

    async def get(self, path: str, **params: Any) -> dict[str, Any]:
        r = await self.client.get(f"/api{path}", params=params, timeout=1800)
        body: dict[str, Any] = r.json()
        if r.status_code != 200:
            raise RuntimeError(f"{path}: {body.get('error', body)}")
        return body

    async def post(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        r = await self.client.post(f"/api{path}", json=body, timeout=1800)
        answer: dict[str, Any] = r.json()
        if r.status_code != 200:
            raise RuntimeError(f"{path}: {answer.get('error', answer)}")
        return answer


async def gather_limited(jobs: list[Any], limit: int = 4) -> list[Any]:
    slots = asyncio.Semaphore(limit)

    async def run(job: Any) -> Any:
        async with slots:
            return await job

    return await asyncio.gather(*(run(j) for j in jobs))


async def build_case(api: Api, case: dict[str, Any]) -> dict[str, Any] | None:
    print(f"== {case['id']}", flush=True)
    if "query" in case:
        target = await api.get("/resolve", q=case["query"])
        ra, dec = target["ra"], target["dec"]
    else:
        ra, dec = case["ra"], case["dec"]
    obs = await api.get("/observations", ra=ra, dec=dec)
    frames = obs["frames"]
    if not frames:
        print("   no frames")
        return None

    detector = case["detector"]
    if case["month"]:
        in_month = [f for f in frames if f["isoMid"].startswith(case["month"])]
        pass_index = max(
            {f["passIndex"] for f in in_month},
            key=lambda p: sum(f["passIndex"] == p for f in in_month),
        )
    else:
        pass_index = obs["passes"][-1]["index"]
    if detector is None:
        counts: dict[int, int] = {}
        for f in frames:
            if f["passIndex"] == pass_index:
                counts[f["detector"]] = counts.get(f["detector"], 0) + 1
        detector = max(counts, key=lambda d: counts[d])
    sequence = [f for f in frames if f["passIndex"] == pass_index and f["detector"] == detector]
    pass_frames = [f for f in frames if f["passIndex"] == pass_index]
    fov = case["fov"]
    print(f"   {len(sequence)} frames of D{detector} in pass {pass_index}", flush=True)

    cutouts = await gather_limited(
        [api.get("/cutout", key=f["key"], ra=ra, dec=dec, size=fov) for f in sequence]
    )
    by_obs = {f["obsId"]: (f, c) for f, c in zip(sequence, cutouts, strict=True)}
    evidence: list[str] = []
    facts: dict[str, Any] = {}

    frame = case.get("frame") or sequence[len(sequence) // 2]["obsId"]
    reference = case.get("reference") or sequence[0]["obsId"]

    if case["kind"] == "moving":
        body = {"ra": ra, "dec": dec, "size": fov, "keys": [f["key"] for f in sequence]}
        known = await api.post("/known-objects", body)
        found = await api.post("/candidates", body)
        bodies = known["objects"]
        if not bodies:
            print("   JPL knows no body here: skipping")
            return None
        main = bodies[0]
        inside = [p for p in main["positions"] if p["inField"]]
        # Show the case on the first and last frames where the asteroid is in the field.
        if not case.get("frame"):
            keys_inside = {p["key"] for p in inside}
            inside_frames = [f for f in sequence if f["key"] in keys_inside]
            reference = inside_frames[0]["obsId"]
            frame = inside_frames[-1]["obsId"]
        evidence.append(
            f"JPL predicts {main['name']} (V {main['vmag']:.1f}) inside this field in "
            f"{len(inside)} of {len(sequence)} frames, moving about "
            f"{main['rateArcsecPerHour']:.0f}″ per hour, as seen from SPHEREx."
        )
        matched = None
        # Strong candidates (three or more pointings) first, then weak ones (two).
        ranked = sorted(found["candidates"], key=lambda c: c["strength"] != "candidate")
        for cand in ranked:
            if matched is not None and matched[0]["strength"] == "candidate":
                break
            pos = {p["key"]: p for p in main["positions"]}
            offsets = []
            for s in cand["sightings"]:
                preds = [pos[k] for k in s["keys"] if k in pos]
                if preds:
                    offsets.append(
                        sep_arcsec(
                            s["ra"],
                            s["dec"],
                            sum(p["ra"] for p in preds) / len(preds),
                            sum(p["dec"] for p in preds) / len(preds),
                        )
                    )
            if offsets:
                median = sorted(offsets)[len(offsets) // 2]
                if median < 12.3 and (matched is None or median < matched[1]):
                    matched = (cand, median)
        if matched:
            cand, median = matched
            strength = (
                "a candidate"
                if cand["strength"] == "candidate"
                else "a weak candidate on its own (two pointings)"
            )
            evidence.append(
                f"SPHEREx Explorer's own moving-source search, which knows nothing about "
                f"asteroids, found {len(cand['sightings'])} sightings on a straight line at "
                f"{cand['rateArcsecPerHour']:.0f}″ per hour, {strength}, "
                f"{median:.1f}″ from JPL's prediction."
            )
        else:
            evidence.append(
                "SPHEREx Explorer's own moving-source search did not recover it as a track "
                f"(it needs three pointings; {found['stats']['sightings']} sightings were found)."
            )
        in_field = [p for p in main["positions"] if p["inField"]] or main["positions"]
        facts["distance_au"] = f"{sum(p['distanceAu'] for p in in_field) / len(in_field):.1f}"
        if main["rateArcsecPerHour"]:
            facts["minutes_per_pixel"] = f"{6.15 / main['rateArcsecPerHour'] * 60:.0f}"
        facts["knownObject"] = main["name"]
        facts["searchCandidates"] = len(
            [c for c in found["candidates"] if c["strength"] == "candidate"]
        )
        caution = (
            "The asteroid's identity comes from JPL's catalogue and orbit predictions, not from "
            "this app. Brightness differences between frames are partly the asteroid's colour: "
            "each frame saw it at a different wavelength."
        )
    elif case["kind"] == "spectrum":
        measures = await gather_limited(
            [api.get("/measure", key=f["key"], ra=ra, dec=dec) for f in pass_frames]
        )
        measured = [
            m
            for m in measures
            if m["photometry"]["fluxMicroJy"] is not None and m["wavelength"]["atTargetUm"]
        ]
        measured.sort(key=lambda m: m["wavelength"]["atTargetUm"])
        wl = [m["wavelength"]["atTargetUm"] for m in measured]
        flux = [m["photometry"]["fluxMicroJy"] for m in measured]
        evidence.append(
            f"{len(pass_frames)} frames from all six detectors in one pass, "
            f"{iso_date(pass_frames[0]['isoMid'])} to {iso_date(pass_frames[-1]['isoMid'])}, "
            f"measure the centre at {len(measured)} wavelengths between {min(wl):.2f} and "
            f"{max(wl):.2f} µm."
        )
        # Describe the shape from the data: where it peaks, and how far it falls by the red end.
        peak = max(range(len(flux)), key=lambda i: flux[i])
        red = [f for w, f in zip(wl, flux, strict=True) if w >= max(wl) - 0.3]
        red_level = sorted(red)[len(red) // 2]
        evidence.append(
            f"The brightness rises to {fmt_flux(flux[peak])} at {wl[peak]:.2f} µm and falls to "
            f"about {fmt_flux(red_level)} near {max(wl):.1f} µm, the shape of the light of old, "
            "cool stars, which dominate a galaxy's centre."
        )
        overflow = [m for m in measured if m["photometry"]["overflowInAperture"]]
        if overflow:
            top = max(m["wavelength"]["atTargetUm"] for m in overflow)
            evidence.append(
                f"The centre is so bright that {len(overflow)} of these frames reach the "
                "detectors' overflow threshold (about half their full capacity) inside the "
                f"aperture, all at wavelengths up to {top:.1f} µm. Those points carry a caveat "
                "in the plot."
            )
        facts["measured"] = len(measured)
        caution = (
            "Simple aperture photometry on an extended galaxy: the numbers depend on the "
            "aperture and are not calibrated for extended sources. Frames were taken days "
            "apart, and the six detectors are calibrated separately."
        )
    else:
        deep = obs.get("deepField")
        evidence.append(
            f"{obs['summary']['frames']} wide-survey frames cover this spot in "
            f"{obs['summary']['passes']} passes between {iso_date(obs['summary']['first'])} and "
            f"{iso_date(obs['summary']['last'])}."
        )
        if deep:
            evidence.append(
                f"It lies in the {deep['name']}, where SPHEREx's separate deep survey takes "
                "images on nearly every orbit: Quick Release 2 alone holds 24,103 deep-survey "
                "images of this very point (IRSA image search, September 2026)."
            )
        caution = (
            "Many frames of the same spot are ideal for finding faint, slow changes, but each "
            "frame still sees a different wavelength."
        )

    f_shown, cut_main = by_obs.get(frame, (sequence[0], cutouts[0]))
    phot = cut_main["photometry"]
    if case["kind"] == "moving" and phot["fluxMicroJy"] is not None:
        # The brightness at the target describes the asteroid only if it is at the target.
        predicted = next((p for p in main["positions"] if p["key"] == f_shown["key"]), None)
        if predicted and sep_arcsec(predicted["ra"], predicted["dec"], ra, dec) < 6.15:
            note = " (possibly saturated)" if phot["overflowInAperture"] else ""
            body_name = main["name"].split(" (")[0]
            evidence.append(
                f"Where JPL puts {body_name} in the frame shown, SPHEREx measured "
                f"{fmt_flux(phot['fluxMicroJy'])} at {cut_main['wavelength']['atTargetUm']:.3f} µm"
                f"{note}, signal-to-noise {phot['snr']:.0f}."
            )

    span_h = datetime.fromisoformat(sequence[-1]["isoMid"]) - datetime.fromisoformat(
        sequence[0]["isoMid"]
    )
    words = {
        2: "two",
        3: "three",
        4: "four",
        5: "five",
        6: "six",
        7: "seven",
        8: "eight",
        9: "nine",
    }
    n_pointings = len({f["pointing"] for f in sequence})
    fill = {
        "hours": f"{span_h.total_seconds() / 3600:.0f}",
        "pointings": words.get(n_pointings, str(n_pointings)),
        **{k: v for k, v in facts.items() if isinstance(v, str)},
    }
    return {
        "id": case["id"],
        "kind": case["kind"],
        "title": case["title"],
        "summary": case["summary"].format(**fill),
        "target": {
            "ra": ra,
            "dec": dec,
            "name": case["name"],
            "constellation": obs["target"]["constellation"],
        },
        "viewer": {
            "seq": "pass",
            "det": detector,
            "f": frame,
            "fa": reference,
            "cmp": case["compare"],
            "fov": fov,
        },
        "observed": {
            "start": sequence[0]["isoMid"],
            "end": sequence[-1]["isoMid"],
            "frames": len(sequence),
            "pointings": len({f["pointing"] for f in sequence}),
            "detector": detector,
            "wavelengthUm": [
                min(f["wavelengthUm"] for f in sequence if f["wavelengthUm"]),
                max(f["wavelengthUm"] for f in sequence if f["wavelengthUm"]),
            ],
        },
        "preview": {
            tag: {
                "obsId": f["obsId"],
                "key": f["key"],
                "isoMid": f["isoMid"],
                "wavelengthUm": c["wavelength"]["atTargetUm"],
            }
            for tag, (f, c) in (
                ("a", by_obs.get(reference, (sequence[0], cutouts[0]))),
                ("b", by_obs.get(frame, (sequence[-1], cutouts[-1]))),
            )
        },
        "evidence": evidence,
        "caution": caution,
        "facts": facts,
    }


async def main() -> int:
    SNAPSHOT.mkdir(parents=True, exist_ok=True)
    # Record every answer into the snapshot folder: this run's cache *is* the demo snapshot.
    settings = Settings(cache_dir=SNAPSHOT, rate_limit_per_minute=100_000, jpl_timeout_s=240)
    app = create_app(settings)
    built: list[dict[str, Any]] = []
    async with LifespanManager(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://build") as client:
            api = Api(client)
            only = set(sys.argv[1:])
            for case in CASES:
                if only and case["id"] not in only:
                    continue
                try:
                    result = await build_case(api, case)
                except RuntimeError as exc:
                    print(f"   failed: {exc}")
                    if not case.get("optional"):
                        raise
                    result = None
                if result:
                    built.append(result)
                    for line in result["evidence"]:
                        print("   ·", line)
    existing: dict[str, Any] = {}
    if only and CASES_FILE.exists():
        existing = {c["id"]: c for c in json.loads(CASES_FILE.read_text())["cases"]}
    for c in built:
        existing[c["id"]] = c
    order = [c["id"] for c in CASES]
    cases = sorted(
        existing.values(), key=lambda c: order.index(c["id"]) if c["id"] in order else 99
    )
    CASES_FILE.write_text(
        json.dumps(
            {
                "about": "Discover cases built by backend/scripts/build_cases.py from live data.",
                "built": datetime.now(UTC).strftime("%Y-%m-%d"),
                "cases": cases,
            },
            indent=1,
            ensure_ascii=False,
        )
        + "\n"
    )
    print(f"wrote {len(cases)} cases to {CASES_FILE}")
    # Header facts are only an input to live JPL checks; demo mode replays the JPL answers
    # themselves, so they need not ship with the snapshot.
    shutil.rmtree(SNAPSHOT / "meta", ignore_errors=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
