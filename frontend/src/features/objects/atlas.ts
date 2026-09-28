import type { Lang } from "../../lib/i18n";
import { displayId, keepNumbersWithUnits } from "./format";

/** Curated objects for the Explore page's atlas. Facts checked against SIMBAD, NED and NASA/ESA sources (see the sources list in each entry's comment). */
export type AtlasCategory = "galaxy" | "nebula" | "cluster" | "star-forming" | "solar-system" | "deep-field";

/**
 * An entry's words in Bangla, translated from the English fields without adding to them. Names keep the
 * Bangla name people use where one exists (কালপুরুষ for Orion, কৃত্তিকা for the Pleiades) and are
 * transliterated otherwise; catalogue ids, units and numbers stay as they are, with large numbers in
 * লক্ষ and কোটি.
 */
export interface AtlasBangla {
  name?: string; // the English name when absent
  catalogue?: string; // only where the English one is words rather than designations
  kind: string;
  constellation: string;
  distance: string;
  blurb: string;
  infrared: string;
}

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
  bn?: AtlasBangla;
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
    bn: {
      name: "অ্যান্ড্রোমিডা গ্যালাক্সি",
      kind: "সর্পিল গ্যালাক্সি",
      constellation: "অ্যান্ড্রোমিডা",
      distance: "প্রায় 25 লক্ষ আলোকবর্ষ",
      blurb:
        "আমাদের গ্যালাক্সির সবচেয়ে কাছের বড় গ্যালাক্সি। এটি এতটাই উজ্জ্বল যে কিছুটা আলোকদূষণ আছে এমন জায়গা থেকেও খালি চোখে দেখা যায়।",
      infrared:
        "নিকট-ইনফ্রারেড আলো আসে মূলত পুরোনো, শীতলতর তারাদের থেকে, যাদের মধ্যেই থাকে গ্যালাক্সির তারাগুলোর মোট ভরের বেশির ভাগ; আর ধুলো এই আলোকে দৃশ্যমান আলোর চেয়ে অনেক কম ম্লান করে, তাই এতে দেখা যায় কেন্দ্রের স্ফীত অংশ আর চাকতিজুড়ে তারারা আসলে কীভাবে ছড়িয়ে আছে।",
    },
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
    bn: {
      name: "ট্রায়াঙ্গুলাম গ্যালাক্সি",
      kind: "সর্পিল গ্যালাক্সি",
      constellation: "ট্রায়াঙ্গুলাম",
      distance: "প্রায় 30 লক্ষ আলোকবর্ষ",
      blurb:
        "আমাদের স্থানীয় গ্যালাক্সি-গোষ্ঠীর (Local Group) তৃতীয় বৃহত্তম গ্যালাক্সি, আকারে আকাশগঙ্গার প্রায় অর্ধেক। এর একটি সর্পিল বাহুতে আছে NGC 604, তারা-জন্মের এমন এক মেঘ, যা কালপুরুষ নীহারিকার চেয়ে প্রায় 100 গুণ বড়।",
      infrared:
        "দৃশ্যমান আলোকে যে ধুলো ম্লান করে দেয়, নিকট-ইনফ্রারেড আলো তা ভেদ করে যায়; আর SPHEREx যে দীর্ঘতর তরঙ্গদৈর্ঘ্যগুলো দেখে, সেখানে উষ্ণ ধুলোর আভা এবং 3.3 µm-এর কাছে কার্বন-সমৃদ্ধ PAH অণুর আভা দেখিয়ে দেয় কোথায় তারার জন্ম হচ্ছে।",
    },
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
    bn: {
      name: "হোয়ার্লপুল গ্যালাক্সি",
      kind: "মিথস্ক্রিয়ারত সর্পিল গ্যালাক্সি",
      constellation: "ক্যানেস ভেনাটিসি",
      distance: "প্রায় 3 কোটি আলোকবর্ষ",
      blurb:
        "সামনাসামনি দেখা একটি সর্পিল গ্যালাক্সি; এর একটি বাহুর মাথায় আছে ছোট এক সঙ্গী গ্যালাক্সি, NGC 5195। দুটির খুব কাছাকাছি আসার ঘটনাই হয়তো হোয়ার্লপুলের বাহুগুলো এত স্পষ্ট হওয়ার কারণ।",
      infrared:
        "ধুলোময় সর্পিল বাহুগুলোর নিচে নিকট-ইনফ্রারেড আলো পুরোনো তারাদের মসৃণ চাকতিটি ফুটিয়ে তোলে, আর 3.3 µm-এর কাছে PAH-এর বিকিরণ অনুসরণ করে সেই বাহুগুলোকে, যেখানে নতুন তারার জন্ম হচ্ছে।",
    },
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
    bn: {
      name: "বোডের গ্যালাক্সি",
      kind: "সর্পিল গ্যালাক্সি",
      constellation: "সপ্তর্ষিমণ্ডল",
      distance: "প্রায় 1.2 কোটি আলোকবর্ষ",
      blurb:
        "রাতের আকাশের উজ্জ্বলতম গ্যালাক্সিগুলোর একটি; 1774 সালে ইয়োহান এলার্ট বোডে এটি খুঁজে পান। বাইনোকুলারে এটি আর এর প্রতিবেশী সিগার গ্যালাক্সি একই দৃষ্টিক্ষেত্রে ধরা পড়ে।",
      infrared:
        "নিকট-ইনফ্রারেড আলোয় গ্যালাক্সিটির পুরোনো, শীতল তারায় গড়া কেন্দ্রের বড় স্ফীত অংশ আর চাকতি স্পষ্ট হয়ে ওঠে, আর ধুলো এই আলোকে দৃশ্যমান আলোর চেয়ে অনেক কম ম্লান করে।",
    },
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
    bn: {
      name: "সিগার গ্যালাক্সি",
      kind: "স্টারবার্স্ট গ্যালাক্সি",
      constellation: "সপ্তর্ষিমণ্ডল",
      distance: "প্রায় 1.2 কোটি আলোকবর্ষ",
      blurb:
        "এর কেন্দ্রের চারপাশে নতুন তারা জন্ম নিচ্ছে পুরো আকাশগঙ্গার চেয়ে প্রায় 10 গুণ দ্রুত; তারা-জন্মের এই জোয়ার, বা ‘স্টারবার্স্ট’, শুরু হয়েছে প্রতিবেশী M81-এর সঙ্গে মহাকর্ষীয় মিথস্ক্রিয়ার ফলে। নবজাত তারাগুলো গ্যালাক্সি থেকে গ্যাসের একটি প্রবাহ বাইরে ঠেলে দেয়।",
      infrared:
        "দৃশ্যমান আলোয় যে ধুলো স্টারবার্স্টকে আড়াল করে রাখে, নিকট-ইনফ্রারেড আলো তার অনেকটাই ভেদ করে দেখতে পায়; আর সেই ধুলোর PAH অণুগুলো 3.3 µm-এর কাছে জোরালো আভা ছড়ায়, যা তারা-জন্মের একটি প্রচলিত চিহ্ন।",
    },
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
    bn: {
      name: "পিনহুইল গ্যালাক্সি",
      kind: "সর্পিল গ্যালাক্সি",
      constellation: "সপ্তর্ষিমণ্ডল",
      distance: "প্রায় 2.1 কোটি আলোকবর্ষ",
      blurb:
        "সামনাসামনি দেখা একটি সর্পিল গ্যালাক্সি, আড়াআড়ি প্রায় 1.7 লক্ষ আলোকবর্ষ, অর্থাৎ আকাশগঙ্গার চেয়ে প্রায় 70 শতাংশ বড়।",
      infrared:
        "নিকট-ইনফ্রারেড আলোয় গ্যালাক্সিটির পুরোনো তারাগুলো একটি মসৃণ চাকতি গড়ে, আর এর বাহুজুড়ে তারা-জন্মের গুচ্ছগুলো দীর্ঘতর তরঙ্গদৈর্ঘ্যে যোগ করে উষ্ণ ধুলো ও PAH অণুর আভা।",
    },
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
    bn: {
      name: "স্কাল্পটর গ্যালাক্সি",
      kind: "স্টারবার্স্ট সর্পিল গ্যালাক্সি",
      constellation: "স্কাল্পটর",
      distance: "প্রায় 1.1 কোটি আলোকবর্ষ",
      blurb:
        "আকাশের সবচেয়ে ধুলোময় সর্পিল গ্যালাক্সিগুলোর একটি; এর কেন্দ্রের কাছে দ্রুত নতুন তারা তৈরি হচ্ছে। 1783 সালে ধূমকেতু খুঁজতে গিয়ে ক্যারোলিন হার্শেল এটি আবিষ্কার করেন।",
      infrared:
        "দৃশ্যমান আলোয় যে ধুলো গ্যালাক্সিটির চাকতি আড়াল করে, নিকট-ইনফ্রারেড আলো তার অনেকটাই ভেদ করে যায়; আর গরম ধুলো ও 3.3 µm-এর কাছে PAH-এর বিকিরণ এর কেন্দ্রে তারা-জন্মের জোয়ারটি চিনিয়ে দেয়।",
    },
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
    bn: {
      name: "সেন্টরাস এ",
      kind: "সক্রিয় গ্যালাক্সি",
      constellation: "সেন্টরাস",
      distance: "প্রায় 1.2 কোটি আলোকবর্ষ",
      blurb:
        "পৃথিবীর সবচেয়ে কাছের সক্রিয় গ্যালাক্সি। এর ওপর দিয়ে চলে গেছে ধুলোর একটি অন্ধকার পট্টি, যা সম্ভবত দুটি গ্যালাক্সির সংঘর্ষের ধ্বংসাবশেষ। কেন্দ্রের একটি অতিবৃহৎ কৃষ্ণগহ্বর যে জেট ছুড়ে দেয়, তা বেতার তরঙ্গ আর এক্স-রেতে দেখা যায়।",
      infrared:
        "যে ধুলো দৃশ্যমান আলো আটকে দেয়, নিকট-ইনফ্রারেডে তা অনেক বেশি স্বচ্ছ; তাই গ্যালাক্সির অন্ধকার পট্টির ভেতরের ও পেছনের তারাগুলো দেখা যায়।",
    },
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
    bn: {
      name: "কালপুরুষ নীহারিকা",
      kind: "তারা-জন্মের নীহারিকা",
      constellation: "কালপুরুষ",
      distance: "প্রায় 1,350 আলোকবর্ষ",
      blurb:
        "পৃথিবীর সবচেয়ে কাছের বড় তারা-জন্মের অঞ্চল, কালপুরুষের কোমরবন্ধের ঠিক নিচে খালি চোখেই দেখা যায়। এর কেন্দ্রের ট্র্যাপিজিয়াম নক্ষত্রপুঞ্জের উত্তপ্ত তরুণ তারাগুলো চারপাশের গ্যাসকে আলোকিত করে।",
      infrared:
        "সবচেয়ে নবীন তারাদের যে ধুলো আড়াল করে রাখে, নিকট-ইনফ্রারেড আলো তার অনেকটাই ভেদ করে যায়; তাই উজ্জ্বল গ্যাসের পেছনে মেঘের ভেতরে এখনো ঢাকা পড়ে থাকা অনেক তারা দেখা যায়।",
    },
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
    bn: {
      name: "ল্যাগুন নীহারিকা",
      kind: "তারা-জন্মের নীহারিকা",
      constellation: "ধনু",
      distance: "প্রায় 4,000 আলোকবর্ষ",
      blurb:
        "উজ্জ্বল গ্যাসের এক বিশাল মেঘ, আমাদের আকাশে যা পূর্ণিমার চাঁদের প্রায় তিন গুণ চওড়া। এখানেই জন্ম নিয়েছে তরুণ নক্ষত্রপুঞ্জ NGC 6530, আর এখনো নতুন তারা তৈরি হচ্ছে।",
      infrared:
        "নিকট-ইনফ্রারেড আলোয় নীহারিকাজুড়ে ধুলোর অন্ধকার পট্টিগুলো আংশিক স্বচ্ছ হয়ে যায়, ফলে ভেতরে লুকিয়ে থাকা তরুণ তারাগুলো দেখা যায়।",
    },
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
    bn: {
      name: "ঈগল নীহারিকা",
      kind: "তারা-জন্মের নীহারিকা",
      constellation: "সার্পেন্স",
      distance: "প্রায় 5,500 থেকে 7,000 আলোকবর্ষ",
      blurb:
        "উজ্জ্বল গ্যাসের মেঘের ভেতরে একটি তরুণ নক্ষত্রপুঞ্জ, NGC 6611। এই মেঘেই আছে ‘সৃষ্টির স্তম্ভ’ (Pillars of Creation) নামের ধুলোময় স্তম্ভগুলো, যা 1995 সালে হাবল টেলিস্কোপের ছবিতে বিখ্যাত হয়ে ওঠে।",
      infrared:
        "দৃশ্যমান আলোয় স্তম্ভগুলোর ধুলো প্রায় অস্বচ্ছ দেখায়, কিন্তু নিকট-ইনফ্রারেড আলোয় তা আংশিক স্বচ্ছ; তাই স্তম্ভগুলোর ভেতরে ও আশপাশে সদ্য জন্ম নেওয়া তারাগুলো দেখা যায়।",
    },
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
    bn: {
      name: "ক্যারিনা নীহারিকা",
      kind: "তারা-জন্মের নীহারিকা",
      constellation: "ক্যারিনা",
      distance: "প্রায় 7,500 আলোকবর্ষ",
      blurb:
        "দক্ষিণ আকাশের আকাশগঙ্গায় তারা-জন্মের এক বিশাল মেঘ, আড়াআড়ি 200 আলোকবর্ষেরও বেশি। এর ভেতরে আছে ইটা ক্যারিনি, এমন একটি তারা-ব্যবস্থা যার সবচেয়ে বড় তারাটির ভর সূর্যের প্রায় 100 গুণ।",
      infrared:
        "নিকট-ইনফ্রারেড আলো নীহারিকার ধুলোর অনেকটাই ভেদ করে যায়, ফলে এর অন্ধকার স্তম্ভ আর মেঘের ভেতরে এখনো থাকা তরুণ তারাগুলো দেখা যায়।",
    },
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
    bn: {
      name: "রো অফিউকি মেঘপুঞ্জ",
      kind: "তারা-জন্মের অন্ধকার মেঘ",
      constellation: "অফিউকাস",
      distance: "প্রায় 390 থেকে 450 আলোকবর্ষ",
      blurb:
        "পৃথিবীর সবচেয়ে কাছের তারা-জন্মের অঞ্চলগুলোর একটি: গ্যাস আর ধুলোর অন্ধকার মেঘ, যেখানে তৈরি হচ্ছে সূর্যের মতো তারা আর ভবিষ্যতের গ্রহব্যবস্থা।",
      infrared:
        "সবচেয়ে নবীন তারাদের যে ধুলো আড়াল করে রাখে, নিকট-ইনফ্রারেড আলো তার অনেকটাই ভেদ করে যায়; আর এমন শীতল মেঘে থাকা পানি, কার্বন ডাই-অক্সাইড ও কার্বন মনোক্সাইডের বরফের শোষণ-ব্যান্ড (প্রায় 3.0, 4.3 ও 4.7 µm) SPHEREx-এর পরিসরের মধ্যেই পড়ে।",
    },
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
    bn: {
      name: "হর্সহেড নীহারিকা",
      kind: "অন্ধকার নীহারিকা",
      constellation: "কালপুরুষ",
      distance: "প্রায় 1,300 আলোকবর্ষ",
      blurb:
        "ঘন গ্যাস আর ধুলোর একটি অন্ধকার স্তম্ভ, দেখতে ঘোড়ার মাথার মতো, উজ্জ্বল হাইড্রোজেন গ্যাসের পটভূমিতে দেখা যায়। এটি রয়েছে Orion B আণবিক মেঘের পশ্চিম প্রান্তে।",
      infrared:
        "দৃশ্যমান আলোয় যে ধুলোর কারণে হর্সহেডকে নিরেট কালো দেখায়, ইনফ্রারেড আলো তার অনেকটাই ভেদ করে যায়; তাই নিকট-ইনফ্রারেডে এটিকে দেখায় গ্যাস আর ধুলোর পাতলা, ভঙ্গুর ভাঁজের মতো।",
    },
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
    bn: {
      name: "ক্র্যাব নীহারিকা",
      kind: "সুপারনোভা-অবশেষ",
      constellation: "বৃষ",
      distance: "প্রায় 6,500 আলোকবর্ষ",
      blurb:
        "একটি তারার অবশেষ, যার বিস্ফোরণের কথা চীনা জ্যোতির্বিদেরা 1054 সালে লিখে রেখেছিলেন; প্রায় এক মাস ধরে সেটি দিনের আলোতেও দেখা যাওয়ার মতো উজ্জ্বল ছিল। এর কেন্দ্রে আছে একটি পালসার, অর্থাৎ এমন এক নিউট্রন তারা, যা সেকেন্ডে 30 বার স্পন্দিত হয়।",
      infrared:
        "ক্র্যাবের নিকট-ইনফ্রারেড আলোর বেশির ভাগই সিনক্রোট্রন বিকিরণ, যা আসে পালসারের চারপাশের চৌম্বক ক্ষেত্রে প্রায় আলোর বেগে পাক খেয়ে ঘোরা ইলেকট্রন থেকে; তাই দৃশ্যমান আলোয় যে গ্যাসের তন্তুগুলো স্পষ্ট চোখে পড়ে, এখানে সেগুলো ততটা প্রকট নয়।",
    },
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
    bn: {
      name: "রিং নীহারিকা",
      kind: "গ্রহ-নীহারিকা",
      constellation: "লাইরা",
      distance: "প্রায় 2,500 আলোকবর্ষ",
      blurb:
        "মৃত্যুপথযাত্রী একটি তারার ছুড়ে ফেলা গ্যাসের খোলস, যা এখন আলোকিত হচ্ছে তারাটির রেখে যাওয়া উত্তপ্ত শ্বেত বামনের আলোয়। আকাশে এটি ছোট, আড়াআড়ি মাত্র প্রায় এক ডজন SPHEREx পিক্সেল।",
      infrared:
        "নিকট-ইনফ্রারেড আলোয় দেখা যায় নীহারিকার বাইরের খোলস আর হাজার হাজার ঘন পিণ্ডে থাকা আণবিক হাইড্রোজেন, যে গ্যাস দৃশ্যমান আলোর ছবিতে প্রায় ধরাই পড়ে না।",
    },
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
    bn: {
      name: "হেলিক্স নীহারিকা",
      kind: "গ্রহ-নীহারিকা",
      constellation: "কুম্ভ",
      distance: "প্রায় 650 আলোকবর্ষ",
      blurb:
        "পৃথিবীর সবচেয়ে কাছের গ্রহ-নীহারিকাগুলোর একটি: মৃত্যুপথযাত্রী একটি তারার বাইরের স্তরগুলো ছড়িয়ে তৈরি হয়েছে প্রায় তিন আলোকবর্ষ চওড়া একটি বলয়, যা আকাশে দেখতে পূর্ণিমার চাঁদের প্রায় অর্ধেক চওড়া।",
      infrared:
        "কেন্দ্র থেকে চারদিকে ছড়ানো গিঁট আর তন্তুগুলোর আণবিক হাইড্রোজেন নিকট-ইনফ্রারেড আলোয় ফুটে ওঠে; এই শীতল গ্যাস দৃশ্যমান আলোয় বেশির ভাগই চোখ এড়িয়ে যায়।",
    },
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
    bn: {
      name: "কৃত্তিকা",
      kind: "মুক্ত নক্ষত্রপুঞ্জ",
      constellation: "বৃষ",
      distance: "প্রায় 445 আলোকবর্ষ",
      blurb:
        "‘সাত বোন’ নামেও পরিচিত: প্রায় 10 কোটি বছর আগে জন্ম নেওয়া এক হাজারেরও বেশি তারা, খালি চোখেই সহজে দেখা যায়। এর উজ্জ্বল তারাগুলো আলোকিত করে ধুলোর এমন একটি মেঘ, যার ভেতর দিয়ে নক্ষত্রপুঞ্জটি ঘটনাচক্রে এখন যাচ্ছে।",
      infrared:
        "নিকট-ইনফ্রারেড আলোয় ধরা পড়ে নক্ষত্রপুঞ্জের ক্ষীণ, শীতল, কম ভরের সদস্যরা, বাদামি বামনসহ, দৃশ্যমান আলোয় যাদের দেখা কঠিন।",
    },
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
    bn: {
      name: "হারকিউলিস গোলকাকার নক্ষত্রপুঞ্জ",
      kind: "গোলকাকার নক্ষত্রপুঞ্জ",
      constellation: "হারকিউলিস",
      distance: "প্রায় 25 হাজার আলোকবর্ষ",
      blurb:
        "মহাকর্ষের টানে একসঙ্গে বাঁধা 1 লক্ষেরও বেশি পুরোনো তারার একটি গোলক; উত্তর গোলার্ধে গ্রীষ্মের সন্ধ্যায় বাইনোকুলারে সহজেই খুঁজে পাওয়া যায়।",
      infrared:
        "পুরোনো নক্ষত্রপুঞ্জের নিকট-ইনফ্রারেড আলোর অনেকটাই আসে এর শীতল লোহিত দানব তারাদের থেকে; দৃশ্যমান আলোর তুলনায় এই আলোয় উষ্ণতর তারাদের মাঝে এরা আরও স্পষ্ট হয়ে ফুটে ওঠে।",
    },
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
    bn: {
      name: "ওমেগা সেন্টরি",
      kind: "গোলকাকার নক্ষত্রপুঞ্জ",
      constellation: "সেন্টরাস",
      distance: "প্রায় 17 হাজার আলোকবর্ষ",
      blurb:
        "আকাশের সবচেয়ে বড় ও উজ্জ্বল গোলকাকার নক্ষত্রপুঞ্জ, এতে আছে প্রায় 1 কোটি তারা। এটি হয়তো কোনো ছোট গ্যালাক্সির কেন্দ্রভাগ, যার বাইরের তারাগুলো ছিনিয়ে নেওয়া হয়েছে।",
      infrared:
        "নিকট-ইনফ্রারেড আলোয় নক্ষত্রপুঞ্জটিতে প্রাধান্য পায় এর শীতল লোহিত দানবেরা, আর আমাদের ও নক্ষত্রপুঞ্জের মাঝের ধুলো এই আলোকে দৃশ্যমান আলোর চেয়ে কম ম্লান করে।",
    },
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
    bn: {
      name: "গ্রহাণু (7) আইরিস",
      kind: "প্রধান বলয়ের গ্রহাণু",
      constellation: "সেক্সট্যান্স (ডিসেম্বর 2025)",
      distance: "প্রায় 31 কোটি km (2.1 au), ডিসেম্বর 2025-এ",
      blurb:
        "প্রধান বলয়ের একটি পাথুরে গ্রহাণু, আড়াআড়ি প্রায় 200 km, আবিষ্কৃত হয় 1847 সালে। গ্রহাণুরা তারাদের পটভূমিতে সরে যায়, তাই এই লিংকে খোলে SPHEREx-এর এক দফা পর্যবেক্ষণ, ডিসেম্বর 2025-এর, যখন আইরিস 36 Sextantis তারার পাশ দিয়ে যাচ্ছিল।",
      infrared:
        "পাথুরে গ্রহাণুর প্রতিফলিত সূর্যের আলোয় থাকে অলিভিন ও পাইরক্সিন খনিজের শোষণ-ব্যান্ড, প্রায় 1 ও 2 µm-এ, যা এর পৃষ্ঠ কী দিয়ে তৈরি তার সূত্র দেয়।",
    },
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
    bn: {
      name: "গ্রহাণু (6) হেবি",
      kind: "প্রধান বলয়ের গ্রহাণু",
      constellation: "কুম্ভ (মে 2025)",
      distance: "প্রায় 31 কোটি km (2.1 au), মে 2025-এ",
      blurb:
        "প্রধান বলয়ের একটি পাথুরে গ্রহাণু, আড়াআড়ি প্রায় 185 km, আবিষ্কৃত হয় 1847 সালে। গ্রহাণুরা তারাদের পটভূমিতে সরে যায়, তাই এই লিংকে খোলে SPHEREx-এর এক দফা পর্যবেক্ষণ, মে 2025-এর, জরিপের বৈজ্ঞানিক কাজের প্রথম সপ্তাহগুলো থেকে।",
      infrared:
        "SPHEREx-এর পরিসরের দীর্ঘ প্রান্তে, প্রায় 4 µm-এর পরে, প্রধান বলয়ের গ্রহাণুর নিজের তাপের বিকিরণ তার প্রতিফলিত সূর্যালোকের সঙ্গে যোগ হতে শুরু করে।",
    },
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
    bn: {
      name: "ক্রান্তিবৃত্তের উত্তর মেরুর গভীর ক্ষেত্র",
      catalogue: "SPHEREx-এর গভীর জরিপ",
      kind: "জরিপের গভীর ক্ষেত্র",
      constellation: "ড্রাকো",
      distance: "কাছের তারা থেকে শত শত কোটি আলোকবর্ষ দূরের গ্যালাক্সি পর্যন্ত",
      blurb:
        "ক্রান্তিবৃত্তের উত্তর মেরুর চারপাশে প্রায় 100 বর্গডিগ্রি এলাকা, যা SPHEREx তার মেরু-কক্ষপথ থেকে সারা বছরই পর্যবেক্ষণ করতে পারে। এর গভীর জরিপে কেন্দ্রটির দশ হাজারেরও বেশি ছবি তোলা হয়েছে, যা দুটি গভীর ক্ষেত্রের বাইরে যেকোনো জায়গার চেয়ে অনেক বেশি।",
      infrared:
        "দূরের গ্যালাক্সির তারার আলো প্রসারমাণ মহাবিশ্বের কারণে দীর্ঘতর তরঙ্গদৈর্ঘ্যে প্রসারিত হয়ে পৌঁছায়; আর SPHEREx-এর গভীর ক্ষেত্রগুলো পরিকল্পনা করা হয়েছে সব গ্যালাক্সির মিলিত নিকট-ইনফ্রারেড আভা মাপার জন্য, এমন গ্যালাক্সিসহ যেগুলো আলাদা করে দেখার পক্ষে খুব ছোট বা খুব দূরে।",
    },
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
    bn: {
      name: "দক্ষিণের গভীর ক্ষেত্র",
      catalogue: "SPHEREx-এর গভীর জরিপ",
      kind: "জরিপের গভীর ক্ষেত্র",
      constellation: "ডোরাডো",
      distance: "কাছের তারা থেকে শত শত কোটি আলোকবর্ষ দূরের গ্যালাক্সি পর্যন্ত",
      blurb:
        "SPHEREx-এর দ্বিতীয় গভীর ক্ষেত্র, এটিও প্রায় 100 বর্গডিগ্রি; ম্যাজেলানিক মেঘ এড়াতে এর কেন্দ্র রাখা হয়েছে ক্রান্তিবৃত্তের দক্ষিণ মেরু থেকে 8° দূরে। উত্তরের ক্ষেত্রটির মতো এটিও সারা বছর পর্যবেক্ষণ করা যায়।",
      infrared:
        "মহাবিশ্বের প্রথম 100 কোটি বছরের গ্যালাক্সিগুলোর অতিবেগুনি আলো আজ প্রসারিত হয়ে নিকট-ইনফ্রারেড হিসেবে পৌঁছায়, আর গভীর ক্ষেত্রগুলো পরিকল্পনা করা হয়েছে এমনভাবে, যাতে সেই মিলিত আভা খোঁজার মতো যথেষ্ট সংবেদনশীল হয়।",
    },
  },
];

