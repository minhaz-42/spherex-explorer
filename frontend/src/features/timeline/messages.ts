import { defineMessages } from "../../lib/i18n";

/** The time machine's words: pass list, frame strip and playback controls. */
export const TIMELINE = defineMessages({
  en: {
    passes: "Survey passes",
    frames: "Frames in this sequence",
    frameLabel: "Frame {n}: {date}, {time}, {wavelength}",
    referenceA: ", reference A",
    sameAsA: ", same wavelength as A",
    failed: ", failed to load",
    notLoaded: ", not loaded yet",
    playback: "Playback",
    first: "First frame",
    previous: "Previous frame",
    pause: "Pause",
    play: "Play through the frames",
    next: "Next frame",
    speed: "Playback speed",
    noFrames: "No frames",
  },
  bn: {
    passes: "জরিপ-পর্বগুলো",
    frames: "এই ক্রমের ফ্রেমগুলো",
    frameLabel: "ফ্রেম {n}: {date}, {time}, {wavelength}",
    referenceA: ", রেফারেন্স A",
    sameAsA: ", A-এর সমান তরঙ্গদৈর্ঘ্য",
    failed: ", লোড করা যায়নি",
    notLoaded: ", এখনো লোড হয়নি",
    playback: "চালানোর নিয়ন্ত্রণ",
    first: "প্রথম ফ্রেম",
    previous: "আগের ফ্রেম",
    pause: "থামান",
    play: "ফ্রেমগুলো পরপর চালান",
    next: "পরের ফ্রেম",
    speed: "চালানোর গতি",
    noFrames: "কোনো ফ্রেম নেই",
  },
});
