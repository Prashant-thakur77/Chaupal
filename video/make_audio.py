#!/usr/bin/env python3
"""The film's sound, all derived from film.json so every effect lands on the frame its picture moves:
  1. data/music_cues.json  the exact landing frame etc. for music.py (the silent beat before the move lands)
  2. music.py              the composed theme on the real timeline
  3. sfx_cues.json         one cue per meaningful event (kolam loop: chalk + santoor; moves: clack; fills: puff; ...)
  4. sfx_synth.py track    the whole effects track in numpy
  5. mix.json + mix.py     voice + ducked music + effects -> master.wav at -14 LUFS, -1.5 dBTP

  python3 video/make_audio.py        (uses ~/.pyenv 3.10 python for numpy/scipy; one process at a time)
Heavy files go to /home/prashant/projects/.chaupal-work/film/audio.
"""
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
A = Path("/home/prashant/projects/.chaupal-work/film/audio")
PY = sys.executable
film = json.loads((HERE / "film" / "film.json").read_text())
S = film["scenes"]
start, t = {}, 0.0
for s in S:
    start[s["id"]] = t
    t += s["duration"]
D = round(t, 3)
by = {s["id"]: s for s in S}
cues = []


def cue(at, sfx, db=-14, align="peak"):
    if at is not None and 0 <= at < D:
        cues.append({"t": round(at, 3), "sfx": sfx, "db": db, "align": align})


# transitions: scene i's outgoing transition plays over the first frames of scene i+1
for i, s in enumerate(S[:-1]):
    tr = s.get("transition") or {}
    t0 = start[S[i + 1]["id"]]
    d = tr.get("dur", 0.5)
    if tr.get("type") == "kolam":
        cue(t0 + 0.06 * d, "chalk", -15, "start")
        cue(t0 + 0.62 * d, "santoor", -13)
    elif tr.get("type") == "fade":
        cue(t0 + d / 2, "whoosh", -22)

st = by["stakes"]
cue(start["stakes"] + st.get("at1", 0.4) + 0.9, "hit", -18)
cue(start["stakes"] + st.get("at2", 5.5) + 1.1, "hit", -18)

tu = by["turn"]
cue(start["turn"] + 0.3, "shimmer", -20)                     # the diya lights
b = start["turn"] + tu.get("boardAt", 5)
bd = tu["duration"] - tu.get("boardAt", 5)
cue(b + bd * 0.62, "clack", -14)                              # the 3D knight lands
cue(b + bd * 0.8, "whoosh", -18)                              # it lifts toward the lens

h = by["hero"]
if h.get("landAt") is not None:
    cue(start["hero"] + h["landAt"] - 0.25, "clack", -12)     # the move on her board
    cue(start["hero"] + h["landAt"] + 0.05, "hit", -16)        # it lands on his phone
if h.get("replyAt") is not None:
    cue(start["hero"] + h["replyAt"] - 0.25, "clack", -13)

def clip_cues(sid, mapping):
    s = by[sid]
    for k, sfx, db in mapping:
        v = s.get(k)
        if v is not None:
            cue(start[sid] + v, sfx, db)

sk = by["sulekh"]
for z in sk.get("zooms", [])[:2]:
    cue(start["sulekh"] + z["at"], "ink", -20)
for n in sk.get("notes", []):
    cue(start["sulekh"] + n["at"] + 0.2, "chalk", -22, "start")

rv = by["reveal"]
cue(start["reveal"] + 0.2, "chalk", -18, "start")
cue(start["reveal"] + rv["duration"] * 0.55, "puff", -16)

rg = by["rangoli"]
for z in rg.get("zooms", []):
    cue(start["rangoli"] + z["at"] + 0.4, "puff", -13)
    cue(start["rangoli"] + z["at"] + 0.9, "puff", -15)

tg = by.get("telegram") or {}
if tg.get("approveAt") is not None:
    cue(start["telegram"] + tg["approveAt"], "tick", -16)
if tg.get("resultAt") is not None:
    cue(start["telegram"] + tg["resultAt"] + 0.3, "chime", -17)

gd = by["guard"]
for c in gd.get("chips", []):
    cue(start["guard"] + c["at"] - 0.4, "tick", -16)
if len(gd.get("zooms", [])) > 1:
    cue(start["guard"] + gd["zooms"][1]["at"], "refuse", -15)

hd = by["hood"]
for k in ("actions", "surfaces", "sql", "engines"):
    v = (hd.get("cues") or {}).get(k)
    if v is not None:
        cue(start["hood"] + v + 0.3, "thud", -14)
c = hd.get("cues") or {}
if c.get("stale") is not None:
    cue(start["hood"] + c["stale"], "refuse", -14)
if c.get("yes") is not None:
    cue(start["hood"] + c["yes"], "chime", -16)

pr = by["proof"]
if (pr.get("eval") or {}).get("ready"):
    cue(start["proof"] + pr["atBadge"], "hit", -12)
cue(start["proof"] + pr.get("atOcr", 9) + 0.9, "tick", -18)

rc = by["recap"]
cue(start["recap"], "riser", -16, "end")
for k in range(1, int(rc["duration"])):
    cue(start["recap"] + k * rc.get("cut", 1.0), "flash", -26)
for l in rc.get("lines", []):
    cue(start["recap"] + l["at"], "hit", -22)

cl = by["close"]
cue(start["close"] + cl.get("nameAt", 0.7), "chime", -16)

cues.sort(key=lambda x: x["t"])
(HERE / "sfx_cues.json").write_text(json.dumps({"duration": D, "dir": str(A / "sfx"), "cues": cues}, indent=1) + "\n")
print(f"{len(cues)} sfx cues over {D:.1f} s")

# music: exact hits for music.py
mc = {"end": D, "turn": start["turn"], "hero": start["hero"], "sulekh": start["sulekh"], "guard": start["guard"], "hood": start["hood"],
      "proof": start["proof"], "recap": start["recap"], "close": start["close"]}
if h.get("landAt") is not None:
    mc["landing"] = round(start["hero"] + h["landAt"] - 0.25, 3)
    mc["silence"] = round(mc["landing"] - 0.95, 3)
(HERE / "data" / "music_cues.json").write_text(json.dumps(mc, indent=1) + "\n")

run = lambda *a: subprocess.run([str(x) for x in a], check=True)
run(PY, HERE / "sfx_chaupal.py", A / "sfx")
if not (A / "sfx" / "whoosh.wav").exists():
    run(PY, HERE / "tools" / "sfx_synth.py", "kit", A / "sfx")
run(PY, HERE / "tools" / "sfx_synth.py", "track", HERE / "sfx_cues.json", A / "sfx_track.wav")
run(PY, HERE / "music.py", "--out", A / "music.wav")
mix = {"duration": D, "vo": str(HERE / "narration" / "vo_full.wav"),
       "music": [{"file": str(A / "music.wav"), "start": 0, "in": 0, "gain_db": -9, "fade_in": 0.3, "fade_out": 2.5, "end": D}],
       "sfx": [{"file": str(A / "sfx_track.wav"), "at": 0, "gain_db": -2}],
       "duck": {"threshold": 0.03, "ratio": 7, "attack": 20, "release": 600}, "target_lufs": -14}
(HERE / "mix.json").write_text(json.dumps(mix, indent=1) + "\n")
print("mix.json written; master:", A / "master.wav")
