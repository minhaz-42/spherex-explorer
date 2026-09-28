import { defineMessages, type Lang } from "../../lib/i18n";
import type { Band } from "./bands";
import { BODIES, type SelectableId } from "./bodies";

/**
 * Bangla joins case endings to Latin words and units with a hyphen ("JPL-এর", "µm-এ"), and a
 * browser may break the line after that hyphen, starting the next line with "এর". A word joiner
 * (U+2060, invisible) after each hyphen that runs into Bangla keeps the two together.
 */
export function joinHyphens(text: string): string {
  return text.replace(/-(?=[\u0980-\u09FF])/g, "-\u2060");
}

/** A Bangla message table with `joinHyphens` applied to every message. */
export function bnTable<K extends string>(table: Record<K, string>): Record<K, string> {
  return Object.fromEntries(Object.entries<string>(table).map(([k, v]) => [k, joinHyphens(v)])) as Record<K, string>;
}

/** The three small figures of the landing page and the (7) Iris illustration. */
export const FIGURES = defineMessages({
  en: {
    andromeda: "Andromeda",
    ra: "RA 00h 42m 44s",
    dec: "Dec +41° 16′ 08″",
    pass: "Pass {n}",
    sixMonths: "about six months",
    time: "Time →",
    visit: "Visit {n}",
    moved: "moved",
    iris: "Illustration: the asteroid (7) Iris in two positions against fixed stars, 9 hours 42 minutes apart.",
  },
  bn: bnTable({
    andromeda: "অ্যান্ড্রোমিডা",
    ra: "বিষুবাংশ 00h 42m 44s",
    dec: "বিষুবলম্ব +41° 16′ 08″",
    pass: "পর্ব {n}",
    sixMonths: "প্রায় ছয় মাস",
    time: "সময় →",
    visit: "পর্যবেক্ষণ {n}",
    moved: "সরেছে",
    iris: "আঁকা ছবি: স্থির তারাদের পটভূমিতে গ্রহাণু (7) Iris-এর দুটি অবস্থান, 9 ঘণ্টা 42 মিনিটের ব্যবধানে।",
  }),
});

/** The orrery's controls, captions and readouts. */
export const ORRERY = defineMessages({
  en: {
    day: "Day",
    week: "Week",
    month: "Month",
    year: "Year",
    inner: "Inner planets",
    whole: "Whole system",
    sunCentre: "At the centre, holding everything else in orbit.",
    distance: "{r} au from the Sun on this date.",
    canvas:
      "An animated view of the Sun, the eight planets, the asteroid belt and the asteroid (7) Iris on their orbits, at their approximate positions for the date shown. Drag to turn the view.",
    on: "The solar system on",
    note: "Positions from JPL orbital elements. Distances compressed, sizes not to scale. Drag to turn.",
    tip: "{name} · click for details",
    pause: "Pause the planets",
    play: "Play the planets",
    speeds: "Time that passes each second",
    perSecond: "per second",
    today: "Today",
    zoom: "Zoom",
    pick: "Pick a body to read about",
    oneOrbit: "One orbit: {year}. ",
  },
  bn: bnTable({
    day: "দিন",
    week: "সপ্তাহ",
    month: "মাস",
    year: "বছর",
    inner: "ভেতরের গ্রহ",
    whole: "পুরো সৌরজগৎ",
    sunCentre: "কেন্দ্রে থেকে বাকি সবকিছুকে কক্ষপথে ধরে রাখে।",
    distance: "এই তারিখে সূর্য থেকে {r}\u00a0au দূরে।",
    canvas:
      "সূর্য, আটটি গ্রহ, গ্রহাণু বলয় আর গ্রহাণু (7) Iris-এর একটি চলমান দৃশ্য, যেখানে প্রত্যেকে নিজ নিজ কক্ষপথে, দেখানো তারিখের আনুমানিক অবস্থানে আছে। দৃশ্যটি ঘোরাতে টেনে সরান।",
    on: "সৌরজগৎ, এই তারিখে",
    note: "অবস্থান JPL-এর কক্ষপথ-উপাদান থেকে হিসাব করা। দূরত্ব ছোট করে দেখানো, আকার মাপমতো নয়। ঘোরাতে টেনে সরান।",
    tip: "{name} · বিস্তারিত দেখতে ক্লিক করুন",
    pause: "গ্রহগুলো থামান",
    play: "গ্রহগুলো চালান",
    speeds: "প্রতি সেকেন্ডে কতটা সময় পেরোবে",
    perSecond: "প্রতি সেকেন্ডে",
    today: "আজ",
    zoom: "জুম",
    pick: "কোন বস্তুর কথা পড়বেন, বেছে নিন",
    oneOrbit: "সূর্যকে একবার প্রদক্ষিণ করতে লাগে {year}। ",
  }),
});

