# Submission form text

Paste each block into the matching field at https://www.builder.io/hackathon/submit. Fill the bracketed fields yourself.

## First name / Last name / Email

[your first name] / [your last name] / [your email]

## Project name

Chaupal

## Project or GitHub URL

https://github.com/Prashant-thakur77/Chaupal

## Public Clips recording URL

[public Clips link, viewable without login]

## Slides URL (optional)

[leave empty or add]

## Project description

Chaupal is a village square on a screen for Indian elders, built with Agent-Native. She speaks in Hindi, Punjabi, Tamil, Marathi or Bengali, and her own agent opens a live activity she can continue with her own hands: Sulekh calligraphy to trace (Devanagari, Gurmukhi, Tamil, Bengali, Urdu), a rangoli or pulli kolam to trace and colour by voice ("beech mein peela, bahar laal"), or shatranj with Hindi piece names ("ghode se uska oont maar do"). Her grandson in another city opens a link and plays the other side of the same live board.

Live app: https://chaupal.prashantthakur.dev

How it uses Agent-Native: every operation is one defineAction, and the same actions are called by her screen, the in-app agent (Hindi voice in), the grandson's phone, Claude through MCP (with an MCP App card of the live board), browser agents through WebMCP, and our evaluation runner. State is in Postgres via Drizzle with one revision per household; every write goes through saveIfCurrent, so when the agent and the grandson move at once the slower write is refused and her screen says who moved first. The household is a shareable resource, so a family member's share grant lets live sync reach their phone. Saved works go to an album and into the History toolkit. A family update to Telegram is gated by needsApproval and her own "haan, bhej do"; "mat bhejo" sends nothing. The engines own the truth: HarfBuzz shapes the calligraphy text (image models break Indic conjuncts), a deterministic generator draws and validates the kolam and rangoli, and chess.js owns every move.

Measured result: 21 frozen cases in an elder's voice, two repetitions each, same model (claude-sonnet-5-5) on the same page. Browser control alone completed 8/42 (19.0%); with Chaupal's actions 40/42 (95.2%), at 49,254 tokens and 10.2 s per try (more tokens than control's 35,581). Family sync on the live deployment: p95 5.06 s from a move on one device to the other's screen. What still fails: in one case the agent writes an English aside before its Hindi reply, and the conversation judge fails it.

Pre-existing work, templates and third-party assets, and what changed during the event:

- The base repo, [name and link of the base repo: add yourself], a prior hackathon project (Korean calligraphy and Janggi through WebMCP tools), MIT licence. Chaupal reuses and adapts its WebGPU human-stroke layer, its ONNX hand-tracking pipeline for air-writing, its vGPU board renderer and glyph atlas, its presence orb renderer, its WebMCP tool-contract pattern (revisions, validNextActions), and the method and structure of its evaluation runner.
- The Agent-Native chat template (@agent-native/core 0.226.0) as the app scaffold.
- Libraries: @agent-native/core and toolkit, React, React Router, Drizzle, chess.js, harfbuzzjs, resvg, onnxruntime-web, vgpu, Playwright (evaluation), tesseract.js (OCR measurement).
- Fonts (all SIL Open Font License, licence files kept in public/fonts): Kalam, Amita, Yatra One, Tiro Devanagari Hindi, Rozha One, Baloo Paaji 2, Mukta Mahee, Catamaran, Meera Inimai, Galada, Baloo Da 2, Noto Nastaliq Urdu.
- The hand-landmark ONNX model (Apache-2.0, licence file kept) used by the base repo's air-writing pipeline.
- Film assets: listed in video/LICENSES.md.
- Everything else was built during the event, starting 9 November 2026: the move to Agent-Native (all actions, Postgres schema and revisions, live sync, guest households and family links, conflict card, approval-gated Telegram updates, MCP App card, WebMCP scoping, History versions); Sulekh text shaping and validation in five scripts; the kolam, rangoli and pookalam generator; the Hindi, Punjabi and Tamil chess move resolver; the living diya; the Hindi and English interface with activity strings in Punjabi, Tamil, Marathi and Bengali; the design system; the 21-case India evaluation and its results; and the film.

Team: [names of everyone on the team]

## Checkbox

Tick the rules, eligibility and data-processing box. You must be 18 or older.
