import { bnTable } from "../components/space/messages";
import { defineMessages } from "../lib/i18n";

/**
 * The About page. Paragraphs with a bold lead-in are split into `…Lead` and the text after it, and
 * paragraphs with a bold phrase inside into `…`, `…Strong` and `…End`; spaces around a split belong
 * to the pieces. The Methods keep every number exactly as the English gives it.
 *
 * The credits are not here: the data and service providers ask for their acknowledgements in their
 * own English wording, so About.tsx prints them in English in both languages.
 */
export const ABOUT = defineMessages({
  en: {
    toc: "On this page",
    mission: "SPHEREx",
    how: "How it works",
    methods: "Methods",
    limitations: "Limitations",
    credits: "Data and credits",
    privacy: "Privacy",

    kicker: "About",
    title: "A time machine for the infrared sky",
    intro:
      "SPHEREx Explorer finds every image NASA’s SPHEREx mission has taken of a place in the sky, lines them up, and lets anyone step through them to see what changed. It was built for the 2026 NASA Space Apps Challenge, “Planet X and SPHEREx”. It is independent: not affiliated with or endorsed by NASA, JPL, Caltech or IPAC.",

    orbit:
      "SPHEREx is a NASA space telescope launched on 12 March 2025. From a polar orbit about 650 km up it maps the entire sky every six months in ",
    orbitStrong: "102 colours of infrared light",
    orbitEnd:
      ", from 0.75 to 5 micrometres, with 6.15-arcsecond pixels. Its science goals are the first moments of the Universe, the history of galaxies, and the ices from which planets form.",
    filter: "SPHEREx has no filter wheel. Each of its six detectors sits behind a ",
    filterStrong: "linear variable filter",
    filterEnd:
      ": the wavelength changes across the detector. As the telescope steps across the sky, each star passes through many wavelengths, and one to two weeks of exposures add up to a spectrum. That design is why, in this app, every frame is labelled with the wavelength that fell on your target.",

    howIntro: "Every view answers three questions in order.",
    whereLead: "Where?",
    where:
      "A name is looked up with CDS Sesame (SIMBAD, NED, VizieR); coordinates are read directly. The position is shown in equatorial, galactic and ecliptic coordinates.",
    whenLead: "When?",
    when: "The IRSA image search (SIA) lists every SPHEREx Level 2 image that contains the point, from Quick Releases 2 and 3. They are grouped into survey passes, months apart. Within a pass, SPHEREx points at the spot several times, hours apart, and takes up to four exposures a couple of minutes apart each time.",
    changedLead: "What changed?",
    changed:
      "Each frame is cut out, aligned and measured on the server, then shown side by side, blinked or differenced in your browser with one shared brightness scale.",

    readingLead: "Reading the data.",
    reading:
      "A SPHEREx image file is about 70 MB. The server reads only the rows it needs from the public cloud copy (Amazon S3), using HTTP byte ranges, and decodes the compressed flag planes of QR3 row by row. This was checked against IRSA’s own cutout service: the pixels are identical. If the cloud copy fails, IRSA’s cutout service is used instead.",
    alignmentLead: "Alignment.",
    alignment:
      "Each frame is resampled onto one grid centred on the target, north up and east left, at SPHEREx’s native pixel size, using the frame’s own astrometric solution (TAN-SIP). Flagged pixels (cosmic rays, hot and dead pixels, ghosts, persistence; the set IRSA’s mosaic tool excludes) are masked and do not leak into their neighbours. For display only, masked pixels are filled from their surroundings; the mask marks them.",
    backgroundLead: "Background.",
    background:
      "The zodiacal light and airglow are not removed in SPHEREx images and change from frame to frame, so each frame’s local background (a sigma-clipped median) is subtracted.",
    wavelengthLead: "Wavelength at the target.",
    wavelength:
      "Read from each frame’s spectral lookup table (WCS-WAVE) at the target’s pixel. Before pixels load, it is estimated from the image footprint to within about 0.002 µm.",
    brightnessLead: "Brightness.",
    brightness:
      "A 12-arcsecond aperture on the native pixels, a local background from a surrounding annulus, and an uncertainty from the pipeline’s variance plane. No aperture correction or PSF fitting: these numbers are for comparing frames, not for precise absolute fluxes.",
    comparisonsLead: "Comparisons.",
    comparisons:
      "A difference image is shown only for two frames from the same detector that saw the target within half a spectral channel of each other. Otherwise the app explains why a difference would mislead, and offers blinking to compare positions.",
    knownLead: "Known Solar System objects.",
    known:
      "JPL’s Small-Body Identification service is asked which catalogued asteroids and comets were in the field, for SPHEREx’s own position from the image header. JPL Horizons then gives each one’s position at every frame time, corrected to SPHEREx’s viewpoint. Checked against Horizons’ own SPHEREx-centred answer for asteroid (7) Iris, the correction agrees to 0.003 arcseconds.",
    movingLead: "Moving-source search.",
    moving:
      "A simple, transparent search: detect sources in every frame, drop those seen again at the same place in another pointing, keep what repeats within one pointing, and link those sightings on straight tracks at a constant rate. Results are called candidates and compared with JPL’s predictions. On the Iris field it finds Iris within 1.4 arcseconds of JPL’s positions.",
    askLead: "The Ask assistant.",
    ask: "Questions are answered from evidence the server gathers itself: its own measurements of the frames on screen, the comparison rules, JPL’s predictions, the moving-source search, SIMBAD’s facts about the object at the target or any object you name, SPHEREx coverage, the Discover cases and short method notes. Whatever a question needs and the server does not have yet is fetched live first, and the chat says what it is fetching. Your browser only says which target and frames are on screen, never any values. A language model running on the same machine as the server (by default Qwen3 4B, through Ollama) phrases that evidence and cites it by number; it never sees the images. Every number and date in an answer is then looked for in its sources, and anything not found is flagged under the answer. Links in answers are made by the server, not by the model. Without a model, the assistant answers from the same evidence directly and says so.",
    notes: "The full notes, with every service request and check, are in the project’s documentation (",
    notesAnd: " and ",
    notesEnd: ").",

    limitWavelength:
      "Two frames of the same place usually saw it at different wavelengths. A brightness difference between them may be the source’s colour rather than a change in time. Use a matched-wavelength sequence to compare brightness.",
    limitSaturation:
      "Very bright stars and fast bright asteroids can saturate: their brightness is then a lower limit, and the app says so.",
    limitResiduals:
      "Differences near bright stars show residuals, because the telescope’s point-spread function changes across the detector.",
    limitReleases:
      "QR2 and QR3 were processed with different calibrations; the SPHEREx team advises caution when combining them.",
    limitSearch:
      "The moving-source search is not a survey pipeline. It can miss faint or slow objects, and it can be fooled by artefacts; an unmatched candidate is not a discovery.",
    limitLive:
      "Data come from IRSA and JPL at the moment you ask; when they are unavailable the app says so and shows no data rather than substitute data. A clearly labelled demo snapshot of real data can be chosen instead.",
    limitAssistant:
      "The assistant’s answers are phrased by a small language model and can be wrong: it sometimes links two true facts in a way the evidence does not support. Its numbers, dates and citations are checked, its reasoning is not. The numbered sources under each answer are what the app actually measured.",

    // Shown only in Bangla, above the credits, which stay in English.
    creditsNote:
      "The acknowledgements below are kept word for word in English, as the data and service providers word them.",

    privacyData:
      "There are no accounts, no cookies and no analytics. Your searches are sent to the SPHEREx Explorer server, which forwards them to the public services above. The server keeps the address of each visitor in memory for a few minutes to limit how fast the archive is queried, and stores nothing about you.",
    privacyAssistant:
      "Questions to the assistant go to the same server, where the language model runs; they are not sent to an AI company or any other service, except an object name you ask about, which is looked up with CDS Sesame like a search. Your chats are kept only in this browser, so you can come back to them; the server keeps nothing, and the chat list deletes them one by one or all at once.",
    start: "Start exploring",
  },
  // Non-breaking spaces (\u00a0) keep a number with its unit, and a name, on one line.
  bn: bnTable({
    toc: "এই পাতায়",
    mission: "SPHEREx",
    how: "যেভাবে কাজ করে",
    methods: "পদ্ধতি",
    limitations: "সীমাবদ্ধতা",
    credits: "ডেটা ও কৃতজ্ঞতা",
    privacy: "গোপনীয়তা",

    kicker: "পরিচিতি",
    title: "ইনফ্রারেড আকাশের এক টাইম মেশিন",
    intro:
      "আকাশের কোনো একটি জায়গার যত ছবি NASA-র SPHEREx মিশন তুলেছে, SPHEREx Explorer তার প্রতিটি খুঁজে বের করে, সারি বেঁধে সাজায়, আর যে কাউকে একটির পর একটি ছবি দেখে বুঝতে দেয় কী বদলেছে। এটি তৈরি হয়েছে 2026\u00a0সালের NASA Space Apps Challenge-এর “Planet X and SPHEREx” চ্যালেঞ্জের জন্য। এটি একটি স্বাধীন প্রকল্প: NASA, JPL, Caltech বা IPAC-এর সঙ্গে যুক্ত নয়, তাদের অনুমোদিতও নয়।",

    orbit:
      "SPHEREx হলো NASA-র একটি মহাকাশ টেলিস্কোপ, যার উৎক্ষেপণ হয় 12\u00a0মার্চ\u00a02025 তারিখে। প্রায় 650\u00a0km উঁচুতে একটি মেরু-কক্ষপথ থেকে এটি প্রতি ছয় মাসে পুরো আকাশের মানচিত্র তৈরি করে ",
    orbitStrong: "ইনফ্রারেড আলোর 102টি রঙে",
    orbitEnd:
      ", 0.75 থেকে 5\u00a0মাইক্রোমিটার পর্যন্ত, 6.15\u00a0আর্কসেকেন্ডের পিক্সেলে। এর বৈজ্ঞানিক লক্ষ্য হলো মহাবিশ্বের একেবারে প্রথম মুহূর্তগুলো, গ্যালাক্সিদের ইতিহাস, আর যে বরফ থেকে গ্রহ গড়ে ওঠে, তা বোঝা।",
    filter:
      "SPHEREx-এ ফিল্টার বদলানোর কোনো চাকা (filter wheel) নেই। এর ছয়টি ডিটেক্টরের প্রতিটি বসানো আছে একটি ",
    filterStrong: "রৈখিক পরিবর্তনশীল ফিল্টারের",
    filterEnd:
      " পেছনে: ডিটেক্টরের এক পাশ থেকে অন্য পাশে তরঙ্গদৈর্ঘ্য বদলে যায়। টেলিস্কোপটি ধাপে ধাপে আকাশজুড়ে সরতে থাকলে প্রতিটি তারা একে একে অনেকগুলো তরঙ্গদৈর্ঘ্যের মধ্য দিয়ে যায়, আর এক থেকে দুই সপ্তাহের এক্সপোজার মিলে তৈরি হয় একটি বর্ণালি। এই নকশার কারণেই এই অ্যাপে প্রতিটি ফ্রেমের সঙ্গে লেখা থাকে, আপনার লক্ষ্যবস্তুর ওপর কোন তরঙ্গদৈর্ঘ্যের আলো পড়েছিল।",

    howIntro: "প্রতিটি দৃশ্য ক্রমানুসারে তিনটি প্রশ্নের উত্তর দেয়।",
    whereLead: "কোথায়?",
    where:
      "কোনো নাম দিলে তা CDS Sesame (SIMBAD, NED, VizieR) দিয়ে খোঁজা হয়; স্থানাঙ্ক দিলে তা সরাসরি পড়ে নেওয়া হয়। অবস্থানটি দেখানো হয় বিষুবীয়, গ্যালাক্টিক ও ক্রান্তীয় স্থানাঙ্কে।",
    whenLead: "কখন?",
    when: "IRSA-র ছবি খোঁজার সেবা (SIA) বিন্দুটি আছে এমন প্রতিটি SPHEREx Level\u00a02 ছবির তালিকা দেয়, Quick Release\u00a02 ও\u00a03 থেকে। ছবিগুলোকে ভাগ করা হয় জরিপ-পর্বে, যেগুলোর মধ্যে ব্যবধান কয়েক মাস। একটি পর্বের ভেতরে SPHEREx কয়েক ঘণ্টা পরপর কয়েকবার জায়গাটির দিকে তাক করে, আর প্রতিবার দু-এক মিনিটের ব্যবধানে সর্বোচ্চ চারটি এক্সপোজার নেয়।",
    changedLead: "কী বদলেছে?",
    changed:
      "সার্ভারে প্রতিটি ফ্রেম কেটে নেওয়া, মিলিয়ে বসানো আর মাপা হয়; তারপর আপনার ব্রাউজারে সবগুলো একই উজ্জ্বলতার মাপকাঠিতে দেখানো হয়: পাশাপাশি রেখে, পালা করে (ব্লিংক), কিংবা একটি থেকে অন্যটি বিয়োগ করে।",

    readingLead: "ডেটা পড়া।",
    reading:
      "একটি SPHEREx ছবির ফাইল প্রায় 70\u00a0MB। সার্ভার উন্মুক্ত ক্লাউড কপি (Amazon\u00a0S3) থেকে HTTP বাইট-রেঞ্জ অনুরোধ দিয়ে শুধু দরকারি সারিগুলো পড়ে, আর QR3-এর সংকুচিত ফ্ল্যাগ-প্লেনগুলো এক সারি এক সারি করে ডিকোড করে। IRSA-র নিজস্ব কাটআউট সেবার সঙ্গে মিলিয়ে এটি যাচাই করা হয়েছে: পিক্সেলগুলো হুবহু এক। ক্লাউড কপি কাজ না করলে তার বদলে IRSA-র কাটআউট সেবা ব্যবহার করা হয়।",
    alignmentLead: "মিলিয়ে বসানো।",
    alignment:
      "প্রতিটি ফ্রেমকে ফ্রেমটির নিজস্ব অ্যাস্ট্রোমেট্রিক সমাধান (TAN-SIP) দিয়ে নতুন করে নমুনায়ন (resample) করে একটি গ্রিডে বসানো হয়: কেন্দ্রে লক্ষ্যবস্তু, উত্তর ওপরে, পূর্ব বাঁয়ে, আর পিক্সেলের মাপ SPHEREx-এর নিজস্ব পিক্সেলের সমান। চিহ্নিত (flagged) পিক্সেলগুলো মাস্ক করা হয়, আর সেগুলোর প্রভাব পাশের পিক্সেলে ছড়ায় না; এর মধ্যে আছে মহাজাগতিক রশ্মির দাগ, হট ও ডেড পিক্সেল, ঘোস্ট (ভেতরের প্রতিফলনে তৈরি নকল ছবি) আর পারসিস্টেন্স (আগের এক্সপোজারের রেশ), অর্থাৎ IRSA-র মোজাইক টুল ঠিক যেগুলো বাদ দেয়। শুধু দেখানোর জন্য মাস্ক করা পিক্সেলগুলো আশপাশের পিক্সেল থেকে ভরাট করা হয়; মাস্কে সেগুলো চিহ্নিত থাকে।",
    backgroundLead: "পটভূমি।",
    background:
      "SPHEREx-এর ছবিতে রাশিচক্রীয় আলো (zodiacal light) আর বায়ুদীপ্তি (airglow) বাদ দেওয়া থাকে না, আর এগুলো ফ্রেম থেকে ফ্রেমে বদলায়; তাই প্রতিটি ফ্রেমের স্থানীয় পটভূমি (সিগমা-ক্লিপড মধ্যমা, অর্থাৎ অস্বাভাবিক মানগুলো বাদ দিয়ে নেওয়া মধ্যমা) বিয়োগ করা হয়।",
    wavelengthLead: "লক্ষ্যবস্তুতে তরঙ্গদৈর্ঘ্য।",
    wavelength:
      "প্রতিটি ফ্রেমের বর্ণালি লুকআপ টেবিল (WCS-WAVE) থেকে লক্ষ্যবস্তুর পিক্সেলে পড়ে নেওয়া হয়। পিক্সেল লোড হওয়ার আগে এটি ছবির ফুটপ্রিন্ট (আকাশে ছবিটি যে এলাকা ঢাকে) থেকে প্রায় 0.002\u00a0µm-এর মধ্যে নির্ভুলভাবে অনুমান করা হয়।",
    brightnessLead: "উজ্জ্বলতা।",
    brightness:
      "মূল পিক্সেলের ওপর 12\u00a0আর্কসেকেন্ডের একটি অ্যাপারচার, চারপাশের একটি বলয় (annulus) থেকে স্থানীয় পটভূমি, আর পাইপলাইনের ভেদাঙ্ক-প্লেন (variance plane) থেকে অনিশ্চয়তা। কোনো অ্যাপারচার সংশোধন বা PSF ফিটিং করা হয় না: এই সংখ্যাগুলো ফ্রেমগুলোর মধ্যে তুলনার জন্য, নিখুঁত পরম ফ্লাক্স মাপার জন্য নয়।",
    comparisonsLead: "তুলনা।",
    comparisons:
      "পার্থক্য-ছবি দেখানো হয় কেবল একই ডিটেক্টরের এমন দুটি ফ্রেমের জন্য, যেগুলো লক্ষ্যবস্তুকে দেখেছে পরস্পরের আধা বর্ণালি-চ্যানেলের মধ্যে থাকা তরঙ্গদৈর্ঘ্যে। তা না হলে অ্যাপটি ব্যাখ্যা করে কেন পার্থক্য-ছবি বিভ্রান্তিকর হতো, আর অবস্থান তুলনার জন্য ব্লিংক করে দেখার সুযোগ দেয়।",
    knownLead: "সৌরজগতের পরিচিত বস্তু।",
    known:
      "JPL-এর Small-Body Identification সেবাকে জিজ্ঞেস করা হয়, ছবির হেডারে লেখা SPHEREx-এর নিজের অবস্থান থেকে দেখলে ক্যাটালগভুক্ত কোন কোন গ্রহাণু ও ধূমকেতু দৃষ্টিক্ষেত্রে ছিল। এরপর JPL Horizons প্রতিটি ফ্রেমের সময়ে প্রতিটির অবস্থান দেয়, SPHEREx-এর দৃষ্টিকোণ অনুযায়ী সংশোধন করে। গ্রহাণু (7)\u00a0Iris-এর বেলায় Horizons-এর নিজস্ব SPHEREx-কেন্দ্রিক উত্তরের সঙ্গে মিলিয়ে দেখা গেছে, সংশোধনটি 0.003\u00a0আর্কসেকেন্ডের মধ্যে মেলে।",
    movingLead: "চলমান উৎসের খোঁজ।",
    moving:
      "একটি সহজ, স্বচ্ছ খোঁজ: প্রতিটি ফ্রেমে উৎস শনাক্ত করা হয়; অন্য কোনো পর্যবেক্ষণে একই জায়গায় আবার দেখা গেলে সেগুলো বাদ দেওয়া হয়; একটি পর্যবেক্ষণের ভেতরে যা বারবার দেখা যায়, তা রাখা হয়; তারপর সেই দেখাগুলোকে স্থির গতিতে চলা সরলরেখার পথে জোড়া হয়। ফলাফলগুলোকে বলা হয় সম্ভাব্য বস্তু, আর সেগুলো JPL-এর পূর্বাভাসের সঙ্গে মিলিয়ে দেখা হয়। Iris যে এলাকায় ছিল, সেখানকার ফ্রেমে এই খোঁজ Iris-কে খুঁজে পায় JPL-এর দেওয়া অবস্থানের 1.4\u00a0আর্কসেকেন্ডের মধ্যে।",
    askLead: "‘জিজ্ঞাসা’ সহকারী।",
    ask: "প্রশ্নের উত্তর দেওয়া হয় সার্ভারের নিজের জোগাড় করা প্রমাণ থেকে: পর্দায় থাকা ফ্রেমগুলোর ওপর সার্ভারের নিজস্ব পরিমাপ, তুলনার নিয়ম, JPL-এর পূর্বাভাস, চলমান উৎসের খোঁজ, লক্ষ্যবস্তুতে থাকা বস্তু বা আপনার নাম বলা যেকোনো বস্তু সম্পর্কে SIMBAD-এর তথ্য, SPHEREx-এর কভারেজ (কোথায় কতবার ছবি তোলা হয়েছে), ‘পরিবর্তন’ পাতার ঘটনাগুলো, আর পদ্ধতি নিয়ে ছোট ছোট নোট। কোনো প্রশ্নের জন্য যা দরকার অথচ সার্ভারের কাছে এখনো নেই, তা আগে লাইভ সংগ্রহ করা হয়, আর চ্যাটে জানানো হয় কী সংগ্রহ করা হচ্ছে। আপনার ব্রাউজার শুধু জানায় পর্দায় কোন লক্ষ্যবস্তু আর কোন ফ্রেমগুলো আছে, কখনো কোনো মান পাঠায় না। সার্ভারের সঙ্গে একই কম্পিউটারে চলা একটি ভাষা মডেল (ডিফল্টভাবে Qwen3\u00a04B, Ollama-র মাধ্যমে) সেই প্রমাণ গুছিয়ে লেখে আর নম্বর দিয়ে উৎস উল্লেখ করে; মডেলটি কখনো ছবিগুলো দেখে না। এরপর উত্তরের প্রতিটি সংখ্যা ও তারিখ তার উৎসগুলোতে খুঁজে দেখা হয়, আর যা পাওয়া যায় না, তা উত্তরের নিচে চিহ্নিত করে দেখানো হয়। উত্তরের লিংকগুলো তৈরি করে সার্ভার, মডেল নয়। মডেল না থাকলে সহকারী একই প্রমাণ থেকে সরাসরি উত্তর দেয় এবং সে কথা জানিয়ে দেয়।",
    // The paths come first, so the sentence does not have to break inside one.
    notes: "প্রকল্পের ডকুমেন্টেশনে (",
    notesAnd: " ও ",
    notesEnd: ") আছে প্রতিটি সেবা-অনুরোধ ও যাচাইসহ পূর্ণ নোট।",

    limitWavelength:
      "একই জায়গার দুটি ফ্রেম সাধারণত জায়গাটিকে ভিন্ন ভিন্ন তরঙ্গদৈর্ঘ্যে দেখেছে। তাই দুটির উজ্জ্বলতার পার্থক্য সময়ের সঙ্গে ঘটা কোনো পরিবর্তন না হয়ে উৎসটির রঙের কারণেও হতে পারে। উজ্জ্বলতা তুলনা করতে একই তরঙ্গদৈর্ঘ্যে মেলানো ফ্রেমের ক্রম ব্যবহার করুন।",
    limitSaturation:
      "খুব উজ্জ্বল তারা আর দ্রুতগামী উজ্জ্বল গ্রহাণু ডিটেক্টরের মাপার সীমা ছাড়িয়ে যেতে পারে (স্যাচুরেশন): তখন তাদের উজ্জ্বলতা আসলে একটি নিম্নসীমা, অর্থাৎ আসল উজ্জ্বলতা এর চেয়ে বেশি; অ্যাপটি সে কথা জানিয়ে দেয়।",
    limitResiduals:
      "উজ্জ্বল তারার কাছে পার্থক্য-ছবিতে কিছু অবশিষ্ট দাগ (residual) থেকে যায়, কারণ টেলিস্কোপের পয়েন্ট-স্প্রেড ফাংশন (একটি বিন্দু-উৎসের আলো ছবিতে যেভাবে ছড়ায়) ডিটেক্টরের এক জায়গা থেকে আরেক জায়গায় বদলে যায়।",
    limitReleases:
      "QR2 আর QR3 প্রক্রিয়াজাত করা হয়েছে ভিন্ন ভিন্ন ক্যালিব্রেশনে; দুটিকে একসঙ্গে ব্যবহার করার সময় SPHEREx দল সাবধান থাকতে বলে।",
    limitSearch:
      "চলমান উৎসের খোঁজ কোনো জরিপ-পাইপলাইন নয়। অনুজ্জ্বল বা ধীরগতির বস্তু এর চোখ এড়িয়ে যেতে পারে, আর ছবির ত্রুটিতে এটি বিভ্রান্তও হতে পারে; পরিচিত কোনো বস্তুর সঙ্গে না মেলা একটি সম্ভাব্য বস্তু কোনো আবিষ্কার নয়।",
    limitLive:
      "ডেটা আসে IRSA আর JPL থেকে, ঠিক যে মুহূর্তে আপনি চান; সেগুলো পাওয়া না গেলে অ্যাপটি সে কথা জানায়, আর বদলি ডেটা না বসিয়ে কোনো ডেটাই দেখায় না। চাইলে তার বদলে আসল ডেটার একটি স্পষ্টভাবে চিহ্নিত ডেমো স্ন্যাপশট বেছে নিতে পারেন।",
    limitAssistant:
      "সহকারীর উত্তর গুছিয়ে লেখে একটি ছোট ভাষা মডেল, তাই উত্তর ভুলও হতে পারে: মডেলটি কখনো কখনো দুটি সত্য তথ্যকে এমনভাবে জুড়ে দেয়, যা প্রমাণ সমর্থন করে না। এর সংখ্যা, তারিখ ও উৎস-উল্লেখ যাচাই করা হয়, কিন্তু এর যুক্তি যাচাই করা হয় না। প্রতিটি উত্তরের নিচে নম্বর দেওয়া উৎসগুলোই হলো অ্যাপ আসলে যা মেপেছে।",

    creditsNote:
      "নিচের কৃতজ্ঞতাগুলো ডেটা ও সেবা প্রদানকারী প্রতিষ্ঠানগুলো যেভাবে লেখে, সেভাবেই হুবহু ইংরেজিতে রাখা হয়েছে।",

    privacyData:
      "এখানে কোনো অ্যাকাউন্ট নেই, কুকি নেই, অ্যানালিটিক্সও নেই। আপনার খোঁজগুলো যায় SPHEREx Explorer-এর সার্ভারে, আর সার্ভার সেগুলো ওপরে উল্লেখ করা উন্মুক্ত সেবাগুলোর কাছে পাঠিয়ে দেয়। আর্কাইভে কত দ্রুত অনুরোধ যাবে তা সীমিত রাখতে সার্ভার প্রতিটি দর্শনার্থীর ইন্টারনেট ঠিকানা কয়েক মিনিটের জন্য মেমোরিতে রাখে, আর আপনার সম্পর্কে কিছুই সংরক্ষণ করে না।",
    privacyAssistant:
      "সহকারীকে করা প্রশ্নগুলো যায় সেই একই সার্ভারে, যেখানে ভাষা মডেলটি চলে; সেগুলো কোনো AI কোম্পানি বা অন্য কোনো সেবায় পাঠানো হয় না, ব্যতিক্রম শুধু আপনার জিজ্ঞেস করা কোনো বস্তুর নাম, যা সাধারণ খোঁজের মতোই CDS Sesame দিয়ে খোঁজা হয়। আপনার চ্যাটগুলো রাখা থাকে শুধু এই ব্রাউজারে, যাতে পরে আবার সেগুলোতে ফিরে আসতে পারেন; সার্ভার কিছুই রাখে না, আর চ্যাটের তালিকা থেকে সেগুলো একটি একটি করে বা একসঙ্গে সব মুছে ফেলা যায়।",
    start: "অন্বেষণ শুরু করুন",
  }),
});
