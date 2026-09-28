import { defineMessages } from "../../lib/i18n";
import type { AtlasCategory } from "./atlas";
import type { ObjectCategory } from "./types";

/*
 * UI text for the object features in English and Bangla. SIMBAD's own class names ("Spectroscopic
 * Binary", "BL Lac"), catalogue ids and survey names stay as the catalogues write them; the words
 * around them are translated. Numbers stay in Western digits in both languages.
 */

/** "About this object": ObjectProfile. */
export const PROFILE = defineMessages({
  en: {
    kicker: "About this object",
    type: "Type",
    galaxy: "Galaxy",
    simbadClass: "SIMBAD class: {label}",
    distance: "Distance",
    redshift: "Redshift z = {z}",
    notMeasured: "Not measured in SIMBAD",
    size: "Size on the sky",
    brightness: "Brightness",
    magnitudes: "magnitudes: lower is brighter; K is 2.2 µm",
    spectralType: "Spectral type",
    hubbleType: "Hubble type",
    aliases: "Also known as",
    listen: "Listen to its colours",
    unavailable: "Catalogue details are not available right now. The images and the map still describe this spot.",
    unavailableSnapshot:
      "Catalogue details are not available right now in the demo snapshot. The images and the map still describe this spot.",
    nothingHere:
      "No catalogued object sits exactly here. The images show the same field in other light, and the map shows where it is.",
    otherLight: "The same patch in other light",
    spherexRange: "SPHEREx records 0.75–5 µm, between the near- and mid-infrared views below.",
    where: "Where it is in the sky",
    constellation: "Constellation",
    galacticLatitude: "Galactic latitude",
    eclipticLatitude: "Ecliptic latitude",
    deepField: "Deep field",
    no: "No",
    nearPlane: "Close to the Milky Way's plane, so the field is crowded with stars and dust.",
    mapKey:
      "Band: the Milky Way's plane. Dashed line: the ecliptic, where the planets travel. Circles: SPHEREx's deep fields.",
    credits: "Catalogue: {catalogue}. Images: {images}, via CDS hips2fits.",
  },
  bn: {
    kicker: "এই বস্তুর পরিচয়",
    type: "ধরন",
    galaxy: "গ্যালাক্সি",
    simbadClass: "SIMBAD শ্রেণি: {label}",
    distance: "দূরত্ব",
    redshift: "লোহিত সরণ z = {z}",
    notMeasured: "SIMBAD-এ কোনো পরিমাপ নেই",
    size: "আকাশে আকার",
    brightness: "উজ্জ্বলতা",
    magnitudes: "ঔজ্জ্বল্য-মান: মান যত কম, বস্তু তত উজ্জ্বল; K হলো 2.2\u00a0µm",
    spectralType: "বর্ণালি-শ্রেণি",
    hubbleType: "হাবল শ্রেণি",
    aliases: "অন্য নাম",
    listen: "এর রংগুলো শুনুন",
    unavailable: "এই মুহূর্তে ক্যাটালগের তথ্য পাওয়া যাচ্ছে না। তবু ছবি আর মানচিত্রে এই জায়গাটির পরিচয় মিলবে।",
    unavailableSnapshot:
      "এই মুহূর্তে ডেমো স্ন্যাপশটে ক্যাটালগের তথ্য পাওয়া যাচ্ছে না। তবু ছবি আর মানচিত্রে এই জায়গাটির পরিচয় মিলবে।",
    nothingHere:
      "ঠিক এই জায়গায় ক্যাটালগভুক্ত কোনো বস্তু নেই। ছবিগুলোতে আকাশের একই অংশ অন্য আলোয় দেখা যাচ্ছে, আর মানচিত্রে দেখা যাচ্ছে জায়গাটি কোথায়।",
    otherLight: "একই অংশ, অন্য আলোয়",
    spherexRange: "SPHEREx ধরে 0.75–5\u00a0µm তরঙ্গদৈর্ঘ্যের আলো, যা নিচের নিকট- ও মধ্য-ইনফ্রারেড ছবির মাঝামাঝি।",
    where: "আকাশে এর অবস্থান",
    constellation: "নক্ষত্রমণ্ডল",
    galacticLatitude: "গ্যালাক্টিক অক্ষাংশ",
    eclipticLatitude: "ক্রান্তীয় অক্ষাংশ",
    deepField: "গভীর ক্ষেত্র",
    no: "না",
    nearPlane: "আকাশগঙ্গার সমতলের কাছে, তাই এই অংশে তারা আর ধুলোর ভিড়।",
    mapKey:
      "চওড়া পট্টি: আকাশগঙ্গার সমতল। ভাঙা রেখা: ক্রান্তিবৃত্ত, যে পথ ধরে গ্রহরা চলে। বৃত্ত: SPHEREx-এর গভীর ক্ষেত্র।",
    credits: "ক্যাটালগ: {catalogue}। ছবি: {images}, CDS hips2fits-এর মাধ্যমে।",
  },
});

