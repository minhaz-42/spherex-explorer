import { defineMessages } from "../lib/i18n";

export const EXPLORE = defineMessages({
  en: {
    kicker: "Explore",
    title: "Where in the sky?",
    intro:
      "Name an object or paste coordinates. SPHEREx Explorer finds every SPHEREx image that covers that spot, lines them up, and lets you step through time, with what the catalogues know about the object beside it.",
    startWith: "Start with one of these",
    lookingUp: "Looking up “{q}”…",
    searching: "Searching the SPHEREx archive for images of {label}…",
    usually: "Usually 3–10 seconds.",
    tryAgainSoon: "{message} Try again in a moment.",
    position: "RA {ra}°, Dec {dec}°",
    raDec: "RA {ra} · Dec {dec}",
    inConstellation: "in {name}",
    snapshot: "Demo snapshot · real SPHEREx data",
    retrieved: ", retrieved {date}",
    live: "Live · IRSA archive",
    notInSnapshot: "This position is not in the demo snapshot.",
    archiveFailed: "The SPHEREx archive could not be searched.",
    nothingSubstituted: "Nothing has been substituted: no data is shown rather than data that did not come from this search.",
    useLive: "Use live data",
    tryAgain: "Try again",
    useSnapshot: "Use the demo snapshot instead",
    browseDiscover: "Browse Discover",
    emptyTitle: "No SPHEREx images cover {label} yet.",
    emptyBody:
      "SPHEREx maps the whole sky every six months, and new images reach the archive within about 60 days. A few regions have gaps in the public Quick Release data so far. Try a nearby position or one of the examples.",
    newSearch: "New search",
  },
  bn: {
    kicker: "অন্বেষণ",
    title: "আকাশের কোথায়?",
    intro:
      "কোনো বস্তুর নাম লিখুন বা স্থানাঙ্ক দিন। SPHEREx Explorer ওই জায়গার প্রতিটি SPHEREx ছবি খুঁজে বের করে সময়ের ক্রমে সাজায়, আর আপনাকে এক ছবি থেকে পরের ছবিতে এগোতে দেয়; পাশে থাকে ক্যাটালগে বস্তুটি সম্পর্কে যা জানা আছে।",
    startWith: "এগুলোর যেকোনো একটি দিয়ে শুরু করুন",
    lookingUp: "“{q}” খোঁজা হচ্ছে…",
    searching: "{label}-এর ছবির জন্য SPHEREx আর্কাইভে খোঁজা হচ্ছে…",
    usually: "সাধারণত 3–10 সেকেন্ড লাগে।",
    tryAgainSoon: "{message} একটু পরে আবার চেষ্টা করুন।",
    position: "বিষুবাংশ {ra}°, বিষুবলম্ব {dec}°",
    raDec: "বিষুবাংশ {ra} · বিষুবলম্ব {dec}",
    inConstellation: "{name} নক্ষত্রমণ্ডলে",
    snapshot: "ডেমো স্ন্যাপশট · আসল SPHEREx ডেটা",
    retrieved: ", সংগ্রহের তারিখ {date}",
    live: "লাইভ · IRSA আর্কাইভ",
    notInSnapshot: "এই অবস্থানটি ডেমো স্ন্যাপশটে নেই।",
    archiveFailed: "SPHEREx আর্কাইভে খোঁজা যায়নি।",
    nothingSubstituted:
      "অন্য কিছু বসিয়ে দেওয়া হয়নি: এই খোঁজ থেকে আসেনি এমন ডেটা দেখানোর বদলে কোনো ডেটাই দেখানো হচ্ছে না।",
    useLive: "লাইভ ডেটা ব্যবহার করুন",
    tryAgain: "আবার চেষ্টা করুন",
    useSnapshot: "বরং ডেমো স্ন্যাপশট ব্যবহার করুন",
    browseDiscover: "পরিবর্তনগুলো দেখুন",
    emptyTitle: "{label} এলাকার কোনো SPHEREx ছবি এখনো নেই।",
    emptyBody:
      "SPHEREx প্রতি ছয় মাসে পুরো আকাশের মানচিত্র তৈরি করে, আর নতুন ছবি প্রায় 60 দিনের মধ্যে আর্কাইভে পৌঁছায়। প্রকাশ্য Quick Release ডেটায় এখনো কিছু অঞ্চলে ফাঁক আছে। কাছাকাছি কোনো অবস্থান বা উদাহরণগুলোর একটি চেষ্টা করুন।",
    newSearch: "নতুন খোঁজ",
  },
});

/** "361 frames in 5 passes, 9 Jul 2025 – 7 Aug 2026" in either language. */
export function framesSummary(lang: "en" | "bn", frames: number, passes: number, range: string): string {
  const n = (v: number) => v.toLocaleString("en-US");
  if (lang === "bn") return `${n(passes)}টি জরিপ-পর্বে ${n(frames)}টি ফ্রেম, ${range}`;
  return `${n(frames)} ${frames === 1 ? "frame" : "frames"} in ${n(passes)} ${passes === 1 ? "pass" : "passes"}, ${range}`;
}
