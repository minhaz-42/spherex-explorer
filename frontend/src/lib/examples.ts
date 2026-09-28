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