/** The same patch of sky from other surveys: ContextImages. */
export const IMAGES = defineMessages({
  en: {
    notAvailable: "Not available",
    alt: "{label} image of this field ({band})",
    across: "{size} across",
  },
  bn: {
    notAvailable: "পাওয়া যায়নি",
    alt: "{seen} এই অংশের ছবি ({band})",
    across: "{size}\u00a0চওড়া",
  },
});

/** The all-sky map: SkyLocator. */
export const LOCATOR = defineMessages({
  en: {
    label:
      "All-sky map: {label} is at right ascension {ra}°, declination {dec}°. The band shows the plane of the Milky Way; the dashed line is the ecliptic.",
  },
  bn: {
    label:
      "পুরো আকাশের মানচিত্র: {label} রয়েছে বিষুবাংশ {ra}°, বিষুবলম্ব {dec}°-এ। চওড়া পট্টিটি আকাশগঙ্গার সমতল; ভাঙা রেখাটি ক্রান্তিবৃত্ত।",
  },
});

/** Catalogued objects around the target: FieldObjects. */
export const FIELD = defineMessages({
  en: {
    kicker: "In this field",
    title: "Catalogued objects in view",
    intro: "The most-studied objects SIMBAD lists within {r}′ of the target. Pick one to explore it.",
    error: "The catalogue could not be searched right now.",
    errorSnapshot: "The catalogue could not be searched right now in the demo snapshot.",
    empty: "SIMBAD lists no objects within {r}′ of this position.",
    object: "Object",
    type: "Type",
    fromTarget: "From target",
    fewer: "Show fewer",
    all: "Show all {n}",
  },
  bn: {
    kicker: "আকাশের এই অংশে",
    title: "দৃষ্টিক্ষেত্রে ক্যাটালগভুক্ত বস্তু",
    intro: "লক্ষ্যবস্তুর {r}′-এর মধ্যে SIMBAD-এর তালিকায় থাকা সবচেয়ে বেশি গবেষণা হওয়া বস্তুগুলো। যেকোনো একটি বেছে নিয়ে অন্বেষণ করুন।",
    error: "এই মুহূর্তে ক্যাটালগে খোঁজা যাচ্ছে না।",
    errorSnapshot: "এই মুহূর্তে ডেমো স্ন্যাপশটে ক্যাটালগে খোঁজা যাচ্ছে না।",
    empty: "এই অবস্থানের {r}′-এর মধ্যে SIMBAD-এ কোনো বস্তু তালিকাভুক্ত নেই।",
    object: "বস্তু",
    type: "ধরন",
    fromTarget: "লক্ষ্যবস্তু থেকে",
    fewer: "কম দেখান",
    all: "সব {n}টি দেখান",
  },
});

/** The curated atlas and its landing-page teaser: ObjectAtlas, AtlasTeaser. */
export const ATLAS_UI = defineMessages({
  en: {
    kicker: "An atlas of the sky",
    // The heading is split around the phrase that carries the accent colour.
    titleBefore: "Start with an ",
    titleShine: "object",
    titleAfter: ".",
    intro:
      "Galaxies, star-forming clouds, clusters and moving asteroids, each with SPHEREx images to step through. The pictures here are visible-light views from the Digitized Sky Survey, for comparison.",
    filter: "Filter the atlas",
    all: "All {n}",
    alt: "{name} in visible light (DSS2)",
    explore: "Explore",
  },
  bn: {
    kicker: "আকাশের অ্যাটলাস",
    titleBefore: "একটি ",
    titleShine: "বস্তু",
    titleAfter: " দিয়ে শুরু করুন।",
    intro:
      "গ্যালাক্সি, তারা-জন্মের মেঘ, নক্ষত্রপুঞ্জ আর চলমান গ্রহাণু, প্রতিটির সঙ্গে আছে একের পর এক দেখার মতো SPHEREx-এর ছবি। তুলনার জন্য এখানকার ছবিগুলো দৃশ্যমান আলোয় তোলা, Digitized Sky Survey থেকে নেওয়া।",
    filter: "অ্যাটলাস ফিল্টার করুন",
    all: "সব {n}টি",
    alt: "দৃশ্যমান আলোয় {name} (DSS2)",
    explore: "অন্বেষণ করুন",
  },
});

/** The atlas's filter chips, one per kind of object. */
export const ATLAS_CATEGORIES = defineMessages<AtlasCategory>({
  en: {
    galaxy: "Galaxies",
    "star-forming": "Star-forming regions",
    nebula: "Nebulae",
    cluster: "Star clusters",
    "solar-system": "Solar System",
    "deep-field": "Deep fields",
  },
  bn: {
    galaxy: "গ্যালাক্সি",
    "star-forming": "তারা-জন্মের অঞ্চল",
    nebula: "নীহারিকা",
    cluster: "নক্ষত্রপুঞ্জ",
    "solar-system": "সৌরজগৎ",
    "deep-field": "গভীর ক্ষেত্র",
  },
});

