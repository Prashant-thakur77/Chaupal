#!/usr/bin/env python3
"""Writes video/film/film.json: the whole film as data, from
  data/facts.json                every number (facts.py)
  narration/timeline.json        the voice timeline (vo_timeline.py): scene durations and line times
  film/public/captions/captions.json   word times (captions.py), used to cue things to the words that name them
  film/public/captures/log.json  the capture log (capture_film.mjs): clip files, event times, element boxes
  film/public/footage/footage.json     the graded opening shots (make_footage.py)
  film/public/svg/pulli-5x5.svg  the engine's own kolam, for the signature transition

  python3 video/make_film.py --skeleton   scene list with lead-ins/minimums only (input for vo_timeline.py)
  python3 video/make_film.py              the full film (run after vo_timeline.py and captions.py)

Anything missing becomes a visible, labelled placeholder in the picture and is listed at the end.
"""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PUB = HERE / "film" / "public"
FILM = HERE / "film" / "film.json"
FPS = 30
missing: list[str] = []


def load(p, default=None):
    p = Path(p)
    return json.loads(p.read_text()) if p.exists() else default


F = load(HERE / "data" / "facts.json", {})
TL = load(HERE / "narration" / "timeline.json")
CAPS = load(PUB / "captions" / "captions.json")
LOG = load(PUB / "captures" / "log.json", {})
FOOT = load(PUB / "footage" / "footage.json")

# id, type, outgoing transition, lead-in (s), minimum length (s)
SKELETON = [
    ("open", "open", {"type": "fade", "dur": 0.6}, 0.7, 14),
    ("stakes", "stakes", {"type": "kolam", "dur": 1.7}, 0.4, 10),
    ("turn", "turn", {"type": "fade", "dur": 0.35}, 1.1, 9),
    ("hero", "twocities", {"type": "kolam", "dur": 1.7}, 0.6, 18),
    ("sulekh", "screen", {"type": "fade", "dur": 0.5}, 1.1, 14),
    ("reveal", "rangoli", {"type": "fade", "dur": 0.5}, 0.4, 6.5),
    ("rangoli", "screen", {"type": "fade", "dur": 0.5}, 0.3, 7),
    ("guard", "screen", {"type": "kolam", "dur": 1.7}, 0.3, 11),
    ("hood", "chabutra", {"type": "fade", "dur": 0.5}, 1.1, 18),
    ("proof", "proof", {"type": "kolam", "dur": 1.7}, 0.4, 12),
    ("recap", "recap", {"type": "fade", "dur": 0.8}, 1.1, 9),
    ("close", "close", None, 0.5, 9),
]
HOLD = {"close": 5.2, "proof": 1.2, "hood": 0.8}


def kolam():
    svg = (PUB / "svg" / "pulli-5x5.svg").read_text()
    d = re.search(r'<path id="r-loop-1"[^>]*\sd="([^"]+)"', svg).group(1)
    dots = [[float(x), float(y)] for x, y in re.findall(r'<circle data-dot="[^"]*" cx="([\d.]+)" cy="([\d.]+)"', svg)]
    view = float(re.search(r'viewBox="0 0 ([\d.]+)', svg).group(1))
    return {"d": d, "dots": dots, "view": view}


def lines():
    return {l["id"]: l for l in (TL or {}).get("lines", [])}


def scene_start(sid):
    for s in (TL or {}).get("scenes", []):
        if s["id"] == sid:
            return s["start"]
    return 0.0


def word_time(sid, word, after=0.0, default=None):
    """Second (from the scene start) the given word is spoken, from captions.json."""
    if not CAPS or not TL:
        return default
    s0 = scene_start(sid)
    w = word.lower()
    for c in CAPS:
        t = c["startMs"] / 1000 - s0
        if t >= after and re.sub(r"[^a-z0-9]", "", c["text"].lower()).startswith(w):
            return round(t, 2)
    return default


def rel(lid, sid, key="start", default=None):
    L = lines()
    if lid not in L:
        return default
    return round(L[lid][key] - scene_start(sid), 2)


