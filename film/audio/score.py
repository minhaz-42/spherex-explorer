"""The film's sound: an original score synthesised here, effects placed on the picture's cues
(build/cues.json, exported by render.mjs), and the narration (build/vo). Writes stems and the
mix to build/audio/.

Everything is generated from code: no samples, no third-party music.
"""

import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import butter, fftconvolve, lfilter, sosfilt

FILM = Path(__file__).resolve().parents[1]
OUT = FILM / "build" / "audio"
SR = 48000
DUR = 238.0
N = int(SR * DUR)
rng = np.random.default_rng(1930)


def at(t):
    # Same rounding as every generated signal's length (int(dur * SR)), so envelopes line up.
    return int(t * SR)


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def note(name):
    names = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}
    p, o = name[:-1], int(name[-1])
    return 12 * (o + 1) + names[p]


class Bus:
    def __init__(self, stereo=True):
        self.x = np.zeros((N, 2) if stereo else N, np.float64)

    def add(self, t, sig, gain=1.0, pan=0.0):
        """Add a mono or stereo signal starting at time t (s); pan -1..1 for mono."""
        i = at(t)
        if i >= N or len(sig) == 0:
            return
        if i < 0:
            sig = sig[-i:]
            i = 0
        n = min(len(sig), N - i)
        if sig.ndim == 1:
            l = np.cos((pan + 1) * np.pi / 4)
            r = np.sin((pan + 1) * np.pi / 4)
            self.x[i : i + n, 0] += sig[:n] * gain * l * 1.4142
            self.x[i : i + n, 1] += sig[:n] * gain * r * 1.4142
        else:
            self.x[i : i + n] += sig[:n] * gain


# ---- Building blocks ---------------------------------------------------------------------------

TABLE_N = 4096
_ph = np.arange(TABLE_N) / TABLE_N
SAW = sum(((-1) ** (k + 1)) * np.sin(2 * np.pi * k * _ph) / k for k in range(1, 48))
SAW /= np.abs(SAW).max()


def osc(freq, dur, table=SAW, phase0=None):
    n = int(dur * SR)
    if np.isscalar(freq):
        ph = (np.arange(n) * freq / SR + (rng.random() if phase0 is None else phase0)) % 1
    else:
        ph = (np.cumsum(freq[:n]) / SR + (rng.random() if phase0 is None else phase0)) % 1
    return table[(ph * TABLE_N).astype(np.int64) % TABLE_N]


def lowpass(x, cutoff, order=2):
    sos = butter(order, min(cutoff, SR * 0.45), "low", fs=SR, output="sos")
    return sosfilt(sos, x, axis=0)


def highpass(x, cutoff, order=2):
    sos = butter(order, cutoff, "high", fs=SR, output="sos")
    return sosfilt(sos, x, axis=0)


def bandpass(x, lo, hi, order=2):
    sos = butter(order, [lo, min(hi, SR * 0.45)], "band", fs=SR, output="sos")
    return sosfilt(sos, x, axis=0)


