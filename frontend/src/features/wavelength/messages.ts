import { defineMessages } from "../../lib/i18n";

/**
 * Band picker and brightness measurements. The two explanations of what the points mean are
 * wavelength caveats: in one pass the points are a spectrum (different wavelengths), and only a
 * matched-wavelength sequence shows changes in time. The Bangla keeps that meaning exactly.
 */
export const WAVELENGTH = defineMessages({
  en: {
    band: "Wavelength band",
    bandLabel: "Detector {detector}, {min} to {max} micrometres, {n} frames",
    title: "Brightness at the target",
    aperture: "Aperture photometry, 12″ radius, background subtracted",
    passBefore:
      "In one pass, each exposure sees the target through a different part of SPHEREx’s filter, so these points trace the target’s ",
    passStrong: "spectrum",
    passAfter:
      " across this detector’s band. They were taken at different times, so a source that varies within a pass would distort it.",
    timeBefore: "Every point saw the target at nearly the same wavelength, so differences between them are changes in ",
    timeStrong: "time",
    timeAfter: ", within the error bars and the caveats of simple aperture photometry.",
    releases:
      "These frames come from different data releases ({releases}), which were calibrated differently. A small step between releases may be calibration rather than the source.",
    and: " and ",
    pointsAppear: "Points appear here as frames load.",
    xWavelength: "Wavelength at the target (µm)",
    xDate: "Date (UTC)",
    y: "Brightness ({unit})",
    wavelength: "Wavelength",
    date: "Date",
    caption:
      "{frames} measured. The highlighted point is the frame on screen; hollow points carry a caveat (see the table). Click a point to show that frame.",
    measureAll: "Measure all six bands in this pass",
    measureNote: "{frames}, about 0.75–5 µm. Reads a small window of each file.",
    progress: "Full spectrum from this pass: {done} of {total} frames measured.",
    spectrumCaption:
      "Every detector’s frames from this pass. Brightness can differ between detectors because of calibration, and a moving or variable target can make neighbouring points disagree.",
    lowSnr: "Signal-to-noise below 3",
    snr: "S/N {snr}",
  },
  bn: {
    band: "তরঙ্গদৈর্ঘ্যের ব্যান্ড",
    bandLabel: "ডিটেক্টর {detector}, {min} থেকে {max} মাইক্রোমিটার, {n}টি ফ্রেম",
    title: "লক্ষ্যে উজ্জ্বলতা",
    aperture: "অ্যাপারচার ফটোমেট্রি, 12″ ব্যাসার্ধ, পটভূমি বিয়োগ করা",
    passBefore:
      "একটি জরিপ-পর্বে প্রতিটি এক্সপোজার SPHEREx-এর ফিল্টারের আলাদা আলাদা অংশ দিয়ে লক্ষ্যকে দেখে, তাই এই বিন্দুগুলো এই ডিটেক্টরের ব্যান্ডজুড়ে লক্ষ্যের ",
    passStrong: "বর্ণালি",
    passAfter:
      " এঁকে দেয়। বিন্দুগুলো ভিন্ন ভিন্ন সময়ে নেওয়া, তাই যে উৎস একটি পর্বের মধ্যেই বদলায়, সেটি বর্ণালিটিকে বিকৃত করবে।",
    timeBefore: "প্রতিটি বিন্দু লক্ষ্যকে প্রায় একই তরঙ্গদৈর্ঘ্যে দেখেছে, তাই এদের মধ্যের পার্থক্য হলো ",
    timeStrong: "সময়ের",
    timeAfter: " সঙ্গে পরিবর্তন, ত্রুটি-দণ্ডের সীমার মধ্যে এবং সাধারণ অ্যাপারচার ফটোমেট্রির সতর্কতাগুলো সাপেক্ষে।",
    releases:
      "এই ফ্রেমগুলো ভিন্ন ভিন্ন ডেটা রিলিজ থেকে এসেছে ({releases}), যেগুলো ভিন্নভাবে ক্যালিব্রেট করা হয়েছিল। রিলিজগুলোর মাঝে ছোট একটি ধাপ উৎসের কারণে না হয়ে ক্যালিব্রেশনের কারণেও হতে পারে।",
    and: " ও ",
    pointsAppear: "ফ্রেম লোড হতে থাকলে বিন্দুগুলো এখানে দেখা যাবে।",
    xWavelength: "লক্ষ্যে তরঙ্গদৈর্ঘ্য (µm)",
    xDate: "তারিখ (UTC)",
    y: "উজ্জ্বলতা ({unit})",
    wavelength: "তরঙ্গদৈর্ঘ্য",
    date: "তারিখ",
    caption:
      "{frames} মাপা হয়েছে। হাইলাইট করা বিন্দুটি পর্দায় থাকা ফ্রেম; ফাঁপা বিন্দুগুলোর সঙ্গে একটি সতর্কতা আছে (সারণি দেখুন)। কোনো বিন্দুতে ক্লিক করলে সেই ফ্রেমটি দেখানো হবে।",
    measureAll: "এই জরিপ-পর্বের ছয়টি ব্যান্ডই মাপুন",
    measureNote: "{frames}, প্রায় 0.75–5 µm। প্রতিটি ফাইলের একটি ছোট অংশ পড়া হয়।",
    progress: "এই জরিপ-পর্বের পূর্ণ বর্ণালি: {total}টির মধ্যে {done}টি ফ্রেম মাপা হয়েছে।",
    spectrumCaption:
      "এই জরিপ-পর্বে প্রতিটি ডিটেক্টরের ফ্রেম। ক্যালিব্রেশনের কারণে ডিটেক্টরভেদে উজ্জ্বলতা আলাদা হতে পারে, আর চলমান বা পরিবর্তনশীল লক্ষ্যের কারণে পাশাপাশি বিন্দুগুলো না-ও মিলতে পারে।",
    lowSnr: "সংকেত-শব্দ অনুপাত 3-এর কম",
    snr: "সংকেত-শব্দ অনুপাত {snr}",
  },
});
