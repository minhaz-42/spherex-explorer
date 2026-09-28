/** Curated objects for the Explore page's atlas. Facts checked against SIMBAD, NED and NASA/ESA sources (see the sources list in each entry's comment). */
export type AtlasCategory = "galaxy" | "nebula" | "cluster" | "star-forming" | "solar-system" | "deep-field";

export interface AtlasObject {
  id: string; // url-safe slug
  name: string; // common name, e.g. "Andromeda Galaxy"
  catalogue: string; // short designations, e.g. "M31 · NGC 224"
  query: string | null; // a name SIMBAD/Sesame resolves, sent as /explore?q=…; null when `to` is given
  to?: string; // explicit link instead of a search (for moving objects and fixed fields)
  ra: number; // ICRS degrees, from SIMBAD (6 decimals) — used for the thumbnail
  dec: number;
  fovDeg: number; // thumbnail field of view in degrees: about 1.3× the object's visible extent, clamped 0.1–3
  category: AtlasCategory;
  kind: string; // short type, e.g. "Spiral galaxy", "Planetary nebula", "Globular cluster"
  constellation: string;
  distance: string; // plain words with units, e.g. "about 2.5 million light-years"
  blurb: string; // 1–2 short plain-language sentences a curious teenager understands
  infrared: string; // ONE careful sentence: what near-infrared light (0.75–5 µm) shows that visible light does not
}

