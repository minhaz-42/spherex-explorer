import { defineMessages } from "../../lib/i18n";

/** "Across the decades": the five-survey blink and its section on the Explore page. */
export const DECADES = defineMessages({
  en: {
    kicker: "Across the decades",
    heading: "{name} from the 1950s to SPHEREx",
    summary: "Five surveys, 75 years: Palomar plates, 2MASS, AllWISE and SPHEREx on one grid.",
    summaryFast:
      "Five surveys, 75 years: Palomar plates, 2MASS, AllWISE and SPHEREx on one grid. This star moves fast enough to see.",
    redPlate: "Photographic red plate · about 0.65 µm",
    nearInfrared: "Near-infrared · 1.2–2.2 µm",
    midInfrared: "Mid-infrared · 3.4–22 µm (many visits combined)",
    spherexBand: "{wavelength} · detector {detector}",
    failed: "The {survey} image could not be loaded right now.",
    loading: "Loading the {survey} image…",
    across: "{n}′ across",
    earlier: "Earlier survey",
    later: "Later survey",
    pause: "Pause",
    blink: "Blink through the decades",
    order: "Surveys in time order",
    same: "The same {fov}′ of sky, photographed by five surveys.",
    sameOver: "The same {fov}′ of sky, photographed by five surveys over {years} years.",
    moves:
      "{name} moves {rate}″ a year across the sky, so between the first and last images it has shifted about {shift}′. The ring marks where its catalogued motion puts it at each date.",
    still: "Stars stay put over these decades; what changes is the light each survey records.",
    dating:
      "2MASS and AllWISE combine exposures from their survey years, so they are dated by those years. Each survey sees a different wavelength, so brightnesses differ between the tiles.",
    where: "Where was SPHEREx on {date}?",
    exportTitle: "{name} across {years} years",
  },
  bn: {
    kicker: "দশকের পর দশক",
    heading: "1950-এর দশক থেকে SPHEREx পর্যন্ত {name}",
    summary: "পাঁচটি জরিপ, 75 বছর: Palomar-এর প্লেট, 2MASS, AllWISE ও SPHEREx, সব একই গ্রিডে।",
    summaryFast:
      "পাঁচটি জরিপ, 75 বছর: Palomar-এর প্লেট, 2MASS, AllWISE ও SPHEREx, সব একই গ্রিডে। এই তারাটি এত দ্রুত সরে যে ছবিগুলোতেই তা দেখা যায়।",
    redPlate: "লাল আলোর ফটোগ্রাফিক প্লেট · প্রায় 0.65 µm",
    nearInfrared: "নিকট-ইনফ্রারেড · 1.2–2.2 µm",
    midInfrared: "মধ্য-ইনফ্রারেড · 3.4–22 µm (বহুবারের পর্যবেক্ষণ একত্রে)",
    spherexBand: "{wavelength} · ডিটেক্টর {detector}",
    failed: "{survey}-এর ছবিটি এখন লোড করা যাচ্ছে না।",
    loading: "{survey}-এর ছবি লোড হচ্ছে…",
    across: "{n}′ চওড়া",
    earlier: "আগের জরিপ",
    later: "পরের জরিপ",
    pause: "থামান",
    blink: "দশকগুলো ব্লিংক করে দেখুন",
    order: "সময়ের ক্রমে জরিপগুলো",
    same: "পাঁচটি জরিপে তোলা আকাশের একই {fov}′ অংশ।",
    sameOver: "{years} বছর ধরে পাঁচটি জরিপে তোলা আকাশের একই {fov}′ অংশ।",
    moves:
      "{name} প্রতি বছর আকাশে {rate}″ সরে যায়, তাই প্রথম আর শেষ ছবির মধ্যে এটি প্রায় {shift}′ সরে গেছে। ক্যাটালগে লেখা নিজস্ব গতি অনুযায়ী প্রতিটি তারিখে এটি কোথায় থাকার কথা, বৃত্তটি তা দেখায়।",
    still: "এই কয়েক দশকে তারাগুলো নিজের জায়গাতেই থাকে; বদলায় কেবল প্রতিটি জরিপে ধরা পড়া আলো।",
    dating:
      "2MASS ও AllWISE তাদের জরিপের বছরগুলোর এক্সপোজার একত্র করে, তাই এদের তারিখ হিসেবে সেই বছরগুলো দেওয়া হয়েছে। প্রতিটি জরিপ আলাদা তরঙ্গদৈর্ঘ্যে দেখে, তাই ছবিভেদে উজ্জ্বলতা আলাদা।",
    where: "{date} তারিখে SPHEREx কোথায় ছিল?",
    exportTitle: "{years} বছর জুড়ে {name}",
  },
});
