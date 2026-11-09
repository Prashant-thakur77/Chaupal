#!/usr/bin/env python3
"""The film's own effects, synthesised in numpy (nothing licensed), added next to the toolbox kit:

  chalk     dry chalk scraped along clay (the kolam line being drawn), ~1.3 s
  santoor   one santoor note on taar Sa (the kolam loop closing; the signature sound)
  clack     a wooden disc set down on a board (a shatranj move)
  puff      a soft powder puff (rangoli colour filling a region)
  ink       a kalam stroke on paper (sulekh reference / her tracing)
  thud      a clay slab settling (the chabutra tiers)
  refuse    a low muted knock + short descending tone (a stale move refused)

  python3 video/sfx_chaupal.py [dir]     (default /home/prashant/projects/.chaupal-work/film/audio/sfx)
"""
import sys
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt

SR = 48000
rng = np.random.default_rng(11)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "bandpass", fs=SR, output="sos"), x)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, "lowpass", fs=SR, output="sos"), x)


def t_(d):
    return np.arange(int(d * SR)) / SR


def chalk():
    t = t_(1.3)
    n = rng.standard_normal(len(t))
    grain = (rng.random(len(t)) < 0.02) * rng.standard_normal(len(t)) * 3  # powder grit
    x = bp(n + grain, 1800, 7000)
    stroke = np.sin(np.pi * np.clip(t / 1.25, 0, 1)) ** 0.6  # pressure over the stroke
    flutter = 0.75 + 0.25 * np.sin(2 * np.pi * 9 * t + 2 * np.sin(2 * np.pi * 1.3 * t))
    return x * stroke * flutter


def santoor():
    t = t_(2.8)
    f0 = 293.66 * 2  # taar Sa (D5)
    y = np.zeros(len(t))
    for det in (-2.0, 0.0, 2.4):
        f = f0 * 2 ** (det / 1200)
        for k in range(1, 12):
            fk = f * k * np.sqrt(1 + 0.00035 * k * k)
            y += (1 / k ** 0.9) * np.sin(2 * np.pi * fk * t + k) * np.exp(-t / (1.9 / (1 + 0.25 * k)))
    y[:240] += rng.standard_normal(240) * np.exp(-np.arange(240) / 30) * 0.8
    return y


def clack():
    t = t_(0.35)
    y = np.zeros(len(t))
    for f, d, a in ((820, 0.05, 1.0), (1370, 0.035, 0.6), (2210, 0.02, 0.4), (410, 0.07, 0.5)):
        y += a * np.sin(2 * np.pi * f * t) * np.exp(-t / d)
    y += bp(rng.standard_normal(len(t)), 1500, 6000) * np.exp(-t / 0.006) * 0.7
    return y


def puff():
    t = t_(0.9)
    x = lp(rng.standard_normal(len(t)), 1400)
    e = np.minimum(1, t / 0.03) * np.exp(-t / 0.22)
    return x * e + 0.25 * np.sin(2 * np.pi * 95 * t) * np.exp(-t / 0.12)


def ink():
    t = t_(0.8)
    x = bp(rng.standard_normal(len(t)), 900, 4500)
    e = np.sin(np.pi * np.clip(t / 0.75, 0, 1)) ** 1.5
    return x * e * (0.8 + 0.2 * np.sin(2 * np.pi * 4 * t))


def thud():
    t = t_(0.7)
    f = 70 + 40 * np.exp(-t / 0.05)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.18)
    y += lp(rng.standard_normal(len(t)), 600) * np.exp(-t / 0.03) * 0.6
    return y


def refuse():
    t = t_(0.8)
    knock = np.sin(2 * np.pi * 140 * t) * np.exp(-t / 0.06) + lp(rng.standard_normal(len(t)), 900) * np.exp(-t / 0.02) * 0.5
    f = 392 * 2 ** (-t * 0.9)
    tone = 0.35 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.minimum(1, np.maximum(0, t - 0.08) / 0.02) * np.exp(-np.maximum(0, t - 0.08) / 0.25)
    return knock + tone


def write(path, x, width=0.3):
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.9
    # a little width: the right channel a few samples late
    d = int(width * 0.001 * SR)
    st = np.stack([x, np.concatenate([np.zeros(d), x[:-d]]) if d else x], 1)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((st * 32767).astype("<i2").tobytes())


def main():
    d = Path(sys.argv[1] if len(sys.argv) > 1 else "/home/prashant/projects/.chaupal-work/film/audio/sfx")
    d.mkdir(parents=True, exist_ok=True)
    for name, fn in (("chalk", chalk), ("santoor", santoor), ("clack", clack), ("puff", puff), ("ink", ink), ("thud", thud), ("refuse", refuse)):
        write(d / f"{name}.wav", fn())
    print("film sfx ->", d)


if __name__ == "__main__":
    main()
