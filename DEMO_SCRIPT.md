# Chaupal: demo film script

The final narration and beats of the submission film, generated from `video/narration.json` and the voice timeline (`video/demo_script.py`). Every number is read from the repo at build time (`video/facts.py`).

Length: 2:48.9 (voice timeline; the picture adds the end-card hold).

## open · 0:00.0–0:14.0

*Picture:* Real footage of India at dusk (stock, labelled): sunset over a river, a village path, hands at work, a city at night. Chalk pin: the living-alone figure with its source.

- `0:00.7` In an Indian village, the evening square is called the chaupal.
- `0:04.7` A lamp, a board, and someone across it.
- `0:08.0` For many elders now, the person across the board lives in another city.

## stakes · 0:14.0–0:25.7

*Picture:* Chalk on the clay floor: two columns grow 10.5% → 20.8% (UNFPA 2023); a 10×10 dot grid lights 66 dots (HelpAge India 2025).

- `0:14.4` By 2050, India's share of people over sixty doubles, to 20.8 percent.
- `0:20.2` And 66 percent of older people surveyed in ten cities find digital tools too confusing.

## turn · 0:25.7–0:36.1

*Picture:* Signature kolam loop opens on a 3D clay diya lighting in the dark; चौपाल written in chalk; लिखना · रंगोली · शतरंज; a 3D shatranj board, the knight takes the rook and lifts toward the lens.

- `0:26.8` So we rebuilt the square as an app, and called it Chaupal.
- `0:30.4` She speaks Hindi. An agent writes, draws and plays with her, and her family joins at the same board.

## hero · 0:36.1–0:55.1

*Picture:* THE MOMENT: her tablet view and Rahul's phone view, live sessions of the deployed app. Her Hindi request in the dock; the agent moves घोड़ा × हाथी; a chalk line carries the move across to his phone; his pawn recaptures and it comes back.

- `0:36.7` This is the live app in two sessions: her tablet view, and her grandson's phone view.
- `0:42.0` She asks in Hindi: take his rook with the knight.
- `0:46.2` Her words are resolved on the real board, and the move reaches his phone in a median of 3.94 seconds.
- `0:51.6` He takes back with a pawn, and his move comes home the same way.

## sulekh · 0:55.1–1:09.7

*Picture:* Real app: the agent sets शुभ दीपावली (HarfBuzz-shaped kalam reference); her tracing (labelled scripted); 'मेरी लकीरें मिटाएँ' clears only her layer; his phone shows the greeting.

- `0:56.2` For Diwali, she wants to show him a greeting.
- `0:59.0` Her words become the reference. HarfBuzz shapes the text, so every conjunct and vowel sign is exactly right.
- `1:05.0` She traces it with her finger. Her lines stay on their own layer, and only hers can be erased.

## reveal · 1:09.7–1:16.2

*Picture:* The rangoli engine's own SVG drawn in chalk on the clay floor, ring by ring, then the colours settle; camera tilts up.

- `1:10.1` For the doorstep, a rangoli. A generator draws it; the agent only sets the design.

## rangoli · 1:16.2–1:23.2

*Picture:* Real app: 'बीच में पीला, बाहर लाल' to the agent; the centre fills yellow, the outer ring red.

- `1:16.5` She says: yellow in the middle, red outside. Exactly those regions fill.

## guard · 1:23.2–1:34.2

*Picture:* Real app: approval card 'क्या यह तस्वीर बच्चों को भेज दूँ?' → 'मत भेजो' → nothing sent. Then Rahul moves first; the agent's stale move is refused: conflict card 'राहुल ने पहले चाल चल दी'.

- `1:23.5` Nothing leaves the house until she says yes. When she says don't send, nothing is sent.
- `1:29.0` And if Rahul moves first, the agent's stale move is refused, and she sees why.

## hood · 1:34.2–1:58.2

*Picture:* Under the hood: a clay chabutra cut into tiers rising on their words: surfaces → one defineAction set → shared SQL with revisions + live sync → engines. A stale packet is refused; a Telegram packet waits at needsApproval until हाँ.

- `1:35.3` Underneath, it's one set of Agent-Native actions.
- `1:38.4` Her voice, her touch, Rahul's phone, Claude through an MCP App card, and Telegram all call the same defineAction.
- `1:45.7` Every write is checked against the board's revision in shared SQL, and live sync carries it to both screens.
- `1:52.0` Engines own the truth: HarfBuzz for text, a rangoli generator, chess.js for the rules.

## proof · 1:58.2–2:27.3

*Picture:* Chalk dots, one per run: browser control only vs Chaupal's actions; tokens and seconds per try; OCR exact match shaped vs unshaped text. Footnote on method.

- `1:58.6` We measured it: 21 cases written in an elder's voice, 2 runs each.
- `2:04.2` The same model with only browser control passed 8 of 42. With the app's actions, 40 of 42.
- `2:10.0` It does use more tokens per try: about 49,000, against 36,000.
- `2:15.2` And OCR reads 21 of 50 shaped phrases exactly, against 8 for unshaped text.
- `2:21.8` One case still fails: before its Hindi reply, the agent sometimes writes an English aside.

## recap · 2:27.3–2:39.9

*Picture:* Fast montage of the real captures (1 s cuts) behind four lines; the strongest number last.

- `2:28.4` Her language, not an app's.
- `2:31.0` Her family, at the same board.
- `2:33.2` Nothing leaves without her say.
- `2:35.8` And 40 of 42 where browser control alone managed 8.

## close · 2:39.9–2:48.9

*Picture:* Back to the lamp: the diya on the clay floor; end card चौपाल · Chaupal · chaupal.prashantthakur.dev (held 5 s).

- `2:40.4` The square is open again, wherever the family is.

## Sources of the numbers

- 10.5% → 20.8% of Indians 60+ (2022 → 2050): UNFPA India Ageing Report 2023
- 5.7% of 60+ live alone: LASI Wave 1 (2017-18), Table 5.3
- 66% of elders surveyed find digital tools too confusing: HelpAge India, June 2025 (10-city survey)
- Eval (control vs Chaupal actions): evals/results/summary.json (iteration-001 vs iteration-006)
- Sync latency: evals/measure/sync-latency.deployed.json (deployed)
- OCR exact match: evals/render-accuracy/results.json
