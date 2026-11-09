#!/usr/bin/env python3
"""Noise floor of a mix in given windows: the quietest and the median 100 ms RMS (dBFS), per window.
  python noise_floor.py file.wav|mp4 a-b [c-d ...]
"""
import subprocess, sys
import numpy as np

f = sys.argv[1]
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-ac", "1", "-ar", "48000", "-f", "f32le", "-"], capture_output=True, check=True).stdout
x = np.frombuffer(raw, dtype=np.float32)
for w in sys.argv[2:]:
    a, b = map(float, w.split("-"))
    seg = x[int(a * 48000):int(b * 48000)]
    n = 4800
    r = np.array([np.sqrt(np.mean(seg[i:i + n] ** 2)) for i in range(0, len(seg) - n, n)])
    db = 20 * np.log10(r + 1e-12)
    print(f"{w:>12}  min {db.min():7.1f} dBFS  median {np.median(db):7.1f}  max {db.max():7.1f}")
