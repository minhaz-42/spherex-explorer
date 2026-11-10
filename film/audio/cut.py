"""Sound for a cut other than the main film: CUT=short (the 30-second film) or CUT=demo (the app
demonstration). Each has its own music on its own clock, written from the "music" sections in
cuts/<cut>/edit.json; the effects follow the picture's cues (build/<cut>/cues.json, exported by
`render.mjs cues --cut <cut>`); the narration, if the cut has any, comes from build/<cut>/vo. The
mix is score.py's: the same instruments, reverb, ducking and limiter.

Writes build/<cut>/audio/{music,fx,vo}.wav, mix_pre.wav and bed_pre.wav (for master.py).

Music sections, each {"at", "dur", "kind", "level"?}:
  air     a low fifth and a high shimmer, for an opening that should breathe
  groove  the demo's groove in F (F, C, Dm, Bb at 100 bpm): pad, plucks, a soft kick, a hat
  end     a landing chord for the name, bells, and a long release
"""

import json
import os

import numpy as np
import soundfile as sf
from scipy.signal import fftconvolve

import score as S

CUT = os.environ["CUT"]
B = S.FILM / "build" / CUT
OUT = B / "audio"
SR = S.SR
BAR = 4 * 60 / 100


def the_cut():
    edit = json.loads((S.FILM / "cuts" / CUT / "edit.json").read_text())
    t = 0.0
    for p in edit["pieces"]:
        p.setdefault("dur", (p["src"][1] - p["src"][0]) if "src" in p else 0)
        p["at"] = t
        t += p["dur"]
    return edit, t


def air(mus, send, t0, dur, level):
    low = S.pad(S.F([S.note("D2"), S.note("A2"), S.note("D3")]), dur + 1.0, cutoff=650, attack=0.6, release=1.2)
    mus.add(t0, low, gain=0.55 * level)
    send.add(t0, low, gain=0.3 * level)
    hi = S.strings(S.F([S.note("A5"), S.note("D6")]), dur + 0.6, attack=dur * 0.6, release=0.6, cutoff=6000)
    mus.add(t0, hi, gain=0.18 * level)
    send.add(t0, hi, gain=0.4 * level)


def groove(mus, send, t0, dur, level):
    chords = [(S.F_, "F2"), (S.C_, "C3"), (S.DM, "D3"), (S.BB, "Bb2")]
    end = t0 + dur
    k = 0
    tb = t0
    while tb < end - 0.05:
        ch, bass = chords[k % 4]
        d = min(BAR, end - tb)
        p = S.pad(S.F(ch), d + 0.8, cutoff=1500, attack=0.25 if k else 0.6, release=0.8, voices=3)
        mus.add(tb, p, gain=0.42 * level)
        send.add(tb, p, gain=0.25 * level)
        for s16 in range(8):
            ts = tb + s16 * BAR / 8
            if ts >= end - 0.05:
                break
            m = S.note(bass) + [12, 19, 24, 19, 12, 19, 24, 31][s16]
            mus.add(ts, S.pluck(S.midi(m), 0.35, (0.28 if s16 % 2 else 0.36) * level, bright=1.4), pan=(0.45 if s16 % 2 else -0.45))
        for bt in range(4):
            tk = tb + bt * BAR / 4
            if tk >= end - 0.05:
                break
            if bt % 2 == 0:
                mus.add(tk, S.kick(0.42 * level))
            mus.add(tk + BAR / 8, S.highpass(S.noise(0.05), 7000) * np.exp(-S.tt(0.05) / 0.012) * 0.05 * level, pan=0.3)
        tb += BAR
        k += 1


def landing(mus, send, fx, t0, dur, level):
    s = S.impact(0.4 * level)
    fx.add(t0, s)
    send.add(t0, s, gain=0.5)
    ch = [S.note("F2"), S.note("C3"), S.note("F3"), S.note("A3"), S.note("G4"), S.note("C5")]
    st = S.strings(S.F(ch[2:]), dur + 1.5, attack=0.4, release=2.0)
    pd = S.pad(S.F(ch), dur + 1.5, cutoff=2200, attack=0.3, release=2.0)
    mus.add(t0, st, gain=0.45 * level)
    mus.add(t0, pd, gain=0.35 * level)
    send.add(t0, st, gain=0.5 * level)
    for j, m in enumerate(("F5", "A5", "C6", "G6")):
        b = S.bell(S.midi(S.note(m)), 3.0, 0.2 * level)
        mus.add(t0 + 0.15 + j * 0.08, b, pan=-0.3 + j * 0.2)
        send.add(t0 + 0.15 + j * 0.08, b, gain=1.4)


def compose(edit, n):
    mus, send, fx = S.Bus(n=n), S.Bus(n=n), S.Bus(n=n)
    for sec in edit.get("music", []):
        t0, dur, level = sec["at"], sec["dur"], sec.get("level", 1.0)
        if sec["kind"] == "air":
            air(mus, send, t0, dur, level)
        elif sec["kind"] == "groove":
            groove(mus, send, t0, dur, level)
        elif sec["kind"] == "end":
            landing(mus, send, fx, t0, dur, level)
    return mus, send, fx


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    edit, dur = the_cut()
    n = int(SR * dur)
    cues = json.loads((B / "cues.json").read_text())
    lines_path = B / "vo" / "lines.json"
    lines = json.loads(lines_path.read_text()) if lines_path.exists() else []
    print(f"· {CUT}: {dur:.2f} s, {len(cues)} cues, {len(lines)} lines")
    mus, send, new_fx = compose(edit, n)
    fx_src, fx_send = S.effects(cues)
    vo, duck = S.narration(lines, n, B / "vo")
    ir = S.make_ir(3.4)
    sends = send.x + fx_send.x[:n]
    wet = np.stack([fftconvolve(sends[:, c], ir[:, c])[:n] for c in range(2)], axis=1) * 0.22
    music = mus.x + wet
    fxx = fx_src.x[:n] + new_fx.x
    music *= (1 - 0.78 * duck)[:, None]
    fxx *= (1 - 0.55 * duck)[:, None]
    sf.write(OUT / "music.wav", music.astype(np.float32), SR)
    sf.write(OUT / "fx.wav", fxx.astype(np.float32), SR)
    sf.write(OUT / "vo.wav", vo.x.astype(np.float32), SR)
    fade = np.ones(n)
    fade[S.at(dur - 0.8) :] = np.linspace(1, 0, n - S.at(dur - 0.8)) ** 2

    def limit(x):
        return np.tanh(x / max(np.abs(x).max(), 1e-9) * 1.4) / np.tanh(1.4) * 0.95 * fade[:, None]

    sf.write(OUT / "mix_pre.wav", limit(music * 0.9 + fxx * 0.85 + vo.x).astype(np.float32), SR)
    sf.write(OUT / "bed_pre.wav", limit(music * 0.9 + fxx * 0.85).astype(np.float32), SR)
    print(f"  music {S.loudness_rms(music):6.1f} dB  fx {S.loudness_rms(fxx):6.1f} dB  vo {S.loudness_rms(vo.x):6.1f} dB")
    print(f"✓ {OUT / 'mix_pre.wav'}  ({dur:.2f} s)")


if __name__ == "__main__":
    main()
