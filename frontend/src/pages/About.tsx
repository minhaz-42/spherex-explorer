import type { ReactNode } from "react";
import { Link } from "react-router";

import { useLang, useT } from "../lib/i18n";
import { ABOUT } from "./about.messages";

type Key = keyof typeof ABOUT.en;

const SECTIONS: { id: string; label: Key }[] = [
  { id: "mission", label: "mission" },
  { id: "how", label: "how" },
  { id: "methods", label: "methods" },
  { id: "limitations", label: "limitations" },
  { id: "credits", label: "credits" },
  { id: "privacy", label: "privacy" },
];

/** The three questions, each a bold lead-in and its answer. */
const QUESTIONS: [Key, Key][] = [
  ["whereLead", "where"],
  ["whenLead", "when"],
  ["changedLead", "changed"],
];

/** The Methods paragraphs, each a bold lead-in and its text. */
const METHODS: [Key, Key][] = [
  ["readingLead", "reading"],
  ["alignmentLead", "alignment"],
  ["backgroundLead", "background"],
  ["wavelengthLead", "wavelength"],
  ["brightnessLead", "brightness"],
  ["comparisonsLead", "comparisons"],
  ["knownLead", "known"],
  ["movingLead", "moving"],
  ["askLead", "ask"],
];

const LIMITATIONS: Key[] = [
  "limitWavelength",
  "limitSaturation",
  "limitResiduals",
  "limitReleases",
  "limitSearch",
  "limitLive",
  "limitAssistant",
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 space-y-4 border-t border-rule pt-10">
      <h2 id={`${id}-title`} className="section-title">
        {title}
      </h2>
      <div className="prose-body space-y-4">{children}</div>
    </section>
  );
}

function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

export function About() {
  const t = useT(ABOUT);
  const lang = useLang();
  // The credits keep the providers' own English wording in both languages; on a Bangla page they
  // are marked as English so screen readers read them as English.
  const en = lang === "bn" ? "en" : undefined;

  return (
    <div className="page grid gap-12 py-12 md:py-16 lg:grid-cols-[12rem_minmax(0,1fr)]">
      <nav aria-label={t("toc")} className="hidden lg:block">
        <ul className="sticky top-24 space-y-2 text-sm">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-muted no-underline hover:text-text">
                {t(s.label)}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0 max-w-3xl space-y-10">
        <header className="space-y-4">
          <p className="kicker">{t("kicker")}</p>
          <h1 className="text-[length:var(--fs-h1)]">{t("title")}</h1>
          <p className="prose-body">{t("intro")}</p>
        </header>

        <Section id="mission" title={t("mission")}>
          <p>
            {t("orbit")}
            <strong>{t("orbitStrong")}</strong>
            {t("orbitEnd")}
          </p>
          <p>
            {t("filter")}
            <strong>{t("filterStrong")}</strong>
            {t("filterEnd")}
          </p>
        </Section>

        <Section id="how" title={t("how")}>
          <p>{t("howIntro")}</p>
          <ol className="space-y-3">
            {QUESTIONS.map(([lead, text]) => (
              <li key={lead}>
                <strong>{t(lead)}</strong> {t(text)}
              </li>
            ))}
          </ol>
        </Section>

        <Section id="methods" title={t("methods")}>
          {METHODS.map(([lead, text]) => (
            <p key={lead}>
              <strong>{t(lead)}</strong> {t(text)}
            </p>
          ))}
          <p className="text-sm">
            {t("notes")}
            <code className="mono">docs/scientific-methods.md</code>
            {t("notesAnd")}
            <code className="mono">docs/research/</code>
            {t("notesEnd")}
          </p>
        </Section>

        <Section id="limitations" title={t("limitations")}>
          <ul className="list-disc space-y-2 pl-5">
            {LIMITATIONS.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </Section>

        <Section id="credits" title={t("credits")}>
          {lang === "bn" && <p className="text-sm text-faint">{t("creditsNote")}</p>}
          <p lang={en}>
            This work makes use of data products from the Spectro-Photometer for the History of the Universe, Epoch of
            Reionization and Ices Explorer (SPHEREx), which is a joint project of the Jet Propulsion Laboratory and the
            California Institute of Technology, and is funded by the National Aeronautics and Space Administration.
            Quick Release 2 (<Ext href="https://doi.org/10.26131/IRSA652">doi:10.26131/IRSA652</Ext>) and Quick Release 3
            (<Ext href="https://doi.org/10.26131/IRSA662">doi:10.26131/IRSA662</Ext>).
          </p>
          <p lang={en}>
            This research has made use of the NASA/IPAC Infrared Science Archive, which is funded by the National
            Aeronautics and Space Administration and operated by the California Institute of Technology.
          </p>
          <p lang={en}>
            Solar System positions come from the{" "}
            <Ext href="https://ssd.jpl.nasa.gov/">JPL Solar System Dynamics</Ext> group’s SBIdent and Horizons services.
            Object names are resolved with <Ext href="https://cds.unistra.fr/cgi-bin/Sesame">CDS Sesame</Ext>, which
            queries SIMBAD, NED and VizieR.
          </p>
          <p lang={en}>
            This research has made use of the <Ext href="https://simbad.cds.unistra.fr/simbad/">SIMBAD database</Ext>,
            operated at CDS, Strasbourg, France, for the facts about each object and the objects in each field. Images
            of the same field in other light come through the CDS{" "}
            <Ext href="https://alasky.cds.unistra.fr/hips-image-services/hips2fits">hips2fits</Ext> service.
          </p>
          <p lang={en}>
            The Digitized Sky Surveys were produced at the Space Telescope Science Institute under U.S. Government grant
            NAG W-2166. The images of these surveys are based on photographic data obtained using the Oschin Schmidt
            Telescope on Palomar Mountain (POSS-I and POSS-II, Caltech) and the UK Schmidt Telescope.
          </p>
          <p lang={en}>
            This publication makes use of data products from the Two Micron All Sky Survey, which is a joint project of
            the University of Massachusetts and the Infrared Processing and Analysis Center/California Institute of
            Technology, funded by the National Aeronautics and Space Administration and the National Science Foundation;
            and from the Wide-field Infrared Survey Explorer (AllWISE), which is a joint project of the University of
            California, Los Angeles, and the Jet Propulsion Laboratory/California Institute of Technology, funded by
            the National Aeronautics and Space Administration.
          </p>
          <p lang={en}>
            Coastlines on the globe are from <Ext href="https://www.naturalearthdata.com/">Natural Earth</Ext>, in the
            public domain.
          </p>
          <p lang={en}>
            SPHEREx Explorer is not affiliated with or endorsed by NASA, JPL, Caltech, IPAC or CDS, and uses none of
            their logos.
          </p>
        </Section>

        <Section id="privacy" title={t("privacy")}>
          <p>{t("privacyData")}</p>
          <p>{t("privacyAssistant")}</p>
          <p>
            <Link to="/explore">{t("start")}</Link>
          </p>
        </Section>
      </div>
    </div>
  );
}
