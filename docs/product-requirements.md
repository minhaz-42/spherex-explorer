# Product requirements

SPHEREx Explorer is a public web tool for looking at how one place in the sky changes across
SPHEREx observations. It sits on top of the public SPHEREx archive at IRSA and never pretends to be
more than that.

**Promise:** find a place in the sky, travel through its observations, see what changed.

## Who it is for

| Visitor | What they need | What we give them |
|---|---|---|
| Curious member of the public | See something real move or change, understand it without jargon | Curated cases, plain labels, a blink view that works on the first click |
| Student or amateur astronomer | Look up a named object, compare dates and wavelengths | Name search, timeline, wavelength filter, metadata in plain units |
| Space Apps judge | See that the tool is real, honest and useful in a 3-minute demo | Live IRSA data, a known asteroid caught by SPHEREx, stated limitations |
| Researcher | Know exactly which files and pixels were used | Observation IDs, file links, flags, units, method notes on every derived value |

## The three questions

The whole interface is organised around three questions, in this order:

1. **Where?** An object name, coordinates or a curated region. Resolved to ICRS RA/Dec, with
   galactic and ecliptic coordinates and the constellation shown alongside.
2. **When?** Every SPHEREx image that covers that point, placed on a timeline. Images cluster into
   *survey passes* about six months apart; inside a pass they are minutes to days apart.
3. **What changed?** Position (motion), brightness at a matched wavelength, and brightness across
   wavelengths (the spectrum SPHEREx builds up over time), each with the method and its limits.

## Functional requirements

### Search (Where)

- R1. Accept an object name, decimal degrees (`10.6847 41.2690`), sexagesimal
  (`00:42:44.3 +41:16:08`, `00h42m44s +41d16m08s`) and pasted catalogue coordinates.
- R2. Resolve names with CDS Sesame (SIMBAD, NED, VizieR). Show which resolver answered.
- R3. Reject invalid input with a message that says what is wrong (Dec out of range, unknown name).
- R4. Offer examples that are known to have data: a galaxy, a deep field, a moving asteroid.

### Observations (When)

- R5. Query SIA v2 for all Wide Survey images (QR2 and QR3) covering the point, and Deep Survey images
  when the point lies in a deep field.
- R6. Normalise each row into an internal `Frame`: time (UTC and MJD), detector and band, exposure,
  footprint, file location, and the wavelength that falls on the target.
- R7. Group frames into passes and visits; show counts per pass and per band.
- R8. Never substitute demo data for a failed live query. Show the error, offer retry, and offer the
  demo snapshot only as an explicit choice.

### Viewer (the time machine)

- R9. Show one aligned frame at a time on a common north-up grid centred on the target.
- R10. Timeline with passes, frames as ticks coloured by wavelength, previous/next, play/pause,
  speed, reset, keyboard control.
- R11. Comparison modes: single, blink, side by side (synchronised zoom and pan), difference.
- R12. One display stretch shared by every frame in a sequence, so a brightness change on screen is a
  brightness change in the data. Pixel readout in MJy/sr.
- R13. Flagged pixels (cosmic rays, hot, cold, non-functional…) are masked and can be shown.
- R14. Loading, empty and error states for the sequence and for each frame.

### Wavelength explorer

- R15. Filter the timeline by detector band and by "matched wavelength" (within half a spectral
  channel of a chosen wavelength).
- R16. Plot aperture brightness at the target against wavelength for every loaded frame (the spectrum)
  and against time for matched-wavelength frames (the light curve).

### Change tools (What changed?)

- R17. Difference view only when two frames are compatible: same detector, same spectral channel at
  the target, both valid at the target, aligned. Otherwise explain why not.
- R18. Known moving objects: ask JPL which catalogued small bodies are in the field and draw their
  predicted positions as seen from SPHEREx in each frame.
- R19. Candidate moving sources: detect point sources that appear in one frame and not the next and
  line up in time. Label them candidates, compare them with JPL, never call them discoveries.
- R20. Every derived value shows its method, units, uncertainty (where available) and limitations.

### Discover

- R21. A small set of curated cases built from real archive data by a script, each with coordinates,
  dates, the change type, the evidence, and a caution line.

### About

- R22. What SPHEREx is, how the app works, the methods, the limitations, data credits, and a clear
  statement that the project is not affiliated with or endorsed by NASA.

### Ask (the assistant)

- R23. A chat page in the main navigation answers questions about the view the visitor had open
  ("Ask about this view" in the viewer), about SPHEREx and about the app's methods, and offers links
  to views (Discover cases, named objects, coordinates). The conversation survives following those
  links and is never stored.
- R24. Answers come from evidence the server gathers from its own data for the view on screen; the
  browser sends identifiers only. A language model running on the same machine phrases the evidence
  and cites it by number. It never sees images, and links are built by the server, never by the
  model.
- R25. Numbers, dates and citations in each answer are checked against its evidence, and anything
  unverified is shown. The language rules below apply to answers.
- R26. The app works fully without a model: the assistant then answers from the same evidence and
  says that no model is running.

## Non-functional requirements

- Works on a consumer laptop and a phone; no GPU; no account; no tracking.
- Downloads only small cutouts, never whole 72 MB files, and caches what it fetched.
- The server validates every input, caps cutout size and frame counts, and times out upstream calls.
- No secrets are needed. Optional configuration lives in `.env` (see `.env.example`).
- The assistant uses local models only (Ollama, or another server on the same machine): questions
  never go to a hosted AI service, and conversations are not stored.
- Accessible: keyboard operable, visible focus, 4.5:1 text contrast, reduced-motion respected.

## Language rules

| Allowed | Not allowed |
|---|---|
| Candidate moving source | New planet, Planet X found |
| Known asteroid (7) Iris, predicted by JPL | Confirmed detection |
| Possible brightness change at 1.62 µm | Variable star discovered |
| Further analysis required | Proof, evidence of life, anything NASA did not say |

## Out of scope for the MVP

- A full-sky change-detection pipeline or source catalogue.
- Mirroring the archive. We cache small derived cutouts only.
- User accounts, saved sessions, comments.
- Forced photometry with PSF fitting (we use simple aperture photometry and say so).
