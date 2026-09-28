import { plural } from "../../lib/format";
import { defineMessages, type Lang } from "../../lib/i18n";

/**
 * The sky viewer's words. The comparison caveats are validity rules: the Bangla keeps their exact
 * meaning (a brightness difference between frames may be the sources' colour, not a change in time).
 */
export const VIEWER = defineMessages({
  en: {
    single: "Single",
    singleHint: "One observation at a time",
    blink: "Blink",
    blinkHint: "Flip between reference A and the current frame B",
    side: "Side by side",
    sideHint: "A and B next to each other, zoomed together",
    diff: "Difference",
    diffHint: "B minus A, where that is scientifically valid",
    frameFailed: "This frame could not be loaded.",
    tryAgain: "Try again",
    reading: "Reading this frame from the SPHEREx archive…",
    noFrames: "No frames from detector {detector} in this selection. Choose another band or pass.",
    viewer: "Sky viewer",
    comparison: "Comparison",
    ask: "Ask about this view",
    zoom: "Zoom",
    zoomOut: "Zoom out",
    fit: "Fit to view",
    zoomIn: "Zoom in",
    frameLabel: "Frame {tag}: {when}",
    diffLabel: "Difference image, current frame minus reference",
    imageLabel: "SPHEREx image of {label}, {when}",
    misleading: "A difference image would be misleading here.",
    useBlink: "Use Blink to compare positions, or pick a matched-wavelength sequence.",
    readout: "RA {ra} Dec {dec}",
    noData: "no data",
    flaggedPixel: " (flagged pixel, filled for display)",
    touchHint: "Pinch to zoom, drag to pan, double-tap to zoom in.",
    mouseHint: "Scroll or pinch to zoom, drag to pan. Hover for coordinates and pixel values.",
    loaded:
      "{frames} of {count} loaded. Each dot’s height is the wavelength that frame saw at the target; a ring marks frames at the same wavelength as A.",
    keys: " Keys: ← → step, space play, R set reference.",
    sequence: "Sequence",
    sequenceType: "Sequence type",
    onePass: "One survey pass",
    oneWavelength: "One wavelength",
    passNote:
      "Frames from one visit of the survey, minutes to days apart. Stars stay put; anything that moves is in the Solar System.",
    wavelengthNote:
      "Frames from every pass that saw the target within half a spectral channel of {wavelength}, one per pointing. This is the fair way to compare brightness over months.",
    band: "Wavelength band",
    matchWavelength: "Match this frame’s wavelength ({wavelength})",
    display: "Display",
    fov: "Field of view",
    stretch: "Stretch",
    asinh: "Asinh (faint and bright)",
    linear: "Linear",
    log: "Logarithmic",
    contrast: "Contrast",
    showFlagged: "Show flagged pixels (filled in for display, not measured)",
    sameStretch:
      "Every frame uses the same stretch, taken from the reference frame, so brightness changes you see are in the data. The local background (zodiacal light and airglow) is removed from each frame.",
    fainter: "fainter",
    brighter: "brighter",
    same: "A and B are the same frame. Step to another frame to compare.",
    apart: "{gap} apart",
    apartWavelength: ", {delta} µm apart in wavelength",
    stop: ".",
    closeEnough: "Close enough in wavelength to compare brightness directly.",
    colours:
      "Positions can be compared (stars stay put, moving objects shift), but brightness differences may just be the sources’ colours.",
    how: "How the comparison works",
    howBody:
      "Both frames are resampled onto the same north-up grid using their own astrometric solutions, flagged pixels are masked, and each frame’s local background is subtracted. A difference is shown only when both saw the target within half a spectral channel of each other, on the same detector. Differences near bright stars include residuals from the changing shape of the telescope’s point-spread function.",
    useB: "Use B as the new reference",
  },
  bn: {
    single: "একক",
    singleHint: "একবারে একটি পর্যবেক্ষণ",
    blink: "ব্লিংক",
    blinkHint: "রেফারেন্স A আর বর্তমান ফ্রেম B পালা করে দেখায়",
    side: "পাশাপাশি",
    sideHint: "A আর B পাশাপাশি, একসঙ্গে জুম হয়",
    diff: "পার্থক্য",
    diffHint: "B বিয়োগ A, যেখানে তা বৈজ্ঞানিকভাবে বৈধ",
    frameFailed: "এই ফ্রেমটি লোড করা যায়নি।",
    tryAgain: "আবার চেষ্টা করুন",
    reading: "SPHEREx আর্কাইভ থেকে এই ফ্রেমটি পড়া হচ্ছে…",
    noFrames: "এই নির্বাচনে ডিটেক্টর {detector}-এর কোনো ফ্রেম নেই। অন্য কোনো ব্যান্ড বা জরিপ-পর্ব বেছে নিন।",
    viewer: "আকাশের ছবি দেখার অংশ",
    comparison: "তুলনা",
    ask: "এই দৃশ্য নিয়ে প্রশ্ন করুন",
    zoom: "জুম",
    zoomOut: "জুম কমান",
    fit: "পুরো ছবি দেখুন",
    zoomIn: "জুম বাড়ান",
    frameLabel: "ফ্রেম {tag}: {when}",
    diffLabel: "পার্থক্য-ছবি: বর্তমান ফ্রেম বিয়োগ রেফারেন্স ফ্রেম",
    imageLabel: "{label}-এর SPHEREx ছবি, {when}",
    misleading: "এখানে পার্থক্য-ছবি বিভ্রান্তিকর হবে।",
    useBlink: "অবস্থান তুলনা করতে ব্লিংক ব্যবহার করুন, অথবা একই তরঙ্গদৈর্ঘ্যে মেলানো ফ্রেমের একটি ক্রম বেছে নিন।",
    readout: "বিষুবাংশ {ra} বিষুবলম্ব {dec}",
    noData: "ডেটা নেই",
    flaggedPixel: " (চিহ্নিত পিক্সেল, দেখানোর জন্য পূরণ করা)",
    touchHint: "পিঞ্চ করে জুম করুন, টেনে সরান, আর জুম বাড়াতে দুবার ট্যাপ করুন।",
    mouseHint: "জুম করতে স্ক্রল বা পিঞ্চ করুন, সরাতে টানুন। স্থানাঙ্ক আর পিক্সেলের মান দেখতে ছবির ওপর পয়েন্টার রাখুন।",
    loaded:
      "{count}টির মধ্যে {n}টি ফ্রেম লোড হয়েছে। প্রতিটি বিন্দুর উচ্চতা দেখায়, ওই ফ্রেম লক্ষ্যে কোন তরঙ্গদৈর্ঘ্য দেখেছে; A-এর সমান তরঙ্গদৈর্ঘ্যের ফ্রেমগুলোর চারপাশে একটি বলয় থাকে।",
    keys: " কিবোর্ড: ← → এক ধাপ সরুন, Space চালান, R রেফারেন্স ঠিক করুন।",
    sequence: "ক্রম",
    sequenceType: "ক্রমের ধরন",
    onePass: "একটি জরিপ-পর্ব",
    oneWavelength: "একটি তরঙ্গদৈর্ঘ্য",
    passNote:
      "জরিপের একটি পরিদর্শনের ফ্রেম, যেগুলোর মধ্যে কয়েক মিনিট থেকে কয়েক দিনের ব্যবধান। তারাগুলো নিজের জায়গায় থাকে; যা কিছু সরে যায়, তা সৌরজগতের ভেতরেই আছে।",
    wavelengthNote:
      "প্রতিটি জরিপ-পর্ব থেকে সেই ফ্রেমগুলো, যেগুলো লক্ষ্যকে {wavelength} থেকে অর্ধেক বর্ণালি-চ্যানেলের মধ্যে থাকা তরঙ্গদৈর্ঘ্যে দেখেছে, প্রতি পয়েন্টিং থেকে একটি করে। মাসের পর মাস ধরে উজ্জ্বলতা তুলনা করার এটাই ন্যায্য উপায়।",
    band: "তরঙ্গদৈর্ঘ্যের ব্যান্ড",
    matchWavelength: "এই ফ্রেমের তরঙ্গদৈর্ঘ্যে মেলান ({wavelength})",
    display: "প্রদর্শন",
    fov: "দৃষ্টিক্ষেত্র",
    stretch: "উজ্জ্বলতার মাপ",
    asinh: "Asinh (ম্লান ও উজ্জ্বল)",
    linear: "রৈখিক",
    log: "লগারিদমিক",
    contrast: "কনট্রাস্ট",
    showFlagged: "চিহ্নিত পিক্সেল দেখান (দেখানোর জন্য পূরণ করা, মাপা হয়নি)",
    sameStretch:
      "প্রতিটি ফ্রেমে একই উজ্জ্বলতার মাপ ব্যবহার করা হয়, যা নেওয়া হয় রেফারেন্স ফ্রেম থেকে; তাই উজ্জ্বলতায় যে পরিবর্তন আপনি দেখেন, তা ডেটাতেই আছে। প্রতিটি ফ্রেম থেকে স্থানীয় পটভূমি (রাশিচক্রীয় আলো ও বায়ুদীপ্তি) সরিয়ে ফেলা হয়।",
    fainter: "ম্লানতর",
    brighter: "উজ্জ্বলতর",
    same: "A আর B একই ফ্রেম। তুলনা করতে অন্য কোনো ফ্রেমে যান।",
    apart: "সময়ের ব্যবধান {gap}",
    apartWavelength: ", তরঙ্গদৈর্ঘ্যের ব্যবধান {delta} µm",
    stop: "।",
    closeEnough: "তরঙ্গদৈর্ঘ্য যথেষ্ট কাছাকাছি, তাই উজ্জ্বলতা সরাসরি তুলনা করা যায়।",
    colours:
      "অবস্থান তুলনা করা যায় (তারাগুলো নিজের জায়গায় থাকে, চলমান বস্তু সরে যায়), কিন্তু উজ্জ্বলতার পার্থক্য হয়তো কেবল উৎসগুলোর রঙের কারণেই।",
    how: "তুলনা কীভাবে কাজ করে",
    howBody:
      "দুটি ফ্রেমকেই তাদের নিজ নিজ জ্যোতির্মিতিক সমাধান ব্যবহার করে উত্তর দিক ওপরে রাখা একই গ্রিডে পুনর্নমুনায়ন করা হয়, চিহ্নিত পিক্সেলগুলো মাস্ক করে বাদ রাখা হয়, আর প্রতিটি ফ্রেমের স্থানীয় পটভূমি বিয়োগ করা হয়। পার্থক্য দেখানো হয় কেবল তখনই, যখন দুটি ফ্রেমই একই ডিটেক্টরে লক্ষ্যকে এমন তরঙ্গদৈর্ঘ্যে দেখেছে, যেগুলোর ব্যবধান অর্ধেক বর্ণালি-চ্যানেলের বেশি নয়। উজ্জ্বল তারার কাছের পার্থক্যে টেলিস্কোপের পয়েন্ট-স্প্রেড ফাংশনের বদলাতে থাকা আকৃতির অবশিষ্টাংশও থাকে।",
    useB: "B-কে নতুন রেফারেন্স করুন",
  },
});

export type ViewerKey = keyof (typeof VIEWER)["en"];

/**
 * Labels drawn on the sky image. The compass keeps the conventional N and E symbols in both
 * languages: at its 8.5px size, Bangla letters would blur and touch the arrowheads.
 */
export const OVERLAYS = defineMessages({
  en: {
    target: "Target",
    predicted: "{name}: position predicted by JPL",
    candidate: "Candidate {id}",
    weak: " (weak)",
  },
  bn: {
    target: "লক্ষ্য",
    predicted: "{name}: JPL-এর পূর্বাভাসিত অবস্থান",
    candidate: "সম্ভাব্য বস্তু {id}",
    weak: " (দুর্বল)",
  },
});

/** "19 frames" as `plural` writes it in English; Bangla counts with a classifier: "19টি ফ্রেম". */
export function frameCount(lang: Lang, n: number): string {
  return lang === "bn" ? `${n.toLocaleString("en-US")}টি ফ্রেম` : plural(n, "frame");
}
