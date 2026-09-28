import { defineMessages } from "../../lib/i18n";

/** The scatter plot's own words; axis labels and captions come from the caller. */
export const PLOTS = defineMessages({
  en: {
    against: "{y} against {x}. Use the arrow keys to read points.",
    table: "Show the values as a table",
    notes: "Notes",
  },
  bn: {
    against: "{y} বনাম {x}। বিন্দুগুলো একে একে পড়তে কিবোর্ডের তীরচিহ্ন-বোতাম ব্যবহার করুন।",
    table: "মানগুলো সারণি আকারে দেখুন",
    notes: "মন্তব্য",
  },
});
