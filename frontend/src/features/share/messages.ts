import { defineMessages } from "../../lib/i18n";

/** The share menu and the exports it makes. */
export const SHARE = defineMessages({
  en: {
    share: "Share",
    gif: "Download GIF",
    video: "Download video",
    shareLink: "Share link",
    copyLink: "Copy link",
    makingGif: "Making the GIF…",
    makingVideo: "Making the video…",
    makingLink: "Making the link…",
    doneGif: "GIF downloaded",
    doneVideo: "video downloaded",
    linkReady: "Link ready",
    failed: "That did not work.",
    stillLoading: "The images are still loading.",
    hint: "Exports carry the dates, wavelengths and credits.",
    noCanvas: "This browser cannot draw the export.",
    noVideo: "This browser cannot record video; download the GIF instead.",
  },
  bn: {
    share: "শেয়ার করুন",
    gif: "GIF ডাউনলোড করুন",
    video: "ভিডিও ডাউনলোড করুন",
    shareLink: "লিংক শেয়ার করুন",
    copyLink: "লিংক কপি করুন",
    makingGif: "GIF তৈরি হচ্ছে…",
    makingVideo: "ভিডিও তৈরি হচ্ছে…",
    makingLink: "লিংক তৈরি হচ্ছে…",
    doneGif: "GIF ডাউনলোড হয়েছে",
    doneVideo: "ভিডিও ডাউনলোড হয়েছে",
    linkReady: "লিংক প্রস্তুত",
    failed: "কাজটি করা গেল না।",
    stillLoading: "ছবিগুলো এখনো লোড হচ্ছে।",
    hint: "এক্সপোর্ট করা ফাইলে তারিখ, তরঙ্গদৈর্ঘ্য ও কৃতজ্ঞতা লেখা থাকে।",
    noCanvas: "এই ব্রাউজারে এক্সপোর্টটি আঁকা যাচ্ছে না।",
    noVideo: "এই ব্রাউজারে ভিডিও রেকর্ড করা যায় না; তার বদলে GIF ডাউনলোড করুন।",
  },
});

/** The "Listen" button and the written summary of what it plays. */
export const SONIFY = defineMessages({
  en: {
    listen: "Listen",
    stop: "Stop",
    noSound: "Sound is not available.",
    cannotPlay: "This browser cannot play sound.",
    tooFew: "Not enough points to describe.",
    summary:
      "{n} points from {from} to {to} {ux}. Brightest at {xName} {maxX} {ux} ({maxY} {uy}), faintest at {minX} {ux}. Overall it {trend} {toward}.",
    level: "stays roughly level",
    rises: "rises",
    falls: "falls",
    longer: "towards longer wavelengths",
    overTime: "over time",
  },
  bn: {
    listen: "শুনুন",
    stop: "থামান",
    noSound: "শব্দ বাজানো যাচ্ছে না।",
    cannotPlay: "এই ব্রাউজারে শব্দ বাজানো যায় না।",
    tooFew: "বর্ণনা করার মতো যথেষ্ট বিন্দু নেই।",
    summary:
      "{n}টি বিন্দু, {from} থেকে {to} {ux} পর্যন্ত। সবচেয়ে উজ্জ্বল {xName} {maxX} {ux}-এ ({maxY} {uy}), সবচেয়ে ক্ষীণ {minX} {ux}-এ। সব মিলিয়ে {toward} উজ্জ্বলতা {trend}।",
    level: "মোটামুটি একই থাকে",
    rises: "বাড়ে",
    falls: "কমে",
    longer: "দীর্ঘতর তরঙ্গদৈর্ঘ্যের দিকে",
    overTime: "সময়ের সঙ্গে",
  },
});

/** Bangla for the x-axis nouns callers pass in English ("wavelength", "time"). */
export const AXIS_NAMES_BN: Readonly<Record<string, string>> = {
  wavelength: "তরঙ্গদৈর্ঘ্য",
  time: "সময়",
};
