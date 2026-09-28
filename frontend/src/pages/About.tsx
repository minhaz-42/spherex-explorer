import type { ReactNode } from "react";
import { Link } from "react-router";

const SECTIONS = [
  { id: "mission", label: "SPHEREx" },
  { id: "how", label: "How it works" },
  { id: "methods", label: "Methods" },
  { id: "limitations", label: "Limitations" },
  { id: "credits", label: "Data and credits" },
  { id: "privacy", label: "Privacy" },
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
  return (
    <div className="page grid gap-12 py-12 md:py-16 lg:grid-cols-[12rem_minmax(0,1fr)]">
      <nav aria-label="On this page" className="hidden lg:block">
        <ul className="sticky top-24 space-y-2 text-sm">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-muted no-underline hover:text-text">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0 max-w-3xl space-y-10">
        <header className="space-y-4">
          <p className="kicker">About</p>
          <h1 className="text-[length:var(--fs-h1)]">A time machine for the infrared sky</h1>
          <p className="prose-body">
            SPHEREx Explorer finds every image NASA’s SPHEREx mission has taken of a place in the sky, lines them up, and
            lets anyone step through them to see what changed. It was built for the 2026 NASA Space Apps Challenge,
            “Planet X and SPHEREx”. It is independent: not affiliated with or endorsed by NASA, JPL, Caltech or IPAC.
          </p>
        </header>

        <Section id="mission" title="SPHEREx">
          <p>
            SPHEREx is a NASA space telescope launched on 12 March 2025. From a polar orbit about 650 km up it maps the
            entire sky every six months in <strong>102 colours of infrared light</strong>, from 0.75 to 5 micrometres,
            with 6.15-arcsecond pixels. Its science goals are the first moments of the Universe, the history of galaxies,
            and the ices from which planets form.
          </p>
          <p>
            SPHEREx has no filter wheel. Each of its six detectors sits behind a <strong>linear variable filter</strong>:
            the wavelength changes across the detector. As the telescope steps across the sky, each star passes through
            many wavelengths, and one to two weeks of exposures add up to a spectrum. That design is why, in this app, every frame
            is labelled with the wavelength that fell on your target.
          </p>
        </Section>

        <Section id="how" title="How it works">
          <p>Every view answers three questions in order.</p>
          <ol className="space-y-3">
            <li>
              <strong>Where?</strong> A name is looked up with CDS Sesame (SIMBAD, NED, VizieR); coordinates are read
              directly. The position is shown in equatorial, galactic and ecliptic coordinates.
            </li>
            <li>
              <strong>When?</strong> The IRSA image search (SIA) lists every SPHEREx Level 2 image that contains the point,
              from Quick Releases 2 and 3. They are grouped into survey passes, months apart. Within a pass, SPHEREx points
              at the spot several times, hours apart, and takes up to four exposures a couple of minutes apart each time.
            </li>
            <li>
              <strong>What changed?</strong> Each frame is cut out, aligned and measured on the server, then shown
              side by side, blinked or differenced in your browser with one shared brightness scale.
            </li>
          </ol>
        </Section>

        <Section id="methods" title="Methods">
          <p>
            <strong>Reading the data.</strong> A SPHEREx image file is about 70 MB. The server reads only the rows it
            needs from the public cloud copy (Amazon S3), using HTTP byte ranges, and decodes the compressed flag planes
            of QR3 row by row. This was checked against IRSA’s own cutout service: the pixels are identical. If the cloud
            copy fails, IRSA’s cutout service is used instead.
          </p>
          <p>
            <strong>Alignment.</strong> Each frame is resampled onto one grid centred on the target, north up and east
            left, at SPHEREx’s native pixel size, using the frame’s own astrometric solution (TAN-SIP). Flagged pixels
            (cosmic rays, hot and dead pixels, ghosts, persistence; the set IRSA’s mosaic tool excludes) are masked and do
            not leak into their neighbours. For display only, masked pixels are filled from their surroundings; the
            mask marks them.
          </p>
          <p>
            <strong>Background.</strong> The zodiacal light and airglow are not removed in SPHEREx images and change from
            frame to frame, so each frame’s local background (a sigma-clipped median) is subtracted.
          </p>
          <p>
            <strong>Wavelength at the target.</strong> Read from each frame’s spectral lookup table (WCS-WAVE) at the
            target’s pixel. Before pixels load, it is estimated from the image footprint to within about 0.002 µm.
          </p>
          <p>
            <strong>Brightness.</strong> A 12-arcsecond aperture on the native pixels, a local background from a
            surrounding annulus, and an uncertainty from the pipeline’s variance plane. No aperture correction or PSF
            fitting: these numbers are for comparing frames, not for precise absolute fluxes.
          </p>
          <p>
            <strong>Comparisons.</strong> A difference image is shown only for two frames from the same detector that
            saw the target within half a spectral channel of each other. Otherwise the app explains why a difference
            would mislead, and offers blinking to compare positions.
          </p>
          <p>
            <strong>Known Solar System objects.</strong> JPL’s Small-Body Identification service is asked which
            catalogued asteroids and comets were in the field, for SPHEREx’s own position from the image header. JPL
            Horizons then gives each one’s position at every frame time, corrected to SPHEREx’s viewpoint. Checked against
            Horizons’ own SPHEREx-centred answer for asteroid (7) Iris, the correction agrees to 0.003 arcseconds.
          </p>
          <p>
            <strong>Moving-source search.</strong> A simple, transparent search: detect sources in every frame, drop
            those seen again at the same place in another pointing, keep what repeats within one pointing, and link
            those sightings on straight tracks at a constant rate. Results are called candidates and compared with JPL’s
            predictions. On the Iris field it finds Iris within 1.4 arcseconds of JPL’s positions.
          </p>
          <p className="text-sm">
            The full notes, with every service request and check, are in the project’s documentation (
            <code className="mono">docs/scientific-methods.md</code> and <code className="mono">docs/research/</code>).
          </p>
        </Section>

        <Section id="limitations" title="Limitations">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Two frames of the same place usually saw it at different wavelengths. A brightness difference between them
              may be the source’s colour rather than a change in time. Use a matched-wavelength sequence to compare
              brightness.
            </li>
            <li>
              Very bright stars and fast bright asteroids can saturate: their brightness is then a lower limit, and the
              app says so.
            </li>
            <li>
              Differences near bright stars show residuals, because the telescope’s point-spread function changes across
              the detector.
            </li>
            <li>
              QR2 and QR3 were processed with different calibrations; the SPHEREx team advises caution when combining
              them.
            </li>
            <li>
              The moving-source search is not a survey pipeline. It can miss faint or slow objects, and it can be fooled
              by artefacts; an unmatched candidate is not a discovery.
            </li>
            <li>
              Data come from IRSA and JPL at the moment you ask; when they are unavailable the app says so and shows no
              data rather than substitute data. A clearly labelled demo snapshot of real data can be chosen instead.
            </li>
          </ul>
        </Section>

        <Section id="credits" title="Data and credits">
          <p>
            This work makes use of data products from the Spectro-Photometer for the History of the Universe, Epoch of
            Reionization and Ices Explorer (SPHEREx), which is a joint project of the Jet Propulsion Laboratory and the
            California Institute of Technology, and is funded by the National Aeronautics and Space Administration.
            Quick Release 2 (<Ext href="https://doi.org/10.26131/IRSA652">doi:10.26131/IRSA652</Ext>) and Quick Release 3
            (<Ext href="https://doi.org/10.26131/IRSA662">doi:10.26131/IRSA662</Ext>).
          </p>
          <p>
            This research has made use of the NASA/IPAC Infrared Science Archive, which is funded by the National
            Aeronautics and Space Administration and operated by the California Institute of Technology.
          </p>
          <p>
            Solar System positions come from the{" "}
            <Ext href="https://ssd.jpl.nasa.gov/">JPL Solar System Dynamics</Ext> group’s SBIdent and Horizons services.
            Object names are resolved with <Ext href="https://cds.unistra.fr/cgi-bin/Sesame">CDS Sesame</Ext>, which
            queries SIMBAD, NED and VizieR.
          </p>
          <p>
            SPHEREx Explorer is not affiliated with or endorsed by NASA, JPL, Caltech or IPAC, and uses none of their
            logos.
          </p>
        </Section>

        <Section id="privacy" title="Privacy">
          <p>
            There are no accounts, no cookies and no analytics. Your searches are sent to the SPHEREx Explorer server,
            which forwards them to the public services above. The server keeps the address of each visitor in memory
            for a few minutes to limit how fast the archive is queried, and stores nothing about you.
          </p>
          <p>
            <Link to="/explore">Start exploring</Link>
          </p>
        </Section>
      </div>
    </div>
  );
}
