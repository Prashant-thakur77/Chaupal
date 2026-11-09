#!/usr/bin/env python3
"""Writes DEMO_SCRIPT.md at the repo root: the film's final narration with its beats and real timestamps
(from narration/timeline.json when it exists, else the planned order). Run after vo_timeline.py.

  python3 video/demo_script.py
"""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
N = json.loads((HERE / "narration.json").read_text())
TLp = HERE / "narration" / "timeline.json"
TL = json.loads(TLp.read_text()) if TLp.exists() else None
F = json.loads((HERE / "data" / "facts.json").read_text())
PH = json.loads((HERE / "data" / "placeholders.json").read_text()) if (HERE / "data" / "placeholders.json").exists() else []

PICTURE = {
    "open": "Real footage of India at dusk (stock, labelled): sunset over a river, a village path, hands at work, a city at night. Chalk pin: the living-alone figure with its source.",
    "stakes": "Chalk on the clay floor: two columns grow 10.5% → 20.8% (UNFPA 2023); a 10×10 dot grid lights 66 dots (HelpAge India 2025).",
    "turn": "Signature kolam loop opens on a 3D clay diya lighting in the dark; चौपाल written in chalk; लिखना · रंगोली · शतरंज; a 3D shatranj board, the knight takes the rook and lifts toward the lens.",
    "hero": "THE MOMENT: her tablet view and Rahul's phone view, live sessions of the deployed app. Her Hindi request in the dock; the agent moves घोड़ा × हाथी; a chalk line carries the move across to his phone; his pawn recaptures and it comes back.",
    "sulekh": "Real app: the agent sets शुभ दीपावली (HarfBuzz-shaped kalam reference); her tracing (labelled scripted); 'मेरी लकीरें मिटाएँ' clears only her layer; his phone shows the greeting.",
    "reveal": "The rangoli engine's own SVG drawn in chalk on the clay floor, ring by ring, then the colours settle; camera tilts up.",
    "rangoli": "Real app: 'बीच में पीला, बाहर लाल' to the agent; the centre fills yellow, the outer ring red.",
    "guard": "Real app: approval card 'क्या यह तस्वीर बच्चों को भेज दूँ?' → 'मत भेजो' → nothing sent. Then Rahul moves first; the agent's stale move is refused: conflict card 'राहुल ने पहले चाल चल दी'.",
    "hood": "Under the hood: a clay chabutra cut into tiers rising on their words: surfaces → one defineAction set → shared SQL with revisions + live sync → engines. A stale packet is refused; a Telegram packet waits at needsApproval until हाँ.",
    "proof": "Chalk dots, one per run: browser control only vs Chaupal's actions; tokens and seconds per try; OCR exact match shaped vs unshaped text. Footnote on method.",
    "recap": "Fast montage of the real captures (1 s cuts) behind four lines; the strongest number last.",
    "close": "Back to the lamp: the diya on the clay floor; end card चौपाल · Chaupal · chaupal.prashantthakur.dev (held 5 s).",
}


def ts(s):
    return f"{int(s // 60)}:{s % 60:04.1f}"


def main():
    starts = {s["id"]: s for s in (TL or {}).get("scenes", [])}
    lines = {l["id"]: l for l in (TL or {}).get("lines", [])}
    out = ["# Chaupal: demo film script", "",
           "The final narration and beats of the submission film, generated from `video/narration.json` and the voice timeline "
           "(`video/demo_script.py`). Every number is read from the repo at build time (`video/facts.py`).", ""]
    if TL:
        out.append(f"Length: {ts(TL['duration'])} (voice timeline; the picture adds the end-card hold).")
    else:
        out.append("Timings: planned (the voice timeline has not been built yet).")
    if PH:
        out += ["", "Placeholders still open: " + "; ".join(PH) + "."]
    out.append("")
    order = list(dict.fromkeys(l["scene"] for l in N))
    for sid in order:
        sc = starts.get(sid)
        head = f"## {sid}" + (f" · {ts(sc['start'])}–{ts(sc['start'] + sc['duration'])}" if sc else "")
        out += [head, "", f"*Picture:* {PICTURE.get(sid, '')}", ""]
        for l in N:
            if l["scene"] != sid:
                continue
            t = lines.get(l["id"])
            out.append(f"- {('`' + ts(t['start']) + '` ') if t else ''}{l['caption']}")
        out.append("")
    out += ["## Sources of the numbers", "",
            f"- {F['public']['elderShare2022']['value']}% → {F['public']['elderShare2050']['value']}% of Indians 60+ (2022 → 2050): {F['public']['elderShare2050']['source']}",
            f"- {F['public']['livingAlone']['value']}% of 60+ live alone: {F['public']['livingAlone']['source']}",
            f"- {F['public']['digitalConfusing']['value']}% of elders surveyed find digital tools too confusing: {F['public']['digitalConfusing']['source']}",
            f"- Eval (control vs Chaupal actions): {F['eval'].get('source')}",
            f"- Sync latency: {(F.get('sync') or {}).get('source', 'pending')} ({(F.get('sync') or {}).get('where', '')})",
            f"- OCR exact match: {(F.get('ocr') or {}).get('source', 'pending')}", ""]
    (ROOT / "DEMO_SCRIPT.md").write_text("\n".join(out))
    print("->", ROOT / "DEMO_SCRIPT.md")
    youtube(starts)