/** What SPHEREx's 0.75–5 µm view brings out, in general terms, for each kind of object. */
export const INFRARED = defineMessages<ObjectCategory>({
  en: {
    galaxy:
      "In SPHEREx's bands most of a galaxy's light comes from older, cooler stars, and the 3.3 µm channels pick up warm dust and organic (PAH) molecules where stars are forming.",
    star: "A star's colour across SPHEREx's 102 channels follows its temperature: cool red stars are brightest in the near-infrared, hot blue stars fade towards longer wavelengths.",
    nebula:
      "Infrared light passes through much of the dust that hides the inside of a nebula, and ices in cold dust absorb at about 3.0, 4.3 and 4.7 µm, all within SPHEREx's range.",
    cluster:
      "In the near-infrared a cluster's light is dominated by its cool giant stars; SPHEREx's 6-arcsecond pixels blend the most crowded parts together.",
    "solar-system":
      "Asteroids reflect sunlight and, further into the infrared, glow with their own warmth; between two SPHEREx visits they move against the fixed stars.",
    other:
      "SPHEREx sees this spot in 102 colours from 0.75 to 5 µm, building a spectrum from many exposures over each survey pass.",
  },
  bn: {
    galaxy:
      "SPHEREx যে তরঙ্গদৈর্ঘ্যগুলোতে দেখে, সেখানে কোনো গ্যালাক্সির বেশির ভাগ আলো আসে পুরোনো, শীতলতর তারাদের থেকে; আর 3.3 µm-এর চ্যানেলগুলোতে ধরা পড়ে উষ্ণ ধুলো ও জৈব (PAH) অণু, যেখানে তারার জন্ম হচ্ছে।",
    star: "SPHEREx-এর 102টি চ্যানেলে একটি তারার রং নির্ভর করে তার তাপমাত্রার ওপর: শীতল লাল তারারা নিকট-ইনফ্রারেডে সবচেয়ে উজ্জ্বল, আর উত্তপ্ত নীল তারারা দীর্ঘতর তরঙ্গদৈর্ঘ্যের দিকে ক্রমশ ম্লান হয়ে যায়।",
    nebula:
      "নীহারিকার ভেতরটা যে ধুলো আড়াল করে রাখে, ইনফ্রারেড আলো তার অনেকটাই ভেদ করে যায়; আর শীতল ধুলোর বরফ প্রায় 3.0, 4.3 ও 4.7 µm-এ আলো শোষণ করে, যার সবই SPHEREx-এর পরিসরের মধ্যে।",
    cluster:
      "নিকট-ইনফ্রারেডে নক্ষত্রপুঞ্জের আলোয় প্রাধান্য পায় এর শীতল দানব তারারা; SPHEREx-এর 6 আর্কসেকেন্ডের পিক্সেলে সবচেয়ে ঘন অংশগুলো মিশে একাকার হয়ে যায়।",
    "solar-system":
      "গ্রহাণুরা সূর্যের আলো প্রতিফলিত করে, আর ইনফ্রারেডের আরও গভীরে নিজেদের উষ্ণতায় আভা ছড়ায়; SPHEREx-এর দুটি পর্যবেক্ষণের মাঝে এরা স্থির তারাদের পটভূমিতে সরে যায়।",
    other:
      "SPHEREx এই জায়গাটি দেখে 0.75 থেকে 5 µm পর্যন্ত 102টি রঙে, আর প্রতিটি জরিপ-পর্বে বহু এক্সপোজার মিলিয়ে একটি বর্ণালি তৈরি করে।",
  },
});

/** A galaxy's shape in plain words, from its catalogued (de Vaucouleurs) morphology; see morphologyWords. */
export const SHAPES = defineMessages({
  en: {
    dwarfElliptical: "Dwarf elliptical galaxy",
    elliptical: "Elliptical galaxy",
    barredIrregular: "Barred irregular galaxy",
    irregular: "Irregular galaxy",
    lenticular: "Lenticular galaxy",
    spiral: "Spiral galaxy",
    barredSpiral: "Barred spiral galaxy",
    weakBarSpiral: "Weakly barred spiral galaxy",
    magellanic: "Magellanic spiral galaxy",
    barredMagellanic: "Barred Magellanic spiral galaxy",
    weakBarMagellanic: "Weakly barred Magellanic spiral galaxy",
  },
  bn: {
    dwarfElliptical: "বামন উপবৃত্তাকার গ্যালাক্সি",
    elliptical: "উপবৃত্তাকার গ্যালাক্সি",
    barredIrregular: "বার-যুক্ত অনিয়মিত গ্যালাক্সি",
    irregular: "অনিয়মিত গ্যালাক্সি",
    lenticular: "লেন্স-আকৃতির গ্যালাক্সি",
    spiral: "সর্পিল গ্যালাক্সি",
    barredSpiral: "বার-যুক্ত সর্পিল গ্যালাক্সি",
    weakBarSpiral: "ক্ষীণ বার-যুক্ত সর্পিল গ্যালাক্সি",
    magellanic: "ম্যাজেলানিক ধাঁচের সর্পিল গ্যালাক্সি",
    barredMagellanic: "বার-যুক্ত ম্যাজেলানিক ধাঁচের সর্পিল গ্যালাক্সি",
    weakBarMagellanic: "ক্ষীণ বার-যুক্ত ম্যাজেলানিক ধাঁচের সর্পিল গ্যালাক্সি",
  },
});