def align(anchors, clip_len, min_gap=1.5, lead=1.3):
    """Map a real capture onto the voice. anchors: [(scene_s, clip_s, what)] in order. The clip plays at 1x; where it
    would reach an anchor late, it is cut forward `lead` s before the anchor, with an honest note saying how long was
    cut. Returns (segments, clip->scene mapper)."""
    segs = []
    if not anchors:
        return [{"at": 0, "from": 0}], (lambda c: c)
    s0, c0, _ = anchors[0]
    segs.append({"at": 0, "from": round(max(0.0, c0 - s0), 2)})
    for s, c, what in anchors[1:]:
        cur = segs[-1]
        natural = cur["at"] + (c - cur["from"])  # scene time the clip would reach this anchor
        if natural - s > min_gap:
            at = round(max(cur["at"] + 0.8, s - lead), 2)
            frm = round(c - (s - at), 2)
            cut = round(frm - (cur["from"] + (at - cur["at"])), 1)
            segs.append({"at": at, "from": frm, "note": f"{what} · {cut:g} s later" if cut >= 1 else None})
    segs = [{k: v for k, v in g.items() if v is not None} for g in segs]

    def to_scene(c):
        best = None
        for g in segs:
            if c >= g["from"]:
                best = g
        return round(best["at"] + (c - best["from"]), 2) if best else round(c, 2)

    return segs, to_scene


def zoom(box, at, dur=2.4, scale=None):
    z = {"at": at, "dur": dur, "box": box}
    if scale:
        z["scale"] = scale
    return z


