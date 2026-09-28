import { defineMessages } from "../../lib/i18n";

/** "Spot the mover": the rounds, the reveal and the closing note. */
export const GAME = defineMessages({
  en: {
    stage: "Two SPHEREx frames of {title}, blinking. Tap the point of light that jumps between them.",
    failed: "This round could not be loaded right now.",
    loading: "Loading two real SPHEREx frames…",
    framesAB: "{date} · frames A and B",
    hunt: "Stars stay where they are between two visits. Something in this field jumps. Tap it.",
    showFrame: "Show frame {frame}",
    showMe: "Show me",
    found: "Found it.",
    here: "It was here.",
    moverIs: "The mover is ",
    rate: ", crossing the sky at about {rate}″ per hour",
    rings: ". The rings are where JPL's orbit puts it in each frame.",
    where: "Where was SPHEREx for frame A?",
    loadingRounds: "Loading the rounds…",
    noRounds: "No moving-object cases are available right now.",
    progress: "Round {round} of {rounds} · score {score}/{played}",
    next: "Next round",
    again: "Play again",
    endBefore:
      "You found {score} of {rounds}. That is how Clyde Tombaugh found Pluto in 1930: by blinking photographic plates at Lowell Observatory. To hunt in real survey data, join NASA's ",
    endAfter: ", where volunteers blink WISE images to find moving brown dwarfs and distant worlds.",
  },
  bn: {
    stage:
      "পালা করে দেখানো দুটি SPHEREx ফ্রেম: {title}। দুই ফ্রেমের মধ্যে যে আলোকবিন্দু লাফিয়ে সরে যায়, সেটিতে ট্যাপ করুন।",
    failed: "এই রাউন্ডটি এখন লোড করা যাচ্ছে না।",
    loading: "দুটি আসল SPHEREx ফ্রেম লোড হচ্ছে…",
    framesAB: "{date} · ফ্রেম A ও B",
    hunt: "দুবার দেখার মধ্যে তারাগুলো যেখানে ছিল সেখানেই থাকে। আকাশের এই অংশে কিছু একটা লাফিয়ে সরে যায়। সেটিতে ট্যাপ করুন।",
    showFrame: "ফ্রেম {frame} দেখান",
    showMe: "দেখিয়ে দিন",
    found: "খুঁজে পেয়েছেন।",
    here: "এটি এখানে ছিল।",
    moverIs: "চলমান বস্তুটি হলো ",
    rate: ", যা ঘণ্টায় প্রায় {rate}″ বেগে আকাশ পাড়ি দিচ্ছে",
    rings: "। বৃত্তগুলো দেখায়, JPL-এর কক্ষপথ অনুযায়ী প্রতিটি ফ্রেমে এটি কোথায় থাকার কথা।",
    where: "ফ্রেম A তোলার সময় SPHEREx কোথায় ছিল?",
    loadingRounds: "রাউন্ডগুলো লোড হচ্ছে…",
    noRounds: "এই মুহূর্তে চলমান বস্তুর কোনো উদাহরণ পাওয়া যাচ্ছে না।",
    progress: "রাউন্ড {round}/{rounds} · স্কোর {score}/{played}",
    next: "পরের রাউন্ড",
    again: "আবার খেলুন",
    endBefore:
      "আপনি {rounds}টির মধ্যে {score}টি খুঁজে পেয়েছেন। ঠিক এভাবেই 1930 সালে ক্লাইড টমবো প্লুটো আবিষ্কার করেছিলেন: লোয়েল মানমন্দিরে ফটোগ্রাফিক প্লেট ব্লিংক করে। আসল জরিপের ডেটায় খুঁজতে চাইলে যোগ দিন NASA-র ",
    endAfter:
      " প্রকল্পে, যেখানে স্বেচ্ছাসেবকেরা WISE-এর ছবি ব্লিংক করে চলমান বাদামি বামন আর দূরের নানা জগৎ খোঁজেন।",
  },
});
