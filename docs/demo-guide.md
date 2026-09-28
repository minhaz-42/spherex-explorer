# Demo guide

A three-minute demonstration of SPHEREx Explorer for the NASA Space Apps judging, with what should
appear at each step, a fallback for bad network, and a clear account of what is real.

## Before the demo

1. `make setup` once, then `make serve`. Open <http://127.0.0.1:8000>. (`make dev` also works, on
   port 5173.)
2. Warm the live cache by opening the Iris case once (Discover → *Explore this case*) and waiting
   for "19 frames of 19 loaded". Then click *Check JPL for known objects* and *Search for moving
   sources* once each. Everything is cached afterwards, so the live demo is instant.
3. If the venue network is poor, use the demo snapshot instead (see Fallback). Test it once
   beforehand with the network off.

## The flow

| # | Say | Do | Expect |
|---|---|---|---|
| 1 | "SPHEREx is a NASA telescope that maps the whole sky every six months in 102 infrared colours." | Open the home page. | The landing page and its search box. |
| 2 | "Anyone can pick a place in the sky." | Search `M31`. | The Andromeda Galaxy heading, its RA/Dec and constellation, and "361 frames in 4 passes" (the count grows as releases add data). |
| 3 | "Every image of that spot, lined up in time." | Press play on the timeline. | Frames step; each has its date and the wavelength at the target. The dots in the strip climb one filter step per exposure. |
| 4 | "Now something that actually moves." | Discover → Asteroid (7) Iris → *Explore this case*. | A blink of two frames 9.7 hours apart: the star stays, a point beside it jumps. |
| 5 | "Is that real? Ask NASA/JPL." | *Check JPL for known objects*. | "7 Iris (A847 PA), V 10.2", a blue predicted track landing on the moving point in every frame. |
| 6 | "And our own search, which knows nothing about asteroids:" | *Search for moving sources*. | Candidate C1, "Matches JPL's prediction for 7 Iris, 0.8″ away (known object)". |
| 7 | "SPHEREx sees each frame at a different wavelength, so we don't pretend a brightness change is a time change." | Click *Difference*. | "A difference image would be misleading here", with the two wavelengths. |
| 8 | "Here is what we measured, and how." | Scroll to *Brightness at the target*; open *Technical details*. | The plot of brightness against wavelength; observation ID, flags, background, pipeline version, link to the original file. |
| 9 | "What can't it do? It can't find Planet X, and it tells you why." | Discover → *What about Planet X?* | The honest limits: slow motion, faintness. |

## Fallback: the demo snapshot

The snapshot holds the real SPHEREx data behind every Discover case, recorded on the date shown in
Discover by `make snapshot`. The recording covers archive answers, aligned cutouts, JPL predictions
and search results. In snapshot mode the app makes no network requests for data.

- On Discover, click *Open the demo snapshot* on a case. Every data view then shows the badge
  "Demo snapshot · real SPHEREx data, retrieved …" instead of "Live · IRSA archive".
- Anything outside the snapshot (another position, pass or detector) says "not part of the demo
  snapshot" and offers live data. It never substitutes anything.
- If the live archive fails mid-demo, the error panel offers *Use the demo snapshot instead*.

## What is real

- **Real:** every image, time, wavelength and brightness shown, read from the SPHEREx Quick
  Release data at IRSA; every asteroid identification and predicted position, from JPL; every
  object name lookup, from CDS.
- **Computed by this app:** alignment, background removal, aperture brightness, the difference
  images, the moving-source search and its candidates. The methods are on the About page and in
  [scientific-methods.md](scientific-methods.md).
- **Simulated:** nothing. There are no mock images, no invented detections and no sample
  statistics. The unit tests use synthetic files, but the app never shows them.

## Known limitations to mention if asked

- **Wavelength.** Each frame sees a different wavelength, so brightness comparisons need the
  matched-wavelength mode.
- **Speed.** The first load of a new place takes tens of seconds from Bangladesh, because the data
  live in the US. It is much faster from a US server, and cached afterwards.
- **The search.** It is simple, and the brighter the object, the better it works. Unmatched
  candidates are unconfirmed.
- See [limitations.md](limitations.md) for the full list.
