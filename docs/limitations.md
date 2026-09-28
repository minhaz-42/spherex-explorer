# Limitations

What SPHEREx Explorer does not do, and where its results need care. The app shows the relevant
caveat next to each result; this page collects them.

## About the data

- **Quick Release data only.** QR2 covers 2025-04-24 → 2026-07-20 and QR3 covers 2026-07-20 →
  2026-08-17. There are no SPHEREx source catalogues, light curves or spectral cubes yet (DR1 is
  scheduled for late 2026), so every derived value here is this app's own measurement.
- **Two calibrations.** QR3 was processed with new calibrations. The SPHEREx team advises caution
  when combining QR2 and QR3, and the app warns when a comparison does.
- **Airglow and zodiacal light** vary from frame to frame and are only removed as a local constant.
  Structure on scales larger than the field is not modelled.
- **Artefacts.** Satellite streaks, ghosts, snowballs, persistence and diffuse optical transients
  (about 1% of exposures) can look like changes. The pipeline flags most of them and the app masks
  those flags, but not every artefact is flagged.

## About comparisons

- **Wavelength.** Two frames of the same place usually saw it at different wavelengths. A
  brightness difference between them may be the source's colour, not a change in time. Difference
  images are refused unless the wavelengths match within half a channel; blinking is always
  allowed because it compares positions.
- **PSF.** The point-spread function changes across the detector and between releases, so
  differences near bright stars leave residuals.
- **Saturation.** Stars brighter than about magnitude 10 in the near-infrared, and bright asteroids,
  reach the overflow limit. The app flags such measurements and treats them as lower limits.

## About measurements

- **Photometry.** Aperture photometry with no aperture correction or PSF fitting. It is good for
  comparing frames with each other, not for absolute fluxes, and not for extended sources.
- **Wavelength estimates** from footprints are good to about 0.002 µm. The exact per-frame value
  replaces them once pixels load. The lookup table itself is documented as accurate to about 1 nm;
  precise work should use the CWAVE/CBAND calibration products.

## About moving objects

- **Known objects** are JPL predictions for catalogued bodies brighter than V = 20, found once per
  sequence. A sequence spanning months cannot be checked, so the feature is limited to one pass
  spanning less than 20 days. Very fast near-Earth objects can be missed by the search box.
- **The moving-source search** is simple and transparent, not a survey pipeline.
  - It needs sightings in at least two pointings (three for a full candidate).
  - It only links rates of 1.8–154″ per hour.
  - It misses sources fainter than 5σ in a single exposure.
  - An unmatched candidate is most often an artefact. It is never presented as a discovery.
- **Planet X.** A distant planet would move less than one pixel a day and look fixed within a pass.
  Published brightness estimates put it near or beyond the single-exposure depth. The app cannot
  find or rule out such a planet.

## About the service

- **Speed.** Search takes seconds. Each new frame takes seconds to tens of seconds, depending on the
  distance to the AWS us-east-1 region. The first JPL check of a field takes 30 s to 2 min.
  Everything is cached afterwards.
- **Availability.** When IRSA, S3, JPL or CDS is unavailable, the app says which, shows no data
  rather than substitute data, and offers a retry. The demo snapshot is real data recorded for the
  Discover cases, and it is used only when the visitor chooses it.
- **Deep fields.** The deep survey's tens of thousands of frames per position are available through
  the API as a windowed query, but the viewer currently shows the wide survey only.
- **Scale.** The service is a single process with in-memory rate limits, sized for a demo or a
  classroom, not heavy public traffic.
