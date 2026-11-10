/** Example searches known to have SPHEREx data, with their labels in English and Bangla. */
export const EXAMPLES = [
  {
    en: { label: "Asteroid (7) Iris moving past a bright star", detail: "Two visits 9.7 hours apart, December 2025" },
    bn: { label: "উজ্জ্বল এক তারার পাশ দিয়ে চলেছে গ্রহাণু (7) Iris", detail: "9.7 ঘণ্টার ব্যবধানে দুবার দেখা, ডিসেম্বর 2025" },
    to: "/explore?ra=161.29678&dec=2.44824&name=Asteroid+(7)+Iris+near+36+Sextantis&seq=pass&det=2&f=2025W49_1A_0423_1&fa=2025W49_1A_0332_1&cmp=blink&fov=0.3",
  },
  {
    en: { label: "Andromeda Galaxy", detail: "M31, our nearest large galaxy" },
    bn: { label: "অ্যান্ড্রোমিডা গ্যালাক্সি", detail: "M31, আমাদের সবচেয়ে কাছের বড় গ্যালাক্সি" },
    to: "/explore?q=M31",
  },
  {
    en: { label: "Orion Nebula", detail: "A star-forming cloud, M42" },
    bn: { label: "কালপুরুষ নীহারিকা", detail: "তারা জন্মের একটি মেঘ, M42" },
    to: "/explore?q=M42",
  },
  {
    en: { label: "North ecliptic pole", detail: "Where SPHEREx looks almost every orbit" },
    bn: { label: "উত্তর ক্রান্তীয় মেরু", detail: "পৃথিবী ঘোরার প্রায় প্রতিটি পাকে SPHEREx যেখানে তাকায়" },
    to: "/explore?ra=270&dec=66.56&name=North+ecliptic+pole",
  },
];

/**
 * The test targets the NASA Space Apps challenge "Planet X and SPHEREx" names: three fast movers
 * and two variable stars. All are looked up by name, so SIMBAD's proper motion comes with them and
 * the fast ones are followed to where they are now. WISE 0855 goes by its WISE designation, which
 * is the challenge's coordinates: those are its 2010 position, 85″ from SIMBAD's for 2000.
 */
export const CHALLENGE_TARGETS: typeof EXAMPLES = [
  {
    en: { label: "Barnard's Star", detail: "The fastest-moving star in our sky, 10.4″ a year" },
    bn: { label: "বার্নার্ডের তারা", detail: "আমাদের আকাশে সবচেয়ে দ্রুত সরে যাওয়া তারা, বছরে 10.4″" },
    to: "/explore?q=Barnard%27s+Star",
  },
  {
    en: { label: "Epsilon Indi B", detail: "A pair of brown dwarfs orbiting a nearby star" },
    bn: { label: "এপসাইলন ইন্ডি বি", detail: "কাছের এক তারাকে ঘিরে ঘোরা একজোড়া বাদামি বামন" },
    to: "/explore?q=eps+Ind+B",
  },
  {
    en: { label: "WISE 0855−0714", detail: "A fast-moving brown dwarf · RA 08h55m10.831s, Dec −7°14′42.53″" },
    bn: { label: "WISE 0855−0714", detail: "দ্রুত সরে যাওয়া এক বাদামি বামন · RA 08h55m10.831s, Dec −7°14′42.53″" },
    to: "/explore?q=WISE+J085510.83-071442.5&name=WISE+0855%E2%88%920714&fov=0.3",
  },
  {
    en: { label: "RW Aurigae", detail: "A young star whose brightness varies" },
    bn: { label: "RW Aurigae", detail: "এক তরুণ তারা, যার উজ্জ্বলতা বদলায়" },
    to: "/explore?q=RW+Aur",
  },
  {
    en: { label: "R Draconis", detail: "A pulsating giant that brightens and fades over months" },
    bn: { label: "R Draconis", detail: "এক স্পন্দনশীল দানব তারা, মাসের পর মাস ধরে উজ্জ্বল ও ম্লান হয়" },
    to: "/explore?q=R+Dra",
  },
];
