#!/usr/bin/env python3
"""Chaupal's own score, composed and synthesised here in numpy: no samples, no SoundFont, nothing licensed, nothing a
recording could match (Content ID cannot claim it).

One continuous theme in raag Bhupali (an evening raag; pentatonic S R G P D, just intonation) with Sa = D:
  - tanpura   additive strings with a jawari "bloom" (a formant sweeping up the partials), Pa-Sa-Sa-Sa, from frame 1
  - bansuri   breathy additive flute with vibrato and meend (glides): free alaap over the story, the tune in the recap
  - santoor   hammered strings (three detuned strings per course, stretched partials): enters on the turn, carries
              the gat (the composed tune) through the product
  - tabla     modal dayan (tuned to Sa) + bayan with the wrist glide: keherwa (8 beats) under the product, sparse
              under the architecture, full with fills in the recap
Arc: alaap -> santoor enters on "Chaupal" -> keherwa under the hero -> one silent beat before the move lands ->
lighter under the guard and the stack -> build into the proof -> the lift for the recap -> resolve on Sa, tanpura alone.

  python3 video/music.py [--out PATH] [--preview SECONDS]
Times come from video/narration/timeline.json (real scene starts) when it exists, else video/sound_map.json.
Output: /home/prashant/projects/.chaupal-work/film/audio/music.wav (48 kHz stereo, peak -1 dBFS)
"""
from __future__ import annotations

import json
import sys
import wave
from pathlib import Path

import numpy as np

SR = 48000
HERE = Path(__file__).resolve().parent
OUT_DEFAULT = Path("/home/prashant/projects/.chaupal-work/film/audio/music.wav")
SA = 146.83  # D3
RATIO = {"S": 1.0, "R": 9 / 8, "G": 5 / 4, "m": 4 / 3, "P": 3 / 2, "D": 5 / 3, "N": 15 / 8}
BPM = 84
BEAT = 60 / BPM
rng = np.random.default_rng(1947)


def hz(sw: str) -> float:
    """'S' madhya Sa, "S'" taar Sa, 'D.' mandra Dha, "G''" two octaves up."""
    base = RATIO[sw[0]] * SA
    for ch in sw[1:]:
        base *= 2 if ch == "'" else 0.5 if ch == "." else 1
    return base


# ---------------------------------------------------------------- instruments (all return mono float64 arrays)

def santoor(f0: float, dur: float = 2.6, vel: float = 0.7) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    B = 0.00035  # inharmonicity of a thin steel string
    for det in (-2.2, 0.0, 2.6):  # three strings per course, a few cents apart
        f = f0 * 2 ** (det / 1200)
        for k in range(1, 14):
            fk = f * k * np.sqrt(1 + B * k * k)
            if fk > 12000:
                break
            amp = (1 / k ** 0.9) * (0.55 + 0.45 * np.cos(k * 0.9))  # hammer position comb
            dec = 1.8 / (1 + 0.22 * k)  # high partials die first
            y += amp * np.sin(2 * np.pi * fk * t + k) * np.exp(-t / dec)
    click = rng.standard_normal(min(n, 300)) * np.exp(-np.arange(min(n, 300)) / 40)
    y[: len(click)] += click * 0.6
    att = np.minimum(1, t / 0.002)
    return y * att * vel / 6.0


def tanpura(f0: float, dur: float = 5.0, vel: float = 0.5) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    centre = 3 + 13 * (1 - np.exp(-t / 1.4))  # the jawari bloom climbs the partials
    for k in range(1, 34):
        fk = f0 * k
        if fk > 9000:
            break
        bloom = 1 + 2.4 * np.exp(-((k - centre) / 2.8) ** 2)
        y += (min(1.0, 0.45 + 0.3 * k) / k ** 0.75) * bloom * np.sin(2 * np.pi * fk * t + 0.37 * k) * np.exp(-t / (4.2 / (1 + 0.04 * k)))
    att = np.minimum(1, t / 0.01)
    rel = np.clip((dur - t) / 0.4, 0, 1)
    return y * att * rel * vel / 14.0


