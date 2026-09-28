import { bnTable } from "../components/space/messages";
import { defineMessages } from "../lib/i18n";

/**
 * The landing page. Headlines with an accented phrase are split into `…Before`, `…Shine` and
 * `…After`, and paragraphs with a bold phrase into `…`, `…Strong` and `…End`, so each language can
 * put the phrase where its word order needs it. Spaces around the split belong to the pieces.
 */
export const LANDING = defineMessages({
  en: {
    exAndromeda: "Andromeda Galaxy",
    exPole: "North Ecliptic Pole",
    exIris: "Asteroid (7) Iris",

    whereTitle: "Where?",
    whereText:
      "Type a name like M31 or paste coordinates. The explorer turns it into a point on the sky and shows which constellation it sits in.",
    whenTitle: "When?",
    whenText:
      "Every SPHEREx image that covers that point, on one timeline. They bunch into survey passes about six months apart.",
    changeTitle: "What changed?",
    changeText:
      "Blink between visits, compare them side by side, or subtract one from another. Moving asteroids and brightness changes stand out.",

    statChannels: "spectral channels",
    statChannelsNote: "17 on each of six detectors",
    statMaps: "maps of the whole sky",
    statMapsNote: "over the two-year survey",
    statMinutes: "min",
    statOrbit: "per orbit of Earth",
    statOrbitNote: "pole to pole, sun-synchronous",
    statMillion: "million",
    statImages: "images public so far",
    statImagesNote: "QR2 + QR3 at IRSA, September 2026",

    searchLabel: "Object name or coordinates",
    searchPlaceholder: "Try M31, Orion Nebula or 10.68 41.27",
    searchButton: "Explore",

    heroKicker: "Real infrared images · the public SPHEREx archive",
    heroBefore: "Pick a point in the sky. ",
    heroShine: "Watch it change.",
    heroLead:
      "SPHEREx Explorer finds every public image NASA's SPHEREx telescope has taken of a place in the sky, lines them up in time and lets you slide through ",
    heroLeadStrong: "102 colours of infrared light",
    heroLeadEnd: ".",
    try: "Try",
    tour: "Take the 90-second tour",
    play: "Play Spot the mover",

    howKicker: "How it works",
    howBefore: "Three questions, ",
    howShine: "in order",
    howAfter: ".",
    howText: "Everything in the explorer hangs off the same three questions you would ask about any patch of sky.",

    surveyKicker: "The survey",
    surveyBefore: "A fresh map of the whole sky, ",
    surveyShine: "twice a year",
    surveyAfter: ".",
    surveyP1:
      "SPHEREx circles Earth pole to pole every 98 minutes. Each pointing lies on a great circle through the ecliptic poles, and as Earth travels around the Sun that circle turns about a degree a day. Six months later it has swept the whole sky.",
    surveyP2:
      "Over the two-year survey it maps the sky four times. The poles, where every circle crosses, are visited again and again: that is where SPHEREx keeps its two ",
    surveyP2Strong: "deep fields",
    surveyP2End: ".",
    factOrbit: "98 min",
    factOrbitLabel: "one orbit of Earth",
    factSweep: "6 months",
    factSweepLabel: "to sweep the whole sky",
    factFields: "2",
    factFieldsLabel: "deep fields, at the poles",

    coloursKicker: "The colours",
    coloursBefore: "Six detectors. ",
    coloursShine: "102 colours",
    coloursAfter: " of infrared.",
    coloursText:
      "Your eyes stop at red. SPHEREx starts just past it, at 0.75 µm, and splits the light out to 5 µm into 102 narrow channels. Each band shows something different.",

    numbersKicker: "By the numbers",

    atlasKicker: "The atlas",
    atlasBefore: "Galaxies, nebulae and clusters, ",
    atlasShine: "ready to explore",
    atlasAfter: ".",
    atlasText:
      "Each one opens with what the catalogues know about it, the same patch in other light, and every SPHEREx image of it.",
    atlasButton: "See the whole atlas",

    irisFrames: "Two real SPHEREx frames, flipped with one shared brightness scale.",
    irisIllustration: "Illustration of the two visits. The real frames are on the Discover page.",
    caseKicker: "Discover",
    caseTitle: "An asteroid, caught in the act.",
    caseP1:
      "On 2 December 2025 SPHEREx looked twice at the same patch of sky near the star 36 Sextantis, 9 hours and 42 minutes apart. In between, the asteroid ",
    caseP1Strong: "(7) Iris",
    caseP1End: " moved against the background stars.",
    caseP2: "Blink the two frames and compare its position with the one JPL's orbit predicts.",
    openCase: "Open the case",
    everyFrame: "See every frame",
    planetX: "Heard about a hidden “Planet X”?",
    planetXLink: "Here is what SPHEREx can and cannot tell us",
    planetXEnd: ".",

    lookBefore: "Where will you ",
    lookShine: "look first?",
  },
  // Non-breaking spaces (\u00a0) keep a number with its unit, and a name, on one line.
  bn: bnTable({
    exAndromeda: "অ্যান্ড্রোমিডা গ্যালাক্সি",
    exPole: "ক্রান্তিবৃত্তের উত্তর মেরু",
    exIris: "গ্রহাণু (7)\u00a0Iris",

    whereTitle: "কোথায়?",
    whereText:
      "M31-এর মতো কোনো নাম লিখুন, বা স্থানাঙ্ক পেস্ট করুন। অ্যাপটি সেটিকে আকাশের একটি বিন্দুতে বসিয়ে দেখায়, আর জানায় বিন্দুটি কোন নক্ষত্রমণ্ডলে পড়েছে।",
    whenTitle: "কখন?",
    whenText:
      "ওই বিন্দুর যত SPHEREx ছবি আছে, সব একটি সময়রেখায়। ছবিগুলো দল বেঁধে আসে জরিপ-পর্বে, আর পর্বগুলো প্রায় ছয় মাস পরপর।",
    changeTitle: "কী বদলেছে?",
    changeText:
      "দুই পর্যবেক্ষণের ছবি পালা করে দেখুন (ব্লিংক), পাশাপাশি রেখে মেলান, কিংবা একটি থেকে অন্যটি বিয়োগ করুন। চলমান গ্রহাণু আর উজ্জ্বলতার পরিবর্তন তখন আলাদা করে চোখে পড়ে।",

    statChannels: "বর্ণালি চ্যানেল",
    statChannelsNote: "ছয়টি ডিটেক্টরের প্রতিটিতে 17টি",
    statMaps: "পুরো আকাশের মানচিত্র",
    statMapsNote: "দুই বছরের জরিপে",
    statMinutes: "মিনিট",
    statOrbit: "পৃথিবীকে একবার প্রদক্ষিণে",
    statOrbitNote: "মেরু থেকে মেরু, সূর্য-সমলয় কক্ষপথে",
    // Counted in lakh, as Bangla counts: 1.45 million is 14.5 lakh (see the stats in Landing.tsx).
    statMillion: "লাখ",
    statImages: "এ পর্যন্ত উন্মুক্ত ছবি",
    statImagesNote: "IRSA-তে QR2 + QR3, সেপ্টেম্বর\u00a02026",

    searchLabel: "বস্তুর নাম বা স্থানাঙ্ক",
    searchPlaceholder: "যেমন M31, Orion Nebula বা 10.68 41.27",
    searchButton: "খুঁজুন",

    heroKicker: "আসল ইনফ্রারেড ছবি · SPHEREx-এর উন্মুক্ত আর্কাইভ",
    heroBefore: "আকাশের একটি বিন্দু বেছে\u00a0নিন। ",
    heroShine: "বদলটা\u00a0দেখুন।",
    heroLead:
      "NASA-র SPHEREx টেলিস্কোপ আকাশের কোনো জায়গার যত ছবি তুলেছে, তার প্রতিটি উন্মুক্ত ছবি SPHEREx Explorer খুঁজে আনে, সময়ের ক্রমে সাজায়, আর আপনি স্লাইড করে দেখতে পারেন ",
    heroLeadStrong: "ইনফ্রারেড আলোর 102টি রং",
    heroLeadEnd: "।",
    try: "যেমন",
    tour: "90 সেকেন্ডের ট্যুর দেখুন",
    play: "খেলুন: চলমান বস্তুটি খুঁজুন",

    howKicker: "যেভাবে কাজ করে",
    howBefore: "তিনটি প্রশ্ন, ",
    howShine: "ধাপে ধাপে",
    howAfter: "।",
    howText:
      "আকাশের যেকোনো অংশ নিয়ে আপনি যে তিনটি প্রশ্ন করতেন, SPHEREx Explorer-এর সবকিছু সেই তিনটি প্রশ্ন ঘিরেই সাজানো।",

    surveyKicker: "জরিপ",
    surveyBefore: "পুরো আকাশের নতুন মানচিত্র, ",
    surveyShine: "বছরে দুবার",
    surveyAfter: "।",
    surveyP1:
      "SPHEREx প্রতি 98\u00a0মিনিটে এক মেরু থেকে অন্য মেরু হয়ে পৃথিবীকে একবার প্রদক্ষিণ করে। টেলিস্কোপ যেদিকেই তাক করে, সেটি থাকে ক্রান্তিবৃত্তের দুই মেরু ছুঁয়ে যাওয়া একটি মহাবৃত্তের ওপর। পৃথিবী সূর্যের চারদিকে এগোতে থাকায় সেই বৃত্ত দিনে প্রায় এক ডিগ্রি করে ঘুরে যায়। ছয় মাসে বৃত্তটি পুরো আকাশ ঘুরে আসে।",
    surveyP2:
      "দুই বছরের জরিপে SPHEREx পুরো আকাশের মানচিত্র তৈরি করে চারবার। প্রতিটি বৃত্ত দুই মেরুর ওপর দিয়ে যায়, তাই মেরু দুটি দেখা হয় বারবার: SPHEREx-এর দুটি ",
    surveyP2Strong: "গভীর ক্ষেত্র",
    surveyP2End: " ঠিক সেখানেই।",
    factOrbit: "98 মিনিট",
    factOrbitLabel: "পৃথিবীকে একবার প্রদক্ষিণ",
    factSweep: "6 মাস",
    factSweepLabel: "পুরো আকাশ একবার ঘুরে দেখতে",
    factFields: "2",
    factFieldsLabel: "গভীর ক্ষেত্র, দুই মেরুতে",

    coloursKicker: "রংগুলো",
    coloursBefore: "ছয়টি ডিটেক্টর। ইনফ্রারেডের ",
    coloursShine: "102টি রং",
    coloursAfter: "।",
    coloursText:
      "আপনার চোখ লাল রং পর্যন্তই দেখতে পায়। SPHEREx শুরু করে ঠিক তার পর থেকে, 0.75\u00a0µm-এ, আর 5\u00a0µm পর্যন্ত আলোকে 102টি সরু চ্যানেলে ভাগ করে। প্রতিটি ব্যান্ডে ধরা পড়ে ভিন্ন কিছু।",

    numbersKicker: "সংখ্যায় SPHEREx",

    atlasKicker: "অ্যাটলাস",
    atlasBefore: "গ্যালাক্সি, নীহারিকা আর নক্ষত্রপুঞ্জ, ",
    atlasShine: "অন্বেষণের অপেক্ষায়",
    atlasAfter: "।",
    atlasText:
      "প্রতিটি খুললেই দেখবেন ক্যাটালগে এর সম্পর্কে কী জানা আছে, অন্য আলোয় আকাশের একই অংশ, আর এর প্রতিটি SPHEREx ছবি।",
    atlasButton: "পুরো অ্যাটলাস দেখুন",

    irisFrames: "SPHEREx-এর দুটি আসল ফ্রেম, একই উজ্জ্বলতার মাপকাঠিতে পালা করে দেখানো।",
    irisIllustration: "দুই পর্যবেক্ষণের একটি আঁকা ছবি। আসল ফ্রেমগুলো আছে ‘পরিবর্তন’ পাতায়।",
    caseKicker: "পরিবর্তন",
    caseTitle: "একটি গ্রহাণু, হাতেনাতে ধরা।",
    caseP1:
      "2\u00a0ডিসেম্বর\u00a02025 তারিখে SPHEREx আকাশের একই অংশ দুবার দেখেছিল, 36\u00a0Sextantis তারার কাছে, 9\u00a0ঘণ্টা 42\u00a0মিনিটের ব্যবধানে। এর মাঝে পেছনের তারাদের তুলনায় গ্রহাণু ",
    caseP1Strong: "(7)\u00a0Iris",
    caseP1End: " সরে গিয়েছিল।",
    caseP2:
      "দুটি ফ্রেম পালা করে দেখুন (ব্লিংক), আর JPL-এর কক্ষপথের হিসাবে গ্রহাণুটির যেখানে থাকার কথা, তার সঙ্গে এর অবস্থান মিলিয়ে নিন।",
    openCase: "ঘটনাটি দেখুন",
    everyFrame: "প্রতিটি ফ্রেম দেখুন",
    planetX: "লুকিয়ে থাকা “প্ল্যানেট এক্স”-এর কথা শুনেছেন?",
    planetXLink: "SPHEREx এ বিষয়ে কী বলতে পারে আর কী পারে\u00a0না, দেখুন",
    planetXEnd: "।",

    lookBefore: "প্রথমে ",
    lookShine: "কোথায় দেখবেন?",
  }),
});