/** The survey globe: canvas labels, readouts and controls. */
export const GLOBE = defineMessages({
  en: {
    north: "North deep field",
    south: "South deep field",
    allMaps: "All four maps",
    map: "Map {n} of {total}",
    hover: "Hover the globe to read coordinates",
    readout: "Ecliptic {lon}°, {lat}° · scanned {n} of {total} times",
    canvas:
      "A globe of the sky filling in stripe by stripe as a scan circle sweeps around it, building up four complete maps. The two poles, marked, are the deep fields.",
    pause: "Pause the survey",
    play: "Play the survey",
  },
  bn: bnTable({
    north: "উত্তরের গভীর ক্ষেত্র",
    south: "দক্ষিণের গভীর ক্ষেত্র",
    allMaps: "চারটি মানচিত্রই সম্পূর্ণ",
    map: "মানচিত্র {n} / {total}",
    hover: "স্থানাঙ্ক দেখতে গোলকের ওপর পয়েন্টার রাখুন",
    readout: "ক্রান্তিবৃত্তীয় স্থানাঙ্ক {lon}°, {lat}° · {total} বারের মধ্যে {n} বার স্ক্যান হয়েছে",
    canvas:
      "আকাশের একটি গোলক: একটি স্ক্যান-বৃত্ত এর চারদিকে ঘুরে যায়, আর গোলকটি ফালি ফালি করে ভরে উঠে চারটি পূর্ণ মানচিত্র তৈরি করে। চিহ্নিত দুই মেরুই গভীর ক্ষেত্র।",
    pause: "জরিপ থামান",
    play: "জরিপ চালান",
  }),
});

/** The spectrum of the six bands. */
export const SPECTRUM = defineMessages({
  en: {
    label:
      "The six SPHEREx bands laid along the infrared spectrum from 0.75 to 5 micrometres, next to the visible light the eye can see.",
    visible: "Visible",
    inBand: "{wl} µm · band {n} · channel {c} of 17",
    between: "{wl} µm · between bands",
    hint: "Hover the spectrum to read a wavelength · click a band to read about it",
    choose: "Choose a band",
    band: "Band {n}",
    details: "{min}–{max} µm · R ≈ {R} · 17 channels",
  },
  bn: bnTable({
    label:
      "ইনফ্রারেড বর্ণালি বরাবর 0.75 থেকে 5 মাইক্রোমিটার পর্যন্ত সাজানো SPHEREx-এর ছয়টি ব্যান্ড, পাশে চোখে দেখা যায় এমন দৃশ্যমান আলো।",
    visible: "দৃশ্যমান",
    inBand: "{wl} µm · ব্যান্ড {n} · 17টির মধ্যে {c} নম্বর চ্যানেল",
    between: "{wl} µm · দুই ব্যান্ডের মাঝখানে",
    hint: "তরঙ্গদৈর্ঘ্য দেখতে বর্ণালির ওপর পয়েন্টার রাখুন · কোনো ব্যান্ড সম্পর্কে পড়তে তাতে ক্লিক করুন",
    choose: "একটি ব্যান্ড বেছে নিন",
    band: "ব্যান্ড {n}",
    details: "{min}–{max} µm · R ≈ {R} · 17টি চ্যানেল",
  }),
});

export interface BodyText {
  name: string;
  fact: string;
  /** Orbital period, as a person would say it. */
  year?: string;
}

/**
 * Bangla for the bodies of the orrery; the English lives with the drawing data in bodies.ts.
 * Non-breaking spaces (\u00a0) keep a number with its unit on one line.
 */
