# SPHEREx data research

What the SPHEREx archive actually offers, checked on **2026-09-28**. It combines two kinds of
evidence, and each fact says which it is:

- **[verified]**: we made the request ourselves and saw the result (from a residential connection in
  Bangladesh, so timings are pessimistic for a server in the US).
- **[doc]**: stated in official documentation, with the source linked.

Anything marked **unverified** is something the app does not depend on.

Main documentation sources:

- **ES**: SPHEREx Explanatory Supplement v2.0, 2026-08-25,
  <https://irsa.ipac.caltech.edu/data/SPHEREx/docs/SPHEREx_Expsupp_QR.pdf>
- **AUG**: SPHEREx Archive at IRSA User Guide, <https://caltech-ipac.github.io/spherex-archive-documentation/>
- IRSA mission page, <https://irsa.ipac.caltech.edu/Missions/spherex.html>
- IRSA SPHEREx tutorials, <https://caltech-ipac.github.io/irsa-tutorials/>

## 1. Summary

| Need | Service | Status | Callable from a browser? |
|---|---|---|---|
| Find images covering a position | IRSA SIA v2 | [verified] 2.6–7.5 s typical; 74 s for a deep-field point with no time limit | No: no CORS header, so we proxy |
| Metadata tables | IRSA TAP | [verified] 15–56 s | No |
| Pixels of a small region | Byte ranges on S3 bucket `nasa-irsa-spherex` | [verified] bit-identical to IRSA cutouts, both releases | Yes (CORS `*`), but we read on the server |
| Pixels, fallback | IRSA IBE cutout service | [verified] about 15 s and 4–5 MB per cutout | No |
| Name → coordinates | CDS Sesame | [verified] 0.7 s | Yes (CORS `*`) |
| Which known small bodies are in a field | JPL SBIdent | [verified] 19 s one-pass, 70–80 s two-pass | No |
| Where a known body is at given times | JPL Horizons | [verified] about 1 s | No |
| Which SPHEREx images contain a known body | IRSA MOST, `catalog=spherex` | [doc] available since mid-2026; **not used yet** | Unverified |

No service needs an account, API key or AWS credentials.

## 2. Instrument and survey [doc]

| Item | Value | Source |
|---|---|---|
| Launch | 12 March 2025, 03:10:12 UTC | ES §1.1 |
| Science operations | From 1 May 2025 (first survey plan 2025W17_4B) | ES §1.1, §1.5 |
| Mission | 25 months, four all-sky surveys | ES §1.1 |
| Wavelength | 0.75–5.0 µm (design 0.744–5.002 µm) | ES Table 2 |
| Channels | 102 = 17 per detector × 6 detectors | ES §3.4.4 |
| Pixels | 6.15″, 2040 × 2040 active pixels per detector | ES Table 2 |
| Field | about 3.5° × 3.5° per detector | spherex.caltech.edu/page/survey |
| Exposure | 113.58 s (`XPOSURE`), 118.19 s elapsed | ES App. A |
| Orbit | Sun-synchronous polar, 98 min, semi-major axis 7,037 km. Altitude about 659 km (7,037 − 6,378 km, derived); JPL Horizons' object data for SPHEREx (-163182) says "~650 km above the terminator line", the figure the app quotes | ES Table 1; Horizons -163182 |

| Band | Detector | Wavelength (µm) | R |
|---|---|---|---|
| 1 | D1 | 0.75–1.09 | 39 |
| 2 | D2 | 1.10–1.62 | 41 |
| 3 | D3 | 1.63–2.41 | 41 |
| 4 | D4 | 2.42–3.82 | 35 |
| 5 | D5 | 3.83–4.41 | 112 |
| 6 | D6 | 4.42–5.00 | 128 |

(Band edges from AUG. ES Table 2 and Bock et al. 2025 quote slightly different design edges.)

Survey facts that shape the product:

- **Linear variable filters.** Each detector sits behind a filter whose pass band changes along one
  axis of the array. Lines of constant wavelength are slightly curved, so wavelength is a function of
  both pixel coordinates (AUG; intro tutorial).
