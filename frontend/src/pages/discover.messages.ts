import { bnTable } from "../components/space/messages";
import { formatRange, plural } from "../lib/format";
import { defineMessages, type Lang } from "../lib/i18n";
import type { DiscoverCase } from "../lib/types";

/**
 * The Discover page's own text. The cases themselves (titles, summaries, evidence, cautions and
 * constellation names) come from the API in English and are shown as they are in both languages;
 * a Bangla page says so above the list. Steps with a bold lead-in are split into `stepN` and
 * `stepNText`, and a sentence around code into `…Before` and `…After`.
 */
export const DISCOVER = defineMessages({
  en: {
    kicker: "Discover",
    title: "Changes SPHEREx has seen",
    intro:
      "Each case comes from real SPHEREx images, measured by this app and checked against an authoritative catalogue. The evidence lists what was measured and what the catalogue says; the note under it says what the evidence cannot tell you. Open a case to step through every frame yourself.",
    built: "Cases built from the archive on {date}.",
    // Shown only in Bangla, above the cases, whose texts come from the API in English.
    inEnglish: "Case details are in English.",
    loading: "Loading cases…",
    error: "The cases could not be loaded. Explore still works: try a search.",
    emptyBefore: "No cases have been built yet. Run ",
    emptyAfter: " to build them.",

    movingHeading: "Things that move",
    movingBlurb:
      "Stars keep their places from one visit to the next. Anything that shifts against them is in our Solar System.",
    brightnessHeading: "Brightness at one wavelength",
    brightnessBlurb: "Compared at the same wavelength months apart, a change in brightness is a change in the source.",
    spectrumHeading: "One place in many colours",
    spectrumBlurb: "Every SPHEREx exposure sees a slightly different wavelength. Together they make a spectrum.",
    contextHeading: "Where to look",
    contextBlurb: "Some parts of the sky are watched much more often than others.",

    kindMoving: "Moving source · known asteroid",
    kindBrightness: "Brightness change at a matched wavelength",
    kindSpectrum: "Spectrum from many exposures",
    kindContext: "Context",
    twoOf: "Two of the {n} frames, flipped with one shared brightness scale.",
    evidence: "The evidence",
    exploreCase: "Explore this case",
    openSnapshot: "Open the demo snapshot",

    huntTitle: "Hunt for yourself",
    step1: "1. Pick a spot near the ecliptic,",
    step1Text: "the plane where the planets and most asteroids travel. Ecliptic latitude is shown for every search.",
    step2: "2. Choose one survey pass",
    step2Text: "and blink frames from different pointings, hours apart. Stars stay put; asteroids jump.",
    step3: "3. Run the moving-source search,",
    step3Text:
      "then ask JPL which known objects were there. A match is a known asteroid; no match is an unconfirmed candidate, most often an artefact.",
    practise: "Practise on Spot the mover",
    orStart: "Or start from any object name or coordinates",

    planetXTitle: "What about Planet X?",
    planetX1:
      "A large planet far beyond Neptune, often called Planet Nine, has been proposed to explain how some distant objects orbit. It has not been found. If it exists at around 500 au, it would move only a few arcseconds a day against the stars, less than one SPHEREx pixel, so within a single pass it would look like a star.",
    planetX2:
      "Six months later, when Earth is on the other side of the Sun, it would appear displaced by about a quarter of a degree. So the signature to look for is a faint source present in one pass and missing from the next, not a track within a pass. Published estimates put its brightness near or beyond what a single SPHEREx exposure can detect, and nothing in this app claims to have found it.",
  },
  // Non-breaking spaces (\u00a0) keep a number with its unit on one line.
  bn: bnTable({
    kicker: "পরিবর্তন",
    title: "SPHEREx যেসব পরিবর্তন দেখেছে",
    intro:
      "প্রতিটি ঘটনা এসেছে আসল SPHEREx ছবি থেকে; এই অ্যাপ সেগুলো মেপেছে, আর একটি প্রামাণ্য ক্যাটালগের সঙ্গে মিলিয়ে দেখেছে। ‘প্রমাণ’ অংশে আছে কী মাপা হয়েছে আর ক্যাটালগ কী বলে; তার নিচের নোটে বলা আছে, এই প্রমাণ থেকে কী জানা যায় না। প্রতিটি ফ্রেম নিজে একে একে দেখতে যেকোনো ঘটনা খুলুন।",
    // The date comes first, so a line does not break inside it.
    built: "{date} তারিখে আর্কাইভ থেকে ঘটনাগুলো তৈরি করা হয়েছে।",
    inEnglish: "ঘটনাগুলোর বিবরণ ইংরেজিতে দেওয়া আছে।",
    loading: "ঘটনাগুলো লোড হচ্ছে…",
    error: "ঘটনাগুলো লোড করা যায়নি। ‘অন্বেষণ’ তবু কাজ করছে: কিছু একটা খুঁজে দেখুন।",
    emptyBefore: "এখনো কোনো ঘটনা তৈরি করা হয়নি। সেগুলো তৈরি করতে ",
    emptyAfter: " চালান।",

    movingHeading: "যা কিছু সরে যায়",
    movingBlurb:
      "এক পর্যবেক্ষণ থেকে পরের পর্যবেক্ষণে তারারা নিজের জায়গাতেই থাকে। তাদের তুলনায় যা কিছু সরে যায়, তা আমাদের সৌরজগতেরই কোনো বস্তু।",
    brightnessHeading: "একই তরঙ্গদৈর্ঘ্যে উজ্জ্বলতা",
    brightnessBlurb:
      "কয়েক মাসের ব্যবধানে একই তরঙ্গদৈর্ঘ্যে তুলনা করলে, উজ্জ্বলতার পরিবর্তন মানে উৎসটিরই পরিবর্তন।",
    spectrumHeading: "এক জায়গা, অনেক রঙে",
    spectrumBlurb: "SPHEREx-এর প্রতিটি এক্সপোজার একটু আলাদা তরঙ্গদৈর্ঘ্য দেখে। সব মিলিয়ে তৈরি হয় একটি বর্ণালি।",
    contextHeading: "কোথায় দেখবেন",
    contextBlurb: "আকাশের কিছু অংশ অন্য অংশের চেয়ে অনেক বেশিবার দেখা হয়।",

    kindMoving: "চলমান উৎস · পরিচিত গ্রহাণু",
    kindBrightness: "মেলানো তরঙ্গদৈর্ঘ্যে উজ্জ্বলতার পরিবর্তন",
    kindSpectrum: "অনেক এক্সপোজার থেকে বর্ণালি",
    kindContext: "প্রেক্ষাপট",
    twoOf: "{n}টি ফ্রেমের দুটি, একই উজ্জ্বলতার মাপকাঠিতে পালা করে দেখানো।",
    evidence: "প্রমাণ",
    exploreCase: "এই ঘটনাটি অন্বেষণ করুন",
    openSnapshot: "ডেমো স্ন্যাপশট খুলুন",

    huntTitle: "নিজেই খুঁজে দেখুন",
    step1: "1. ক্রান্তিবৃত্তের কাছাকাছি একটি জায়গা বেছে নিন।",
    step1Text:
      "ক্রান্তিবৃত্ত হলো সেই সমতল, যেখানে গ্রহগুলো আর বেশির ভাগ গ্রহাণু চলাচল করে। প্রতিটি খোঁজে ক্রান্তীয় অক্ষাংশ দেখানো\u00a0হয়।",
    step2: "2. একটি জরিপ-পর্ব বেছে নিন,",
    step2Text:
      "তারপর কয়েক ঘণ্টার ব্যবধানে তোলা ভিন্ন ভিন্ন পর্যবেক্ষণের ফ্রেম ব্লিংক করে দেখুন। তারারা নিজের জায়গায় থাকে; গ্রহাণুরা লাফিয়ে সরে যায়।",
    step3: "3. চলমান উৎসের খোঁজ চালান,",
    step3Text:
      "তারপর JPL-কে জিজ্ঞেস করুন সেখানে কোন কোন পরিচিত বস্তু ছিল। মিলে গেলে সেটি একটি পরিচিত গ্রহাণু; না মিললে সেটি একটি অনিশ্চিত সম্ভাব্য বস্তু, যা বেশির ভাগ সময় আসলে ছবির\u00a0ত্রুটি।",
    practise: "‘চলমান বস্তুটি খুঁজুন’ খেলে অনুশীলন করুন",
    orStart: "অথবা যেকোনো বস্তুর নাম বা স্থানাঙ্ক দিয়ে শুরু করুন",

    planetXTitle: "প্ল্যানেট এক্সের কী খবর?",
    planetX1:
      "কিছু দূরবর্তী বস্তু যেভাবে কক্ষপথে ঘোরে, তা ব্যাখ্যা করতে নেপচুনের অনেক ওপারে একটি বড় গ্রহ থাকার প্রস্তাব করা হয়েছে, যাকে প্রায়ই নবম গ্রহ (Planet Nine) বলা হয়। এটি এখনো খুঁজে পাওয়া যায়নি। এটি যদি প্রায় 500\u00a0au দূরে থেকে থাকে, তবে তারাদের পটভূমিতে দিনে মাত্র কয়েক আর্কসেকেন্ড সরবে, যা SPHEREx-এর এক পিক্সেলেরও কম; তাই একটি জরিপ-পর্বের ভেতরে এটিকে একটি তারার মতোই দেখাবে।",
    planetX2:
      "ছয় মাস পরে, পৃথিবী যখন সূর্যের অন্য পাশে থাকবে, তখন এটিকে প্রায় সিকি ডিগ্রি সরে যাওয়া অবস্থায় দেখা যাবে। তাই খুঁজতে হবে এমন একটি অনুজ্জ্বল উৎস, যা এক জরিপ-পর্বে আছে কিন্তু পরের পর্বে নেই; একটি পর্বের ভেতরের কোনো গতিপথ নয়। প্রকাশিত হিসাব অনুযায়ী এর উজ্জ্বলতা SPHEREx-এর একটি এক্সপোজারে শনাক্তযোগ্য সীমার কাছাকাছি, কিংবা তার চেয়েও কম; আর এই অ্যাপের কোনো কিছুই এটি খুঁজে পাওয়ার দাবি করে না।",
  }),
});

/**
 * A case's dates, frames, detector, wavelengths and constellation on one line, in either language:
 * "1 – 3 Dec 2025 · 19 frames in 7 pointings · detector 2, 1.10–1.66 µm · in Sextans". Dates and
 * the constellation name stay as the API and the date formatter give them.
 */
export function caseFacts(lang: Lang, c: DiscoverCase): string {
  const o = c.observed;
  const range = formatRange(o.start, o.end);
  const lo = o.wavelengthUm[0].toFixed(2);
  const hi = o.wavelengthUm[1].toFixed(2);
  if (lang === "bn") {
    const n = (v: number) => v.toLocaleString("en-US");
    // A word joiner (U+2060) after the dash keeps the wavelength range on one line.
    return `${range} · ${n(o.pointings)}টি পর্যবেক্ষণে ${n(o.frames)}টি ফ্রেম · ডিটেক্টর\u00a0${o.detector}, ${lo}–\u2060${hi}\u00a0µm · ${c.target.constellation} নক্ষত্রমণ্ডলে`;
  }
  return `${range} · ${plural(o.frames, "frame")} in ${plural(o.pointings, "pointing")} · detector ${o.detector}, ${lo}–${hi} µm · in ${c.target.constellation}`;
}
