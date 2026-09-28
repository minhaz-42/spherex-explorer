"""What the assistant may say about SPHEREx and this app, and where each statement comes from.

Every entry is written from the project's own research and methods notes
(``docs/research/spherex-data-research.md``, ``docs/scientific-methods.md``). The assistant is told
to use these entries and the evidence built for each question, and nothing else, for facts.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

CORE_FACTS = """\
- SPHEREx is a NASA space telescope launched on 12 March 2025 (UTC). Science operations began on 1 May 2025.
- It maps the whole sky every six months in 102 spectral channels between 0.75 and 5.0 µm, with 6.15″ pixels.
- Six detectors: D1 0.75–1.09 µm, D2 1.10–1.62 µm, D3 1.63–2.41 µm, D4 2.42–3.82 µm, D5 3.83–4.41 µm, D6 4.42–5.00 µm. They work in pairs that see the same sky at once: D1+D4, D2+D5, D3+D6.
- Each detector sits behind a linear variable filter: the wavelength changes across the detector, so every exposure sees a given star at a different wavelength. A full spectrum of one spot takes one to two weeks of exposures.
- Public data: IRSA Quick Release 2 (24 Apr 2025 – 20 Jul 2026) and Quick Release 3 (20 Jul – 17 Aug 2026). Images are in MJy/sr. There are no SPHEREx source catalogues or light curves yet.
- SPHEREx Explorer aligns frames north up, uses one brightness scale per sequence, subtracts each frame's local background, and masks flagged pixels. It shows a difference image only for two frames from the same detector that saw the target within half a spectral channel of each other.
- Motion and brightness are judged differently. Motion is seen by comparing positions between frames (blink or side by side): stars stay put, Solar System objects shift, whatever the wavelength. A difference image compares brightness, which is only fair at matched wavelengths.
- Known asteroids and comets come from NASA/JPL's SBIdent and Horizons services, computed for SPHEREx's own position. The app's own moving-source search reports candidates; a candidate is unconfirmed unless it matches a JPL prediction.
- SPHEREx Explorer is an independent project for the 2026 NASA Space Apps Challenge, not affiliated with or endorsed by NASA, JPL, Caltech or IPAC."""


@dataclass(frozen=True)
class Entry:
    id: str
    title: str
    keywords: tuple[str, ...]
    text: str
    source: str


ENTRIES: tuple[Entry, ...] = (
    Entry(
        "spherex",
        "What SPHEREx is",
        (
            "what is spherex",
            "spherex",
            "mission",
            "launch",
            "telescope",
            "goal",
            "science",
            "inflation",
            "ices",
            "galaxies",
        ),
        "SPHEREx (the Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer) "
        "is a NASA space telescope launched on 12 March 2025. From a polar orbit about 650 km up it maps the whole "
        "sky every six months in 102 colours of infrared light, from 0.75 to 5 µm. Its science goals are the first "
        "moments of the Universe, the history of galaxies, and the ices from which planets form.",
        "About › SPHEREx; SPHEREx Explanatory Supplement v2.0",
    ),
    Entry(
        "lvf",
        "Linear variable filters",
        (
            "linear variable",
            "filter",
            "102",
            "channel",
            "colour",
            "color",
            "no filter wheel",
            "how does spherex see",
        ),
        "SPHEREx has no filter wheel. Each detector sits behind a linear variable filter whose pass band changes "
        "along the detector, so the wavelength a star is seen at depends on where it lands. As SPHEREx steps "
        "across the sky, each star falls on many parts of the filter; one to two weeks of exposures add up to its "
        "spectrum in 102 channels.",
        "About › SPHEREx; docs/research §2",
    ),
    Entry(
        "wavelength",
        "The wavelength at the target",
        (
            "wavelength at the target",
            "wavelength",
            "micron",
            "µm",
            "um",
            "why different",
            "different colour",
            "bandwidth",
        ),
        "Every frame is labelled with the wavelength that fell on your target, read from that frame's own spectral "
        "lookup table (WCS-WAVE) at the target's pixel. Before the pixels load it is estimated from the image "
        "footprint to about 0.002 µm. Because of the linear variable filters, two frames of the same place "
        "usually saw it at different wavelengths.",
        "About › Methods; docs/scientific-methods.md §3",
    ),
    Entry(
        "matched",
        "Comparing brightness fairly",
        (
            "one wavelength",
            "matched",
            "light curve",
            "brightness change",
            "changed brightness",
            "vary",
            "variable",
            "fade",
            "brighter",
            "dimmer",
            "over time",
        ),
        "A brightness difference between two frames means a change in time only if both saw the source at the "
        "same wavelength. The 'One wavelength' sequence keeps frames from every pass that saw the target within "
        "half a spectral channel of a chosen wavelength, one per pointing; outside the deep fields that happens "
        "about once every six months.",
        "Explore › Sequence; docs/scientific-methods.md §8",
    ),
    Entry(
        "difference",
        "When a difference image is allowed",
        (
            "difference",
            "subtract",
            "b − a",
            "b - a",
            "why can't",
            "unavailable",
            "misleading",
            "not allowed",
        ),
        "The difference view (B minus A) is shown only when both frames come from the same detector and saw the "
        "target within half a spectral channel of each other. Otherwise the difference would mostly show how the "
        "sources' brightness varies with wavelength, not a change in time, so the app explains why and offers "
        "blinking, which compares positions.",
        "About › Methods; docs/scientific-methods.md §8",
    ),
    Entry(
        "blink",
        "Blink and side by side",
        ("blink", "side by side", "compare", "flip", "reference", "frame a", "frame b"),
        "Blink flips between a reference frame A and the current frame B on the same north-up grid and brightness "
        "scale; side by side shows them next to each other, zoomed together. Stars stay put between frames; "
        "anything that shifts against them is in the Solar System. Press R to make the current frame the "
        "reference.",
        "Explore › Comparison",
    ),
    Entry(
        "passes",
        "Passes, pointings and frames",
        (
            "pass",
            "pointing",
            "frame",
            "timeline",
            "months apart",
            "hours apart",
            "steps",
            "exposure",
            "how often",
        ),
        "A frame is one detector's image from one exposure (about 114 seconds). SPHEREx takes up to four exposures "
        "a couple of minutes apart at each pointing, each moving the sky onto a new part of the filter. It points at "
        "a spot several times over a few days, hours apart, and returns about every six months; those returns are "
        "the survey passes on the timeline.",
        "About › How it works; docs/scientific-methods.md §1",
    ),
    Entry(
        "flags",
        "Flagged pixels",
        (
            "flag",
            "masked",
            "mask",
            "hot pixel",
            "cosmic ray",
            "bloom",
            "ghost",
            "persistence",
            "filled in",
            "bad pixel",
        ),
        "The SPHEREx pipeline flags pixels hit by cosmic rays, hot or dead pixels, ghosts, persistence and "
        "similar problems. The app masks the same set IRSA's mosaic tool excludes; masked pixels are filled from "
        "their surroundings for display only and are never measured. 'Show flagged pixels' tints them. The "
        "SOURCE flag only means a catalogued source falls there, so it is not masked.",
        "About › Methods; docs/scientific-methods.md §4",
    ),
    Entry(
        "background",
        "Background light",
        ("background", "zodiacal", "airglow", "glow", "haze", "sky level"),
        "SPHEREx images still contain zodiacal light (sunlight scattered by dust in the Solar System) and airglow, "
        "which change from frame to frame. The app subtracts each frame's local background, a sigma-clipped median "
        "of unflagged pixels, so whole frames do not appear to brighten and fade.",
        "About › Methods; docs/scientific-methods.md §5",
    ),
    Entry(
        "photometry",
        "How brightness is measured",
        (
            "brightness",
            "flux",
            "magnitude",
            "aperture",
            "signal-to-noise",
            "s/n",
            "snr",
            "how bright",
        ),
        "Brightness at the target is simple aperture photometry: a 12.3″ circle on the frame's own pixels, minus a "
        "local background from a surrounding ring, with an uncertainty from the pipeline's variance map. There is "
        "no aperture correction or PSF fitting, so the numbers are for comparing frames, not precise absolute "
        "fluxes. If most of the aperture is flagged, no brightness is reported.",
        "About › Methods; docs/scientific-methods.md §7",
    ),
    Entry(
        "saturation",
        "Saturation and overflow",
        (
            "saturat",
            "overflow",
            "too bright",
            "burned",
            "lower limit",
            "star core",
            "black spot",
            "dark spot",
            "hole",
        ),
        "Very bright sources reach the detectors' overflow threshold, about half their full capacity. The app "
        "marks such measurements with a caveat. In the newer QR3 release the pipeline may also flag a saturated "
        "core as BLOOM, and then the core is not measured at all. Masked pixels are filled from their "
        "surroundings for display, so such a star can look flat or smudged in the middle.",
        "docs/research §13; docs/limitations.md",
    ),
    Entry(
        "known",
        "Known asteroids and comets",
        (
            "jpl",
            "known",
            "asteroid",
            "comet",
            "horizons",
            "sbident",
            "predicted",
            "prediction",
            "catalogued",
            "identify",
            "what is that dot",
        ),
        "When asked, the app sends the field and the time of the middle frame to NASA/JPL's Small-Body "
        "Identification service, with SPHEREx itself as the observer, to learn which catalogued asteroids and "
        "comets are there. JPL Horizons then gives each one's position at every frame time. These are "
        "predictions for known objects, drawn as blue tracks; they are not detections.",
        "About › Methods; docs/scientific-methods.md §9",
    ),
    Entry(
        "parallax",
        "Seeing from SPHEREx's position",
        (
            "parallax",
            "spacecraft position",
            "viewpoint",
            "from earth",
            "geocentric",
            "orbit position",
        ),
        "SPHEREx orbits about 7,000 km from Earth's centre, so a nearby body appears slightly shifted against the "
        "stars compared with a view from Earth's centre. The app corrects each JPL position using the "
        "spacecraft's position recorded in each frame; for asteroid (7) Iris this matches JPL's own "
        "SPHEREx-centred answer to 0.003″.",
        "docs/scientific-methods.md §9",
    ),
    Entry(
        "search",
        "The moving-source search",
        (
            "moving source",
            "moving-source",
            "search",
            "candidate",
            "detect",
            "track",
            "unknown",
            "new object",
            "undiscovered",
            "find something",
        ),
        "The search detects sources in every aligned frame of a pass, drops those seen again at the same place in "
        "another pointing (stars stay put), keeps what repeats within one pointing (to rule out cosmic rays), and "
        "links those sightings on straight tracks at a constant rate. Three or more sightings make a candidate, "
        "two a weak candidate. A candidate matching a JPL prediction is a known object; an unmatched one is "
        "unconfirmed and most often an artefact.",
        "About › Methods; docs/scientific-methods.md §10",
    ),
    Entry(
        "planet-x",
        "Planet X and SPHEREx",
        (
            "planet x",
            "planet nine",
            "planet 9",
            "new planet",
            "distant planet",
            "ninth planet",
            "hidden planet",
        ),
        "A large planet far beyond Neptune, often called Planet Nine, has been proposed to explain how some "
        "distant objects orbit; it has not been found. At around 500 au it would move only a few arcseconds a "
        "day, less than one SPHEREx pixel, so within one pass it would look like a star; six months later it "
        "would appear about a quarter of a degree away. Published estimates put it near or beyond what a single "
        "SPHEREx exposure can detect. This app cannot find or rule it out.",
        "Discover › What about Planet X?",
    ),
    Entry(
        "deep",
        "Deep fields",
        (
            "deep field",
            "deep survey",
            "ecliptic pole",
            "north pole",
            "south pole",
            "most observed",
            "every orbit",
            "nep",
        ),
        "SPHEREx turns to look at two deep fields of about 100 square degrees near the ecliptic poles on nearly "
        "every orbit, so they are seen far more often than the rest of the sky. Quick Release 2 alone holds "
        "24,103 deep-survey images of the north ecliptic pole point. The viewer currently shows the wide survey; "
        "the deep survey is available through the API.",
        "docs/research §2, §4",
    ),
    Entry(
        "releases",
        "Data releases",
        (
            "qr2",
            "qr3",
            "release",
            "quick release",
            "calibration",
            "dr1",
            "catalogue",
            "catalog",
            "when was",
            "how recent",
        ),
        "The public SPHEREx data are Quick Release 2 (24 Apr 2025 – 20 Jul 2026) and Quick Release 3 "
        "(20 Jul – 17 Aug 2026, released 16 Sep 2026, new calibrations). The SPHEREx team advises caution when "
        "combining the two, so the app warns when a comparison mixes them. All-sky spectral cubes are scheduled "
        "for late 2026 and a source catalogue for August 2027.",
        "docs/research §3",
    ),
    Entry(
        "live",
        "Live data and the demo snapshot",
        (
            "live",
            "real time",
            "real-time",
            "realtime",
            "latest",
            "up to date",
            "up-to-date",
            "fresh",
            "snapshot",
            "demo",
            "recorded",
            "cached",
            "how old",
        ),
        "By default the app is live: every search asks NASA's IRSA archive, JPL and CDS at that moment, and the "
        "server keeps the answers in a cache. SPHEREx data are not a real-time feed: images reach IRSA within 60 "
        "days of observation and are released weekly, so the newest are about two months old. The demo snapshot "
        "is a labelled recording of real data for the Discover cases, used only when the visitor chooses it.",
        "docs/research §3; README › Live data and demo mode",
    ),
    Entry(
        "units",
        "Units",
        (
            "mjy/sr",
            "megajansky",
            "microjansky",
            "millijansky",
            "jansky",
            "µjy",
            "mjy",
            "jy",
            "steradian",
            "surface brightness",
            "unit",
            "ab magnitude",
        ),
        "Pixel values are surface brightness in megajanskys per steradian (MJy/sr). Brightness at the target is a "
        "flux density in microjanskys (µJy), millijanskys (mJy) or janskys (Jy); 1 Jy is 10⁻²⁶ watts per square "
        "metre per hertz. The AB magnitude is −2.5 log₁₀(flux ÷ 3631 Jy): smaller is brighter.",
        "docs/scientific-methods.md §7",
    ),
    Entry(
        "coordinates",
        "Sky coordinates",
        (
            "right ascension",
            "declination",
            "ra",
            "dec",
            "coordinates",
            "galactic",
            "ecliptic",
            "arcsec",
            "arcmin",
            "degree",
        ),
        "Right ascension (RA) and declination (Dec) locate a point on the sky like longitude and latitude. "
        "Galactic coordinates are measured from the plane of the Milky Way; ecliptic coordinates from the plane "
        "of Earth's orbit, near which most asteroids travel. A degree has 60 arcminutes (′) and 3,600 "
        "arcseconds (″); one SPHEREx pixel is 6.15″.",
        "Explore › search",
    ),
    Entry(
        "psf",
        "Sharpness and residuals",
        ("psf", "point spread", "residual", "blurry", "blocky", "pixelated", "resolution", "sharp"),
        "SPHEREx pixels are 6.15″, large compared with most telescopes, because it is built to map the whole sky in "
        "many colours rather than to see fine detail. The viewer draws each pixel as a square so nothing finer "
        "than the data is implied. The point-spread function changes across the detector, so difference images "
        "leave residuals near bright stars.",
        "docs/scientific-methods.md §6, §8",
    ),
    Entry(
        "howto",
        "Using SPHEREx Explorer",
        (
            "how do i",
            "how to",
            "how can i",
            "use the app",
            "play",
            "zoom",
            "keyboard",
            "shortcut",
            "snapshot",
            "demo",
            "share",
            "link",
        ),
        "Search a name or coordinates on Explore. Choose a survey pass and a wavelength band, then press play or "
        "step with the arrow keys; Blink, Side by side and Difference compare a reference frame A with the "
        "current frame B. Brightness plots, the JPL check and the moving-source search are further down. Every "
        "view's link can be shared. The demo snapshot replays recorded real data without a network.",
        "Explore",
    ),
    Entry(
        "credits",
        "Data, credits and privacy",
        (
            "who made",
            "affiliated",
            "nasa",
            "credit",
            "privacy",
            "data from",
            "where does the data",
            "source of",
        ),
        "Images and metadata come from the SPHEREx Quick Release data at the NASA/IPAC Infrared Science Archive "
        "(IRSA); asteroid positions from NASA/JPL; object names from CDS Sesame. SPHEREx Explorer is independent "
        "and not affiliated with or endorsed by NASA, JPL, Caltech or IPAC. It has no accounts, cookies or "
        "analytics; this assistant runs on a language model on the server's own machine.",
        "About › Data and credits",
    ),
    Entry(
        "main-belt",
        "Main-belt asteroids",
        ("main belt", "main-belt", "how far", "distance", "how big", "au"),
        "Most asteroids orbit in the main belt between Mars and Jupiter, roughly 2 to 3.3 au from the Sun "
        "(1 au is the Earth–Sun distance). Seen from Earth they drift against the stars by tens of arcseconds "
        "an hour, which is why they shift between SPHEREx pointings taken hours apart.",
        "General astronomy",
    ),
)

_STOP = {
    "the",
    "a",
    "an",
    "is",
    "are",
    "was",
    "were",
    "of",
    "to",
    "in",
    "on",
    "at",
    "and",
    "or",
    "it",
    "this",
    "that",
    "what",
    "why",
    "how",
    "do",
    "does",
    "i",
    "me",
    "my",
    "you",
    "can",
    "could",
    "would",
    "be",
    "for",
    "with",
    "about",
    "there",
    "here",
    "these",
    "those",
    "which",
    "who",
    "when",
    "where",
    "so",
    "if",
    "not",
    "no",
    "yes",
    "please",
}


def _words(text: str) -> set[str]:
    return {
        w for w in re.findall(r"[a-zα-ωµ0-9/+\-]+", text.lower()) if w not in _STOP and len(w) > 1
    }


def _pattern(keyword: str) -> re.Pattern[str]:
    """A keyword starts a word; a short last word ("RA", "Jy", "planet x") must also end one.

    Longer keywords are stems: "saturat" finds "saturated" and "saturation", "pass" finds
    "passes". A digit may come first, so "1.5µm" finds "µm".
    """
    whole = len(keyword.split()[-1]) <= 3
    return re.compile(r"(?<![^\W\d])" + re.escape(keyword) + (r"(?:e?s)?(?!\w)" if whole else ""))


_PATTERNS = [(entry, kw, _pattern(kw)) for entry in ENTRIES for kw in entry.keywords]


def _keyword_hits(q: str) -> list[tuple[Entry, str, int, int]]:
    """Keyword matches in a question, minus those inside a longer match.

    "MJy/sr" should count for the units note, not also as "MJy" and "Jy" for the photometry note.
    """
    hits = [(entry, kw, m.start(), m.end()) for entry, kw, p in _PATTERNS for m in p.finditer(q)]
    return [
        h
        for h in hits
        if not any(o[2] <= h[2] and h[3] <= o[3] and o[3] - o[2] > h[3] - h[2] for o in hits)
    ]


def search(question: str, limit: int = 3) -> list[Entry]:
    """The entries most relevant to a question: keyword matches first, then shared words."""
    # Greek mu (as typed) to the micro sign; curly apostrophes to straight.
    q = question.lower().replace("μ", "µ").replace("’", "'")
    words = _words(question)
    keyword_score: dict[str, float] = {}
    for entry, kw, _, _ in {(h[0], h[1], 0, 0) for h in _keyword_hits(q)}:
        keyword_score[entry.id] = keyword_score.get(entry.id, 0.0) + 3.0 + 1.0 * kw.count(" ")
    scored: list[tuple[float, Entry]] = []
    for entry in ENTRIES:
        score = keyword_score.get(entry.id, 0.0)
        score += 1.0 * len(words & _words(entry.title))
        score += 0.15 * len(words & _words(entry.text))
        if score >= 1.2:
            scored.append((score, entry))
    scored.sort(key=lambda s: -s[0])
    return [e for _, e in scored[:limit]]


def by_id(entry_id: str) -> Entry | None:
    return next((e for e in ENTRIES if e.id == entry_id), None)