const BODIES_BN: Record<SelectableId, BodyText> = {
  sun: {
    name: "সূর্য",
    fact: "আমাদের নিজেদের তারা। SPHEREx তার টেলিস্কোপ সূর্যের দিক থেকে মুখ ফিরিয়ে রাখে, শঙ্কু-আকৃতির ঢালের আড়ালে; সেই ঢালই ডিটেক্টরগুলোকে ঠান্ডা রাখে।",
  },
  mercury: { name: "বুধ", fact: "সবচেয়ে ছোট গ্রহ, আর সূর্যের সবচেয়ে কাছের।", year: "88\u00a0দিন" },
  venus: { name: "শুক্র", fact: "সবচেয়ে উত্তপ্ত গ্রহ, সালফিউরিক অ্যাসিডের ঘন মেঘে মোড়া।", year: "225\u00a0দিন" },
  earth: {
    name: "পৃথিবী",
    fact: "আমাদের বাড়ি, আর SPHEREx-এরও ঘাঁটি; SPHEREx প্রতি 98\u00a0মিনিটে এক মেরু থেকে অন্য মেরু হয়ে একে প্রদক্ষিণ করে।",
    year: "365\u00a0দিন",
  },
  mars: {
    name: "মঙ্গল",
    fact: "ঠান্ডা এক মরুভূমির জগৎ; এখানেই সৌরজগতের সবচেয়ে উঁচু আগ্নেয়গিরি, অলিম্পাস মন্স।",
    year: "687\u00a0দিন",
  },
  iris: {
    name: "(7) Iris",
    fact: "প্রধান গ্রহাণু বলয়ের একটি গ্রহাণু, প্রায় 200\u00a0km চওড়া। 2\u00a0ডিসেম্বর\u00a02025 তারিখে SPHEREx-এর ছবিতে একে সরে যেতে দেখা গেছে।",
    year: "3.7\u00a0বছর",
  },
  jupiter: {
    name: "বৃহস্পতি",
    fact: "সবচেয়ে বড় গ্রহ; এর ভর বাকি সব গ্রহের মোট ভরের দ্বিগুণেরও বেশি।",
    year: "11.9\u00a0বছর",
  },
  saturn: {
    name: "শনি",
    fact: "এর বলয়গুলো মূলত পানির বরফ; মহাকাশে এই একই অণুকে SPHEREx শনাক্ত করে 3\u00a0µm-এ।",
    year: "29.5\u00a0বছর",
  },
  uranus: { name: "ইউরেনাস", fact: "কাত হয়ে থাকা এক বরফ-দানব, সূর্যের চারদিকে গড়িয়ে গড়িয়ে চলে।", year: "84\u00a0বছর" },
  neptune: {
    name: "নেপচুন",
    fact: "সবচেয়ে তীব্র বাতাসের গ্রহ; এখানে দমকা হাওয়ার গতি 2,000\u00a0km/h ছাড়িয়ে যায়।",
    year: "165\u00a0বছর",
  },
};

/** A body's name, one-line fact and orbital period in the page's language. */
export function bodyText(id: SelectableId, lang: Lang): BodyText {
  if (lang === "bn") return { ...BODIES_BN[id], fact: joinHyphens(BODIES_BN[id].fact) };
  const { name, fact, year } = BODIES[id];
  return { name, fact, year };
}

/** Every body's name in one language, for the orrery's canvas labels. */
export const BODY_NAMES: Record<Lang, Record<SelectableId, string>> = {
  en: Object.fromEntries(Object.values(BODIES).map((b) => [b.id, b.name])) as Record<SelectableId, string>,
  bn: Object.fromEntries(Object.entries(BODIES_BN).map(([id, b]) => [id, b.name])) as Record<SelectableId, string>,
};

/** Bangla for what each band shows; the English lives with the band data in bands.ts. */
const BAND_WHAT_BN: Record<Band["n"], string> = {
  1: "আপনার চোখ যতটা লাল দেখতে পায়, তার ঠিক পরের অংশ। এখানে মূলত সাধারণ তারাদের আলো।",
  2: "1.6\u00a0µm-এর উঁচু অংশটি পর্যন্ত, যেখানে গ্যালাক্সির পুরোনো তারাদের আলো সবচেয়ে বেশি।",
  3: "ধুলার আড়াল ভেদ করে দেখে। আলো ছড়ানো হাইড্রোজেন (Paschen-α, 1.88\u00a0µm) দেখিয়ে দেয় কোথায় তারা জন্ম নিচ্ছে।",
  4: "পানির বরফ 3.0\u00a0µm-এ আলো শুষে নেয়, আর ঝুলকালির মতো PAH অণু আলো ছড়ায় 3.3\u00a0µm-এ।",
  5: "কার্বন-ডাই-অক্সাইডের বরফ (4.27\u00a0µm) আর হাইড্রোজেনের Brackett-α (4.05\u00a0µm), আরও সূক্ষ্ম রেজোলিউশনে।",
  6: "কার্বন-মনোক্সাইডের বরফ (4.67\u00a0µm), SPHEREx-এর সবচেয়ে সূক্ষ্ম বর্ণালি রেজোলিউশনে দেখা।",
};

export function bandWhat(band: Band, lang: Lang): string {
  return lang === "bn" ? joinHyphens(BAND_WHAT_BN[band.n]) : band.what;
}

/** Spectral feature labels by their English label; names of lines and molecules stay as written. */
const FEATURES_BN: Record<string, string> = {
  "water ice": "পানির বরফ",
  "CO₂ ice": "CO₂ বরফ",
  "CO ice": "CO বরফ",
};

export function featureLabel(label: string, lang: Lang): string {
  return lang === "bn" ? (FEATURES_BN[label] ?? label) : label;
}
