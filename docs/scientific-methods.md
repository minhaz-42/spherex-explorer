# Scientific methods

How SPHEREx Explorer turns archive files into the images, numbers and labels it shows, and what
each step can and cannot support. Every method here was checked against real data; the checks are
listed with each step and reproduced by the test suite (`make test`, `make test-live`).

## 1. Finding the frames

- **Query.** IRSA SIA v2 over `spherex_qr2` and `spherex_qr3` with a 1″ circle at the target.
  Deep-survey collections are queried only for an explicit window of at most 31 days, because a
  deep-field point can have more than 24,000 frames.
- **Keeping a frame.** A frame is kept only if the target falls inside its pixel grid, estimated
  from the footprint polygon (section 3).
- **Grouping.** Frames are sorted by mid-exposure time and split into *passes* wherever 20 days pass
  without a frame. Inside a pass, frames sharing an observation ID prefix (`2025W49_1A_0332`) form a
  *pointing* of up to four steps, about 2 minutes apart.

## 2. Reading pixels

- **Byte ranges.** A Level 2 file is read with HTTP byte ranges on the public S3 copy: the headers,
  then only the image and flag rows covering the requested field, a few variance rows around the
  target, one zodiacal-light row and the wavelength table.
- **Both releases.** QR3 stores flags as a RICE_1 tile-compressed table with one tile per row; only
  the needed tiles are fetched and decoded.
- **Check.** Output is identical to IRSA's cutout service, for both a QR2 and a QR3 file
  (`tests/test_live.py`).
- **Fallback.** If S3 fails, IRSA's cutout service is used and its WCS is shifted back to
  parent-image pixels.

## 3. Wavelength at the target

- **Where it comes from.** Each Level 2 file has an alternate WCS `W` pointing at a `WCS-WAVE`
  lookup table: wavelength and bandwidth on a coarse grid of control points. We evaluate it by
  bilinear interpolation at the target's pixel.
- **SIP.** SIP is not applied, because wavelength is a property of the detector and filter, not the
  optics. Astropy would apply SIP to this alternate WCS unless told not to, shifting wavelengths by
  about 0.006 µm.
- **Check.** Our evaluation equals astropy's (with SIP disabled) to 4 × 10⁻¹⁶ µm.
- **Estimate before pixels load.**
  - The footprint polygon's four vertices are the outer pixel-grid corners (verified to 4.4″ on real
    headers).
  - A projective transform on the tangent plane places the target within about 5 pixels.
  - Per-detector tables copied from real files (`scripts/extract_wave_tables.py`) then give the
    wavelength.
- **Check.** For the six Iris frames, every estimate lies within 0.2 bandwidths of the exact value
  from each file's own table.

## 4. Alignment and masking

- **Grid.** A gnomonic (TAN) projection centred on the target, north up, east left, with 6.15″
  pixels and an odd size, so the target sits on the central pixel.
- **Resampling.** Bilinear, from each frame's TAN-SIP solution. The image × good-pixel weight and the
  weight are interpolated separately and divided, so a flagged pixel does not leak into its
  neighbours.
- **Check.** Resampling onto an identical grid returns the input to 10⁻⁵. The bright star
  36 Sextantis lands within 0.5 px of its catalogue position in eight independent frames.
- **Mask.** The mask is the set IRSA's Mosaic Tool excludes (Explanatory Supplement v2.0 §3.4.3):
  TRANSIENT, SUR_ERROR, NONFUNC, DICHROIC, MISSING_DATA, HOT, COLD, PHANMISS, NONLINEAR, PERSIST,
  CROSSTALK, GHOST, GHOST_FPA, GHOST_EXT, STREAK, BLOOM, SNOWBALL, HALO, SATELLITE_HALO.
  - SOURCE, OVERFLOW and OUTLIER are informational.
  - Bit numbers are read from each file's header, which uses `MP_*` keywords in QR2 and `MSKN####` in
    QR3.
- **Display fill.** For display, masked pixels are filled with a normalised Gaussian average of
  valid neighbours, widened until the hole closes. The mask sent to the browser marks these pixels,
  and no measurement uses them.

## 5. Background

- **Why.** Zodiacal light and airglow are not subtracted from SPHEREx Level 2 images. The He 1.083 µm
  line alone can reach 30 times the zodiacal level.
- **How.** Each frame's local background is the sigma-clipped (3σ, 5 iterations) median of
  unflagged pixels in the window read. It is subtracted before display.
- **Metadata.** The level, its rms and the pipeline's ZODI model at the target are reported with
  every frame.

## 6. Display

- **One stretch.** Every frame of a sequence is drawn with one stretch, fixed from the reference
  frame: asinh by default, linear or log on request. Black is two background rms below zero, and
  white is the reference frame's 99.5th percentile divided by the contrast setting.
- **Why.** The stretch never adapts per frame, so a brightness change on screen is a change in the
  data.

## 7. Brightness

- **Aperture.** Circular, radius 2 px (12.3″), with 5 × 5 sub-pixel weights, on native pixels.
- **Background.** From a 5–9 px annulus.
- **Flux.** Σ w (I − B) × Ω. Ω comes from the header's `OMEGA_MEDIAN` pixel solid angle, and the
  result is converted from MJy to µJy.
