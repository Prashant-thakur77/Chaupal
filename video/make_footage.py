#!/usr/bin/env python3
"""The opening's real footage: licensed clips from Wikimedia Commons (CC0 and CC BY only; no BY-SA, so the film carries
no share-alike obligation), cut to the shots the story uses and normalised to 1920x1080, 30 fps, BT.709.
The grade (warm, a little desaturated, shadows toward indigo) is applied in the Remotion scene so it matches the world.
Stock people are footage, not our users: the scene says so on screen.

  python3 video/make_footage.py     -> film/public/footage/*.mp4 + footage.json
Sources and licences: video/LICENSES.md (and footage/sources.json in the work folder).
"""
import json
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
RAW = Path("/home/prashant/projects/.chaupal-work/film/footage/raw")
OUT = HERE / "film" / "public" / "footage"
DAY = "A_day_in_the_life_of_India_promo_version.webm"            # CC BY 3.0 (MEA External Publicity Division)
SUKHAD = "Women_at_Work_Sukhad_Watchal_Comfortable_journey.webm"  # CC0 (Lek Ladki Abhiyan / CIS-A2K)
VISHWASU = "Women_at_Work_Vishwasu_Prawas_Trusted_transport.webm" # CC0 (Lek Ladki Abhiyan / CIS-A2K)
LETTERBOX = "crop=1452:817:234:131"  # the Day film is 2.35:1 inside 16:9: take a 16:9 window from the picture area

# name, file, in, out, speed (<1 = slowed with motion interpolation), crop, push, pan, what
SHOTS = [
    ("sunset", DAY, 102.06, 103.2, 0.42, LETTERBOX, 0.05, 0.0, "the sun going down over a river"),
    ("path", SUKHAD, 23.0, 26.4, 1.0, None, 0.05, 0.3, "a village path under trees"),
    ("hand", VISHWASU, 389.0, 391.6, 1.0, None, 0.06, 0.0, "an older woman's hand, steady"),
    ("craft", SUKHAD, 85.6, 88.2, 1.0, None, 0.05, -0.2, "hands at work"),
    ("city", DAY, 103.32, 104.36, 0.24, LETTERBOX, 0.07, 0.0, "a city at night"),
]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    shots = []
    for name, f, a, b, speed, crop, push, pan, what in SHOTS:
        out = OUT / f"{name}.mp4"
        dur = round((b - a) / speed, 2)
        if not out.exists() or out.stat().st_mtime < Path(__file__).stat().st_mtime:
            vf = []
            if crop:
                vf.append(crop)
            vf.append("scale=1920:1080:flags=lanczos")
            if speed < 1:
                vf += [f"setpts={1 / speed:.4f}*PTS", "minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1"]
            vf += ["fps=30", "hqdn3d=2:2:4:4", "format=yuv420p", "setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709"]
            tmp = OUT / f"{name}.part.mp4"
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-threads", "2", "-ss", str(a), "-to", str(b), "-i", str(RAW / f), "-an",
                            "-vf", ",".join(vf), "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-g", "15",
                            "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-movflags", "+faststart", str(tmp)], check=True)
            tmp.rename(out)
        shots.append({"src": f"footage/{name}.mp4", "dur": dur, "push": push, "pan": pan, "what": what})
        print(f"{name:7} {dur:5.2f} s  {what}")
    (OUT / "footage.json").write_text(json.dumps({"shots": shots}, indent=1) + "\n")


if __name__ == "__main__":
    main()