def bansuri(notes: list[tuple[str, float]], vel: float = 0.5, glide: float = 0.12) -> np.ndarray:
    """A legato phrase: [(swara, seconds), ...], '-' = rest. Glides between notes (meend), vibrato on long notes."""
    total = sum(d for _, d in notes)
    n = int(total * SR) + SR
    f = np.zeros(n)
    a = np.zeros(n)
    pos = 0
    prev = None
    for sw, d in notes:
        m = int(d * SR)
        if sw == "-":
            pos += m
            prev = None
            continue
        target = hz(sw) * 2  # bansuri sounds an octave above the santoor's register
        seg = np.full(m, target)
        if prev is not None:
            g = min(int(glide * SR), m // 2)
            seg[:g] = prev + (target - prev) * (0.5 - 0.5 * np.cos(np.linspace(0, np.pi, g)))
        tt = np.arange(m) / SR
        vib = 1 + 0.006 * np.minimum(1, tt / 0.6) * np.sin(2 * np.pi * 5.2 * tt)
        f[pos:pos + m] = seg * vib
        env = np.minimum(1, tt / 0.07) * np.clip((d - tt) / 0.12, 0, 1) if prev is None else np.clip((d - tt) / 0.12, 0, 1)
        env = np.maximum(env, 0) * (0.85 + 0.15 * np.sin(np.pi * np.clip(tt / max(d, 1e-3), 0, 1)))
        a[pos:pos + m] = env
        prev = target
        pos += m
    a = np.convolve(a, np.ones(480) / 480, mode="same")  # smooth note joins
    phase = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(phase) + 0.22 * np.sin(2 * phase + 0.4) + 0.07 * np.sin(3 * phase + 1.1) + 0.03 * np.sin(4 * phase)
    breath = rng.standard_normal(n)
    breath = np.convolve(breath, np.hanning(64) / 32, mode="same")
    y = (y + 0.10 * breath) * a
    return y * vel * 0.35


def tabla_stroke(kind: str, vel: float = 0.7) -> np.ndarray:
    n = int(1.2 * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    d0 = SA * 2  # dayan tuned to madhya Sa an octave up (D4)

    def dayan(partials, decays, amps):
        out = np.zeros(n)
        for p, dc, am in zip(partials, decays, amps):
            out += am * np.sin(2 * np.pi * d0 * p * t) * np.exp(-t / dc)
        return out

    def bayan(open_=True):
        if not open_:
            nz = rng.standard_normal(n) * np.exp(-t / 0.018)
            return np.convolve(nz, np.hanning(90) / 45, mode="same") * 0.8
        fb = 88 + 26 * (1 - np.exp(-t / 0.12))  # the wrist pushes the pitch up
        ph = 2 * np.pi * np.cumsum(fb) / SR
        return (np.sin(ph) * np.exp(-t / 0.55) + 0.3 * np.sin(2 * ph) * np.exp(-t / 0.2)) * 1.1

    slap = rng.standard_normal(n) * np.exp(-t / 0.004) * 0.25
    if kind in ("na", "ta"):
        y = dayan([1, 2, 3, 4, 5.02], [0.5, 0.32, 0.2, 0.12, 0.08], [0.6, 0.8, 0.5, 0.3, 0.2]) + slap
    elif kind == "tin":
        y = dayan([1, 2, 3, 4], [0.12, 0.35, 0.22, 0.12], [0.2, 0.7, 0.6, 0.3]) + slap
    elif kind in ("ti", "ra", "te"):
        y = dayan([1, 2, 3], [0.05, 0.04, 0.03], [0.5, 0.4, 0.3]) + slap * 1.3
    elif kind == "ge":
        y = bayan(True)
    elif kind in ("ka", "ke"):
        y = bayan(False)
    elif kind == "dha":
        y = tabla_stroke("na", 1) / 1 + tabla_stroke("ge", 1)
    elif kind == "dhi":
        y = tabla_stroke("tin", 1) + tabla_stroke("ge", 1)
    return y * vel


TABLA_CACHE: dict = {}


def tabla(kind: str, vel: float) -> np.ndarray:
    if kind not in TABLA_CACHE:
        TABLA_CACHE[kind] = tabla_stroke(kind, 1.0)
    return TABLA_CACHE[kind] * vel


# ---------------------------------------------------------------- the arrangement

def times() -> dict:
    """Scene starts (s) and the film's length, from the voice timeline when it exists."""
    tl = HERE / "narration" / "timeline.json"
    sm = json.loads((HERE / "sound_map.json").read_text())
    h = sm["hits"]
    out = {"turn": h["turn"], "hero": 38.0, "silence": h["silence"], "landing": h["landing"], "sulekh": 60.0,
           "guard": 95.0, "hood": 111.0, "proof": 133.0, "recap": h["recap"], "close": h["end"], "end": sm["duration"]}
    if tl.exists():
        d = json.loads(tl.read_text())
        sc = {s["id"]: s for s in d.get("scenes", [])}
        lines = {l["id"]: l for l in d.get("lines", [])}
        for k in ("turn", "hero", "sulekh", "guard", "hood", "proof", "recap", "close"):
            if k in sc:
                out[k] = sc[k]["start"]
        if "h3" in lines:
            out["silence"] = lines["h3"]["start"] - 0.95
            out["landing"] = lines["h3"]["start"] + 0.05
        out["end"] = d.get("duration", out["end"])
    cues = HERE / "data" / "music_cues.json"  # written by make_film.py from capture events (exact landing frame)
    if cues.exists():
        out.update(json.loads(cues.read_text()))
    return out


class Track:
    def __init__(self, seconds: float):
        self.n = int(seconds * SR) + 6 * SR
        self.L = np.zeros(self.n, dtype=np.float32)
        self.R = np.zeros(self.n, dtype=np.float32)

    def add(self, x: np.ndarray, at: float, gain: float = 1.0, pan: float = 0.0):
        i = int(at * SR)
        if i >= self.n or i + len(x) <= 0:
            return
        x = x[: self.n - i]
        lg, rg = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        self.L[i:i + len(x)] += (x * gain * lg * 1.414).astype(np.float32)
        self.R[i:i + len(x)] += (x * gain * rg * 1.414).astype(np.float32)


def reverb(x: np.ndarray, seed: int, decay: float = 2.0, wet: float = 0.28) -> np.ndarray:
    r = np.random.default_rng(seed)
    m = int(decay * SR)
    ir = r.standard_normal(m) * np.exp(-np.arange(m) / SR * 6.9 / decay)
    ir = np.convolve(ir, np.ones(24) / 24, mode="same")  # darker tail
    ir /= np.sqrt(np.sum(ir ** 2))
    block = 1 << 17
    nfft = 1 << int(np.ceil(np.log2(block + m)))
    IR = np.fft.rfft(ir, nfft)
    out = np.zeros(len(x) + m, dtype=np.float32)
    for s in range(0, len(x), block):
        seg = x[s:s + block]
        y = np.fft.irfft(np.fft.rfft(seg, nfft) * IR, nfft)[: len(seg) + m]
        out[s:s + len(y)] += y
    return x + np.float32(wet) * out[: len(x)]


def gain_at(t: float, T: dict) -> float:
    """Section level for the santoor/tabla bed."""
    if T["silence"] <= t < T["landing"]:
        return 0.0
    if t < T["hero"]:
        return 0.7
    if t < T["guard"]:
        return 0.66
    if t < T["proof"]:
        return 0.6
    if t < T["recap"]:
        return 0.8
    if t < T["close"]:
        return 1.0
    return 0.55


GAT = [  # santoor gat in Bhupali, one keherwa cycle (8 beats) per line, 8ths ("-" holds)
    "S S D. S R G R G",
    "P G D P G R S -",
    "G P D S' D P G R",
    "G R S D. S R G -",
]
GAT_B = [  # second half, higher register
    "P D S' S' R' S' D P",
    "G P D S' D P G R",
    "S' D P G P G R S",
    "D. S R G R S S -",
]


def build(T: dict) -> Track:
    end = T["end"]
    tr = Track(end)

    def mix(layer, g, seed, wet):
        tr.L += reverb(layer.L, seed, 2.2, wet) * np.float32(g)
        tr.R += reverb(layer.R, seed + 10, 2.2, wet) * np.float32(g)

    tan = Track(end)

    # tanpura: Pa-Sa-Sa-Sa(kharaj), one cycle every 4 beats-ish, from 0 to the very end
    t, i = 0.0, 0
    cyc = [("P.", 0.0), ("S", 1.15), ("S", 2.3), ("S.", 3.45)]
    while t < end + 1:
        for sw, off in cyc:
            f = hz(sw)
            tan.add(tanpura(f, 5.2, 0.55), t + off, pan=(-0.35 + 0.23 * i) % 0.7 - 0.35)
            i += 1
        t += 4.6
    fade = np.clip(np.arange(tan.n) / SR / 2.0, 0, 1)
    tan.L *= fade.astype(np.float32)
    tan.R *= fade.astype(np.float32)
    mix(tan, 0.55, 1, 0.22)
    del tan
    ban = Track(end)

    # bansuri alaap over the story (free time, before the turn)
    alaap = [
        (1.6, [("G", 1.4), ("R", 0.7), ("S", 2.2), ("-", 0.1)]),
        (7.0, [("D.", 1.0), ("S", 0.8), ("R", 0.8), ("G", 2.4)]),
        (13.2, [("P", 0.8), ("G", 0.6), ("D", 1.4), ("P", 0.9), ("G", 0.7), ("R", 0.7), ("S", 2.0)]),
        (21.0, [("G", 0.7), ("P", 0.7), ("D", 0.9), ("S'", 2.2), ("D", 0.6), ("P", 1.6)]),
    ]
    for at, ph in alaap:
        if at < T["turn"] - 1.0:
            ban.add(bansuri(ph, 0.42), at, pan=0.15)

    # santoor + tabla on a beat grid that starts at the turn
    san, tab = Track(end), Track(end)
    t0 = T["turn"]
    beat_i = 0
    grid_end = T["close"] + 2 * BEAT
    # the turn: a rising tremolo run S G P S' into the first downbeat
    for k, sw in enumerate(["S", "G", "P", "S'", "G'", "S'"]):
        san.add(santoor(hz(sw), 2.4, 0.55 + 0.05 * k), t0 - 0.6 + k * 0.1, pan=-0.2)
    bar = 0
    while True:
        bt = t0 + bar * 8 * BEAT
        if bt >= grid_end:
            break
        sect = "intro" if bt < T["hero"] else "hero" if bt < T["guard"] else "guard" if bt < T["hood"] else \
            "hood" if bt < T["proof"] else "proof" if bt < T["recap"] else "recap" if bt < T["close"] else "close"
        line = (GAT_B if (bar // 4) % 2 else GAT)[bar % 4].split()
        if sect == "close":
            san.add(santoor(hz("S"), 3.5, 0.6), bt, pan=-0.2)
            san.add(santoor(hz("S."), 3.5, 0.45), bt, pan=0.2)
            break
        for k, sw in enumerate(line):
            at = bt + k * BEAT
            g = gain_at(at, T)
            if g == 0 or sw == "-":
                continue
            if sect in ("hood", "guard") and k % 2:
                continue  # sparser under dense narration
            v = 0.5 * g
            san.add(santoor(hz(sw), 2.2, v), at, pan=-0.25)
            if sect in ("hero", "recap", "proof"):  # santoor tremolo/8ths: the off-beat strike
                nxt = line[(k + 1) % 8] if line[(k + 1) % 8] != "-" else sw
                san.add(santoor(hz(nxt), 1.6, v * 0.55), at + BEAT / 2, pan=0.25)
            if sect == "recap":  # the lift: octave doubling
                san.add(santoor(hz(sw + "'"), 1.8, v * 0.45), at + BEAT / 4, pan=0.4)
        # tabla
        if sect in ("hero", "proof", "recap", "guard", "hood"):
            theka = ["dha", "ge", "na", "ti", "na", "ka", "dhi", "na"]
            for k, bol in enumerate(theka):
                at = bt + k * BEAT
                g = gain_at(at, T)
                if g == 0:
                    continue
                if sect in ("hood", "guard") and k not in (0, 3, 4, 7):
                    continue
                vel = (0.55 if k in (0, 4) else 0.4) * g
                tab.add(tabla(bol, vel), at, pan=0.1)
                if sect in ("recap", "proof") or (sect == "hero" and k in (3, 7)):
                    tab.add(tabla("te", vel * 0.6), at + BEAT / 2, pan=0.1)
            if sect == "recap":  # tirakita fill into the next cycle
                for j, bol in enumerate(["ti", "ra", "ki", "ta"]):
                    tab.add(tabla("ka" if bol == "ki" else "te", 0.45), bt + 7 * BEAT + j * BEAT / 4, pan=0.1)
        bar += 1
        beat_i += 8

    # the landing: one santoor run up to taar Sa on the frame the move lands
    for k, sw in enumerate(["G", "P", "D", "S'"]):
        san.add(santoor(hz(sw), 2.4, 0.6), T["landing"] + k * 0.07, pan=0.3)

    # bansuri sings the tune in the recap, an octave up, and holds Sa into the close
    rec = [("G'", 0.6), ("P'", 0.6), ("D'", 1.2), ("P'", 0.6), ("G'", 0.6), ("R'", 0.6), ("S'", 1.6),
           ("D", 0.6), ("S'", 0.6), ("R'", 0.6), ("G'", 1.8), ("R'", 0.6), ("S'", 2.4)]
    ban.add(bansuri(rec, 0.6), T["recap"] + 0.3, pan=0.15)
    ban.add(bansuri([("R", 0.8), ("S", 4.5)], 0.5), T["close"] + 0.4, pan=0.15)

    mix(ban, 0.6, 2, 0.35)
    mix(san, 0.8, 3, 0.22)
    mix(tab, 0.75, 4, 0.18)

    # fade out over the last 3 s, and the silent beat: the whole bed dips ~16 dB before the move lands
    n_end = int(end * SR)
    f = np.ones(tr.n, dtype=np.float32)
    a, b = int(T["silence"] * SR), int(T["landing"] * SR)
    if 0 < a < b < tr.n:
        r = int(0.12 * SR)
        f[a:b] = 0.16
        f[a - r:a] = np.linspace(1, 0.16, r)
        f[b:b + r // 2] = np.linspace(0.16, 1, r // 2)
    f[max(0, n_end - 3 * SR):n_end] = np.linspace(1, 0, n_end - max(0, n_end - 3 * SR))
    f[n_end:] = 0
    tr.L *= f
    tr.R *= f
    return tr


def write(path: Path, L: np.ndarray, R: np.ndarray, seconds: float):
    from scipy.signal import butter, sosfilt
    n = int(seconds * SR)
    hp = butter(4, 65, "highpass", fs=SR, output="sos")  # no rumble under the voice
    x = np.stack([sosfilt(hp, L[:n]), sosfilt(hp, R[:n])], 1).astype(np.float32)
    x = x / (np.max(np.abs(x)) + 1e-9) * 10 ** (-1 / 20)
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype("<i2").tobytes())


def main():
    opt = lambda k, d: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
    out = Path(opt("--out", str(OUT_DEFAULT)))
    T = times()
    prev = opt("--preview", None)
    if prev:
        T["end"] = min(T["end"], float(prev))
    tr = build(T)
    write(out, tr.L, tr.R, T["end"])
    print(f"music -> {out} ({T['end']:.1f} s)", {k: round(v, 2) for k, v in T.items()})


if __name__ == "__main__":
    main()
