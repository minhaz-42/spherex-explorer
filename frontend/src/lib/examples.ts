/** Example searches known to have SPHEREx data. */
export const EXAMPLES = [
  {
    label: "Asteroid (7) Iris moving past a bright star",
    detail: "Two visits 9.7 hours apart, December 2025",
    to: "/explore?ra=161.29678&dec=2.44824&name=Asteroid+(7)+Iris+near+36+Sextantis&seq=pass&det=2&f=2025W49_1A_0423_1&fa=2025W49_1A_0332_1&cmp=blink&fov=0.3",
  },
  { label: "Andromeda Galaxy", detail: "M31, our nearest large galaxy", to: "/explore?q=M31" },
  { label: "Orion Nebula", detail: "A star-forming cloud, M42", to: "/explore?q=M42" },
  {
    label: "North ecliptic pole",
    detail: "Where SPHEREx looks almost every orbit",
    to: "/explore?ra=270&dec=66.56&name=North+ecliptic+pole",
  },
];