- **Uncertainty.** From the VARIANCE plane plus the background's error of the mean.
- **Reported alongside.** Signal-to-noise, AB magnitude, flagged pixels inside the aperture, and
  whether any aperture pixel reached the overflow limit.
- **Check.** A synthetic point source of known flux is recovered to 2 %.
- **What it is for.** No aperture correction and no PSF fitting. These values compare frames with
  each other; they are not calibrated absolute fluxes, especially for extended sources.

## 8. Comparing two frames

- **When a difference is allowed.** Only when both frames:
  - come from the same detector;
  - saw the target within half a spectral channel of each other, where the channel is the smaller
    bandwidth.
- **When it is not.** The app gives the reason in words, and suggests blinking (valid for positions)
  or a matched-wavelength sequence (valid for brightness).
- **Cautions.** The app warns when QR2 and QR3 mix, because their calibrations differ, and when two
  frames are only minutes apart.
- **Display.** The difference is B − A in MJy/sr on a diverging scale limited to ±6 × the combined
  background rms. Pixels masked in either frame show as no data.
- **Known limitation.** Residuals remain near bright stars, where the PSF differs between frames
  (section 10).

## 9. Known Solar System objects

1. **Which bodies.** SBIdent (two-pass, numerically integrated) is asked for catalogued bodies
   brighter than V = 20.
   - The field is centred on the target at the middle frame's time.
   - Its half-width is the field half-width plus 0.35° per day of sequence span, capped at 3°.
   - The observer is SPHEREx itself, through the frame header's geocentric state vector (`xobs`).
2. **Where, when.** Horizons gives each body's astrometric geocentric RA/Dec and distance at every
   frame's mid-exposure time.
3. **Parallax.** Each position is converted to the direction seen from SPHEREx. The body's
   geocentric vector minus the spacecraft's header position vector gives the direction.
   - **Check.** For (7) Iris the correction is 0.62″. Our value agrees with Horizons' own
     SPHEREx-centred ephemeris to 0.003″.
4. **Rate.** The rate reported is the mean apparent rate over the sequence. SBIdent's instantaneous
   rate from the orbiting spacecraft swings with its 7.5 km/s orbital motion.

These are predictions for catalogued objects. They are drawn as predictions and never counted as
detections.

## 10. Moving-source search

This is a transparent search, not a survey pipeline.

1. **Detect.**
   - Sources are local maxima of the display image smoothed with σ = 0.8 px, more than 5 × the
     (MAD) noise above the median.
   - They must be away from missing data and the frame edge.
   - Peaks within 9 px of very bright sources (> 400σ) are dropped.
   - Detection runs on the display image, whose flagged pixels are filled. The pipeline flags the
     cores of bright moving sources (TRANSIENT, SUR_ERROR), and a first version that refused flagged
     pixels missed (7) Iris entirely.
2. **Static sky.** A detection with a counterpart within 1.5 px in a frame from another pointing, at
   least 30 minutes apart, is a fixed source.
3. **Sightings.** A detection that survives must repeat within 1.5 px in another step of the same
   pointing. This rejects cosmic rays and single-frame glitches that the pipeline did not flag.
4. **Tracks.**
   - Every pair of sightings from different pointings proposes a constant-rate track of
     0.3–25 px/h (1.8–154″/h).
   - Other sightings within 2 px of the prediction join it, and a straight line is refitted, with an
     rms residual limit of 2 px.
   - The longest, best-fitting tracks are accepted first, and each sighting belongs to at most one.
   - Three or more sightings make a *candidate*; two make a *weak candidate*.
5. **Matching.** A candidate matches a known body when the median offset between its sightings and
   JPL's predictions, in the same frames, is under 12.3″ (2 px).

Checks:

- **Synthetic.** The search recovers a mover in a synthetic field with a cosmic ray, a
  wavelength-varying star and missing data, and finds nothing in a static field.
- **Iris, 2025-12-02/03, D2.** One candidate: three sightings, 0.7–1.4″ from JPL's predictions.
- **Hebe, May 2025.** A weak (two-pointing) candidate 1.3″ from JPL's predictions.

Limits:

- **Slow objects.** Bodies slower than 1.8″/h, including any distant planet, are indistinguishable
  from the fixed sky within a pass.
- **Fast objects.** Bodies faster than 154″/h are not linked.
- **Faint objects.** Bodies below the per-exposure detection limit are missed.

## 11. What the app can and cannot conclude

| The app can say | The app cannot say |
|---|---|
| A source moved against the stars between these frames | What the source is, unless a catalogue says so |
| A catalogued body is predicted here, and a source is there | That a new object has been discovered |
| Brightness at the target differs between frames by X ± σ | That the source varied, unless the frames are wavelength-matched and unflagged |
| The target's brightness at wavelengths sampled in one pass | A calibrated spectrum of an extended source |
| No catalogued body matches this candidate | That the candidate is real rather than an artefact |
