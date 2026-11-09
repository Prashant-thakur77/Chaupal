# YouTube kit

## Title (< 100 chars)

Chaupal: Hindi voice, one chessboard, family in another city (Agent-Native Hackathon)

## Description

Many Indian elders now live far from their children, and most digital tools were never built for them. Chaupal is the village square as an app: she speaks Hindi, an agent writes her greeting in Devanagari calligraphy, draws a rangoli for her to fill, and plays shatranj with her, while her family joins the same board live from another city.

Live app: https://chaupal.prashantthakur.dev
Built for the Builder.io Agent-Native Hackathon (Oct 27 – Nov 9, 2026) with Agent-Native: one defineAction set behind voice, touch, the family's phone, an MCP App card and Telegram (sent only after her own haan), over shared SQL with live sync.

Proof: On 21 cases written in an elder's voice (2 runs each), the same model passed 40 of 42 runs with Chaupal's actions and 8 of 42 with browser control only; it used more tokens per try (49,254 vs 35,581) and slightly less time (10.2 s vs 11.7 s). Family sync on the deployed app: median 3.94 s from a move request to the other screen (50 moves). Shaped Devanagari and four other scripts: OCR read 21 of 50 phrases back exactly, against 8 for unshaped text.

Personas in the film are illustrative; both screens are live sessions of the deployed app. Opening footage is stock.

## Chapters

0:00 An evening square, far from family
0:36 One move, two cities (live)
0:54 Sulekh: शुभ दीपावली, shaped right
1:09 Rangoli by voice
1:22 Her yes, and it reaches the family's Telegram
1:39 Under the hood: one Agent-Native action set
2:03 Measured: actions vs browser control
2:32 What it does, in one breath

## Settings

- Audience: not made for kids. Visibility: public (or unlisted) — the Clips upload must be public with no password or expiry.
- Captions: upload `film.srt` (not burned into the master).
- After upload: Content → Restrictions should say None (the music is composed in code).
- Tags: agent-native, builder.io, hackathon, hindi, devanagari, calligraphy, rangoli, chess, shatranj, elders, family, india

## Licences

Nothing in the film requires attribution (CC0 / public-domain footage, OFL fonts, music and effects made for the film); see `video/LICENSES.md`.

