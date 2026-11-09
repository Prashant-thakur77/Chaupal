#!/usr/bin/env python3
"""The film's words, with every number filled from data/facts.json (run facts.py first).

  python3 video/narration.py      -> video/narration.json (+ DEMO_SCRIPT.md at the repo root)

caption = what the captions show (real spelling); spoken = respelled for the voice (numbers in words, acronyms
spaced). Story lines are slower and warmer, product lines brisker, the recap lifted (references/audio.md).
"""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
F = json.loads((HERE / "data" / "facts.json").read_text())

STORY = {"exaggeration": 0.55, "cfg": 0.32}
PRODUCT = {"exaggeration": 0.62, "cfg": 0.4}
RECAP = {"exaggeration": 0.75, "cfg": 0.34}

ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()


def words(n):
    """Integer or decimal to words, the way a narrator reads it ('twenty point eight', 'zero point three one')."""
    if isinstance(n, float) and not n.is_integer():
        a, b = f"{n}".split(".")
        return words(int(a)) + " point " + " ".join(ONES[int(c)] for c in b)
    n = int(n)
    if n < 20:
        return ONES[n]
    if n < 100:
        return TENS[n // 10] + ("" if n % 10 == 0 else "-" + ONES[n % 10])
    if n < 1000:
        return ONES[n // 100] + " hundred" + ("" if n % 100 == 0 else " and " + words(n % 100))
    if n < 100000:
        return words(n // 1000) + " thousand" + ("" if n % 1000 == 0 else " " + words(n % 1000))
    return str(n)


P = F["public"]
SYNC = F.get("sync") or {}
EV = F.get("eval") or {}
OCR = F.get("ocr") or {}

L = []


def line(scene, lid, caption, spoken=None, style=PRODUCT, **kw):
    L.append({"scene": scene, "id": lid, "caption": caption, "spoken": spoken or caption, **style, **kw})


# 1. open: real footage at dusk
line("open", "o1", "In an Indian village, the evening square is called the chaupal.",
     "In an Indian village, the evening square is called the chow-paal.", STORY)
line("open", "o2", "A lamp, a board, and someone across it.", None, STORY)
line("open", "o3", "For many elders now, the person across the board lives in another city.", None, STORY)

# 2. stakes: chalk numbers
e50, dig = P["elderShare2050"]["value"], P["digitalConfusing"]["value"]
line("stakes", "s1", f"By 2050, India's share of people over sixty doubles, to {e50} percent.",
     f"By twenty fifty, India's share of people over sixty doubles, to {words(e50)} percent.", STORY)
line("stakes", "s2", f"And {dig} percent of older people surveyed in ten cities find digital tools too confusing.",
     f"And {words(dig)} percent of older people surveyed in ten cities find digital tools too confusing.", STORY)

# 3. the turn
line("turn", "t1", "So we rebuilt the square as an app, and called it Chaupal.",
     "So we rebuilt the square as an app, and called it chow-paal.", STORY)
line("turn", "t2", "She speaks Hindi. An agent writes, draws and plays with her, and her family joins at the same board.", None, STORY)

# 4. the hero: two devices, one board
line("hero", "h1", "This is the live app in two sessions: her tablet view, and her grandson's phone view.")
line("hero", "h2", "She asks in Hindi: take his rook with the knight.")
if SYNC.get("p50") is not None and SYNC.get("where") == "deployed":
    p50 = SYNC["p50"]
    line("hero", "h3", f"Her words are resolved on the real board, and the move reaches his phone in a median of {p50} seconds.",
         f"Her words are resolved on the real board, and the move reaches his phone in a median of {words(float(p50))} seconds.", pauseBefore=0.8)
else:
    line("hero", "h3", "Her words are resolved on the real board, and the move reaches his phone.",
         "Her words are resolved on the real board, and the move reaches his phone.", pauseBefore=0.8)
line("hero", "h4", "He takes back with a pawn, and his move comes home the same way.")

# 5. sulekh
line("sulekh", "k1", "For Diwali, she wants to show him a greeting.")
line("sulekh", "k2", "Her words become the reference. HarfBuzz shapes the text, so every conjunct and vowel sign is exactly right.",
     "Her words become the reference. Harf Buzz shapes the text, so every conjunct and vowel sign is exactly right.")
line("sulekh", "k3", "She traces it with her finger. Her lines stay on their own layer, and only hers can be erased.")

# 6. rangoli
line("reveal", "r1", "For the doorstep, a rangoli. A generator draws it; the agent only sets the design.",
     "For the doorstep, a rung-o-lee. A generator draws it; the agent only sets the design.")
line("rangoli", "r2", "She says: yellow in the middle, red outside. Exactly those regions fill.")

# 7. the guard
line("guard", "g1", "Nothing leaves the house until she says yes. When she says don't send, nothing is sent.")
line("guard", "g2", "And if Rahul moves first, the agent's stale move is refused, and she sees why.")

# 8. under the hood
line("hood", "a1", "Underneath, it's one set of Agent-Native actions.", "Underneath, it's one set of agent native actions.")
line("hood", "a2", "Her voice, her touch, Rahul's phone, Claude through an MCP App card, and Telegram all call the same defineAction.",
     "Her voice, her touch, Rahul's phone, Claude through an M C P app card, and Telegram all call the same define action.")
line("hood", "a3", "Every write is checked against the board's revision in shared SQL, and live sync carries it to both screens.",
     "Every write is checked against the board's revision in shared S Q L, and live sync carries it to both screens.")
line("hood", "a4", "Engines own the truth: HarfBuzz for text, a rangoli generator, chess.js for the rules.",
     "Engines own the truth: Harfbuzz for text, a rangoli generator, chess J S for the rules.")

# 9. proof
if EV.get("ready"):
    A, B = EV["A"], EV["B"]
    line("proof", "p1", f"We measured it: {EV['cases']} cases written in an elder's voice, {EV['reps']} runs each.",
         f"We measured it: {words(EV['cases'])} cases written in an elder's voice, {words(EV['reps'])} runs each.")
    line("proof", "p2", f"The same model with only browser control passed {A['passed']} of {A['runs']}. With the app's actions, {B['passed']} of {B['runs']}.",
         f"The same model with only browser control passed {words(A['passed'])} of {words(A['runs'])}. With the app's actions, {words(B['passed'])} of {words(B['runs'])}.",
         pauseBefore=0.5)
else:
    line("proof", "p1", "We measured it: the same model, the same cases written in an elder's voice, with Chaupal's actions and with browser control only.",
         "We measured it: the same model, the same cases written in an elder's voice, with chow-paal's actions and with browser control only.")
if EV.get("ready"):
    A, B = EV["A"], EV["B"]
    ka, kb = round(A["tokens"] / 1000), round(B["tokens"] / 1000)
    if B["tokens"] > A["tokens"]:
        line("proof", "p2b", f"It does use more tokens per try: about {kb},000, against {ka},000.",
             f"It does use more tokens per try: about {words(kb)} thousand, against {words(ka)} thousand.")
if OCR:
    line("proof", "p3", f"And OCR reads {OCR['shaped']} of {OCR['n']} shaped phrases exactly, against {OCR['unshaped']} for unshaped text.",
         f"And O C R reads {words(OCR['shaped'])} of {words(OCR['n'])} shaped phrases exactly, against {words(OCR['unshaped'])} for unshaped text.")
if EV.get("ready") and EV.get("failures"):
    n_fail = len(EV["failures"])
    line("proof", "p4", f"{'One case still fails' if n_fail == 1 else str(n_fail) + ' cases still fail'}: before its Hindi reply, the agent sometimes writes an English aside.")

# 10. recap
line("recap", "c1", "Her language, not an app's.", None, RECAP)
line("recap", "c2", "Her family, at the same board.", None, RECAP)
line("recap", "c3", "Nothing leaves without her say.", None, RECAP)
if EV.get("ready") and EV.get("better"):
    A, B = EV["A"], EV["B"]
    line("recap", "c4", f"And {B['passed']} of {B['runs']} where browser control alone managed {A['passed']}.",
         f"And {words(B['passed'])} of {words(B['runs'])} where browser control alone managed {words(A['passed'])}.", RECAP)

# 11. close
line("close", "z1", "The square is open again, wherever the family is.", None, STORY)

(HERE / "narration.json").write_text(json.dumps(L, indent=1, ensure_ascii=False) + "\n")
n = sum(len(x["caption"].split()) for x in L)
print(f"narration.json: {len(L)} lines, {n} words (~{n / 2.6:.0f} s of speech at 156 wpm)")