/** An entry's words in the reader's language. */
export interface AtlasText {
  name: string;
  catalogue: string;
  kind: string;
  constellation: string;
  distance: string;
  blurb: string;
  infrared: string;
}

export function atlasText(o: AtlasObject, lang: Lang): AtlasText {
  const bn = lang === "bn" ? o.bn : undefined;
  if (!bn) {
    const { name, catalogue, kind, constellation, distance, blurb, infrared } = o;
    return { name, catalogue, kind, constellation, distance, blurb, infrared };
  }
  return {
    name: bn.name ?? o.name,
    catalogue: bn.catalogue ?? o.catalogue,
    kind: bn.kind,
    constellation: bn.constellation,
    distance: keepNumbersWithUnits(bn.distance),
    blurb: keepNumbersWithUnits(bn.blurb),
    infrared: keepNumbersWithUnits(bn.infrared),
  };
}

// Designations compared without case, spaces or SIMBAD's prefixes: "M  31", "M 31" and "M31" match.
const designation = (id: string) => displayId(id).toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * The atlas entry for a catalogued object, matched by any of its designations or its common name, so
 * the profile of M 31 can use the atlas's Bangla name. Only fixed objects are matched: an asteroid or a
 * survey field is never the object SIMBAD finds at a position.
 */
export function atlasEntryFor(object: { id: string; name: string | null; aliases?: string[] }): AtlasObject | null {
  const ids = new Set([object.id, ...(object.aliases ?? [])].map(designation));
  const name = object.name?.toLowerCase();
  return (
    ATLAS.find(
      (o) =>
        o.query !== null &&
        (o.name.toLowerCase() === name || o.catalogue.split(" · ").some((c) => ids.has(designation(c)))),
    ) ?? null
  );
}

/** A catalogued object's name in the reader's language: the atlas's Bangla name where it has one, else null. */
export function localName(object: { id: string; name: string | null; aliases?: string[] }, lang: Lang): string | null {
  return lang === "bn" ? (atlasEntryFor(object)?.bn?.name ?? null) : null;
}

/** A SPHEREx deep field's name (as the API gives it) in the reader's language. */
export function deepFieldName(name: string, lang: Lang): string {
  if (lang !== "bn") return name;
  return ATLAS.find((o) => o.category === "deep-field" && o.name === name)?.bn?.name ?? name;
}
