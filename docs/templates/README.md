# Chaupal

Chaupal is a village square on a screen for Indian elders. She says what she wants in Hindi, Punjabi, Tamil, Marathi or Bengali, and her own agent puts a live activity in front of her: a calligraphy phrase to trace, a rangoli or pulli kolam to trace and colour, or a game of shatranj with Hindi piece names. Her grandson in another city can open a link and sit at the same board.

Live: https://chaupal.prashantthakur.dev (no account needed; tap "शुरू करें").

## What she can do

**Sulekh (calligraphy).** "पोते को दिवाली पर 'शुभ दीपावली' दिखाना है" puts शुभ दीपावली on her screen in a kalam style, ready to trace with a finger, or in the air with her hand if she asks for the camera. Chaupal shapes the text itself with HarfBuzz and an OFL font, so conjuncts and matras (क्ष, त्र, ज्ञ, कि) are always right. It covers Devanagari, Gurmukhi, Tamil, Bengali and Urdu Nastaliq, in kalam, brush and modern styles. Her strokes stay on their own layer; "sirf meri lakeerein mitao" erases only those.

**Rangoli and kolam.** The agent sets parameters; Chaupal draws the design: a pulli kolam on an N×N dot grid whose loops are checked for closure and symmetry, a radial rangoli with lotus, diya, peacock-feather, mango-leaf or geometric rings, or a pookalam. "Beech mein peela, bahar laal" colours exactly those regions. Festival presets are used only when she names the festival.

**Shatranj.** chess.js owns the rules. "Raja ke saamne waala pyada do ghar aage" plays e2–e4; "ghode se uska oont maar do" takes the bishop with the knight when only one knight can; when two moves fit, she is asked which one. An illegal move is refused with a reason in Hindi and the board does not change. "Pehle dikhao" shows where a piece can go without moving it. If she says she'll move by hand, her drag goes back to the waiting agent, which replies.

**Family at the same board.** "Rahul ko bulao, woh doosri taraf se khelega" creates a private link. On his phone Rahul sees the same live board and plays the other side; the agent stops moving for that side. If the agent and Rahul move at once, the slower write is refused and her screen says "Rahul ने पहले चाल चल दी". A family update to Telegram needs her own "हाँ, भेज दो" on her screen; "मत भेजो" sends nothing. Camera, audio and her conversation never reach the family.

## How it is built on Agent-Native

Every operation is one `defineAction` in [`actions/`](actions). The same actions are called by her screen, the in-app agent, the grandson's phone, Claude or any MCP host (with an inline MCP App card of the live board), browser agents through WebMCP, and the evaluation runner. The agent interprets her language and chooses among valid options; the engines own the truth: HarfBuzz for text, the kolam and rangoli generator for designs, chess.js for moves.

State lives in Postgres through Drizzle (`chaupal_*` tables). Each household has one revision counter, and every write goes through the framework's `saveIfCurrent`, so a stale caller gets `save_conflict` and nothing changes. The household is a shareable resource: a family member's guest identity gets a share grant, which lets the framework's live sync reach their phone. Saved works are kept in the album and as versions through the History toolkit. Sending to Telegram is gated by `needsApproval` and by her own approval card. The diya on screen follows the agent's run state.

The app runs as Node functions on Netlify behind a Cloudflare edge proxy at chaupal.prashantthakur.dev, with Postgres hosted separately.

## Proof

We rebuilt the base repo's evaluation for India: 21 cases frozen before any run (its 15 cases ported one to one, plus 4 rangoli and kolam cases and 2 family cases), written in an elder's voice in Hindi, Hinglish, Punjabi, Tamil and Marathi, two repetitions each. The same model, `claude-sonnet-5-5`, ran both conditions on the same page, and grading reads only what ends up on screen.

| Condition | Task success | Tokens per try | Seconds per try |
|---|---:|---:|---:|
| A. Browser control only (no actions) | {{A_PASS}}/{{A_RUNS}} ({{A_RATE}}) | {{A_TOKENS}} | {{A_SECS}} |
| B. Chaupal actions (best accepted iteration) | {{B_PASS}}/{{B_RUNS}} ({{B_RATE}}) | {{B_TOKENS}} | {{B_SECS}} |

B uses more tokens than A; each of its tool results carries the live state and the next valid actions. Five candidate iterations followed the base repo's rule of one bounded change at a time with a computed acceptance gate; one was rejected, and every artifact is kept in [`evals/iterations`](evals/iterations). The remaining failure is one case, twice: before its Hindi reply the agent wrote an English aside, which the conversation judge counts against it.

Family sync on the live deployment, from a move request until the other device shows it: p50 {{SYNC_P50}} s, p95 {{SYNC_P95}} s over {{SYNC_N}} moves. The deployment polls for changes from serverless functions; on a long-lived local server the same measure is about 1 s.

Indic text, 50 phrases in 5 scripts, read back with OCR: provider-shaped renders matched exactly {{OCR_SHAPED}}/50 times against {{OCR_UNSHAPED}}/50 for the same text drawn without shaping (calligraphic fonts), and {{OCR_SHAPED_PLAIN}}/50 against {{OCR_UNSHAPED_PLAIN}}/50 with the plainest font per script. OCR misreads calligraphic letterforms, so the absolute numbers understate the shaped renders, all of which passed exact-text validation before OCR.

Method, every case and every failure are in [EVALUATION.md](EVALUATION.md); the same numbers are on the app's [/proof](https://chaupal.prashantthakur.dev/proof) page. Sources for the need are in [EVIDENCE.md](EVIDENCE.md).

## Run it

```bash
pnpm install
cp .env.example .env    # add ANTHROPIC_API_KEY; AUTH_DISABLED=true for local use
pnpm dev                # http://localhost:8080
```

Engines have their own tests: `pnpm exec vitest run app/engines`. The evaluation runner and how to reproduce every number are in [evals/README.md](evals/README.md).

## What it is not

It has not been tested with an elder yet. It does not claim to reduce loneliness, improve health or teach digital skills. It is a live activity that she can start in her own words and continue with her own hands.