def build(skeleton_only=False):
    scenes = []
    for sid, typ, tr, lead, mn in SKELETON:
        s = {"id": sid, "type": typ, "duration": mn, "leadIn": lead, "min": mn}
        if sid in HOLD:
            s["hold"] = HOLD[sid]
        if tr:
            s["transition"] = tr
        scenes.append(s)
    if TL:
        d = {s["id"]: s["duration"] for s in TL["scenes"]}
        for s in scenes:
            s["duration"] = d.get(s["id"], s["duration"])
    film = {"title": "Chaupal", "fps": FPS, "width": 1920, "height": 1080, "kolam": kolam(), "facts": F, "scenes": scenes}
    if skeleton_only:
        return film
    S = {s["id"]: s for s in scenes}
    P = F.get("public", {})

    # 1 open: real footage
    o = S["open"]
    if FOOT:
        shots, total = [], 0.0
        for k, sh in enumerate(FOOT["shots"]):
            dur = sh["dur"] if k < len(FOOT["shots"]) - 1 else max(2.5, o["duration"] - total + 1.0)
            shots.append({"src": sh["src"], "dur": dur, "push": sh.get("push", 0.05), "pan": sh.get("pan", 0), "what": sh["what"]})
            total += dur
        o["shots"] = shots
    else:
        missing.append("opening footage (make_footage.py)")
        o["shots"] = [{"src": None, "dur": o["duration"] / 3 + 0.5, "what": w} for w in ("dusk over a village", "lamps and hands", "a city at night")]
    la = P.get("livingAlone", {})
    o["pins"] = [{"at": (rel("o3", "open") or 9.5) + 0.6, "text": f"{la.get('value')}% of Indians over 60 live alone", "sub": la.get("source"), "x": 1180, "y": 120}]
    o["notes"] = [{"at": 0.4, "until": 4.5, "text": "Footage: India at dusk (stock, not our users)"}]

    # 2 stakes
    st = S["stakes"]
    st.update({"at1": rel("s1", "stakes", default=0.4), "at2": rel("s2", "stakes", default=5.5),
               "share2022": P["elderShare2022"]["value"], "share2050": P["elderShare2050"]["value"], "digital": P["digitalConfusing"]["value"],
               "src1": P["elderShare2050"]["source"] + ", p.20", "src2": P["digitalConfusing"]["source"] + ", elderly respondents"})

    # 3 turn
    tu = S["turn"]
    tu["wordsAt"] = rel("t2", "turn", default=4.2)
    tu["boardAt"] = word_time("turn", "plays", after=1, default=(rel("t2", "turn", default=4.2) or 4.2) + 2.6)

    # 4 hero: two live sessions
    h = S["hero"]
    hl = LOG.get("hero")
    h.update({"square": "h6", "replySquare": "h6",
              "request": {"hi": "घोड़े से उसका हाथी मार दो", "en": "“Take his rook with the knight”"},
              "typedNote": ("request typed into the dock for the recording; she can also say it" if (hl or {}).get("mode") == "agent"
                            else "her exact words, sent straight to move-chess-piece (the action her agent calls)"),
              "requestAt": rel("h2", "hero", default=4.0)})
    sync = F.get("sync") or {}
    if sync.get("where") == "deployed" and sync.get("p50") is not None:
        h["syncLabel"] = f"median {sync['p50']} s"
    land_at = (rel("h3", "hero", default=9.0) or 9.0) + 1.6
    reply_at = (rel("h4", "hero", default=13.0) or 13.0) + 1.2
    if hl:
        ev = hl["events"]
        segs, to_scene = align([(h["requestAt"], ev["request"], "her request"), (land_at, ev["land"], "waiting for the move"),
                                (reply_at, ev.get("replyPhone", ev["reply"]), "pause"), (reply_at + 1.0, ev.get("replyTablet", ev["reply"]), "his move on its way")], hl["duration"])
        h.update({"tablet": hl["tablet"], "phone": hl["phone"], "segments": segs, "landAt": to_scene(ev["land"]), "replyAt": to_scene(ev.get("replyTablet", ev["reply"])),
                  "tabletBoard": hl["boards"]["tablet"], "phoneBoard": hl["boards"]["phone"], "squares": hl.get("squares")})
    else:
        missing.append("hero capture (two sessions)")
        h.update({"landAt": land_at, "replyAt": reply_at})

    # 5 sulekh
    sk = S["sulekh"]
    sl = LOG.get("sulekh")
    req_at = rel("k1", "sulekh", default=1.2)
    ref_at = (rel("k2", "sulekh", default=5) or 5) + 0.3
    trace_at = rel("k3", "sulekh", default=11)
    erase_at = word_time("sulekh", "erased", after=trace_at or 0, default=(trace_at or 11) + 3.5)
    sk["chips"] = [{"at": req_at, "until": ref_at, "text": "पोते को दिवाली पर ‘शुभ दीपावली’ दिखाना है", "sub": "“I want to show my grandson ‘Happy Diwali’”", "y": 840}]
    mode_note = lambda c, action: ("typed into the dock for the recording; the in-app agent answers" if (c or {}).get("mode") == "agent"
                                   else f"sent straight to {action} (the action her agent calls)")
    if sl:
        ev, bx = sl["events"], sl["boxes"]
        # her tracing took far longer in the recording than the line it sits under: it plays sped up, and says so
        segs, to_scene0 = align([(req_at, ev["request"], "her request"), (ref_at, ev["reference"], "waiting for the reference")], sl["duration"])
        avail = max(1.5, (erase_at - 0.8) - trace_at)
        rate = max(1.0, float(round((ev["traceEnd"] - ev["traceStart"]) / avail)))
        segs.append({"at": round(trace_at, 2), "from": round(ev["traceStart"], 2), "rate": rate, "note": f"her tracing, sped up ×{rate:g}" if rate > 1.05 else None})
        segs.append({"at": round(erase_at - 0.8, 2), "from": round(ev["erase"] - 0.8, 2)})
        segs = [{k: v for k, v in g.items() if v is not None} for g in segs]

        def to_scene(c):
            best = None
            for g in segs:
                if c >= g["from"]:
                    best = g
            return round(best["at"] + (c - best["from"]) / best.get("rate", 1), 2)

        sk.update({"src": sl["src"], "segments": segs,
                   "zooms": ([zoom(bx["dock"], req_at + 0.3, 2.2)] if sl.get("mode") == "agent" else [])
                            + [zoom(bx["reference"], to_scene(ev["reference"]) + 0.3, 3.2), zoom(bx["reference"], to_scene(ev["traceStart"]), 3.0, 1.35)],
                   "notes": [{"at": req_at, "until": ref_at, "text": mode_note(sl, "set-calligraphy-reference")},
                             {"at": to_scene(ev["traceStart"]), "until": to_scene(ev["traceEnd"]), "text": "her tracing: drawn by the recording script"}]})
        if sl.get("pip"):
            sk["pip"] = {"src": sl["pip"], "at": to_scene(ev["reference"]) + 1.5, "from": round(ev["reference"] + 1.5 - (to_scene(ev["reference"]) + 1.5), 2), "until": to_scene(ev["traceStart"]) + 0.5}
    else:
        missing.append("sulekh capture")
        sk["what"] = "sulekh: शुभ दीपावली reference, tracing, erase"

    # 6 rangoli reveal (the engine's own SVG; the captured one when the capture saved it)
    rv = S["reveal"]
    svg_out = "svg/captured-rangoli.svg" if (PUB / "svg" / "captured-rangoli.svg").exists() else "svg/rangoli-uncoloured.svg"
    attrs = re.search(r'data-rings="(\d+)" data-petals="(\d+)" data-symmetry="([^"]+)"', (PUB / svg_out).read_text())
    rv.update({"outline": svg_out, "filled": "svg/rangoli-filled.svg",
               "caption": f"{attrs.group(2)} petals · {attrs.group(1)} rings · {attrs.group(3)} symmetry" if attrs else None})

    # 7 rangoli fill by voice
    rg = S["rangoli"]
    rl = LOG.get("rangoli")
    say_at = rel("r2", "rangoli", default=0.4)
    fill_at = word_time("rangoli", "exactly", after=0, default=(say_at or 0.4) + 3.2)
    rg["chips"] = [{"at": say_at, "until": fill_at + 1.5, "text": "बीच में पीला, बाहर लाल", "sub": "“Yellow in the middle, red outside”", "y": 840}]
    if rl:
        ev, bx = rl["events"], rl["boxes"]
        segs, to_scene = align([(say_at, ev["request"], "typing"), (fill_at, ev["filled"], "waiting for the fill")], rl["duration"])
        rg.update({"src": rl["src"], "segments": segs, "zooms": [zoom(bx["canvas"], to_scene(ev["filled"]) - 0.4, 3.0, 1.25)],
                   "notes": [{"at": say_at, "until": fill_at + 1.5, "text": mode_note(rl, "fill-region")}]})
    else:
        missing.append("rangoli capture")
        rg["what"] = "rangoli: “बीच में पीला, बाहर लाल” fills"

    # 8 guard: approval card refused, then the conflict card
    gd = S["guard"]
    gl = LOG.get("guard")
    card_at = rel("g1", "guard", default=0.3)
    no_at = word_time("guard", "don't", after=0, default=(card_at or 0.3) + 2.6)
    conf_at = rel("g2", "guard", default=6)
    if gl:
        ev, bx = gl["events"], gl["boxes"]
        segs, to_scene = align([(card_at, ev["card"], "her request"), (no_at, ev["decline"], "pause"), (conf_at + 0.8, ev["conflict"], "switching to the board")], gl["duration"])
        gd.update({"src": gl["src"], "segments": segs,
                   "zooms": [zoom(bx["card"], card_at + 0.2, 3.4, 1.35), zoom(bx["conflict"], to_scene(ev["conflict"]) + 0.2, 2.6, 1.5)],
                   "chips": [{"at": to_scene(ev["decline"]) + 0.4, "until": to_scene(ev["decline"]) + 3, "text": "मत भेजो · nothing was sent", "tone": "good", "y": 840}],
                   "notes": [{"at": card_at, "until": card_at + 2.5, "text": mode_note(gl, "draft-family-update")},
                             {"at": to_scene(ev["conflict"]) - 0.6, "until": to_scene(ev["conflict"]) + 2.5, "text": "his move tapped on his phone; the agent's now-stale move sent to move-chess-piece"}]})
    else:
        missing.append("guard capture (approval + conflict cards)")
        gd["what"] = "approval card (मत भेजो) + conflict card"

    # 9 hood: tiers rise on the words that name them
    hd = S["hood"]
    hd["cues"] = {
        "actions": word_time("hood", "actions", default=(rel("a1", "hood", default=1.1) or 1.1) + 1.6),
        "surfaces": 0.4,  # the surfaces are on screen from the first frame; the tiers below rise on their words
        "gate": word_time("hood", "telegram", default=(rel("a2", "hood", default=4) or 4) + 5),
        "sql": word_time("hood", "revision", default=rel("a3", "hood", default=10)),
        "stale": (word_time("hood", "revision", default=rel("a3", "hood", default=10)) or 10) + 1.0,
        "engines": word_time("hood", "engines", default=rel("a4", "hood", default=15)),
    }
    hd["cues"]["yes"] = round((hd["cues"]["gate"] or 0) + 1.8, 2)

    # 10 proof
    pr = S["proof"]
    ev = F.get("eval", {})
    pr["eval"] = ev
    pr["ocr"] = F.get("ocr")
    pr["atControl"] = (rel("p2", "proof", default=3) or 3) + 0.4
    pr["atOurs"] = word_time("proof", "with", after=pr["atControl"] + 1, default=pr["atControl"] + 2.6)
    pr["atBadge"] = rel("p2", "proof", key="end", default=7)
    pr["atOcr"] = rel("p3", "proof", default=9)
    if ev.get("ready") and ev.get("failures"):
        pr["failure"] = f"Still failing: {len(ev['failures'])} of {ev['cases']} cases. Before its Hindi reply, the agent sometimes writes an English aside."
        pr["atFail"] = rel("p4", "proof", default=20)
    o_ = F.get("ocr") or {}
    pr["footnote"] = ("Same model and prompt in both arms; control = browser control only, no actions. "
                      + (f"Model {ev.get('model')}. " if ev.get("ready") else "")
                      + f"OCR: tesseract exact match over {o_.get('n', 50)} phrases in 5 scripts, calligraphic fonts; with plain fonts {o_.get('shapedPlain')} vs {o_.get('unshapedPlain')}. "
                      + "Unshaped text = the same font drawn code point by code point.")
    if not ev.get("ready"):
        missing.append("eval numbers (evals/results/summary.json pending): proof shows a labelled placeholder")

    # 11 recap
    rc = S["recap"]
    rec_lines = [("c1", "Her language, not an app's."), ("c2", "Her family, at the same board."),
                 ("c3", "Nothing leaves without her say.")]
    out, last = [], 0.4
    for lid, text in rec_lines:
        t = rel(lid, "recap") if lid else None
        t = t if t is not None else last + 1.6
        out.append({"at": t, "text": text})
        last = t
    if ev.get("ready") and ev.get("better"):
        out.append({"at": rel("c4", "recap", default=last + 1.6), "text": f"{ev['B']['passed']}/{ev['B']['runs']} with actions · {ev['A']['passed']}/{ev['A']['runs']} without", "strong": True})
    rc["lines"] = out
    clips = []
    for k in ("hero", "sulekh", "rangoli", "guard"):
        c = LOG.get(k)
        if c:
            src = c.get("tablet") or c.get("src")
            for t in c.get("recap", []):
                clips.append({"src": src, "from": t})
    rc["clips"] = clips
    rc["cut"] = 1.0

    # 12 close + end card
    cl = S["close"]
    cl.update({"nameAt": (rel("z1", "close", default=0.5) or 0.5) + 0.2,
               "tagline": "She speaks. The board moves. The family is right there.",
               "links": ["chaupal.prashantthakur.dev", "Agent-Native Hackathon 2026"]})

    film["captions"] = None  # captions are uploaded as film.srt, not burned (a burned copy is a separate render)
    film["thumb"] = LOG.get("thumb", {})
    return film


def main():
    sk = "--skeleton" in sys.argv
    film = build(sk)
    if not sk:
        film.pop("captions", None) if film.get("captions") is None else None
    FILM.write_text(json.dumps(film, indent=1, ensure_ascii=False) + "\n")
    tot = sum(s["duration"] for s in film["scenes"])
    print(f"film.json: {len(film['scenes'])} scenes, {tot:.1f} s{' (skeleton)' if sk else ''}")
    for m in missing:
        print("  PLACEHOLDER:", m)
    (HERE / "data" / "placeholders.json").write_text(json.dumps(missing, indent=1, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
