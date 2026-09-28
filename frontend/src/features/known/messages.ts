import { defineMessages } from "../../lib/i18n";

/**
 * JPL's known objects and our own moving-source search. Our detections are candidates (সম্ভাব্য
 * বস্তু), never discoveries. JPL's method notes, source names and body names come from the API and
 * stay in English.
 */
export const KNOWN = defineMessages({
  en: {
    knownTitle: "Known Solar System objects",
    knownDisabled:
      "Available for one survey pass: asteroids cross a field in hours to days, so a sequence spanning months cannot follow one.",
    knownIntro:
      "Ask JPL which catalogued asteroids and comets were in this field during the pass, as seen from SPHEREx, and draw where each should be in every frame.",
    knownButton: "Check JPL for known objects",
    knownPending: "Asking JPL… it integrates each orbit, so the first answer for a field takes 30 seconds to 2 minutes.",
    knownFailed: "JPL could not be reached.",
    tryAgain: "Try again",
    incomplete:
      "JPL Horizons did not answer for {n} catalogued bodies near this field, so this list may be incomplete. Try again in a moment.",
    knownNone:
      "JPL knows no asteroid or comet brighter than V = {vmag} in this field during this pass. Anything that moves here is not in its catalogue, or is fainter, or is an artefact.",
    showPredicted: "Show predicted positions on the image",
    moves: "Moves {rate}″ per hour · ",
    inField: "in the field in {k} of {frames}",
    inThisFrame: " · in this frame",
    notInThisFrame: " · not in this frame",
    howPredicted: "How these positions are predicted",
    source:
      "Source: {source}. {n} catalogued bodies brighter than V {vmag} were within {deg}° of the field at the middle frame’s time.",
    movingTitle: "Moving sources in this pass",
    movingDisabled: "Needs one survey pass with at least two pointings.",
    movingIntro:
      "Search every frame of this pass for sources that move from one pointing to the next, the way an asteroid or a distant planet would. It reads every frame, so it waits for them to load.",
    movingButton: "Search for moving sources",
    searching: "Searching {n} frames…",
    searchFailed: "The search failed.",
    stats:
      "{detections} sources detected; {transient} were not seen again at the same place, {sightings} of those repeated within a pointing, and {lined}.",
    linedNone: "none lined up across three or more pointings",
    linedSome: "{n} lined up across three or more pointings",
    rate: "{rate}″/h toward the {direction}",
    sightings: "{n} sightings on a straight line (scatter {scatter}″).",
    matches: "Matches JPL’s prediction for {name}, {offset}″ away (known object).",
    unmatched: "No catalogued body brighter than V {vmag} matches. Unconfirmed candidate: further analysis required.",
    checkFirst: "Check JPL for known objects above to see whether it is catalogued.",
    showWeak: "Also show {n} weak {noun} (two sightings only)",
    candidate: "candidate",
    candidates: "candidates",
    howSearch: "How the search works",
    rates:
      "Rates between {min}″ and {max}″ per hour are searched. A body much slower than that, such as a distant planet, would not be separated from the fixed sky within one pass.",
    n: "north",
    ne: "north-east",
    e: "east",
    se: "south-east",
    s: "south",
    sw: "south-west",
    w: "west",
    nw: "north-west",
  },
  bn: {
    knownTitle: "সৌরজগতের পরিচিত বস্তু",
    knownDisabled:
      "একটি জরিপ-পর্বের ক্ষেত্রে পাওয়া যায়: গ্রহাণু কয়েক ঘণ্টা থেকে কয়েক দিনে একটি দৃষ্টিক্ষেত্র পার হয়ে যায়, তাই কয়েক মাসজুড়ে বিস্তৃত কোনো ক্রমে একটিকে অনুসরণ করা যায় না।",
    knownIntro:
      "JPL-কে জিজ্ঞেস করুন, SPHEREx থেকে যেমন দেখা যায়, এই জরিপ-পর্বের সময় ক্যাটালগভুক্ত কোন কোন গ্রহাণু ও ধূমকেতু এই দৃষ্টিক্ষেত্রে ছিল, এবং প্রতিটি ফ্রেমে প্রতিটি বস্তুর যেখানে থাকার কথা, তা এঁকে দেখান।",
    knownButton: "JPL-এ পরিচিত বস্তু খুঁজুন",
    knownPending:
      "JPL-কে জিজ্ঞেস করা হচ্ছে… এটি প্রতিটি কক্ষপথ ধাপে ধাপে হিসাব করে, তাই কোনো দৃষ্টিক্ষেত্রের প্রথম উত্তর আসতে 30 সেকেন্ড থেকে 2 মিনিট লাগে।",
    knownFailed: "JPL-এর সঙ্গে যোগাযোগ করা যায়নি।",
    tryAgain: "আবার চেষ্টা করুন",
    incomplete:
      "JPL Horizons এই ক্ষেত্রের কাছের {n}টি পরিচিত বস্তুর অবস্থান জানায়নি, তাই তালিকাটি অসম্পূর্ণ হতে পারে। একটু পরে আবার চেষ্টা করুন।",
    knownNone:
      "এই জরিপ-পর্বের সময় এই দৃষ্টিক্ষেত্রে V = {vmag}-এর চেয়ে উজ্জ্বল কোনো গ্রহাণু বা ধূমকেতু JPL-এর জানা নেই। এখানে যা কিছু সরে, তা হয় এর ক্যাটালগে নেই, নয়তো আরও ম্লান, নয়তো ছবির কোনো ত্রুটি।",
    showPredicted: "ছবিতে পূর্বাভাসিত অবস্থান দেখান",
    moves: "ঘণ্টায় {rate}″ সরে · ",
    inField: "{total}টি ফ্রেমের মধ্যে {k}টিতে দৃষ্টিক্ষেত্রে ছিল",
    inThisFrame: " · এই ফ্রেমে আছে",
    notInThisFrame: " · এই ফ্রেমে নেই",
    howPredicted: "এই অবস্থানগুলোর পূর্বাভাস কীভাবে করা হয়",
    source:
      "তথ্যসূত্র: {source}। মাঝের ফ্রেমের সময়ে V {vmag}-এর চেয়ে উজ্জ্বল {n}টি ক্যাটালগভুক্ত বস্তু দৃষ্টিক্ষেত্র থেকে {deg}°-এর মধ্যে ছিল।",
    movingTitle: "এই জরিপ-পর্বে চলমান উৎস",
    movingDisabled: "এর জন্য অন্তত দুটি পয়েন্টিংসহ একটি জরিপ-পর্ব দরকার।",
    movingIntro:
      "এই জরিপ-পর্বের প্রতিটি ফ্রেমে এমন উৎস খুঁজুন, যা এক পয়েন্টিং থেকে পরের পয়েন্টিংয়ে সরে যায়, যেমনটা কোনো গ্রহাণু বা দূরের কোনো গ্রহ সরত। এটি প্রতিটি ফ্রেম পড়ে, তাই ফ্রেমগুলো লোড হওয়া পর্যন্ত অপেক্ষা করে।",
    movingButton: "চলমান উৎস খুঁজুন",
    searching: "{n}টি ফ্রেমে খোঁজা হচ্ছে…",
    searchFailed: "খোঁজটি ব্যর্থ হয়েছে।",
    stats:
      "{detections}টি উৎস শনাক্ত হয়েছে; তার মধ্যে {transient}টিকে একই জায়গায় আর দেখা যায়নি, সেগুলোর {sightings}টি একই পয়েন্টিংয়ের মধ্যে আবার দেখা গেছে, আর {lined}।",
    linedNone: "তিন বা তার বেশি পয়েন্টিংজুড়ে কোনোটিই এক সরলরেখায় পড়েনি",
    linedSome: "{n}টি তিন বা তার বেশি পয়েন্টিংজুড়ে এক সরলরেখায় পড়েছে",
    rate: "{rate}″/h, {direction} দিকে",
    sightings: "একটি সরলরেখার ওপর {n}বার দেখা গেছে (বিক্ষেপ {scatter}″)।",
    matches: "{name}-এর জন্য JPL-এর পূর্বাভাসের সঙ্গে মেলে, {offset}″ দূরে (পরিচিত বস্তু)।",
    unmatched:
      "V {vmag}-এর চেয়ে উজ্জ্বল কোনো ক্যাটালগভুক্ত বস্তুর সঙ্গে মেলে না। নিশ্চিত নয় এমন সম্ভাব্য বস্তু: আরও বিশ্লেষণ দরকার।",
    checkFirst: "এটি ক্যাটালগভুক্ত কি না দেখতে ওপরে JPL-এ পরিচিত বস্তু খুঁজুন।",
    showWeak: "{n}টি দুর্বল সম্ভাব্য বস্তুও দেখান (কেবল দুবার দেখা গেছে)",
    candidate: "সম্ভাব্য বস্তু",
    candidates: "সম্ভাব্য বস্তু",
    howSearch: "খোঁজ কীভাবে কাজ করে",
    rates:
      "ঘণ্টায় {min}″ থেকে {max}″ বেগের বস্তু খোঁজা হয়। এর চেয়ে অনেক ধীর কোনো বস্তু, যেমন দূরের কোনো গ্রহ, একটি জরিপ-পর্বের মধ্যে স্থির আকাশ থেকে আলাদা হবে না।",
    n: "উত্তর",
    ne: "উত্তর-পূর্ব",
    e: "পূর্ব",
    se: "দক্ষিণ-পূর্ব",
    s: "দক্ষিণ",
    sw: "দক্ষিণ-পশ্চিম",
    w: "পশ্চিম",
    nw: "উত্তর-পশ্চিম",
  },
});
