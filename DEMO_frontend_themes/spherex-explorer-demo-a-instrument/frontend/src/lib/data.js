// Facts from the project README, and generated frames for the preview widget.
// The generated frames are illustrations of the interface only, not SPHEREx
// data. In the real app they come from /api (IRSA SIA2 + cutouts).

export const BANDS = [
  { band: 1, min: 0.75, max: 1.09, R: 39, detector: 'D1' },
  { band: 2, min: 1.10, max: 1.62, R: 41, detector: 'D2' },
  { band: 3, min: 1.63, max: 2.41, R: 41, detector: 'D3' },
  { band: 4, min: 2.42, max: 3.82, R: 35, detector: 'D4' },
  { band: 5, min: 3.83, max: 4.41, R: 112, detector: 'D5' },
  { band: 6, min: 4.42, max: 5.00, R: 128, detector: 'D6' },
];

export const RELEASES = [
  { id: 'QR2', from: '2025-04-24', to: '2026-07-20', note: 'Wide and Deep Survey spectral images' },
  { id: 'QR3', from: '2026-07-20', to: '2026-08-17', note: 'Pipeline R7, released 2026-09-16' },
];

/** Deterministic random numbers, so every visitor sees the same preview. */
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const toMJD = (date) => date.getTime() / 86400000 + 40587;
export const fmtUTC = (date) => date.toISOString().slice(0, 16).replace('T', ' ');

/** False-colour ramp for wavelength: short = violet-blue, long = deep red. */
export function lambdaColor(micron, light = 1) {
  const f = Math.min(1, Math.max(0, (micron - 0.75) / (5.0 - 0.75)));
  const hue = 250 - f * 245;
  return `hsl(${hue.toFixed(0)} 85% ${(58 * light).toFixed(0)}%)`;
}

/**
 * Three survey passes about six months apart, four pointings per pass, and
 * six frames per pointing (one per detector). Passes 1 and 3 put the target on
 * nearly the same wavelengths; pass 2 is offset by half a step, so a
 * pass 1 vs pass 2 difference is refused, which is the point of the gate.
 */
export function makeFrames() {
  const r = rng(36);
  const passes = [
    { id: 1, start: '2025-07-30T04:12:00Z', release: 'QR2', offset: 0 },
    { id: 2, start: '2026-01-29T19:40:00Z', release: 'QR2', offset: 0.5 },
    { id: 3, start: '2026-07-31T02:05:00Z', release: 'QR3', offset: 0 },
  ];
  const frames = [];
  passes.forEach((pass) => {
    let t = new Date(pass.start).getTime();
    for (let k = 0; k < 4; k++) {
      t += (k === 0 ? 0 : 0.35 + r() * 0.5) * 86400000;
      BANDS.forEach((b) => {
        const frac = (k + 0.5 + pass.offset) / 4.5 + (r() - 0.5) * 0.006;
        const lambda = b.min + frac * (b.max - b.min);
        frames.push({
          index: frames.length,
          pass: pass.id,
          pointing: k + 1,
          release: pass.release,
          band: b.band,
          detector: b.detector,
          R: b.R,
          lambda,
          date: new Date(t + b.band * 1000),
          obsId: `demo-${pass.id}${k + 1}-${b.detector}`,
          seed: pass.id * 100 + k * 10 + b.band,
        });
      });
    }
  });
  return frames;
}

/** A made-up cool-star spectrum in arbitrary units, used for the preview only. */
export function starFlux(micron) {
  const T = 3900;
  const x = 14388 / (micron * T);
  const planck = 1 / (Math.pow(micron, 4) * (Math.exp(x) - 1));
  const co = 1 - 0.18 * Math.exp(-(((micron - 2.35) / 0.08) ** 2)) - 0.22 * Math.exp(-(((micron - 4.65) / 0.12) ** 2));
  const h2o = 1 - 0.12 * Math.exp(-(((micron - 2.8) / 0.2) ** 2));
  return planck * co * h2o * 9;
}

/** Half a resolution element: frames closer than this saw "the same" wavelength. */
export function sameWavelength(a, b) {
  const tol = (0.5 * a.lambda) / a.R;
  return a.band === b.band && Math.abs(a.lambda - b.lambda) <= tol;
}
