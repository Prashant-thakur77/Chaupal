# Storyboard: Chaupal (target ~2:35; no length rule, soft)

> Final wording and real timestamps: `/DEMO_SCRIPT.md` (generated from `narration.json` and the voice timeline). This table is the plan it was built from.

## First line: three candidates
1. *A moment:* "In an Indian village, the evening square is called the chaupal: a lamp, a board, and someone across it." ← **picked** (it names the product's world, the person and the loss in one picture; the next line turns it)
2. *A question:* "What happens to the evening game when the person across the board moves to another city?"
3. *A reframe:* "Everyone says the internet is too hard for India's elders. It just never spoke their language."

Spine: Once, the square at dusk had someone across the board → every day now, the family is in another city and apps
don't speak her language → so she speaks Hindi and the agent works the board → because of that the move lands on
his phone, her greeting is spelled right, her rangoli fills, nothing leaves without her yes → until finally the same
model does better with Chaupal's actions than with browser control alone → and ever since, the square is open again.

Length decision: no rule; aim ~2:35. Everything a judge must see (who, the live two-session product, Agent-Native
doing the work, the proof number vs baseline) lands by ~2:20.

Personas: "Amma" (never named in narration; "she") and "Rahul" (the name used in the app's invite) are
**illustrative**, labelled on screen at the first live shot. Stock people are footage, not personas.
Hindi: the narrator stays in English; every Hindi request is shown in Devanagari on the real screen plus a burned
English sub-line (chip). Words the narrator says: Chaupal, rangoli, shatranj only (respelled for the voice).

## Beats

Numbers in `{}` are read at render time by `facts.py` (sources in the last column). Times are planned; the voice-first
timeline (`vo_timeline.py`) sets the real ones.

| # | t (s) | Scene | Narration (caption spelling) | Picture | Motion | Caption emphasis | Sound | Number source |
|---|---|---|---|---|---|---|---|---|
| 1 | 0–5 | `open` footage | In an Indian village, the evening square is called the chaupal. | A village path, hands at work, city lights from orbit (CC0 / public-domain footage) | slow push 4%, warm grade toward indigo | **chaupal** | tanpura drone fades in 2 s, bansuri first phrase | – |
| 2 | 5–9 | `open` | A lamp, a board, and someone across it. | Close: lamps; hands (footage); a chalk dot grid fades up over the last shot | slow pan, chalk dots rise | lamp · board · **someone** | bansuri | – |
| 3 | 9–15 | `open` | For many elders now, the person across the board lives in another city. | City at night (footage); pinned chalk chip "5.7% of Indians 60+ live alone · LASI Wave 1, 2017–18" | label pins with a 12 px rise | **another city** | bansuri holds | LASI Table 5.3 via EVIDENCE.md (constant in facts.py with its source) |
| 4 | 15–27 | `stakes` ChalkNumbers | By 2050, India's share of people over sixty doubles, to 20.8 percent. And 66 percent of older people surveyed in ten cities find digital tools too confusing. | Clay floor; "10.5% → 20.8%" drawn in chalk, two chalk bars growing; then a 10×10 dot grid with 66 dots lit marigold; sources under each | count-up 0.8 s, dots light in a wave | **20.8%**, **66%** | drone, a low tabla bayan "ge" on each number | UNFPA India Ageing Report 2023 p.20; HelpAge India June 2025 (Outlook Money) |
| 5 | 27–30 | KolamLoop | – (0.4 s breath) | **Signature transition**: dots, one chalk line weaves and closes, iris of lamplight | 1.4 s line, 0.6 s iris | – | chalk scrape + santoor note on close | – |
| 6 | 30–38 | `turn` Diya3D + wordmark | So we built Chaupal: the village square, as an app. She speaks Hindi; an agent writes, draws and plays with her, and her family joins at the same board. | 3D clay diya lights in the dark (match cut from the footage lamp), flame grows; चौपाल / Chaupal wordmark in chalk; three words rise: लिखना · रंगोली · शतरंज | camera dolly-in on the flame, slow 12° orbit | **Chaupal**, **same board** | santoor enters (the drop) on "Chaupal" | – |
| 7 | 38–44 | `hero` TwoCities (split) | This is the live app in two sessions: her tablet view, and her grandson's phone view. | Real capture: tablet board (left), phone board (right, "Rahul जुड़ गए"); chip: "Illustrative personas · live app, real screens" | the split slides together from the diya light | **live app** | tabla keherwa starts soft | – |
| 8 | 44–48 | `hero` | She asks in Hindi: take his rook with the knight. | Her request in the dock: "घोड़े से उसका हाथी मार दो" + English chip; diya → "creating" | push in on the request 1.6× | **in Hindi** | – then **silence 0.8 s** | – |
| 9 | 48–55 | `hero` | The agent finds the move on the real board, and it lands on his phone in {sync_p50} seconds. | **Memorable moment**: घोड़ा takes हाथी (real capture); chalk line draws across the seam, a marigold disc runs it, the phone board updates (real); "{sync_p50} s" in chalk on the line | disc travels 0.6 s, camera follows | **{sync_p50} seconds** | wooden clack on the capture, santoor rising run, hit when it lands | `evals/measure/sync-latency.deployed.json` (else `sync-latency.json`), elderToFamily.p50Ms |
| 10 | 55–60 | `hero` | He takes back with a pawn, and his move comes home the same way. | Phone: g-pawn takes on h6 (real); the line runs back right → left; her board updates | camera swings to the phone, then back | **comes home** | clack, soft hit | – |
| 11 | 60–64 | `sulekh` screen | For Diwali, she wants to show him a greeting. | Tablet: request "पोते को दिवाली पर 'शुभ दीपावली' दिखाना है" typed in the dock (chip "typed for the recording") | push on the dock | **greeting** | tabla light | – |
| 12 | 64–72 | `sulekh` | The agent picks the words and the style. HarfBuzz shapes the text, so every conjunct and vowel sign is exactly right. | Real: शुभ दीपावली kalam reference appears on paper; overlay: the real engine SVG strokes drawing on, one conjunct circled in chalk | camera pushes 1.8× onto दीपावली | **HarfBuzz**, **exactly right** | ink stroke swishes | – |
| 13 | 72–78 | `sulekh` | She traces it with her finger. Her lines stay on their own layer, and only hers can be erased. | Real: indigo strokes over the reference ("tracing drawn by the recording script"), then "मेरी लकीरें मिटाएँ" clears only them | follow the stroke | **only hers** | chalk scratch, soft whoosh on erase | – |
| 14 | 78–80 | KolamLoop | – | signature transition, into the rangoli | | | scrape + santoor | |
| 15 | 80–87 | `rangoli` RangoliReveal → screen | For the doorstep, a rangoli. A generator draws it; the agent only sets the design. | The engine's rangoli SVG draws on in chalk on clay (3D tilt down onto the floor), then cut to the same design on the real tablet | line draw 1.6 s, camera tilts from floor to screen | **generator** | powder puff | – |
| 16 | 87–95 | `rangoli` screen | She says: yellow in the middle, red outside. Exactly those regions fill. | Real: "बीच में पीला, बाहर लाल" request; centre fills पीला, outer ring लाल | push to the centre, then pull out | **yellow**, **red** | two powder puffs on the fills | – |
| 17 | 95–103 | `guard` screen | Nothing leaves the house without her yes. When she says don't send, nothing is sent. | Real approval card "क्या यह तस्वीर बच्चों को भेज दूँ?" · हाँ, भेज दो / मत भेजो; cursor on मत भेजो; status "not sent" | dim to 40% around the card | **her yes**, **nothing is sent** | tick on the click | – |
| 18 | 103–109 | `guard` screen | And if Rahul moves first, the agent's stale move is refused, and she sees why. | Real conflict card "राहुल ने पहले चाल चल दी" | push on the card | **refused** | low thud | – |
| 19 | 109–111 | KolamLoop | – | signature transition into the stack | | | | |
| 20 | 111–133 | `hood` Chabutra (arch3d) | Underneath, it's one set of Agent-Native actions. Her voice, her touch, Rahul's phone, Claude through an MCP App card, and Telegram all call the same defineAction. Every write is checked against the revision in shared SQL, and live sync streams it to both screens. Engines own the truth: HarfBuzz for text, a rangoli generator, chess.js for the rules. | Clay platform tiers rise on their words: Surfaces → defineAction → SQL + revisions + live sync → Engines; packets of light climb; a stale packet is refused at the revision tier; a Telegram packet waits at "needsApproval" until "हाँ" | slow 17° orbit, gentle dolly | **defineAction**, **live sync**, **engines** | sparse tabla, slab thuds, tick + hit on the block | – |
| 21 | 133–150 | `proof` | We measured it on {cases} cases written in an elder's voice, {reps} runs each. The same model with only browser control passed {A_pass} of {A_runs}. With Chaupal's actions, {B_pass} of {B_runs}. And OCR reads {ocr_shaped} of 50 shaped phrases exactly, against {ocr_unshaped} for unshaped text. Calligraphic Urdu is still hard: {urdu_shaped} of 10. | Two chalk columns of dots (one per run): control fills first in chalk, Chaupal fills in marigold; tokens/try and s/try in small text; then OCR row; footnote "same model, same cases; control = browser control only; OCR = tesseract exact match" | dots fill, delta badge pops | **{B_pass} of {B_runs}** | silence 0.5 s before the badge, then a hit | `evals/results/summary.json` (from `evals/iterations/iteration-*/benchmark.json` + `manifest.json`); `evals/render-accuracy/results.json` |
| 22 | 150–152 | KolamLoop | – | into the recap | | | riser | |
| 23 | 152–164 | `recap` montage | Her language, not an app's. Her family, at the same board. Her yes, before anything leaves. | ~1 s cuts of the real captures; kinetic lines: "She speaks Hindi. The board moves." · "Her family plays from another city, live." · "Every letter shaped right, by construction." · "Nothing leaves the house without her yes." · "{B_pass}/{B_runs} with actions · {A_pass}/{A_runs} without" | 1 s cuts on beats, flash on each | each line's last word | the lift: full tabla, bansuri up an octave; soft hit per line | summary.json |
| 24 | 164–172 | `close` Diya3D + endcard | The square is open again, wherever the family is. | Back to the footage dusk, the diya, the two screens side by side small; end card चौपाल Chaupal · chaupal.prashantthakur.dev · Agent-Native Hackathon 2026 (held 5 s) | slow pull back, flame breathes | **open again** | resolve on Sa, tanpura alone | – |

Product first on screen: ~0:38 (beat 7). Proof lands: ~2:20 (beat 21).

## Shot list for capture (`shots.json`, recorded last, on the deployed app)
- S-two: tablet 1366×1024 at `/chaupal` + phone 390×844 at the join link; set-up moves (1. Nf3 h5 2. Nh4 Rh6 3. Nf5 a6) via
  actions; hero move through the in-app agent ("घोड़े से उसका हाथी मार दो"); Rahul's reply g7×h6 from the phone UI.
- S-sulekh: agent request "पोते को दिवाली पर 'शुभ दीपावली' दिखाना है"; tracing strokes by pointer drag; "मेरी लकीरें मिटाएँ".
- S-rangoli: set-rangoli-reference diwali; agent request "बीच में पीला, बाहर लाल" (or fill-region).
- S-guard: draft-family-update → approval card → "मत भेजो"; conflict: family-move then a stale elder move → conflict card.
- S-recap: short extra takes for the montage (diya phases, album).
No human shots needed: no founder on camera (the user did not ask for one), stock footage for the opening.
