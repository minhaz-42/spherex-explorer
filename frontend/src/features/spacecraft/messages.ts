import { defineMessages } from "../../lib/i18n";

/** "Where was SPHEREx?": the globe, its canvas labels, its read-outs and the compass letters. */
export const SPACECRAFT = defineMessages({
  en: {
    figure: "Earth at {time} UTC, with SPHEREx {height} km up over {place}, looking towards the target.",
    height: "Height",
    speed: "Speed",
    above: "Above",
    sunAngle: "Target from the Sun",
    note: "From the frame's recorded position and velocity. SPHEREx covers {speed} km every second, so two frames taken hours apart see the sky from different places. A nearby asteroid shifts against the stars between them: that is parallax. Coastlines: Natural Earth.",
    spacecraft: "SPHEREx",
    toTarget: "to the target",
    north: "N",
    south: "S",
    east: "E",
    west: "W",
  },
  bn: {
    figure: "{time} UTC-তে পৃথিবী। SPHEREx তখন {height} km উচ্চতায়, ঠিক নিচে {place}; এটি লক্ষ্যবস্তুর দিকে তাকিয়ে আছে।",
    height: "উচ্চতা",
    speed: "গতি",
    above: "নিচের ভূমিবিন্দু",
    sunAngle: "সূর্য থেকে লক্ষ্যের কোণ",
    note: "ফ্রেমে লেখা অবস্থান ও বেগ থেকে আঁকা। SPHEREx প্রতি সেকেন্ডে {speed} km পথ পাড়ি দেয়, তাই কয়েক ঘণ্টার ব্যবধানে তোলা দুটি ফ্রেম আকাশকে দুটি ভিন্ন জায়গা থেকে দেখে। কাছের কোনো গ্রহাণু এই দুই ফ্রেমের মধ্যে তারাদের পটভূমিতে সরে যায়: এটাই লম্বন। উপকূলরেখা: Natural Earth।",
    spacecraft: "SPHEREx",
    toTarget: "লক্ষ্যের দিকে",
    north: "উ",
    south: "দ",
    east: "পূ",
    west: "প",
  },
});