def sweep_filter(x, cutoffs, kind="low", block=512):
    """Filter with a cutoff that changes over time (one value per block)."""
    out = np.zeros_like(x)
    zi = None
    for b in range(0, len(x), block):
        c = float(np.clip(cutoffs[min(b // block, len(cutoffs) - 1)], 30, SR * 0.45))
        bb, aa = butter(2, c, kind, fs=SR)
        if zi is None:
            zi = np.zeros(max(len(aa), len(bb)) - 1)
        out[b : b + block], zi = lfilter(bb, aa, x[b : b + block], zi=zi)
    return out


def adsr(n, a=0.01, d=0.1, s=0.7, r=0.3, hold=None):
    a_n, d_n, r_n = int(a * SR), int(d * SR), int(r * SR)
    h_n = max(0, n - a_n - d_n - r_n) if hold is None else int(hold * SR)
    env = np.concatenate([np.linspace(0, 1, max(a_n, 1)), np.linspace(1, s, max(d_n, 1)), np.full(h_n, s), np.linspace(s, 0, max(r_n, 1))])
    return np.pad(env, (0, max(0, n - len(env))))[:n]


def noise(dur):
    return rng.standard_normal(int(dur * SR))


def tt(dur):
    return np.arange(int(dur * SR)) / SR


# ---- Instruments -------------------------------------------------------------------------------


def pad(freqs, dur, cutoff=1800, attack=1.5, release=2.5, detune=0.11, voices=4, bright=None):
    """A wide, slow pad: detuned saws, filtered, stereo."""
    n = int(dur * SR)
    out = np.zeros((n, 2))
    for f in freqs:
        for v in range(voices):
            cents = (v - (voices - 1) / 2) * detune * 12
            ff = f * 2 ** (cents / 1200)
            s = osc(ff, dur)
            pan = (v / max(voices - 1, 1)) * 2 - 1
            out[:, 0] += s * np.cos((pan * 0.8 + 1) * np.pi / 4)
            out[:, 1] += s * np.sin((pan * 0.8 + 1) * np.pi / 4)
    if bright is None:
        out = lowpass(out, cutoff, 2)
    else:
        cut = np.geomspace(cutoff, bright, max(1, n // 512 + 1))
        out = np.stack([sweep_filter(out[:, 0], cut), sweep_filter(out[:, 1], cut)], axis=1)
    env = adsr(n, attack, 0.2, 1.0, release)
    return out * env[:, None] / (len(freqs) * voices) ** 0.5 * 0.5


def strings(freqs, dur, attack=1.2, release=2.0, cutoff=3200):
    """Bowed, with vibrato: slower and warmer than the pad."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    for f in freqs:
        for v, pan in enumerate((-0.7, 0.0, 0.7)):
            vib = 1 + 0.004 * np.sin(2 * np.pi * (5.2 + v * 0.3) * t + v) * np.clip(t / 1.5, 0, 1)
            s = osc(f * vib * 2 ** ((v - 1) * 0.06 / 12), dur)
            out[:, 0] += s * np.cos((pan + 1) * np.pi / 4)
            out[:, 1] += s * np.sin((pan + 1) * np.pi / 4)
    out = lowpass(out, cutoff, 2)
    out = highpass(out, 90, 1)
    return out * adsr(n, attack, 0.3, 0.9, release)[:, None] / (len(freqs) * 3) ** 0.5 * 0.55


def piano(f, dur=4.0, vel=0.6):
    t = tt(dur)
    out = np.zeros_like(t)
    B = 0.00035
    for k in range(1, 16):
        fk = k * f * np.sqrt(1 + B * k * k)
        if fk > 16000:
            break
        tau = 2.8 / (1 + 0.55 * k) * (300 / f) ** 0.25
        amp = (1 / k**1.15) * (0.6 + 0.4 * vel)
        for det in (-0.6, 0.6):
            out += 0.5 * amp * np.sin(2 * np.pi * fk * 2 ** (det / 1200) * t + rng.random() * 6.28) * np.exp(-t / tau)
    hammer = bandpass(noise(0.02), 800, 5000) * np.linspace(1, 0, int(0.02 * SR)) * 0.05
    out[: len(hammer)] += hammer
    out *= np.clip(t / 0.004, 0, 1)
    return out * vel * 0.32


def bell(f, dur=3.0, vel=0.5):
    t = tt(dur)
    out = np.zeros_like(t)
    for ratio, amp, tau in ((1, 1, 1.6), (2.76, 0.45, 0.8), (5.40, 0.25, 0.45), (8.93, 0.12, 0.25), (2.0, 0.2, 1.2)):
        out += amp * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t / tau)
    return out * np.clip(t / 0.002, 0, 1) * vel * 0.25


def pluck(f, dur=0.9, vel=0.5, bright=1.0):
    t = tt(dur)
    out = np.zeros_like(t)
    for k in range(1, 14):
        if k * f > 14000:
            break
        tau = 0.55 / (1 + 0.6 * k / bright)
        out += (1 / k) * np.sin(2 * np.pi * k * f * t + rng.random()) * np.exp(-t / tau)
    return out * np.clip(t / 0.003, 0, 1) * vel * 0.3


def kick(vel=1.0):
    t = tt(0.6)
    f = 46 + 95 * np.exp(-t / 0.035)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.28)
    click = highpass(noise(0.006), 2000) * 0.15
    s[: len(click)] += click
    return np.tanh(s * 1.6) * vel * 0.6


def boom(dur=4.0, vel=1.0):
    """A big low impact: sub drop, body, air."""
    t = tt(dur)
    f = 36 + 60 * np.exp(-t / 0.08)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 1.4)
    body = lowpass(noise(dur), 260) * np.exp(-t / 0.35) * 0.8
    air = bandpass(noise(dur), 400, 4000) * np.exp(-t / 0.18) * 0.25
    return np.tanh((sub * 1.2 + body + air) * 1.3) * vel * 0.7


def hit(vel=1.0):
    t = tt(2.5)
    tom = np.sin(2 * np.pi * np.cumsum(70 + 50 * np.exp(-t / 0.05)) / SR) * np.exp(-t / 0.5)
    snap = bandpass(noise(2.5), 300, 3500) * np.exp(-t / 0.09) * 0.6
    return np.tanh((tom + snap + kick(0.8)[: len(t)] if len(t) <= len(kick()) else tom + snap) * 1.2) * vel * 0.55


def impact(vel=1.0):
    k = kick(1.0)
    b = boom(2.5, 0.8)
    out = b.copy()
    out[: len(k)] += k
    t = tt(2.5)
    out += bandpass(noise(2.5), 300, 3000) * np.exp(-t / 0.12) * 0.35
    return np.tanh(out * 1.1) * vel * 0.6


def riser(dur=3.0, lo=300, hi=7000, vel=0.5):
    n = int(dur * SR)
    cuts = np.geomspace(lo, hi, n // 512 + 1)
    s = sweep_filter(noise(dur), cuts, "low")
    s = highpass(s, lo * 0.8)
    t = np.arange(n) / SR
    return s * (t / dur) ** 2.2 * vel * 0.4


def whoosh(dur=1.2, up=False, vel=0.5):
    n = int(dur * SR)
    a, b = (250, 3500) if up else (3500, 250)
    cuts = np.geomspace(a, b, n // 512 + 1)
    s = sweep_filter(noise(dur), cuts, "low")
    env = np.sin(np.linspace(0, np.pi, n)) ** 2
    return s * env * vel * 0.5


def reverse_swell(dur=1.6, vel=0.5):
    t = tt(dur)
    s = bandpass(noise(dur), 500, 9000) * (t / dur) ** 3
    return s * vel * 0.35


def click(vel=0.5, f=2400):
    t = tt(0.03)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.006) + highpass(noise(0.03), 3000) * np.exp(-t / 0.002) * 0.4
    return s * vel * 0.4


def key(vel=0.3):
    t = tt(0.04)
    s = bandpass(noise(0.04), 1500 + rng.random() * 2000, 6000) * np.exp(-t / 0.006)
    s += np.sin(2 * np.pi * 180 * t) * np.exp(-t / 0.01) * 0.3
    return s * vel * 0.6


def clack(vel=0.8):
    t = tt(0.25)
    thunk = np.sin(2 * np.pi * np.cumsum(150 + 80 * np.exp(-t / 0.01)) / SR) * np.exp(-t / 0.045)
    metal = bandpass(noise(0.25), 2500, 7000) * np.exp(-t / 0.012) * 0.7
    rattle = bandpass(noise(0.25), 900, 2500) * np.exp(-((t - 0.05) ** 2) / 0.0004) * 0.25
    return (thunk + metal + rattle) * vel * 0.5


def blip(vel=0.5, f=1320):
    t = tt(0.18)
    return (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * f * 2 * t)) * np.exp(-t / 0.04) * vel * 0.18


def typewriter_char(vel=0.6):
    t = tt(0.09)
    s = bandpass(noise(0.09), 1200, 6000) * np.exp(-t / 0.008)
    s += np.sin(2 * np.pi * 220 * t) * np.exp(-t / 0.02) * 0.6
    return s * vel * 0.45


# ---- Reverb ---------------------------------------------------------------------------------------


def make_ir(seconds=3.2, damp=5500):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = np.zeros((n, 2))
    for c in range(2):
        nz = rng.standard_normal(n) * np.exp(-6.9 * t / seconds)
        nz = lowpass(nz, damp, 1)
        ir[:, c] = nz
    # A few early reflections.
    for d, g in ((0.011, 0.5), (0.019, 0.35), (0.027, 0.3), (0.041, 0.22)):
        ir[int(d * SR), 0] += g
        ir[int((d + 0.003) * SR), 1] += g
    return ir / np.sqrt((ir**2).sum(axis=0)).max()


def reverb(x, ir, wet=0.3):
    y = np.stack([fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], axis=1)
    return x * (1 - wet) + y * wet


# ---- The score -------------------------------------------------------------------------------------

DM = [note("D3"), note("A3"), note("D4"), note("F4")]
BB = [note("Bb2"), note("F3"), note("Bb3"), note("D4")]
F_ = [note("F2"), note("C3"), note("F3"), note("A3"), note("C4")]
C_ = [note("C3"), note("G3"), note("C4"), note("E4")]
GM = [note("G2"), note("D3"), note("G3"), note("Bb3")]
A_ = [note("A2"), note("E3"), note("A3"), note("C#4")]
DM9 = [note("D3"), note("A3"), note("E4"), note("F4"), note("A4")]


def F(ns):
    return [midi(m) for m in ns]


def compose(cues, lines):
    mus = Bus()
    rev_send = Bus()

    # 0–15: almost nothing. Air, a low drone arriving, then the freeze.
    air = bandpass(noise(15), 3000, 9000) * 0.012
    air *= np.clip(np.linspace(-0.2, 1.2, len(air)), 0, 1)[: len(air)]
    mus.add(0.0, air * np.r_[np.ones(at(10.7)), np.zeros(len(air) - at(10.7))], pan=0.2)
    drone = sum(np.sin(2 * np.pi * f * tt(10.7)) * a for f, a in ((midi(note("D1")), 0.5), (midi(note("D2")), 0.35), (midi(note("A2")), 0.15)))
    drone *= np.clip((tt(10.7) - 4.5) / 5.0, 0, 1) ** 1.5 * 0.22
    mus.add(0.0, drone)
    # The held tone after the freeze: the moment hangs.
    held = np.sin(2 * np.pi * midi(note("A5")) * tt(4.6)) * adsr(at(4.6) - at(0), 0.02, 0.1, 0.6, 1.8) * 0.035
    mus.add(10.75, held, pan=-0.1)
    rev_send.add(10.75, held * 2)

    # 15–30: the build. Pads open, a pulse starts, the whole sky.
    prog = [(15.0, 3.6, DM), (18.6, 3.5, BB), (22.1, 3.4, F_), (25.5, 2.6, C_), (28.1, 1.95, DM9)]
    for t0, d, ch in prog:
        k = (t0 - 15) / 15
        p = pad(F(ch), d + 1.2, cutoff=500 + 2600 * k, attack=0.6 if t0 > 15 else 2.0, release=1.2, bright=900 + 3600 * k)
        mus.add(t0, p, gain=0.55 + 0.4 * k)
        rev_send.add(t0, p, gain=0.4)
    beat = 60 / 96
    pulse_notes = [note("D3"), note("D4"), note("A3"), note("D4")]
    t = 17.0
    i = 0
    while t < 29.95:
        k = (t - 17) / 13
        root = {0: note("D3"), 1: note("Bb2"), 2: note("F3"), 3: note("C3"), 4: note("D3")}[0 if t < 18.6 else 1 if t < 22.1 else 2 if t < 25.5 else 3 if t < 28.1 else 4]
        m = root + [0, 12, 7, 12][i % 4]
        mus.add(t, pluck(midi(m), 0.6, 0.35 + 0.35 * k, bright=0.6 + 1.5 * k), pan=(-0.4 if i % 2 else 0.4))
        t += beat / 2
        i += 1
    for b in np.arange(23.2, 29.9, beat):
        mus.add(b, kick(0.55 + 0.3 * (b - 23.2) / 6.7))
    mus.add(27.0, riser(3.0, 300, 9000, 0.7))
    mus.add(28.4, reverse_swell(1.6, 0.6))

    # 30–45: close and human. Piano over a low pad; space for the voice.
    lowpad = pad(F([note("D2"), note("A2"), note("F3")]), 15.5, cutoff=700, attack=0.3, release=2.0)
    mus.add(30.0, lowpad, gain=0.6)
    rev_send.add(30.0, lowpad, gain=0.3)
    motif = ["D4", "F4", "A4", "E5", "D5", "A4", "F4", "C5"]
    for j, nm in enumerate(motif * 2):
        tj = 30.15 + j * 0.92
        if tj > 44.5:
            break
        pn = piano(midi(note(nm)), 3.0, 0.42 if j % 4 else 0.55)
        mus.add(tj, pn, pan=(j % 3 - 1) * 0.3)
        rev_send.add(tj, pn, gain=0.8)
    # A ticking, like a clock or a shutter, while the people work.
    for tk in np.arange(30.0, 42.4, beat / 2):
        mus.add(tk, click(0.18 if int((tk - 30) / (beat / 2)) % 2 else 0.28, 3200), pan=0.5)

    # 45–59.3: the swell under the name, and the cut.
    for t0, d, ch in [(44.8, 4.4, BB), (49.2, 2.4, F_), (51.4, 4.2, C_), (55.6, 3.8, DM9)]:
        s = strings(F([m + 12 for m in ch[1:]]), d + 1.5, attack=1.0 if t0 < 50 else 0.4, release=1.4)
        p = pad(F(ch), d + 1.5, cutoff=2400, attack=0.8, release=1.2)
        g = 0.55 if t0 >= 51.4 else 0.42
        mus.add(t0, s, gain=g)
        mus.add(t0, p, gain=g * 0.6)
        rev_send.add(t0, s, gain=0.5)
    for j, nm in enumerate(["A4", "D5", "F5", "E5", "D5", "C5", "A4", "D5"]):
        pn = piano(midi(note(nm)), 3.5, 0.45)
        mus.add(51.5 + j * 0.95, pn, pan=0.15)
        rev_send.add(51.5 + j * 0.95, pn, gain=0.9)
    mus.add(57.7, reverse_swell(1.6, 0.8))

    # 60–73: 1930. A low bowed note under the projector.
    cello = strings(F([note("D2"), note("A2")]), 13.6, attack=1.5, release=0.8, cutoff=1400)
    mus.add(60.2, cello, gain=0.55)
    rev_send.add(60.2, cello, gain=0.4)
    b = bell(midi(note("D5")), 4.0, 0.6)
    mus.add(70.15, b)
    rev_send.add(70.15, b, gain=1.2)

    # 73–90: forward through the decades, into the data.
    for t0, d, ch in [(73.2, 2.9, DM), (76.1, 2.9, BB), (79.0, 2.6, F_), (81.6, 2.6, C_), (84.2, 5.9, DM)]:
        p = pad(F(ch), d + 1.0, cutoff=900 + (t0 - 73) * 140, attack=0.7, release=1.0)
        mus.add(t0, p, gain=0.55)
        rev_send.add(t0, p, gain=0.35)
    t = 79.0
    i = 0
    while t < 90.0:
        root = note("D3") if t < 81.6 else note("C3") if t < 84.2 else note("D3")
        mus.add(t, pluck(midi(root + [0, 12, 7, 12, 15, 12, 7, 12][i % 8]), 0.55, 0.4), pan=(-0.35 if i % 2 else 0.35))
        t += beat / 2
        i += 1
    # The hush before "the scale isn't": a single high tone and the drone.
    hush = np.sin(2 * np.pi * midi(note("A5")) * tt(5.6)) * adsr(at(5.6), 0.4, 0.1, 0.6, 0.6) * 0.03
    mus.add(90.0, hush)
    lowd = np.sin(2 * np.pi * midi(note("D1")) * tt(5.6)) * adsr(at(5.6), 0.4, 0.1, 0.8, 0.3) * 0.18
    mus.add(90.0, lowd)
    mus.add(93.9, riser(1.5, 200, 6000, 0.45))

    # 94.4–105: the scale. A driving minor progression, louder and louder.
    for t0, d, ch in [(95.4, 2.2, DM), (97.6, 2.3, BB), (99.9, 2.3, GM), (102.2, 2.8, A_)]:
        s = strings(F([m + 12 for m in ch]), d + 0.6, attack=0.25, release=0.6)
        p = pad(F(ch), d + 0.6, cutoff=2600, attack=0.2, release=0.6)
        mus.add(t0, s, gain=0.7)
        mus.add(t0, p, gain=0.45)
        rev_send.add(t0, s, gain=0.4)
    t = 95.4
    i = 0
    while t < 104.9:
        root = note("D3") if t < 97 else note("Bb2") if t < 99.6 else note("G2") if t < 102.2 else note("A2")
        mus.add(t, pluck(midi(root + [0, 12, 7, 12][i % 4]), 0.45, 0.55, bright=2.0), pan=(-0.4 if i % 2 else 0.4))
        if i % 4 == 0:
            mus.add(t, kick(0.75))
        t += beat / 2
        i += 1
    mus.add(103.3, riser(1.7, 400, 9000, 0.6))

    # 105–116.6: by hand. Sparse piano, a tension that never resolves; then everything stops.
    p = pad(F([note("D2"), note("A2"), note("Eb3")]), 11.8, cutoff=900, attack=1.0, release=0.4)
    mus.add(105.0, p, gain=0.55)
    rev_send.add(105.0, p, gain=0.4)
    for j, nm in enumerate(["D5", "A4", "Eb5", "D5", "A4", "F4", "Eb4", "D4"]):
        pn = piano(midi(note(nm)), 2.6, 0.38)
        mus.add(105.2 + j * 1.35, pn, pan=-0.2)
        rev_send.add(105.2 + j * 1.35, pn, gain=0.9)
    hi = strings(F([note("A5"), note("Bb5")]), 5.0, attack=3.0, release=0.2, cutoff=6000)
    mus.add(111.5, hi, gain=0.35)
    # The dot: one pure tone, alone.
    dot = np.sin(2 * np.pi * midi(note("D6")) * tt(3.6)) * adsr(at(3.6), 0.3, 0.2, 0.7, 1.0) * 0.03
    mus.add(116.6, dot)
    rev_send.add(116.6, dot, gain=2)

    # 120–180: the demo. A light, positive groove in F, out of the way of the voice.
    groove = [(F_, "F2"), (C_, "C3"), (DM, "D3"), (BB, "Bb2")]
    bar = 4 * 60 / 100
    t0 = 120.4
    k = 0
    while t0 < 179.5:
        ch, bass = groove[k % 4]
        d = min(bar, 180.0 - t0)
        p = pad(F(ch), d + 0.8, cutoff=1500, attack=0.25 if k else 1.0, release=0.8, voices=3)
        mus.add(t0, p, gain=0.42)
        rev_send.add(t0, p, gain=0.25)
        for s16 in range(8):
            ts = t0 + s16 * bar / 8
            if ts >= 179.6:
                break
            m = note(bass) + [12, 19, 24, 19, 12, 19, 24, 31][s16]
            mus.add(ts, pluck(midi(m), 0.35, 0.28 if s16 % 2 else 0.36, bright=1.4), pan=(0.45 if s16 % 2 else -0.45))
        for bt in range(4):
            tb = t0 + bt * bar / 4
            if bt % 2 == 0 and tb < 179.6:
                mus.add(tb, kick(0.42))
            if tb < 179.6:
                mus.add(tb + bar / 8, highpass(noise(0.05), 7000) * np.exp(-tt(0.05) / 0.012) * 0.05, pan=0.3)
        t0 += bar
        k += 1

    # 180–188: stay on the discovery. 188–212: every generation; the swell.
    p = pad(F(DM9), 8.6, cutoff=1400, attack=1.2, release=1.5)
    mus.add(180.0, p, gain=0.5)
    rev_send.add(180.0, p, gain=0.5)
    for j, nm in enumerate(["A4", "D5", "E5", "A4"]):
        pn = piano(midi(note(nm)), 3.0, 0.4)
        mus.add(180.4 + j * 1.6, pn)
        rev_send.add(180.4 + j * 1.6, pn, gain=0.9)
    insp = [(188.4, 3.7, BB), (192.1, 3.6, F_), (195.7, 3.4, C_), (199.1, 3.5, DM), (202.6, 1.9, BB), (204.5, 3.6, F_), (208.1, 3.9, C_)]
    for idx, (t0, d, ch) in enumerate(insp):
        k = idx / (len(insp) - 1)
        s = strings(F([m + 12 for m in ch[1:]]), d + 1.2, attack=0.9 - 0.5 * k, release=1.0)
        p = pad(F(ch), d + 1.2, cutoff=1200 + 2600 * k, attack=0.5, release=1.0)
        mus.add(t0, s, gain=0.45 + 0.4 * k)
        mus.add(t0, p, gain=0.35 + 0.25 * k)
        rev_send.add(t0, s, gain=0.45)
    arp = ["F4", "A4", "C5", "F5", "C5", "A4"]
    ta = 188.6
    j = 0
    while ta < 211.8:
        root_shift = 0 if ta < 192.1 else -5 if ta < 195.7 else 2 if ta < 199.1 else -3 if ta < 202.6 else 0 if ta < 208.1 else 2
        pn = piano(midi(note(arp[j % 6]) + root_shift), 2.2, 0.32 + 0.12 * ((ta - 188) / 24))
        mus.add(ta, pn, pan=(j % 3 - 1) * 0.35)
        rev_send.add(ta, pn, gain=0.7)
        ta += beat / 2 if ta > 199 else beat
        j += 1
    for b in np.arange(204.5, 211.9, beat):
        mus.add(b, kick(0.5))

    # 212–221.4: the advertisement. Driving, then black.
    for t0, d, ch in [(212.0, 1.6, DM), (213.6, 1.8, BB), (215.4, 2.0, F_), (217.4, 1.8, C_), (219.2, 2.2, DM9)]:
        s = strings(F([m + 12 for m in ch]), d + 0.3, attack=0.08, release=0.3)
        p = pad(F(ch), d + 0.3, cutoff=3000, attack=0.05, release=0.3)
        mus.add(t0, s, gain=0.5)
        mus.add(t0, p, gain=0.32)
        rev_send.add(t0, s, gain=0.3)
    t = 212.0
    i = 0
    while t < 221.35:
        root = note("D3") if t < 213.6 else note("Bb2") if t < 215.4 else note("F3") if t < 217.4 else note("C3") if t < 219.2 else note("D3")
        mus.add(t, pluck(midi(root + [0, 12, 7, 12][i % 4]), 0.4, 0.4, bright=1.6), pan=(-0.4 if i % 2 else 0.4))
        if i % 2 == 0:
            mus.add(t, kick(0.5))
        t += beat / 2
        i += 1
    mus.add(219.8, riser(1.6, 400, 10000, 0.6))

    # 221.6–232.6: the dot again; then the whole sky; then the name.
    p = pad(F([note("D3"), note("A3"), note("E4")]), 6.2, cutoff=1100, attack=0.8, release=1.2)
    mus.add(221.7, p, gain=0.5)
    rev_send.add(221.7, p, gain=0.5)
    b = bell(midi(note("A5")), 3.0, 0.5)
    mus.add(224.62, b)
    rev_send.add(224.62, b, gain=1.2)
    for t0, d, ch in [(227.6, 2.6, BB), (230.2, 2.7, C_)]:
        s = strings(F([m + 12 for m in ch]), d + 1.0, attack=0.6, release=0.8)
        mus.add(t0, s, gain=0.7)
        mus.add(t0, pad(F(ch), d + 1.0, cutoff=3000, attack=0.4, release=0.8), gain=0.5)
        rev_send.add(t0, s, gain=0.5)
    mus.add(231.2, riser(1.7, 300, 10000, 0.6))
    fin = strings(F([note("D3"), note("A3"), note("D4"), note("E4"), note("F4"), note("A4")]), 5.6, attack=0.05, release=3.6)
    finpad = pad(F(DM9), 5.6, cutoff=3200, attack=0.05, release=3.6)
    mus.add(232.9, fin, gain=0.85)
    mus.add(232.9, finpad, gain=0.6)
    rev_send.add(232.9, fin, gain=0.9)
    pn = piano(midi(note("D3")), 5.0, 0.6) + piano(midi(note("A3")), 5.0, 0.4)
    mus.add(232.9, pn)
    rev_send.add(232.9, pn, gain=1.0)
    return mus, rev_send


# ---- Effects on the picture's cues --------------------------------------------------------------------

PENTA = [note(n) for n in ("D6", "F6", "G6", "A6", "C7", "D7", "F7")]


def effects(cues):
    fx = Bus()
    send = Bus()
    for c in cues:
        t, kind, g = c["t"], c["kind"], c.get("gain", 1.0)
        if kind == "ping":
            s = bell(midi(PENTA[int(rng.integers(len(PENTA)))]), 2.0, 0.35 * g)
            fx.add(t, s, pan=rng.uniform(-0.7, 0.7))
            send.add(t, s, gain=1.5)
        elif kind == "blip":
            s = blip(0.7 * g, 1046)
            fx.add(t, s, pan=-0.2)
            send.add(t, s, gain=0.8)
        elif kind == "freeze":
            fx.add(t - 1.2, reverse_swell(1.2, 0.5 * g))
        elif kind == "data":
            for j in range(10):
                fx.add(t + j * 0.045, blip(0.25 * g, 1500 + rng.random() * 2500), pan=rng.uniform(-0.6, 0.6))
        elif kind in ("whoosh-out", "whoosh-in"):
            s = whoosh(1.6, up=kind == "whoosh-in", vel=0.7 * g)
            fx.add(t, s, pan=0)
            send.add(t, s, gain=0.4)
        elif kind == "title-hit":
            s = impact(0.8 * g)
            fx.add(t, s)
            send.add(t, s, gain=0.9)
            fx.add(t - 1.2, reverse_swell(1.2, 0.45 * g))
        elif kind == "sweep":
            fx.add(t, whoosh(1.4, up=True, vel=0.35 * g), pan=-0.3)
        elif kind == "fan":
            for j, m in enumerate(("D5", "F5", "A5", "C6", "D6", "F6")):
                s = bell(midi(note(m)), 2.2, 0.3 * g)
                fx.add(t + 0.25 + j * 0.13, s, pan=-0.6 + j * 0.24)
                send.add(t + 0.25 + j * 0.13, s, gain=1.2)
        elif kind == "cut-hit":
            s = impact(0.9 * g)
            fx.add(t, s)
            send.add(t, s, gain=0.7)
        elif kind == "cut-soft":
            fx.add(t, whoosh(0.35, vel=0.3 * g), pan=0.2)
        elif kind == "cut-black":
            s = boom(3.0, 0.85 * g)
            fx.add(t, s)
            send.add(t, s, gain=0.5)
        elif kind == "gather":
            for j in range(26):
                tj = t + 2.1 * (j / 26) ** 0.8
                s = bell(midi(PENTA[j % len(PENTA)] - 12 + (12 if j > 13 else 0)), 1.2, 0.12 * g)
                fx.add(tj, s, pan=rng.uniform(-0.8, 0.8))
                send.add(tj, s, gain=1.2)
            fx.add(t, riser(2.1, 500, 9000, 0.4 * g))
        elif kind == "projector":
            d = c.get("until", t + 13) - t
            nz = bandpass(noise(d), 700, 3200)
            flutter = 0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 24 * tt(d)))
            hum = sum(np.sin(2 * np.pi * f * tt(d)) * a for f, a in ((60, 0.5), (120, 0.3), (180, 0.15)))
            env = np.clip(tt(d) / 0.4, 0, 1) * np.clip((d - tt(d)) / 0.6, 0, 1)
            fx.add(t, (nz * flutter * 0.045 + hum * 0.02) * env * g, pan=0.15)
        elif kind == "clack":
            s = clack(0.8 * g)
            fx.add(t, s, pan=-0.15)
            send.add(t, s, gain=0.3)
        elif kind == "ink":
            d = 1.0
            s = bandpass(noise(d), 2000, 8000) * np.abs(np.sin(2 * np.pi * 7 * tt(d))) * np.exp(-tt(d) / 0.5) * 0.08
            fx.add(t, s * g)
        elif kind == "typewriter":
            n, cps = c.get("n", 5), c.get("cps", 10)
            for j in range(n):
                fx.add(t + j / cps + rng.uniform(-0.01, 0.01), typewriter_char(0.55 * g * rng.uniform(0.7, 1.0)), pan=rng.uniform(-0.2, 0.2))
        elif kind == "tick":
            s = np.sin(2 * np.pi * 1250 * tt(0.06)) * np.exp(-tt(0.06) / 0.012) * 0.25 * g
            fx.add(t, s, pan=0.25)
        elif kind == "shutter":
            fx.add(t, highpass(noise(0.02), 2000) * 0.3 * g, pan=-0.2)
            fx.add(t + 0.07, highpass(noise(0.03), 1500) * 0.22 * g, pan=-0.2)
        elif kind == "boom":
            s = boom(5.0, 1.0 * g)
            fx.add(t, s)
            send.add(t, s, gain=0.8)
            fx.add(t - 1.4, reverse_swell(1.4, 0.6))
        elif kind == "scroll":
            for j in range(8):
                fx.add(t + j * 0.05, click(0.12 * g, 1800), pan=0.3)
        elif kind == "click":
            fx.add(t, click(0.55 * g), pan=0.1)
        elif kind == "key":
            fx.add(t, key(0.55 * g), pan=0.05)
        elif kind == "open":
            s = whoosh(1.3, up=True, vel=0.5)
            fx.add(t, s)
            b = bell(midi(note("A5")), 2.0, 0.3)
            fx.add(t + 0.9, b)
            send.add(t + 0.9, b, gain=1.0)
        elif kind == "swish":
            fx.add(t - 0.15, whoosh(0.45, up=True, vel=0.25 * g), pan=0.3)
        elif kind == "chime":
            for j, m in enumerate(("A5", "E6")):
                s = bell(midi(note(m)), 2.0, 0.3 * g)
                fx.add(t + j * 0.09, s, pan=0.2)
                send.add(t + j * 0.09, s, gain=1.0)
        elif kind == "draw":
            d = 1.1
            s = bandpass(noise(d), 2500, 9000) * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 5 * tt(d)))) * np.sin(np.linspace(0, np.pi, at(d))) * 0.05
            fx.add(t, s * g, pan=rng.uniform(-0.3, 0.3))
        elif kind == "unfold":
            s = whoosh(1.8, up=True, vel=0.6 * g)
            fx.add(t, s)
            send.add(t, s, gain=0.6)
        elif kind == "people":
            d = c.get("until", t + 3) - t
            for j in range(70):
                tj = t + d * (j / 70) ** 0.7
                s = bell(midi(PENTA[int(rng.integers(len(PENTA)))]), 1.0, 0.07 * g)
                fx.add(tj, s, pan=rng.uniform(-0.9, 0.9))
                send.add(tj, s, gain=1.2)
        elif kind == "lock":
            fx.add(t, blip(0.6, 1568), pan=0.2)
            fx.add(t + 0.08, blip(0.6, 2093), pan=0.2)
            s = hit(0.5)
            fx.add(t + 0.02, s)
            send.add(t + 0.02, s, gain=0.5)
    return fx, send


# ---- Narration and the mix ------------------------------------------------------------------------------


def narration(lines):
    vo = Bus()
    mask = np.zeros(N)
    for ln in lines:
        x, sr = sf.read(FILM / "build" / "vo" / f"{ln['id']}.wav")
        assert sr == SR
        if x.ndim > 1:
            x = x.mean(axis=1)
        # A touch of presence and warmth.
        x = x + 0.25 * highpass(x, 2500, 1)
        x = highpass(x, 80, 2)
        vo.add(ln["at"], x, gain=1.0)
        a, b = at(ln["at"] - 0.12), at(ln["end"] + 0.25)
        mask[max(a, 0) : min(b, N)] = 1
    # Smooth the ducking: quick to dip, slow to recover.
    win = np.hanning(int(0.35 * SR))
    win /= win.sum()
    duck = np.convolve(mask, win, mode="same")
    return vo, np.clip(duck, 0, 1)


def loudness_rms(x):
    return 20 * np.log10(np.sqrt(np.mean(x**2)) + 1e-12)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    cues = json.loads((FILM / "build" / "cues.json").read_text())
    lines = json.loads((FILM / "build" / "vo" / "lines.json").read_text())
    print("· score")
    mus, mus_send = compose(cues, lines)
    print("· effects")
    fx, fx_send = effects(cues)
    print("· narration")
    vo, duck = narration(lines)
    print("· reverb")
    ir = make_ir(3.4)
    wet = np.stack([fftconvolve((mus_send.x + fx_send.x)[:, c], ir[:, c])[:N] for c in range(2)], axis=1) * 0.22
    music = mus.x + wet
    # Hard silences: the cuts to black and the freeze leave nothing ringing.
    gate = np.ones(N)
    for a, b in ((10.72, 10.76), (59.3, 60.0), (116.55, 116.62), (221.4, 221.62)):
        ia, ib = at(a), at(b)
        gate[ia:ib] = 0
        r = int(0.02 * SR)
        gate[max(ia - r, 0) : ia] = np.linspace(1, 0, ia - max(ia - r, 0))
    # After the freeze in the opening, only the held tone (which starts after the gate).
    music *= gate[:, None]
    music *= (1 - 0.78 * duck)[:, None]
    fxx = fx.x * gate[:, None] * (1 - 0.55 * duck)[:, None]
    sf.write(OUT / "music.wav", music.astype(np.float32), SR)
    sf.write(OUT / "fx.wav", fxx.astype(np.float32), SR)
    sf.write(OUT / "vo.wav", vo.x.astype(np.float32), SR)
    mix = music * 0.9 + fxx * 0.85 + vo.x
    # Gentle bus compression and a soft limiter.
    peak = np.abs(mix).max()
    mix = np.tanh(mix / max(peak, 1e-9) * 1.4) / np.tanh(1.4) * 0.95
    fade = np.ones(N)
    fade[at(237.2) :] = np.linspace(1, 0, N - at(237.2)) ** 2
    mix *= fade[:, None]
    sf.write(OUT / "mix_pre.wav", mix.astype(np.float32), SR)
    # The same film without the voice, for a team that narrates live or records its own take.
    bed = music * 0.9 + fxx * 0.85
    bed = np.tanh(bed / max(np.abs(bed).max(), 1e-9) * 1.4) / np.tanh(1.4) * 0.95
    bed *= fade[:, None]
    sf.write(OUT / "bed_pre.wav", bed.astype(np.float32), SR)
    for name, a, b in (("Q1", 0, 60), ("Q2", 60, 120), ("Q3", 120, 180), ("Q4", 180, 238)):
        print(f"  {name}: music {loudness_rms(music[at(a):at(b)]):6.1f} dB  fx {loudness_rms(fxx[at(a):at(b)]):6.1f} dB  vo {loudness_rms(vo.x[at(a):at(b)]):6.1f} dB  mix {loudness_rms(mix[at(a):at(b)]):6.1f} dB")
    print("✓", OUT / "mix_pre.wav")


if __name__ == "__main__":
    main()
