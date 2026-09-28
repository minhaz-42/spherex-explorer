import { defineMessages } from "../lib/i18n";

/** The tour's scenes and controls. Each scene has a kicker, a title and its narration ("say"). */
export const TOUR = defineMessages({
  en: {
    introKicker: "NASA Space Apps Challenge 2026 · Planet X and SPHEREx",
    introTitle: "SPHEREx Explorer",
    introSay:
      "NASA's SPHEREx telescope maps the whole sky every six months in 102 colours of infrared light. This app lets anyone see how the sky changes in those images.",
    surveyKicker: "The survey",
    surveyTitle: "A fresh map of the sky, twice a year",
    surveySay:
      "From a pole-to-pole orbit, SPHEREx sweeps great circles through the ecliptic poles. Every point is revisited about every six months; the poles, its deep fields, far more often.",
    whereKicker: "Where?",
    whereTitle: "Pick any object",
    whereSay:
      "Search a name or coordinates. The explorer finds every SPHEREx image of that spot, and shows what the catalogues know: type, distance, and the same patch in other light.",
    irisKicker: "What changed?",
    irisTitle: "An asteroid, caught in the act",
    irisSay:
      "Two real SPHEREx frames, 9.7 hours apart, on one brightness scale. The stars stay put; the asteroid (7) Iris moves. JPL's orbit, seen from where SPHEREx was, lands within 1 arcsecond of the track the app found.",
    decadesKicker: "Across the decades",
    decadesTitle: "75 years of one fast star",
    decadesSay:
      "Barnard's Star moves 10.4 arcseconds a year. Palomar plates from 1950, 2MASS, WISE and SPHEREx on one grid show it creeping about 13 arcminutes.",
    coloursKicker: "The colours",
    coloursTitle: "102 colours of infrared",
    coloursSay:
      "Six detectors from 0.75 to 5 micrometres. Water ice absorbs at 3 µm, carbon dioxide at 4.3 µm: the ices SPHEREx was built to measure.",
    planetXKicker: "Planet X",
    planetXTitle: "What it can't find, and why",
    planetXSay:
      "A planet far beyond Neptune would move less than one SPHEREx pixel a day and be near the limit of a single exposure. The app explains that honestly rather than claim a discovery.",
    yoursKicker: "Your turn",
    yoursTitle: "Where will you look first?",
    yoursSay:
      "Everything shown is real SPHEREx data from NASA/IPAC's archive, measured by this app with its methods and limits stated.",
    loadingIris: "Loading the Iris frames…",
    andromeda: "Andromeda Galaxy",
    barnard: "Barnard's Star",
    candidates: "Candidates, never discoveries.",
    checked:
      "Every moving source the app finds is checked against JPL. Unmatched ones are called candidates, and most are artefacts.",
    readPlanetX: "Read the Planet X explanation",
    exploreSky: "Explore the sky",
    seeCases: "See the cases",
    judge: "Judge mode · {n} of {total}",
    previous: "Previous",
    pause: "Pause",
    play: "Play",
    next: "Next",
    leave: "Leave the tour",
    exit: "Exit",
  },
  bn: {
    introKicker: "NASA Space Apps Challenge 2026 · Planet X and SPHEREx",
    introTitle: "SPHEREx Explorer",
    introSay:
      "NASA-র SPHEREx টেলিস্কোপ প্রতি ছয় মাসে ইনফ্রারেড আলোর 102টি রঙে পুরো আকাশের মানচিত্র তৈরি করে। এই অ্যাপের সাহায্যে যে কেউ দেখতে পারেন, সেই ছবিগুলোতে আকাশ কীভাবে বদলায়।",
    surveyKicker: "জরিপ",
    surveyTitle: "বছরে দুবার আকাশের নতুন মানচিত্র",
    surveySay:
      "পৃথিবীর দুই মেরুর ওপর দিয়ে ঘোরা কক্ষপথ থেকে SPHEREx আকাশজুড়ে একের পর এক মহাবৃত্ত ধরে ছবি তোলে, আর প্রতিটি মহাবৃত্ত যায় ক্রান্তিবৃত্তের দুই মেরুর ওপর দিয়ে। প্রতিটি বিন্দু মোটামুটি ছয় মাস পরপর আবার দেখা হয়; আর মেরু দুটি, যেখানে এর গভীর জরিপের ক্ষেত্র, দেখা হয় আরও অনেক বেশিবার।",
    whereKicker: "কোথায়?",
    whereTitle: "যেকোনো বস্তু বেছে নিন",
    whereSay:
      "কোনো নাম বা স্থানাঙ্ক দিয়ে খুঁজুন। অ্যাপটি ওই জায়গার প্রতিটি SPHEREx ছবি খুঁজে বের করে, আর ক্যাটালগে যা জানা আছে তা দেখায়: বস্তুর ধরন, দূরত্ব, আর অন্য আলোয় আকাশের একই অংশ।",
    irisKicker: "কী বদলেছে?",
    irisTitle: "একটি গ্রহাণু, হাতেনাতে ধরা",
    irisSay:
      "9.7 ঘণ্টার ব্যবধানে তোলা দুটি আসল SPHEREx ফ্রেম, একই উজ্জ্বলতার মাপে। তারাগুলো নিজের জায়গায় থাকে; গ্রহাণু (7)\u00a0Iris সরে যায়। SPHEREx যেখানে ছিল সেখান থেকে দেখলে JPL-এর কক্ষপথ অ্যাপের খুঁজে পাওয়া গতিপথের 1 আর্কসেকেন্ডের মধ্যে পড়ে।",
    decadesKicker: "দশকের পর দশক",
    decadesTitle: "এক দ্রুতগামী তারার 75 বছর",
    decadesSay:
      "বার্নার্ডের তারা প্রতি বছর 10.4 আর্কসেকেন্ড সরে। 1950 সালের Palomar প্লেট, 2MASS, WISE আর SPHEREx-এর ছবি একই গ্রিডে রাখলে দেখা যায়, এটি ধীরে ধীরে প্রায় 13 আর্কমিনিট সরে গেছে।",
    coloursKicker: "রংগুলো",
    coloursTitle: "ইনফ্রারেডের 102টি রং",
    coloursSay:
      "0.75 থেকে 5 মাইক্রোমিটার পর্যন্ত ছয়টি ডিটেক্টর। পানির বরফ 3 µm-এ আলো শোষণ করে, কার্বন ডাই-অক্সাইড 4.3 µm-এ: ঠিক এই বরফগুলো মাপার জন্যই SPHEREx তৈরি।",
    planetXKicker: "প্ল্যানেট এক্স",
    planetXTitle: "যা এটি খুঁজে পায় না, আর কেন",
    planetXSay:
      "নেপচুনের অনেক ওপারের কোনো গ্রহ দিনে SPHEREx-এর এক পিক্সেলেরও কম সরবে, আর একটি এক্সপোজারে ধরা পড়ার সীমার কাছাকাছি থাকবে। আবিষ্কারের দাবি না করে অ্যাপটি এ কথা সৎভাবে ব্যাখ্যা করে।",
    yoursKicker: "এবার আপনার পালা",
    yoursTitle: "প্রথমে কোথায় দেখবেন?",
    yoursSay:
      "এখানে দেখানো সবকিছুই NASA/IPAC-এর আর্কাইভের আসল SPHEREx ডেটা; এই অ্যাপ সেগুলো মেপেছে, আর মাপার পদ্ধতি ও সীমাবদ্ধতাও জানিয়ে দিয়েছে।",
    loadingIris: "Iris-এর ফ্রেমগুলো লোড হচ্ছে…",
    andromeda: "অ্যান্ড্রোমিডা গ্যালাক্সি",
    barnard: "বার্নার্ডের তারা",
    candidates: "সম্ভাব্য বস্তু, কখনো আবিষ্কার নয়।",
    checked:
      "অ্যাপ যত চলমান উৎস খুঁজে পায়, তার প্রতিটি JPL-এর তথ্যের সঙ্গে মিলিয়ে দেখা হয়। যেগুলো মেলে না, সেগুলোকে বলা হয় সম্ভাব্য বস্তু, আর সেগুলোর বেশির ভাগই আসলে ছবির ত্রুটি।",
    readPlanetX: "প্ল্যানেট এক্সের ব্যাখ্যা পড়ুন",
    exploreSky: "আকাশ অন্বেষণ করুন",
    seeCases: "পরিবর্তনের উদাহরণ দেখুন",
    judge: "বিচারক মোড · {n}/{total}",
    previous: "আগেরটি",
    pause: "থামান",
    play: "চালান",
    next: "পরেরটি",
    leave: "ট্যুর ছেড়ে বেরিয়ে যান",
    exit: "বের হন",
  },
});
