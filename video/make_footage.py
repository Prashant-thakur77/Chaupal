#!/usr/bin/env python3
"""The opening's real footage: CC0 and public-domain clips from Wikimedia Commons only, so no attribution or
share-alike is owed anywhere, cut to the shots the story uses and normalised to 1920x1080, 30 fps, BT.709.
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
ISS = "ISS_Europe_to_SE_Asia_night.ogv"                          # public domain (NASA, ISS Expedition 29 crew)
SUKHAD = "Women_at_Work_Sukhad_Watchal_Comfortable_journey.webm"  # CC0 (Lek Ladki Abhiyan / CIS-A2K)
VISHWASU = "Women_at_Work_Vishwasu_Prawas_Trusted_transport.webm" # CC0 (Lek Ladki Abhiyan / CIS-A2K)
ISS_CROP = "crop=840:472:0:44"  # 3:2 source -> a 16:9 window

# name, file, in, out, speed (<1 = slowed with motion interpolation), crop, push, pan, what
SHOTS = [
    ("path", SUKHAD, 23.0, 26.4, 1.0, None, 0.05, 0.3, "a village path under trees"),
    ("hand", VISHWASU, 389.0, 391.6, 1.0, None, 0.06, 0.0, "an older woman's hand, steady"),
    ("craft", SUKHAD, 85.6, 88.2, 1.0, None, 0.05, -0.2, "hands at work"),
    ("city", ISS, 19.0, 21.7, 0.55, ISS_CROP, 0.07, 0.0, "city lights at night, seen from orbit"),
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
    # the owner's own phone recording of the family's Telegram chat (optional): no audio, slowed to 0.8x, last frame held
    tg = HERE / "footage" / "telegram-phone.mp4"
    out = OUT / "telegram-phone.mp4"
    if tg.exists() and (not out.exists() or out.stat().st_mtime < tg.stat().st_mtime):
        tmp = OUT / "telegram-phone.part.mp4"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(tg), "-an", "-vf",
                        "setpts=1.25*PTS,fps=30,scale=720:1600:flags=lanczos,tpad=stop_mode=clone:stop_duration=6,format=yuv420p,setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709",
                        "-c:v", "libx264", "-crf", "17", "-preset", "medium", "-movflags", "+faststart", str(tmp)], check=True)
        tmp.rename(out)
        print("telegram phone clip ->", out)


if __name__ == "__main__":
    main()