CHAPTERS = [("open", "An evening square, far from family"), ("hero", "One move, two cities (live)"), ("sulekh", "Sulekh: शुभ दीपावली, shaped right"),
            ("reveal", "Rangoli by voice"), ("guard", "Nothing leaves without her yes"), ("hood", "Under the hood: one Agent-Native action set"),
            ("proof", "Measured: actions vs browser control"), ("recap", "What it does, in one breath")]


def youtube(starts):
    film = json.loads((HERE / "film" / "film.json").read_text())
    t, st = 0.0, {}
    for sc in film["scenes"]:
        st[sc["id"]] = t
        t += sc["duration"]
    ev = F.get("eval") or {}
    chap, last = [], -99
    for sid, title in CHAPTERS:
        s0 = 0 if sid == "open" else st.get(sid, 0)
        if s0 - last >= 10:
            chap.append(f"{int(s0 // 60)}:{int(s0 % 60):02d} {title}")
            last = s0
    proof = (f"On {ev['cases']} cases written in an elder's voice ({ev['reps']} runs each), the same model passed {ev['B']['passed']} of {ev['B']['runs']} runs with Chaupal's actions and {ev['A']['passed']} of {ev['A']['runs']} with browser control only; it used more tokens per try ({ev['B']['tokens']:,} vs {ev['A']['tokens']:,}) and slightly less time ({ev['B']['seconds']} s vs {ev['A']['seconds']} s). Family sync on the deployed app: median {(F.get('sync') or {}).get('p50')} s from a move request to the other screen ({(F.get('sync') or {}).get('moves')} moves)."
             if ev.get("ready") else "[eval numbers pending: filled from evals/results/summary.json]")
    o = F.get("ocr") or {}
    md = [
        "# YouTube kit", "",
        "## Title (< 100 chars)", "",
        "Chaupal: Hindi voice, one chessboard, family in another city (Agent-Native Hackathon)", "",
        "## Description", "",
        "Many Indian elders now live far from their children, and most digital tools were never built for them. Chaupal is the village square as an app: "
        "she speaks Hindi, an agent writes her greeting in Devanagari calligraphy, draws a rangoli for her to fill, and plays shatranj with her, while her family joins the same board live from another city.",
        "",
        "Live app: https://chaupal.prashantthakur.dev",
        "Built for the Builder.io Agent-Native Hackathon (Oct 27 – Nov 9, 2026) with Agent-Native: one defineAction set behind voice, touch, the family's phone, an MCP App card and Telegram (needsApproval), over shared SQL with live sync.",
        "",
        f"Proof: {proof} Shaped Devanagari and four other scripts: OCR read {o.get('shaped')} of {o.get('n')} phrases back exactly, against {o.get('unshaped')} for unshaped text.",
        "",
        "Personas in the film are illustrative; both screens are live sessions of the deployed app. Opening footage is stock.", "",
        "## Chapters", "", *chap, "",
        "## Settings", "",
        "- Audience: not made for kids. Visibility: public (or unlisted) — the Clips upload must be public with no password or expiry.",
        "- Captions: upload `film.srt` (not burned into the master).",
        "- After upload: Content → Restrictions should say None (the music is composed in code).",
        "- Tags: agent-native, builder.io, hackathon, hindi, devanagari, calligraphy, rangoli, chess, shatranj, elders, family, india",
        "",
        "## Credits owed (for the owner to add in his own words; not added here)", "",
        "See `video/LICENSES.md`: one CC BY 3.0 clip in the opening owes an attribution; the rest is CC0, OFL or made for the film.", "",
    ]
    (HERE / "youtube.md").write_text("\n".join(md) + "\n")
    print("->", HERE / "youtube.md")


if __name__ == "__main__":
    main()