- **Detector pairs.** D1+D4, D2+D5 and D3+D6 see the same sky at the same time through a dichroic.
  "Only any 2 of the images will be of the same part of the sky"
  ([Data Explorer overview](https://irsa.ipac.caltech.edu/onlinehelp/spherex/spherex/overview.html)).
- **Cadence.** "The entire sky is completely sampled twice every year"; a full 102-channel spectrum
  of one position takes one to two weeks (Bock et al. §II).
- **Deep fields.** About 100 deg² each, one centred on the north ecliptic pole and one at ecliptic
  latitude −82°, longitude −44.8°, "generally observed every orbit" (Bock et al. §III.4.1, §IV.2.4).
- **Time-domain caveat.** Repeat visits usually put a source on a different part of the filter, so
  it is seen at a different wavelength. Outside the deep fields, a same-wavelength repeat happens
  about every six months.
- **Things that change but are not the sky.** Airglow is not subtracted from the images; the
  He 1.083 µm line in D1/D2 can be up to 30 times the zodiacal background. Other sources of spurious
  change: satellites, ghosts, cosmic rays, and diffuse optical transients in about 1 % of exposures
  (ES §2.3, §3.1). Known contaminated images: <https://spherex.caltech.edu/page/anomalyimages>.

## 3. Releases and collections

[verified] TAP `spherex.obscore`, grouped by collection (a 56 s query the app never runs):

| Collection | Type | Level | Rows | Time span (UTC) |
|---|---|---|---|---|
| `spherex_qr2` | image | 2 | 1,097,080 | 2025-04-24 → 2026-07-20 |
| `spherex_qr2_deep` | image | 2 | 270,250 | 2025-04-24 → 2026-07-20 |
| `spherex_qr3` | image | 2 | 70,405 | 2026-07-20 → 2026-08-16 |
| `spherex_qr3_deep` | image | 2 | 17,252 | 2026-07-20 → 2026-08-17 |
| `spherex_qr2_cal`, `spherex_qr3_cal` | measurements | 1, 3 | 162 in all | calibration files |

[doc] QR3 was released on 2026-09-16 with pipeline R7 (IRSA news). QR1 was retired in February
2026. QR2 and QR3 are consecutive time slices, so a timeline queries both. The ES advises "caution
when combining QR2 and QR3 data" because R7 changed the calibration, so the app marks cross-release
comparisons. Images reach IRSA within 60 days of observation, and new data is released weekly.

[doc] **No Level 3 or 4 products exist yet.** All-sky spectral cubes and reprocessed images are
scheduled for November 2026 (DR1) and a source catalogue for August 2027
(<https://spherex.caltech.edu/page/data-products>). Any spectrum or brightness history in this app is
our own measurement on Level 2 images, labelled as such.

Citation DOIs: QR2 `10.26131/IRSA652`, QR3 `10.26131/IRSA662`.

## 4. Image discovery: SIA v2 [verified]

```text
GET https://irsa.ipac.caltech.edu/SIA
    ?COLLECTION=spherex_qr2&COLLECTION=spherex_qr3
    &POS=circle+10.6847+41.2690+0.0003
    &TIME=61000+61003                 (optional, MJD interval)
    &RESPONSEFORMAT=CSV
```

- Repeating `COLLECTION` returns both releases in one response: 361 rows for M31 in 2.6 s.
- `TIME` (MJD) filtering keeps deep-field queries fast: 3 s for a 3-day window at the NEP, against
  74 s and 24,103 rows for everything. `BAND` takes metres. [doc] SIA jobs are cut off at 5 minutes.
- Columns we use: `obs_id`, `obs_publisher_did`, `obs_collection`, `energy_bandpassname`
  (`SPHEREx-D1` … `D6`), `em_min`/`em_max` (metres, whole detector), `em_res_power`, `t_min`/`t_max`
  (MJD), `t_exptime` (s), `s_ra`, `s_dec`, `s_region`, `access_url` (direct FITS URL).
- `cloud_access` is JSON inside a CSV cell and its inner quotes are not escaped, so it does not
  parse. The S3 key is the `access_url` path after `https://irsa.ipac.caltech.edu/ibe/data/spherex/`
  ([doc] the IRSA cloud-access tutorial says the same).
- No `Access-Control-Allow-Origin` header.

Sample row (trimmed):

```text
obs_id=2025W51_1A_0684_2  energy_bandpassname=SPHEREx-D3  em_min=1.63010e-06  em_max=2.43460e-06
em_res_power=40.6  t_min=61027.214984  t_exptime=113.5826  s_pixel_scale=6.15
access_url=https://irsa.ipac.caltech.edu/ibe/data/spherex/qr2/level2/2025W51_1A/l2b-v21-2025-354/3/level2_2025W51_1A_0684_2D3_spx_l2b-v21-2025-354.fits
s_region=POLYGON ICRS 6.9628 41.7501 11.2825 43.1373 13.1746 39.9467 8.9792 38.6246 6.9628 41.7501
```

### The footprint polygon gives the target's detector position

The four `s_region` vertices are the outer corners of the pixel grid, in the order (−0.5, −0.5),
(2039.5, −0.5), (2039.5, 2039.5), (−0.5, 2039.5) in 0-based pixels. Checked against the full TAN-SIP
WCS in four headers, each vertex sat 4.2–4.5″ from the matching corner pixel centre. That is the
half-pixel diagonal (6.15″ × √2 ÷ 2 = 4.35″). So the target's detector position, and from it the
wavelength that fell on the target, can be estimated from search results before any pixels are read.

### Exposure structure seen in the data

- `obs_id` = planning period + pointing + small step, e.g. `2025W49_1A_0332_1`. The detector is in
  the publisher DID: `ivo://irsa.ipac/spherex_qr2?2025W49_1A_0332_1/D2`.
- Steps `_1` to `_4` of a pointing are about 2 minutes apart. Each moves the sky slightly on the
  filter, so a source is measured at a new wavelength. The next pointing that covers the same point
  may be hours later.
- M31 (10.6847, +41.2690): 361 frames in QR2 + QR3, in survey passes 2025-07-09 → 07-22 (109),
  2025-12-18 → 2026-01-04 (110), 2026-07-10 → 07-23 (110) and 2026-08-04 → 08-07 (26).
- North ecliptic pole (270.0, +66.56): 24,103 `spherex_qr2_deep` frames covering one point, 169 of
  them in a single 3-day window.

## 5. Tables: TAP and DataLink [verified]

`https://irsa.ipac.caltech.edu/TAP/sync?QUERY=…&FORMAT=csv` works (TAP has no JSON output).

- `spherex.obscore`: standard ObsCore, the same content as SIA.
- `spherex.plane`: adds `quality_flag`, `metrics_background`, `metrics_maglimit` and more.
- `spherex.artifact`: file URIs and sizes.
- A spatial `CONTAINS(POINT(…), o.s_region)` fails inside a join (`function st_covers(character
  varying, geography) does not exist`). [doc] The cutout tutorial joins `artifact` to `plane` and
  constrains `p.poly` instead.
- TAP answered the same positional query in 15 s where SIA took 5 s, so the app uses SIA.

TAP `access_url` values are DataLink documents. One lists the science file, an `ibe-cutout`
descriptor, the S3 location and every calibration file used. It took 12.3 s server-side, so the app
never calls DataLink per frame.

## 6. The Level 2 file

[verified] Layout from reading real files through S3 byte ranges:

```text
          QR2 (pipeline 6.x)                          QR3 (pipeline 7.x)
PRIMARY   1 block                                     1 block
IMAGE     hdr 7–8 blocks + 2040² float32 MJy/sr       hdr 8 blocks + 2040² float32
FLAGS     hdr 5 blocks + 2040² int32                  hdr 6 blocks, RICE_1 tile-compressed
                                                      bintable: 2040 one-row tiles, heap ≈ 12 MB
VARIANCE  hdr 4 blocks + 2040² float32 (MJy/sr)²      hdr 4 blocks + 2040² float32
ZODI      hdr 4 blocks + 2040² float32 MJy/sr         hdr 4 blocks + 2040² float32
PSF       hdr 15 blocks + 101×101×121 image cube      EPSF bintable, 441 rows (451 for D3)
WCS-WAVE  1 block + 1-row table (11×11 grid)          1 block + 1-row table (9×9 grid)
```

Each uncompressed 2040² plane is 16,646,400 bytes. Only the IMAGE header length varied in QR2. In
QR3 the compressed FLAGS size varies per file, which moves every later extension. So the reader
parses each header it relies on and checks it, instead of assuming fixed offsets.

[doc] "No zodiacal light subtraction is applied" to IMAGE; ZODI is a model and "has not been
subtracted". Airglow lines are not subtracted either. Dark current is subtracted and gain applied
(ES §2.2, §3.1, §3.2).

### IMAGE header keywords the app uses

| Keyword | Meaning | Example |
|---|---|---|
| `CTYPE` = `RA---TAN-SIP`, `CRVAL`, `CRPIX`, `PC`, `A_*`, `B_*`, `AP_*`, `BP_*` | Celestial WCS with third-order SIP | |
| `DATE-AVG`, `MJD-AVG` | Mid-exposure time, UTC | `2025-12-18T05:10:32.209` |
| `MJD-BEG`, `MJD-END`, `XPOSURE` | Start, end, integration time | `113.5826` s |
| `DETECTOR` | 1–3 SWIR, 4–6 MWIR | `3` |
| `X_SC` … `VZ_SC`, `XYZ_SC_SYSTEM = 'GEOCENTER'` | Spacecraft geocentric position (km) and velocity (km/s) at mid-exposure | |
| `PSF_FWHM` | Median PSF FWHM | `5.22` arcsec |
| `OMEGA_MEDIAN` | Median pixel solid angle | `37.86` arcsec² |
| `FINAST`, `L2DQAFLG` | Astrometry and data-quality outcome; only `FINAST = 0`, `PASS` are archived (ES §3.2.12) | |
| `SPS_EPA` | Planned position angle, 0 or 180; tells the surveys apart | |
| Alternate WCS `W` (`CTYPE1W = 'WAVE-TAB'` …) | Per-pixel wavelength and bandwidth lookup | see below |

[doc] The header position vector matches JPL Horizons' ICRF geocentric vector for SPHEREx to about
2 km, so it is effectively ICRF equatorial, although the header does not name the axes.

### Flags

Bit numbers come from the FLAGS header, and the keyword style differs by release:
`HIERARCH MP_TRANSIENT = 0` in QR2, `MSKN0000 = 'TRANSIENT'` in QR3 [verified]. The app parses both.

| Bit | Name | Masked by default | Bit | Name | Masked by default |
|---|---|---|---|---|---|
| 0 | TRANSIENT | yes | 17 | PERSIST | yes |
| 1 | OVERFLOW | no (informational) | 19 | OUTLIER | no (informational) |
| 2 | SUR_ERROR | yes | 20 | CROSSTALK | yes |
| 6 | NONFUNC | yes | 21 | SOURCE | **no**: 40–70 % of pixels |
| 7 | DICHROIC | yes | 22–24 | GHOST, GHOST_FPA, GHOST_EXT | yes |
| 9 | MISSING_DATA | yes | 25 | STREAK | yes |
| 10 | HOT | yes | 26 | BLOOM | yes |
| 11 | COLD | yes | 27 | SNOWBALL | yes |
| 12 | FULLSAMPLE | no (informational) | 28 | HALO | yes |
| 14 | PHANMISS | yes | 29 | SATELLITE_HALO | yes |
| 15 | NONLINEAR | yes | | | |

The default mask is exactly the set the IRSA Mosaic Tool sets to NaN (ES §3.4.3, Table 16).

### Wavelength per pixel

The header's alternate WCS `W` is a FITS Paper III `WAVE-TAB` bilinear lookup into the `WCS-WAVE`
table. The table holds control points `X`, `Y` (11 each in QR2, spaced about 204 px; 9 in QR3,
spaced 255 px) in 1-based parent-image pixels, and `VALUES` (wavelength, bandwidth) in µm.

- [doc] Astropy wrongly carries the image's SIP distortion onto this alternate WCS, so the
  tutorials set `spectral_wcs.sip = None` (astropy issue 13105). [verified] Leaving SIP on shifted
  wavelengths by about 0.006 µm, roughly 12 % of a channel width. The app does its own bilinear
  interpolation and tests it against astropy with SIP off.
- [verified] Across a 0.2° D3 cutout the wavelength ran from 2.047 to 2.003 µm, with a bandwidth of
  about 0.050 µm.
- [verified] The table was identical, value for value, in two D2 files from different weeks and
  pipeline versions: it is a detector calibration. The app still reads each frame's own table.
- [doc] Bilinear lookup is "accurate to within approximately 1 nm" and meant for visualisation.
  Precise science should use the CWAVE/CBAND calibration products.

**Consequence for the product:** the wavelength that falls on a star depends on where the star
lands on the detector, and that changes between exposures. Two images of one place taken on
different dates usually sampled different wavelengths, so a brightness difference between them may
be the source's spectrum rather than a change in time.

## 7. Pixel access

### S3 byte ranges (primary) [verified]

```text
GET https://nasa-irsa-spherex.s3.us-east-1.amazonaws.com/<key>
Range: bytes=<start>-<end>
```

- Anonymous access, `Accept-Ranges: bytes`, CORS `*`. The response carries `Content-Range` with the
  total file size.
- From this connection with a warm connection pool: 0.6 s for a 46 KB header read, 1.4 s for 955 KB,
  3.5 s for four 955 KB reads in parallel (about 1.1 MB/s).
- A QR2 cutout assembled from byte ranges was **bit-identical** to the IRSA IBE cutout of the same
  file and position (IMAGE maximum difference 0.0, FLAGS equal).
- QR3 FLAGS rows were decoded from their RICE_1 tiles, fetching only the heap bytes of the needed
  rows. They matched the IBE cutout exactly. (Astropy's `Rice1` codec is used for decoding.)
- [doc] IRSA's FAQ recommends cloud access for bulk reads and warns that cloud transfer policies may
  change.

### IRSA IBE cutout (fallback) [verified]

```text
GET <access_url>?center=10.6847,41.2690&size=0.2        (degrees; also `pix`, `arcsec`, `arcmin`)
```

- Returns all extensions trimmed to the region, with WCS adjusted, except PSF/EPSF, which is always
  included whole.
- A 0.2° cutout took 14.7 s and was 5.3 MB, of which 4.9 MB was the PSF cube. [doc] Cutouts keep
  the parent image's axes, not north up.

## 8. Solar-system bodies

### JPL SBIdent [verified]

```text
GET https://ssd-api.jpl.nasa.gov/sb_ident.api
    ?xobs=<x,y,z km>,<vx,vy,vz km/s>           geocentric ICRF state of the observer
    &obs-time=<JD UTC>
    &fov-ra-center=hh-mm-ss&fov-dec-center=dd-mm-ss&fov-ra-hwidth=<deg>&fov-dec-hwidth=<deg>
    &two-pass=true&suppress-first-pass=true&mag-required=true
```

- [doc] Only topocentric MPC codes are allowed ("never 500 'geocentric'"); spacecraft pass `xobs`.
  The SPHEREx header provides exactly that state vector.
- Two-pass (numerically integrated) answers took 71 s for a 2° × 2° field and 80 s for 0.3° × 0.3°.
  The time is in the integration, not the field size. One-pass (two-body) answers took 19 s with
  about ±100″ errors.
- Response fields: object name, astrometric RA/Dec, offsets from centre, V magnitude, RA and Dec
  rates (″/h).

### JPL Horizons [verified]

```text
GET https://ssd.jpl.nasa.gov/api/horizons.api?format=json&COMMAND='7;'&EPHEM_TYPE='OBSERVER'
    &CENTER='500@399'&TLIST='<JD>','<JD>'&TLIST_TYPE='JD'&QUANTITIES='1,9,20'&ANG_FORMAT='DEG'&CSV_FORMAT='YES'
```

- About 1 s for a list of exact times.
- The spacecraft is `−163182` ("SPHEREx Spacecraft"); `−163` is WISE. [doc] `CENTER='500@-163182'`
  makes SPHEREx the observer. Its trajectory comes from concatenated public orbit data (TLEs).

### Parallax

SPHEREx is about 7,037 km from Earth's centre, so a geocentric position can be off by up to about
9.7″ ÷ distance in au. That is 0.5–1 pixel for main-belt asteroids and tens of pixels for near-Earth
objects. The app converts each Horizons geocentric position to the direction seen from SPHEREx using
the frame's own `X_SC`, `Y_SC`, `Z_SC`.

### IRSA Moving Object Search Tool [doc, not used yet]

`https://irsa.ipac.caltech.edu/cgi-bin/MOST/nph-most?catalog=spherex&input_type=name_input&obj_name=…`
lists the SPHEREx images that contain a named solar-system body, with predicted positions. It is
a candidate for a future "find where SPHEREx saw asteroid X" search. Unverified: whether it
predicts positions from the spacecraft or from Earth's centre.

### A verified moving-object case

Asteroid **(7) Iris**, 2025-12-02/03, D2 frames covering (161.297, +2.448): 14 frames in four
pointings (12:06, 21:48, 04:21 and 05:57 UTC). Horizons positions drawn on the frames, aligned by
their WCS, fall on a point source that moves about 0.17° from the first frame to the last. The nearby
bright star 36 Sextantis (V = 6.3, K = 3.5) stays put, and its measured peak lies within 0.5 px of
its catalogue position in all eight frames checked, which confirms the alignment. This is the lead
Discover case.

## 9. Name resolution

[verified] `GET https://cds.unistra.fr/cgi-bin/nph-sesame/-oxp/SNV?M31` returns XML with `<jradeg>`,
`<jdedeg>`, `<otype>`, `<oname>` for each resolver that answered (SIMBAD, NED, VizieR). An unknown
name returns `<INFO> *** Nothing found *** </INFO>`. 0.7 s, CORS `*`.

[doc] Sesame does not resolve solar-system bodies (IMCCE SsODNet does). Asteroid names therefore go
through JPL instead.

## 10. Attribution and usage [doc]

- SPHEREx acknowledgment (ES §1.6): "This publication makes use of data products from the
  Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer
  (SPHEREx), which is a joint project of the Jet Propulsion Laboratory and the California Institute
  of Technology, and is funded by the National Aeronautics and Space Administration."
- IRSA acknowledgment (<https://irsa.ipac.caltech.edu/ack.html>): "This research has made use of the
  NASA/IPAC Infrared Science Archive, which is funded by the National Aeronautics and Space
  Administration and operated by the California Institute of Technology."
- NASA logos, insignia and the JPL logo need prior written approval and must not appear on
  non-NASA pages. NASA content may be used factually without implying endorsement, crediting NASA.
  Mission images from spherex.caltech.edu are credited "Courtesy NASA/JPL-Caltech"
  (<https://spherex.caltech.edu/page/image-use-policy>).
- Usable mission images: PIA26531 (spacecraft, artist's concept) and PIA26600 (first all-sky map,
  2025-12-18), credited NASA/JPL-Caltech.
- IRSA data use: "Most data served by IRSA is public, with no usage restrictions"
  (<https://irsa.ipac.caltech.edu/data_use_terms.html>).

## 11. Unavailable or uncertain

- No SPHEREx source catalogue or light curves exist yet. Brightness histories are our own aperture
  photometry.
- The SPHEREx Spectrophotometry Tool (Tractor forced photometry) is a web GUI limited to 20 sources
  per job, with no documented API.
- We found no documented way to drop the PSF extension from IBE cutouts.
- No numeric rate limits are published for SIA or S3. IRSA has scheduled downtime every other
  Tuesday morning Pacific time.
- IRSA's Data Explorer deep link, `https://irsa.ipac.caltech.edu/applications/spherex/?api=spectral-images&ra=…&dec=…&sr=30m&execute=true`,
  is documented; the app offers it as "Open in IRSA".

## 12. Strategy adopted

1. SIA v2 over QR2 and QR3 for discovery; deep collections only near the ecliptic poles, paged by `TIME`.
2. The wavelength at the target estimated from the footprint at search time, then replaced by the
   frame's own lookup table when its pixels load.
3. Pixels from S3 byte ranges on the server, with the IBE cutout as fallback. Frames are aligned
   with astropy, and the default mask is the Mosaic Tool set.
4. Aligned float arrays sent to the browser, where one stretch applies to the whole sequence.
5. JPL SBIdent once per sequence to learn which bodies are present, then Horizons at every frame
   time, corrected for parallax with that frame's spacecraft position.
6. Sesame for names; coordinates parsed locally.
7. A demo snapshot of real responses for the live demo, clearly labelled.

## 13. Learned while building (verified on real frames)

- **The pipeline flags the cores of bright moving sources.** In the (7) Iris frames, 4–17 of the 25
  pixels around the asteroid carry TRANSIENT and SUR_ERROR, presumably because the source moved or
  brightened during the ramp. A detector that ignores flagged pixels misses bright asteroids. The
  moving-source search therefore runs on the filled display image.
- **QR3 flags saturated cores as BLOOM.** M31's nucleus is flagged BLOOM across the whole aperture
  in a QR3 (pipeline 7.0.5) frame. QR2 marks the same core only OVERFLOW (informational). Summing
  the few unflagged pixels reported zero, so photometry now refuses apertures with less than half
  their weight usable.
- **Where saturation begins.** Sources of about 0.1–0.2 Jy in the near-infrared (Iris at V = 10.2;
  M31's nucleus at 1–2 Jy) reach the overflow threshold in D1–D4. The values there still follow the
  expected spectral shape, so they are shown with a caveat rather than dropped.
- **Rates from SBIdent.** SBIdent's rate is instantaneous as seen from the spacecraft, and swings
  with SPHEREx's 7.5 km/s orbit. For Iris it gave 52″/h against 39″/h averaged over 16 hours. The
  app reports the sequence average from predicted positions.