// Checked on 2026-09-28. Every `query` resolves through CDS Sesame to the SIMBAD object whose position is
// given; frame counts are wide-survey frames (QR2 + QR3) from this app's /api/observations at that position.
// Sizes are SIMBAD's galdim_majaxis unless noted; NGC 2000.0 is VizieR VII/118.
export const ATLAS: AtlasObject[] = [
  // ── Galaxies ──────────────────────────────────────────────────────────────────────────────────────────
  // Sources: SIMBAD "M 31" (size 199.5′, so fov clamps to 3); 361 frames. Distance and naked-eye visibility:
  // https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-31/
  {
    id: "andromeda-galaxy",
    name: "Andromeda Galaxy",
    catalogue: "M31 · NGC 224",
    query: "M31",
    ra: 10.684708,
    dec: 41.26875,
    fovDeg: 3,
    category: "galaxy",
    kind: "Spiral galaxy",
    constellation: "Andromeda",
    distance: "about 2.5 million light-years",
    blurb:
      "The nearest major galaxy to our own. It is bright enough to see with the naked eye, even from places with some light pollution.",
    infrared:
      "Near-infrared light comes mostly from the older, cooler stars that hold most of a galaxy's stellar mass, and dust dims it far less than visible light, so it shows how the stars themselves are spread through the bulge and disc.",
  },
  // Sources: SIMBAD "M 33" (size 60.3′); 422 frames. Distance, "third-largest", NGC 604:
  // https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-33/
  {
    id: "triangulum-galaxy",
    name: "Triangulum Galaxy",
    catalogue: "M33 · NGC 598",
    query: "M33",
    ra: 23.462069,
    dec: 30.660175,
    fovDeg: 1.3,
    category: "galaxy",
    kind: "Spiral galaxy",
    constellation: "Triangulum",
    distance: "about 3 million light-years",
    blurb:
      "The third-largest galaxy in our Local Group, about half the size of the Milky Way. One of its spiral arms holds NGC 604, a star-forming cloud nearly 100 times larger than the Orion Nebula.",
    infrared:
      "Near-infrared light passes through dust that dims visible light, and at the longer wavelengths SPHEREx covers, the glow of warm dust and of carbon-rich PAH molecules near 3.3 µm marks where stars are forming.",
  },
  // Sources: SIMBAD "M 51" (size 9.0′; NGC 5195 lies 4.4′ north, so fov 0.3 keeps both in the cropped
  // card); 413 frames. Distance: NASA says 31 million ly
  // (https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-51/);
  // the TRGB distance of McQuinn et al. 2016 (ApJ 826, 21) is 8.58 Mpc ≈ 28 million ly, hence "about 30".
  {
    id: "whirlpool-galaxy",
    name: "Whirlpool Galaxy",
    catalogue: "M51 · NGC 5194",
    query: "M51",
    ra: 202.469575,
    dec: 47.195258,
    fovDeg: 0.3,
    category: "galaxy",
    kind: "Interacting spiral galaxy",
    constellation: "Canes Venatici",
    distance: "about 30 million light-years",
    blurb:
      "A spiral seen face-on, with a smaller companion galaxy, NGC 5195, at the tip of one arm. A close encounter between the two may be why the Whirlpool's arms are so prominent.",
    infrared:
      "Beneath the dusty spiral arms, near-infrared light traces the smooth disc of older stars, while PAH emission near 3.3 µm follows the arms where new stars are forming.",
  },
  // Sources: SIMBAD "M 81" (size 21.4′); 266 frames. Distance 11.6 million ly, Bode 1774, binocular view with M82:
  // https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-81/
  // NED Cepheid and TRGB medians: 3.62 Mpc ≈ 11.8 million ly.
  {
    id: "bodes-galaxy",
    name: "Bode's Galaxy",
    catalogue: "M81 · NGC 3031",
    query: "M81",
    ra: 148.888219,
    dec: 69.065295,
    fovDeg: 0.46,
    category: "galaxy",
    kind: "Spiral galaxy",
    constellation: "Ursa Major",
    distance: "about 12 million light-years",
    blurb:
      "One of the brightest galaxies in the night sky, found by Johann Elert Bode in 1774. Through binoculars it shares the field of view with its neighbour, the Cigar Galaxy.",
    infrared:
      "In near-infrared light the galaxy's large bulge and disc of old, cool stars stand out, and dust dims this light far less than it dims visible light.",
  },
  // Sources: SIMBAD "M 82" (no size; NGC 2000.0 gives 11.2′); 277 frames. Distance, "10 times faster", galactic wind:
  // https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-82/
  // NED median of 21 distances: 3.70 Mpc ≈ 12.1 million ly.
  {
    id: "cigar-galaxy",
    name: "Cigar Galaxy",
    catalogue: "M82 · NGC 3034",
    query: "M82",
    ra: 148.968458,
    dec: 69.679703,
    fovDeg: 0.24,
    category: "galaxy",
    kind: "Starburst galaxy",
    constellation: "Ursa Major",
    distance: "about 12 million light-years",
    blurb:
      "Around its centre, young stars are being born about 10 times faster than in the whole Milky Way, a starburst set off by gravitational encounters with its neighbour M81. The newborn stars drive a wind of gas out of the galaxy.",
    infrared:
      "Near-infrared light sees through much of the dust that hides the starburst in visible light, and PAH molecules in that dust glow strongly near 3.3 µm, a common tracer of star formation.",
  },
  // Sources: SIMBAD "M 101" (size 21.9′); 368 frames. Distance and size: NASA/JPL
  // https://www.jpl.nasa.gov/images/pia15630-pinwheel-galaxy-rainbow/ (21 million ly; NASA's Messier page says
  // 25 million, but NED's median of 116 distances is 6.73 Mpc ≈ 22 million ly and Cepheids give 6.2–6.5 Mpc).
  {
    id: "pinwheel-galaxy",
    name: "Pinwheel Galaxy",
    catalogue: "M101 · NGC 5457",
    query: "M101",
    ra: 210.802429,
    dec: 54.34875,
    fovDeg: 0.47,
    category: "galaxy",
    kind: "Spiral galaxy",
    constellation: "Ursa Major",
    distance: "about 21 million light-years",
    blurb: "A spiral galaxy seen face-on, about 170,000 light-years across, some 70 per cent larger than the Milky Way.",
    infrared:
      "In near-infrared light the galaxy's older stars form a smooth disc, and the star-forming knots along its arms add the glow of warm dust and PAH molecules at the longer wavelengths.",
  },
  // Sources: SIMBAD "NGC 253" (size 28.8′); 337 frames. The query is "NGC 253" because Sesame resolves
  // "Sculptor Galaxy" to the Sculptor Dwarf Galaxy. Distance 11.4 million ly:
  // https://chandra.harvard.edu/photo/2023/ngc253/ and 11 million ly: https://www.eso.org/public/news/eso2510/
  // (NASA's Caldwell page says 13 million; NED TRGB median 3.46 Mpc ≈ 11.3 million ly). Herschel 1783, dust, starburst:
  // https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-caldwell-catalog/caldwell-65/
  {
    id: "sculptor-galaxy",
    name: "Sculptor Galaxy",
    catalogue: "NGC 253 · Caldwell 65",
    query: "NGC 253",
    ra: 11.888058,
    dec: -25.2888,
    fovDeg: 0.62,
    category: "galaxy",
    kind: "Starburst spiral galaxy",
    constellation: "Sculptor",
    distance: "about 11 million light-years",
    blurb:
      "One of the dustiest spiral galaxies in the sky, forming stars rapidly near its centre. Caroline Herschel discovered it in 1783 while hunting for comets.",
    infrared:
      "Near-infrared light passes through much of the dust that hides the galaxy's disc in visible light, and hot dust and PAH emission near 3.3 µm trace the burst of star formation in its core.",
  },
  // Sources: SIMBAD "NAME Centaurus A" (size 25.7′); 377 frames. Distance and jets:
  // https://chandra.harvard.edu/photo/2023/cena/ (12 million ly; NED TRGB median 3.78 Mpc ≈ 12.3 million ly).
  // Collision origin and "closest active galaxy":
  // https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-caldwell-catalog/caldwell-77/
  {
    id: "centaurus-a",
    name: "Centaurus A",
    catalogue: "NGC 5128 · Caldwell 77",
    query: "NGC 5128",
    ra: 201.365063,
    dec: -43.019113,
    fovDeg: 0.56,
    category: "galaxy",
    kind: "Active galaxy",
    constellation: "Centaurus",
    distance: "about 12 million light-years",
    blurb:
      "The closest active galaxy to Earth, crossed by a dark lane of dust that is probably debris from a collision between two galaxies. A supermassive black hole at its centre launches jets seen in radio waves and X-rays.",
    infrared:
      "Dust that blocks visible light is far more transparent in the near-infrared, so the stars within and behind the galaxy's dark lane show through.",
  },

  // ── Star-forming regions ──────────────────────────────────────────────────────────────────────────────
  // Sources: SIMBAD "M 42" (size 66′); 237 frames. Distance 1,350 ly: https://esawebb.org/images/weic2315a/
  // (NASA's Messier page says 1,500; VLBA parallax 414 pc ≈ 1,350 ly, Menten et al. 2007). Naked eye, Trapezium:
  // https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-42/
  {
    id: "orion-nebula",
    name: "Orion Nebula",
    catalogue: "M42 · NGC 1976",
    query: "M42",
    ra: 83.8201,
    dec: -5.3876,
    fovDeg: 1.4,
    category: "star-forming",
    kind: "Star-forming nebula",
    constellation: "Orion",
    distance: "about 1,350 light-years",
    blurb:
      "The closest large star-forming region to Earth, visible to the naked eye just below Orion's belt. Hot young stars of the Trapezium cluster at its heart light up the surrounding gas.",
    infrared:
      "Near-infrared light passes through much of the dust that hides the youngest stars, so many stars still buried in the cloud behind the glowing gas become visible.",
  },
  // Sources: SIMBAD "M 8" (no size; NGC 2000.0 and Sharpless Sh2-25 give 90′); 32 frames. Distance, size
  // against the Moon, infrared view: https://esahubble.org/news/heic1808/ (4,000 ly; Gaia-based 1,272 pc
  // ≈ 4,150 ly, Zucker et al. 2020; NASA's Messier page says 5,200).
  {
    id: "lagoon-nebula",
    name: "Lagoon Nebula",
    catalogue: "M8 · NGC 6523",
    query: "M8",
    ra: 270.904167,
    dec: -24.386667,
    fovDeg: 2,
    category: "star-forming",
    kind: "Star-forming nebula",
    constellation: "Sagittarius",
    distance: "about 4,000 light-years",
    blurb:
      "A giant cloud of glowing gas about three times as wide as the full Moon in our sky, where the young star cluster NGC 6530 formed and new stars are still forming.",
    infrared:
      "In near-infrared light the dark lanes of dust across the nebula become partly transparent, showing young stars hidden inside.",
  },
  // Sources: SIMBAD "M 16" (its 80′ is the cluster's member spread; NGC 2000.0 gives 35′ for cluster and
  // nebula); 142 frames. The query is "M 16": Sesame's SIMBAD does not match "M16" and falls back to NED.
  // Distance: NASA gives 6,500 ly (https://science.nasa.gov/missions/webb/nasas-webb-takes-star-filled-portrait-of-pillars-of-creation/)
  // and 7,000 ly (https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-16/);
  // Gaia-based values are 1,690–1,740 pc ≈ 5,500–5,700 ly (Zucker et al. 2020; Kuhn et al. 2019), hence a range.
  {
    id: "eagle-nebula",
    name: "Eagle Nebula",
    catalogue: "M16 · NGC 6611",
    query: "M 16",
    ra: 274.688,
    dec: -13.792,
    fovDeg: 0.8,
    category: "star-forming",
    kind: "Star-forming nebula",
    constellation: "Serpens",
    distance: "about 5,500 to 7,000 light-years",
    blurb:
      "A young star cluster, NGC 6611, inside a glowing cloud of gas. The cloud holds the dusty columns called the Pillars of Creation, made famous by Hubble in 1995.",
    infrared:
      "The pillars' dust looks almost opaque in visible light but partly transparent in near-infrared light, which reveals newly formed stars in and around them.",
  },
  // Sources: SIMBAD "NGC 3372" (no size; NGC 2000.0 gives 120′); 503 frames. Distance and Eta Carinae:
  // https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-caldwell-catalog/caldwell-92/
  // "more than 200 light-years": https://www.esa.int/Science_Exploration/Space_Science/Space_sensations/Carina_Nebula_NGC_3372
  {
    id: "carina-nebula",
    name: "Carina Nebula",
    catalogue: "NGC 3372 · Caldwell 92",
    query: "NGC 3372",
    ra: 161.259292,
    dec: -59.699944,
    fovDeg: 2.6,
    category: "star-forming",
    kind: "Star-forming nebula",
    constellation: "Carina",
    distance: "about 7,500 light-years",
    blurb:
      "A vast star-forming cloud in the southern Milky Way, more than 200 light-years across. It holds Eta Carinae, a system whose largest star is about 100 times the mass of the Sun.",
    infrared: "Near-infrared light pierces much of the nebula's dust, showing young stars still inside its dark pillars and clouds.",
  },
  // Sources: SIMBAD "NAME Ophiuchus Molecular Cloud" = LDN 1688 (size 600′, so fov clamps to 3); 395 frames.
  // The query avoids "Rho Ophiuchi", which resolves to the star rho Oph. Distance: NASA says 390 ly
  // (https://science.nasa.gov/missions/webb/webb-celebrates-first-year-of-science-with-close-up-on-birth-of-sun-like-stars/);
  // SIMBAD lists 128 and 139 pc ≈ 420–450 ly (Zucker et al. 2020), hence a range. Ice bands: H₂O 3.05, CO₂ 4.27,
  // CO 4.67 µm; SPHEREx's ice goal: https://www.jpl.nasa.gov/news/interstellar-glaciers-nasas-spherex-maps-vast-galactic-ice-regions/
  {
    id: "rho-ophiuchi",
    name: "Rho Ophiuchi cloud complex",
    catalogue: "LDN 1688",
    query: "rho Ophiuchi cloud",
    ra: 247.025,
    dec: -24.541667,
    fovDeg: 3,
    category: "star-forming",
    kind: "Star-forming dark cloud",
    constellation: "Ophiuchus",
    distance: "about 390 to 450 light-years",
    blurb:
      "One of the nearest star-forming regions to Earth: dark clouds of gas and dust where Sun-like stars and future planetary systems are forming.",
    infrared:
      "Near-infrared light passes through much of the dust that hides the youngest stars, and SPHEREx's range covers the absorption bands of water, carbon dioxide and carbon monoxide ices (near 3.0, 4.3 and 4.7 µm) found in cold clouds like this.",
  },
  // Sources: SIMBAD "NAME Horsehead Nebula" = Barnard 33 (size 6′; fov 0.15 allows for the card's 4:3 crop);
  // 237 frames. Distance and Orion B:
  // https://science.nasa.gov/missions/webb/webb-captures-top-of-iconic-horsehead-nebula-in-unprecedented-detail/
  // Infrared view: https://esahubble.org/news/heic1307/
  {
    id: "horsehead-nebula",
    name: "Horsehead Nebula",
    catalogue: "Barnard 33",
    query: "Barnard 33",
    ra: 85.245833,
    dec: -2.458333,
    fovDeg: 0.15,
    category: "star-forming",
    kind: "Dark nebula",
    constellation: "Orion",
    distance: "about 1,300 light-years",
    blurb:
      "A dark pillar of dense gas and dust shaped like a horse's head, seen against glowing hydrogen gas. It lies on the western edge of the Orion B molecular cloud.",
    infrared:
      "Infrared light pierces much of the dust that makes the Horsehead look solid black in visible light, so in the near-infrared it appears as thin, fragile-looking folds of gas and dust.",
  },

  // ── Nebulae ───────────────────────────────────────────────────────────────────────────────────────────
  // Sources: SIMBAD "M 1" (size 7′); 216 frames. Distance, 1054, pulsar, synchrotron glow:
  // https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-1/
  // (Trimble 1973: 2 kpc ≈ 6,500 ly). Synchrotron dominates at 3.6–4.5 µm: Temim et al. 2006, AJ 132, 1610.
  {
    id: "crab-nebula",
    name: "Crab Nebula",
    catalogue: "M1 · NGC 1952",
    query: "M1",
    ra: 83.6324,
    dec: 22.0174,
    fovDeg: 0.15,
    category: "nebula",
    kind: "Supernova remnant",
    constellation: "Taurus",
    distance: "about 6,500 light-years",
    blurb:
      "The remains of a star whose explosion Chinese astronomers recorded in 1054, bright enough to see in daylight for nearly a month. At its centre is a pulsar, a neutron star that pulses 30 times a second.",
    infrared:
      "Most of the Crab's near-infrared light is synchrotron radiation from electrons spiralling at nearly the speed of light in magnetic fields around the pulsar, so the gas filaments that stand out in visible light are less prominent.",
  },
  // Sources: SIMBAD "M 57" (size 1.2′, so fov clamps to 0.1; about 12 SPHEREx pixels of 6.2″); 268 frames.
  // Distance 2,500 ly and molecular-hydrogen globules: https://esawebb.org/news/weic2320/ (Gaia parallax 787 pc
  // ≈ 2,570 ly; NASA's Messier page says 2,000).
  {
    id: "ring-nebula",
    name: "Ring Nebula",
    catalogue: "M57 · NGC 6720",
    query: "M57",
    ra: 283.396237,
    dec: 33.029134,
    fovDeg: 0.1,
    category: "nebula",
    kind: "Planetary nebula",
    constellation: "Lyra",
    distance: "about 2,500 light-years",
    blurb:
      "A shell of gas thrown off by a dying star, now lit by the hot white dwarf it left behind. It is small in the sky, only about a dozen SPHEREx pixels across.",
    infrared:
      "Near-infrared light shows molecular hydrogen in the nebula's outer shell and in thousands of dense clumps, gas that visible images barely show.",
  },
  // Sources: SIMBAD "NGC 7293" (size 13.4′; NASA's "nearly half the width of the full moon" ≈ 16′ used for fov);
  // 317 frames. Distance, size, "one of the closest":
  // https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-caldwell-catalog/caldwell-63/
  // (Gaia parallax 200 pc ≈ 650 ly). Near-infrared view: https://www.eso.org/public/news/eso1205/
  {
    id: "helix-nebula",
    name: "Helix Nebula",
    catalogue: "NGC 7293 · Caldwell 63",
    query: "NGC 7293",
    ra: 337.410606,
    dec: -20.837152,
    fovDeg: 0.35,
    category: "nebula",
    kind: "Planetary nebula",
    constellation: "Aquarius",
    distance: "about 650 light-years",
    blurb:
      "One of the closest planetary nebulae to Earth: the outer layers of a dying star, spread into a ring nearly three light-years across that looks almost half the width of the full Moon.",
    infrared:
      "Near-infrared light brings out molecular hydrogen in the knots and filaments that radiate from the centre, cold gas that visible light mostly misses.",
  },

  // ── Star clusters ─────────────────────────────────────────────────────────────────────────────────────
  // Sources: SIMBAD "Cl Melotte 22" (size 76.9′); 223 frames. Distance, naked eye, over a thousand stars:
  // https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-45/
  // (Gaia: 135 pc ≈ 440 ly). Age and passing dust cloud: https://science.nasa.gov/photojournal/the-seven-sisters-pose-for-spitzer/
  {
    id: "pleiades",
    name: "Pleiades",
    catalogue: "M45 · Melotte 22",
    query: "M45",
    ra: 56.600833,
    dec: 24.113889,
    fovDeg: 1.7,
    category: "cluster",
    kind: "Open star cluster",
    constellation: "Taurus",
    distance: "about 445 light-years",
    blurb:
      "The Seven Sisters: more than a thousand stars born about 100 million years ago, easy to see with the naked eye. Its bright stars light up a cloud of dust that the cluster happens to be passing through.",
    infrared:
      "Near-infrared light picks up the cluster's faint, cool, low-mass members, including brown dwarfs, which are hard to see in visible light.",
  },
  // Sources: SIMBAD "M 13" (its 33′ is a limiting size; NGC 2000.0 gives 16.6′ visible); 441 frames.
  // Distance, "over 100,000 stars", binoculars in July:
  // https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-13/
  {
    id: "hercules-cluster",
    name: "Hercules Globular Cluster",
    catalogue: "M13 · NGC 6205",
    query: "M13",
    ra: 250.423475,
    dec: 36.461319,
    fovDeg: 0.36,
    category: "cluster",
    kind: "Globular cluster",
    constellation: "Hercules",
    distance: "about 25,000 light-years",
    blurb:
      "A ball of more than 100,000 old stars held together by gravity, easy to find with binoculars on summer evenings in the northern hemisphere.",
    infrared:
      "Much of an old cluster's near-infrared light comes from its cool red giant stars, which stand out more strongly against the hotter stars than they do in visible light.",
  },
  // Sources: SIMBAD "NGC 5139" (size 36.3′); 455 frames. Distance, 10 million stars, "largest and brightest",
  // stripped-dwarf-galaxy idea: https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-caldwell-catalog/caldwell-80/
  {
    id: "omega-centauri",
    name: "Omega Centauri",
    catalogue: "NGC 5139 · Caldwell 80",
    query: "NGC 5139",
    ra: 201.697,
    dec: -47.479472,
    fovDeg: 0.8,
    category: "cluster",
    kind: "Globular cluster",
    constellation: "Centaurus",
    distance: "about 17,000 light-years",
    blurb:
      "The largest and brightest globular cluster in the sky, with about 10 million stars. It might be the core of a small galaxy that was stripped of its outer stars.",
    infrared:
      "In near-infrared light the cluster is dominated by its cool red giants, and the dust between us and the cluster dims this light less than visible light.",
  },

  // ── Solar System ──────────────────────────────────────────────────────────────────────────────────────
  // Sources: link = the Iris example in src/lib/examples.ts (Discover case iris-2025-12); 243 frames at that
  // position. Size (199.8 km, IRAS), S-type, discovery 1847: JPL SBDB https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=7
  // Distance on 2025-12-02: JPL Horizons, 2.07 au from Earth.
  {
    id: "asteroid-7-iris",
    name: "Asteroid (7) Iris",
    catalogue: "7 Iris · A847 PA",
    query: null,
    to: "/explore?ra=161.29678&dec=2.44824&name=Asteroid+(7)+Iris+near+36+Sextantis&seq=pass&det=2&f=2025W49_1A_0423_1&fa=2025W49_1A_0332_1&cmp=blink&fov=0.3",
    ra: 161.29678,
    dec: 2.44824,
    fovDeg: 0.3,
    category: "solar-system",
    kind: "Main-belt asteroid",
    constellation: "Sextans (Dec 2025)",
    distance: "about 310 million km (2.1 au) in December 2025",
    blurb:
      "A stony main-belt asteroid about 200 km across, discovered in 1847. Asteroids move against the stars, so this link opens one set of SPHEREx visits, from December 2025, when Iris passed the star 36 Sextantis.",
    infrared:
      "Sunlight reflected by a stony asteroid carries absorption bands of the minerals olivine and pyroxene near 1 and 2 µm, clues to what its surface is made of.",
  },
  // Sources: link built from Discover case hebe-2025-05 in data/cases.json (target, then viewer fields); 294 frames
  // at that position. Size (185.2 km, IRAS), S-type, discovery 1847: JPL SBDB https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=6
  // Distance on 2025-05-14: JPL Horizons, 2.06 au from Earth. Thermal emission beyond ~4 µm: NEOWISE's 4.6 µm band
  // is partly thermal for main-belt asteroids (Mainzer et al. 2011).
  {
    id: "asteroid-6-hebe",
    name: "Asteroid (6) Hebe",
    catalogue: "6 Hebe · A847 NA",
    query: null,
    to: "/explore?ra=326.891&dec=-7.683&name=Asteroid+(6)+Hebe+in+Aquarius&seq=pass&det=2&f=2025W20_1C_0370_4&fa=2025W20_1C_0314_1&cmp=side&fov=0.3",
    ra: 326.891,
    dec: -7.683,
    fovDeg: 0.3,
    category: "solar-system",
    kind: "Main-belt asteroid",
    constellation: "Aquarius (May 2025)",
    distance: "about 310 million km (2.1 au) in May 2025",
    blurb:
      "A stony main-belt asteroid about 185 km across, discovered in 1847. Asteroids move against the stars, so this link opens one set of SPHEREx visits, from May 2025, the survey's first weeks of science.",
    infrared:
      "At the long end of SPHEREx's range, beyond about 4 µm, a main-belt asteroid's own heat starts to add to the sunlight it reflects.",
  },

  // ── Deep fields ───────────────────────────────────────────────────────────────────────────────────────
  // Sources: centre = deep_fields() in backend/src/spherex_explorer/resolve/target.py (the ecliptic pole);
  // 608 wide-survey frames, plus 24,103 QR2 deep-survey frames of this point (IRSA SIA). Field size, every-orbit
  // coverage and purpose: Bock et al. 2025, https://arxiv.org/abs/2511.02985. "Total glow from all galaxies":
  // https://www.jpl.nasa.gov/press-kits/spherex/
  {
    id: "north-deep-field",
    name: "North ecliptic pole deep field",
    catalogue: "SPHEREx deep survey",
    query: null,
    to: "/explore?ra=269.999985&dec=66.560719&name=North+ecliptic+pole+deep+field",
    ra: 269.999985,
    dec: 66.560719,
    fovDeg: 3,
    category: "deep-field",
    kind: "Survey deep field",
    constellation: "Draco",
    distance: "from nearby stars to galaxies billions of light-years away",
    blurb:
      "About 100 square degrees around the north ecliptic pole, which SPHEREx can observe throughout the year from its polar orbit. Its deep survey has taken tens of thousands of images of the centre, far more than of anywhere outside the two deep fields.",
    infrared:
      "Starlight from distant galaxies arrives stretched to longer wavelengths by the expanding universe, and SPHEREx's deep fields are designed to measure the combined near-infrared glow of all galaxies, including those too small or too distant to see one by one.",
  },
  // Sources: Bock et al. 2025 (https://arxiv.org/abs/2511.02985) put the field at ecliptic latitude −82°,
  // "longitude −44.8°", displaced "to avoid the Magellanic Clouds". IRSA's deep-survey images show the centre is
  // at longitude +44.8°: 22,538 QR2 + 1,589 QR3 deep frames at this point (more than at four points 3° around
  // it), 9.4° from the LMC. The −44.8° point that target.py uses (72.000037, −71.362903) has 0 deep frames and
  // lies 3.4° from the LMC. 620 wide-survey frames here.
  {
    id: "south-deep-field",
    name: "South deep field",
    catalogue: "SPHEREx deep survey",
    query: null,
    to: "/explore?ra=78.465119&dec=-60.405785&name=South+deep+field",
    ra: 78.465119,
    dec: -60.405785,
    fovDeg: 3,
    category: "deep-field",
    kind: "Survey deep field",
    constellation: "Dorado",
    distance: "from nearby stars to galaxies billions of light-years away",
    blurb:
      "SPHEREx's second deep field, also about 100 square degrees, is centred 8° from the south ecliptic pole so that it avoids the Magellanic Clouds. Like the north field, it can be observed throughout the year.",
    infrared:
      "Ultraviolet light from galaxies in the universe's first billion years arrives today stretched into the near-infrared, and the deep fields are designed to be sensitive enough to look for its combined glow.",
  },
];
