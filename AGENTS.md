# Chaupal: agent guide

Chaupal is a village square on a screen for an Indian elder. She speaks in her own language; the agent opens a live activity she continues herself: Sulekh calligraphy to trace, a rangoli or pulli kolam to trace and colour, or shatranj with Hindi piece names. Family can join the same live board from another city. The elder's screen is `/chaupal`; a family member's phone is `/family`; the MCP App card is `/embed/live`; results are at `/proof`.

## Rules

- Actions own the truth. HarfBuzz shapes calligraphy text, the kolam/rangoli generator draws designs, chess.js owns moves. Choose among valid options and set parameters; never invent a render, a design or a position.
- Every result carries `revision` and `validNextActions`. Pass `expectedRevision` when acting on something you read; a `save_conflict` means someone else acted first: re-read and decide again.
- Speak to her as an adult in her language and script, with "aap". No tool or technical words, no pity, no false intimacy.
- Never claim something is on her screen, saved or sent unless the result shows it.
- Camera only after she asks to write in the air; the browser asks her. Family invites only when she asks. Anything leaving the house needs her own "haan" on her screen.

## Key actions

| Action | Use |
|---|---|
| `get-session-state` | What is on her screen now, with `validNextActions`. |
| `open-activity` | Open `sulekh`, `rangoli`, `kolam` or `shatranj` (her side `w` or `b`). |
| `suggest-phrases` | Show 1–3 phrase choices and wait for her tap; never choose for her. |
| `set-calligraphy-reference` | Put her exact phrase on screen (Devanagari, Gurmukhi, Tamil, Bengali, Urdu; kalam, brush, modern). On a `REFERENCE_*` rejection, call again. |
| `set-input-mode` / `start-air-writing` | Finger drawing (no camera) / air-writing after she asks. |
| `clear-my-strokes` | Erase only her lines; references and designs stay. |
| `set-kolam-reference` / `set-rangoli-reference` / `suggest-designs` | Pulli kolam on an N×N grid; radial rangoli or pookalam; festival presets only when she names one. |
| `fill-region` | Colour by her words ("beech mein peela, bahar laal") or by zone; unresolved parts come back for you to ask about. |
| `get-chess-state` / `preview-moves` / `move-chess-piece` | Read the board; show where a piece can go; play her move from her `phrase` (or squares) or your own reply. Illegal moves are refused with no substitute; ambiguous ones come back with a question to ask her. |
| `wait-for-person-move` | When she says she will move by hand on her turn. |
| `invite-family` / `family-move` | Private link for a family member; they play the other side. |
| `draft-family-update` / `send-family-update` / `cancel-family-update` | A family update to Telegram, only after her own approval; "mat bhejo" cancels it. |
| `save-artwork` / `list-album` | Keep what is on screen in her album. |
| `show-history` / `set-language` / `show-live-board` | History panel; screen language; the live MCP App card. |

## Development

`pnpm dev` runs the app on :8080 with PGlite. Engines and their tests live in `app/engines/` (`pnpm exec vitest run app/engines`). Server logic for actions is in `server/chaupal/`; schema in `server/db/`. Deploy with `pnpm deploy:netlify` and `pnpm deploy:edge`. The evaluation is in `evals/` (see `evals/README.md`).
