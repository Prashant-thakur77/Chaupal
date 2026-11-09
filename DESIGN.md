# Chaupal — Visual Design Contract

Chaupal is a village square in morning light, on a screen. An elder speaks Hindi. Her agent writes for her, draws a rangoli for her, and plays shatranj with her. Her grandson in another city sits down at the same board from his phone. A clay diya shows what the agent is doing.

Tokens live in `app/styles/chaupal-tokens.css`. The static prototype and its screenshots live outside the repo, in `../.chaupal-work/design-proto/` (`index.html`, `proto.css`, `proto.js`, `shots/`). Build every screen from those tokens, never from the scaffold's neutral greys.

---

## 1. Taste

**Dials:** CRAZINESS 6 · MOTION 5 · DENSITY 2. The wild part is the light, the texture and the diya, never the navigation.

| IS | What it means on screen |
|---|---|
| **warm** | One light source: the diya. Surfaces catch its glow (radial marigold light on indigo dusk). Clay, terracotta, marigold, brass. |
| **unhurried** | Big type, long easing, nothing jumps. A screen waits for her. Nothing auto-advances. |
| **hand-made** | Chalk lines with powder edges, kalam strokes, clay grain. Every ornament could be drawn by a hand on a floor. |

| NEVER | What we avoid |
|---|---|
| **clinical** | No grey SaaS cards, no tiny labels, no dashboards in the elder view. |
| **kitsch** | No cartoon grandmothers, clip-art lamps, festival-sale banners or deities. |
| **busy** | No carousels, notification dots, competing CTAs or auto-advancing anything. |

**Feel in motion.** Like a lamp flame and like chalk dragged across a floor. Lines draw on over 0.9–1.6 s with a long ease-out tail. State changes cross-fade in 220–420 ms. The flame flickers irregularly, 0.44–4.8 s per cycle depending on phase. No bounce, no spring overshoot.

**Material.** Fired clay with grain, lime-washed walls, an indigo evening sky, rice-flour chalk, brass, marigold.

**Lines not to cross**
- No religious symbols as defaults: no ॐ, swastika or deity imagery in presets, icons or ornament. The diya is a household light, shown without ritual framing. Lotus, peacock, mango leaf and geometric kolam are safe.
- No English-only labels on elder screens. No text under 18 px. No information that only appears on hover.
- No colour-only meaning. Every state also has a word, a shape or a position.
- No stereotypes in copy or imagery. Address her as "aap", never "tum".

**Audience.** Indian elders 65+, Hindi-first, low digital confidence (66% of surveyed elders find digital tools confusing). They trust large clear Hindi, a respectful tone and the familiar feel of a courtyard. The second user is a grandson aged 20–30 on a phone, who wants to tap a link and be in the game.

---

## 2. Principles

1. **One action per screen.** Each screen has one lit thing. The agent dock's mic is the voice path. On activity screens the task button ("हो गया", "पूरी हुई") uses a marigold outline, so the mic stays the only filled marigold control. Dialogs have one filled answer and one equal-sized quiet answer.
2. **Voice first, touch always.** Anything she can say, she can also tap. The touch path never needs a gesture she must discover.
3. **Her marks are hers.** Reference layers and her layers are visually distinct (ghost ink vs indigo, white chalk vs marigold). "मेरी लकीरें मिटाएँ" never touches the reference.
4. **Nothing leaves the house without her yes.** The approval dialog is the only way out.
5. **Conflicts are friendly facts, not errors.** "राहुल ने पहले चाल चल दी", then what changed, then one button.
6. **Light means state.** The diya is the agent's state. The marigold halo marks the one action that's ready.
7. **Bilingual by pairing, not by mixing.** Hindi leads. English appears as a smaller, separate line (italic display or muted body), never inside the same sentence.

---

## 3. Colour

Default theme: **day**, called "subah" (`data-theme="day"` on every Chaupal page): a lime-washed courtyard in morning light. Ivory ground (`#FAF6EF`), warm ink (`#2D2620`), one calm peacock teal (`#2B6B6C`) for actions, terracotta (`#B0502A`) second, marigold only for the diya's warmth. Canvases are paper and sandstone; kolam outlines draw in warm brown (`#8A4B2E`); her own lines are teal. The earlier dark look, **dusk** (`data-theme="dusk"`), is still defined in the token sheet; the tables below describe its raw palette.

### 3.1 Raw palette

| Token | Hex | Role |
|---|---|---|
| `--ch-night-900` | `#15132B` | dusk page |
| `--ch-night-800` | `#221E40` | dusk surface (cards, dock) |
| `--ch-night-700` | `#2E2955` | raised surface |
| `--ch-night-600` | `#3A345F` | hairlines on dusk |
| `--ch-indigo-500` | `#3A3A92` | indigo action, avatar |
| `--ch-indigo-300` | `#9C9CF0` | "awaiting" halo and label |
| `--ch-indigo-700` | `#2E2C7A` | her strokes on paper; day accent |
| `--ch-marigold-500` | `#F4A93C` | primary fill, flame body |
| `--ch-marigold-400` | `#FFC866` | focus ring, task-button text |
| `--ch-marigold-300` | `#FFD58C` | other-side disc label, "speaking" glow |
| `--ch-marigold-200` | `#E9B860` | last-move square tint |
| `--ch-terracotta-500` | `#D0643A` | diya body, ornament |
| `--ch-terracotta-600` | `#9A3B1C` | terracotta text/button on day |
| `--ch-clay-700` | `#5A2A17` | kolam/rangoli floor |
| `--ch-clay-600` | `#6A2611` | her disc label and rim |
| `--ch-clay-500` | `#8E5232` | board dark square |
| `--ch-clay-300` | `#D7A577` | board light square |
| `--ch-clay-950` | `#1A0F08` | ink on marigold |
| `--ch-chalk-50` | `#F7F1E6` | text on dusk, chalk lines |
| `--ch-chalk-100` | `#F4E8D2` | her disc face |
| `--ch-chalk-200` | `#E3D6C0` | soft text |
| `--ch-chalk-400` | `#BCAA8E` | muted text |
| `--ch-limewash-100` | `#F5EEE2` | day page |
| `--ch-paper-200` | `#F2E7D3` | sulekh paper |

**Rangoli colours.** Each is named for voice ("बीच में पीला, बाहर लाल").

| Hindi | Token | Hex |
|---|---|---|
| लाल | `--ch-rang-laal` | `#E0473B` |
| पीला | `--ch-rang-peela` | `#F6C33B` |
| हरा | `--ch-rang-hara` | `#43A95E` |
| नीला | `--ch-rang-neela` | `#4F7FE0` |
| गुलाबी | `--ch-rang-gulabi` | `#E66CA7` |
| केसरिया | `--ch-rang-kesariya` | `#F28A2E` |
| सफ़ेद | `--ch-rang-safed` | `#F7F1E6` |
| बैंगनी | `--ch-rang-baingani` | `#9B6BD3` |

### 3.2 Semantic tokens

`--ch-bg`, `--ch-surface`, `--ch-surface-raised`, `--ch-ground`, `--ch-hairline`, `--ch-text`, `--ch-text-soft`, `--ch-text-muted`, `--ch-accent`, `--ch-on-accent`, `--ch-second`, `--ch-on-second`, `--ch-focus`, `--ch-glow` (RGB triplet for halos), `--ch-sky-top/mid/low`, `--ch-paper`, `--ch-ink`, `--ch-her-stroke`, `--ch-good-text`, `--ch-bad-text`, `--ch-shadow-1/2`, `--ch-lit`.

`.theme-chaupal` remaps the toolkit's HSL theme variables (`--background`, `--primary`…) so the toolkit chrome matches.

### 3.3 Contrast (checked by script)

All pairs were checked with the WCAG 2.x formula in `../.chaupal-work/design-proto/contrast.mjs`. The full output is in `contrast-results.txt` next to it: **38/38 pass**. Body text targets AAA (7:1). Non-text UI (chips, disc rims, focus) targets 3:1.

| Pair | Ratio | Target |
|---|---|---|
| text `#F7F1E6` on bg `#15132B` | 16.10 | 7 |
| text on surface `#221E40` | 14.07 | 7 |
| text-soft `#E3D6C0` on bg | 12.63 | 7 |
| text-muted `#BCAA8E` on bg / surface | 8.00 / 6.99 | 4.5 |
| ink `#1A0F08` on marigold `#F4A93C` (primary button) | 9.49 | 7 |
| task-button text `#FFC866` on bg | 11.82 | 7 |
| awaiting label `#9C9CF0` on surface | 6.35 | 4.5 |
| speaking label `#FFD58C` on surface | 11.41 | 4.5 |
| focus ring `#FFC866` on bg | 11.82 | 3 |
| day text `#24160E` on `#F5EEE2` | 15.22 | 7 |
| day muted `#6B5444` on `#F5EEE2` | 6.12 | 4.5 |
| day accent indigo `#2E2C7A` on `#F5EEE2` | 10.36 | 7 |
| sulekh reference ink `#2B1A12` on paper | 13.62 | 7 |
| her stroke `#2E2C7A` on paper | 9.76 | 7 |
| kolam chalk `#F7F1E6` on clay `#5A2A17` | 10.50 | 7 |
| her disc label `#6A2611` on `#F4E8D2` | 9.12 | 7 |
| other disc label `#FFD58C` on `#26245E` | 10.12 | 7 |
| her disc rim vs light square | 5.02 | 3 |
| her disc face vs dark square | 5.09 | 3 |
| other disc face vs light square | 6.37 | 3 |
| other disc rim vs dark square | 4.45 | 3 |
| rangoli chips vs bg (laal…baingani) | 4.43–16.10 | 3 |
| good / bad text on surface | 9.25 / 6.91 | 4.5 |
| album sent pill `#1F5A31` on `#E3EFE2` · album meta on paper | 6.90 · 9.46 | 4.5 · 7 |

Ratios not printed above are in `contrast-results.txt`. Re-run `node contrast.mjs '<pairs json>'` whenever a colour changes.

---

## 4. Type

All fonts are from Google Fonts under the **SIL Open Font License**. Load them with `<link>` tags in `root.tsx`. The exact tags are at the top of `chaupal-tokens.css`.

| Role | Family | Use |
|---|---|---|
| Display | **Tiro Devanagari Hindi** (regular + italic; ships a Latin designed to match) | Greetings, screen titles, dialog questions, album titles, numbers in KPIs. The italic Latin is the English sub-line ("Good evening"). |
| Body / UI | **Mukta** 400/500/600/700 (Devanagari + Latin) | Everything else: buttons, transcript, chips, disc labels (700). |
| Brush | **Yatra One** | Only the sulekh brush reference style and the sulekh motif. Other sulekh styles (kalam, modern) come from the Sulekh engine's font list. |

### Scale (rem at 16px root)

| Token | Size | Devanagari line-height | Latin line-height | Use |
|---|---|---|---|---|
| `--ch-text-small` | 18px | 1.6 | 1.5 | meta, captions, chip names: **the floor** |
| `--ch-text-body` | 22px | 1.7 | 1.5 | body, buttons, transcript |
| `--ch-text-lead` | 26px | 1.6 | 1.5 | agent caption on home, big dialog buttons |
| `--ch-text-title` | 32px | 1.4 | 1.2 | section titles |
| `--ch-text-h2` | 36–44px fluid | 1.35 | 1.12 | activity titles, dialog questions |
| `--ch-text-h1` | 44–72px fluid | 1.35 | 1.12 | greeting |
| `--ch-text-display` | 56–120px fluid | 1.3 | 1.05 | hero moments only |

**Devanagari rules**
- Line-height is about 0.15–0.2 higher than Latin, because matras sit above (ि ी े ै ँ) and below (ु ू ृ) the line. Use `:lang(hi)` (set `lang="hi"` on `<html>`) to switch automatically.
- Never use letter-spacing on Devanagari: it breaks the shirorekha (headline).
- Never use all-caps or tracked eyebrows (they don't exist in Devanagari, and they read as SaaS).
- Display headings need about 6px of top padding so tall matras aren't clipped by `overflow: hidden` parents.
- Use international numerals (2, 3, 12). Tabular figures go in tables (`.ch-num`).
- Elder views never render text under 18px. Disc labels follow §9.5.

Utilities: `.ch-display`, `.ch-h1`, `.ch-h2`, `.ch-title`, `.ch-lead`, `.ch-body`, `.ch-small`, `.ch-brush`, `.ch-num`.

---

## 5. Space, shape, depth

- **Spacing:** 4px base, `--ch-space-1…10` = 4, 8, 12, 16, 24, 32, 48, 64, 96, 128. The page gutter is `--ch-gutter` = clamp(16px, …, 48px).
- **Targets:** `--ch-target-min` 56px for everything tappable; `--ch-target-main` 64px for primary buttons and chips; `--ch-target-mic` 88px for the home mic (72px in the dock, 64px on phone). Leave at least 8px between adjacent targets.
- **Radii by hierarchy:**
  - chip/pill/button 999px;
  - small tile 10px;
  - card/canvas 18px;
  - sheet/dialog/dock rail/book 28px;
  - discs and the diya halo 50%.
- **Elevation:** dusk uses glow more than shadow.
  - `--ch-shadow-1` (cards): a hairline inner top light plus a 24px soft drop.
  - `--ch-shadow-2` (canvases, dialogs): a 64px drop.
  - `--ch-lit`: a 1px marigold ring plus a 40px marigold halo. Only the one primary action gets it.
  - Canvases also get a large, faint marigold halo, as if lit by the diya.
- **Texture:**
  - `--ch-grain` is SVG fractal noise. Use it at 14% overlay on dusk, 8% on day, 22–50% inside the paper, clay floor and board.
  - The `#chalk` SVG filter (turbulence displacement plus a powder mask) goes on every chalk line.
  - The `#hand` filter (low-frequency wobble) goes on her strokes.
  - The `#clay` filter goes on the diya bowl.
- **Z layers:** canvas 0 · ornament 1 · dock 20 · header 30 · toast 40 · dialog 50.

**Ornament.**
- The chalk horizon is a 2px line at 50% chalk alpha that fades at both ends. The home diya sits on it.
- The kolam edge is a repeating dot-and-ring strip, used on dialog tops at 35%.
- The rangoli dot ring surrounds the floor.

Ornament is always decorative (`aria-hidden`) and never carries meaning.

---

## 6. Motion

| Token | Value | Use |
|---|---|---|
| `--ch-dur-instant` | 120ms | press feedback (scale 0.98) |
| `--ch-dur-quick` | 220ms | hover, chip select |
| `--ch-dur-calm` | 420ms | cross-fades, dialog/sheet enter, diya phase change |
| `--ch-dur-slow` | 900ms | piece glide, capture lift |
| `--ch-dur-draw` | 1600ms | chalk and kalam line draws |
| `--ch-dur-breath` | 3200ms | diya "ready" breath |
| `--ch-ease-settle` | `cubic-bezier(.22,.61,.36,1)` | things arriving |
| `--ch-ease-chalk` | `cubic-bezier(.65,.05,.36,1)` | line draws, page turns |
| `--ch-ease-ember` | `cubic-bezier(.4,0,.2,1)` | glow and state |
| `--ch-ease-leave` | `cubic-bezier(.55,0,1,.45)` | things leaving |

**Rules**
- Animate only transform, opacity, clip-path, filter and stroke-dashoffset.
- **Chalk draw:** set `pathLength=1` and animate the dash offset 1→0 over 1600ms (chalk easing).
  - Rangoli outlines draw centre-out, 120ms stagger per ring.
  - The kolam draws as one continuous loop at a time.
  - The sulekh reference writes stroke by stroke in kalam order (one stroke per 380ms); "लिखकर दिखाएँ" replays it.
- **Fills:** a colour fill blooms from the tap point. It runs as a clip-path circle 0→150% over 420ms with settle easing.
- **Page change:** a 420ms cross-fade. The diya and dock persist across pages and never re-mount.
- **Loading and agent work:** never use spinners. The diya goes to "creating".
- **No auto-advance**, no parallax, no scroll-jacking.
- **Pause:** "हलचल रोकें" (Pause motion) in the header sets `data-motion="paused"` and freezes every loop.

**Reduced motion** (`prefers-reduced-motion: reduce`)
- Durations collapse: draws are instant, cross-fades 160ms.
- Loops stop at a neutral frame.
- Pieces jump instead of gliding.
- Phase meaning stays through a static flame height, static embers, ring or halo, and the text label (§7).
- Content never waits on animation.

---

## 7. The living diya

The SVG (viewBox 200×220):
- **Bowl:** terracotta gradient `#D9733F → #7A3018`, with `#clay` grain and a chalk dot arc and scallop drawn on it.
- **Oil:** dark oil surface with a marigold glint.
- **Flame:** a two-layer flame (outer body `#F28A2E → #F4A93C → #FFC866`, inner core `#FFFAF0 → #FFD58C`) with a faint indigo base.
- **Light:** a marigold light pool under the bowl, and a CSS radial glow behind it at 260% of the lamp width.

The flame anchor is (100, 122). The base flame height is 99 units (45% of lamp height).

| Phase | Hindi label (always visible) | Flame scale | Flicker cycle | Glow colour · alpha | Extra |
|---|---|---|---|---|---|
| **ready** | तैयार — बोलिए | 1.00 | 2.6s, small skew ±1.6° | `#F4A93C` · .45, breath 3.2s (scale .94–1, opacity .78–1) | — |
| **creating** | बन रहा है… | 1.22 | 0.9s | `#F28A2E` · .60 | 3 embers rise 60u and fade, 1.8s, staggered 0.6s |
| **speaking** | सुनिए… | 1.10 | 0.44s (syllable pulse; in the app, drive scaleY from TTS amplitude, clamped 1.0–1.25) | `#FFD58C` · .55 | 2 chalk-gold rings expand 0.6→1.5 and fade, 1.8s, staggered 0.9s |
| **awaiting** | आपकी बारी | 0.82 | 4.8s | `#9C9CF0` · .34 | dashed indigo halo (r 88, dash 3/13, 5u stroke), turning once per 24s |

- **Phase change:** flame scale and glow cross-fade over 420ms with ember easing. Never snap.
- **Sizes:** 220–300px on home, 120px in the landscape rail, 88px in the tablet dock, 56px on phone. Below 64px the halo, rings and embers are the main cue, so the text label is required.
- **Reduced motion:**
  - no flicker or breath;
  - creating shows 3 static embers at rising heights;
  - speaking shows one static ring at 1.15;
  - awaiting shows a static halo.
- **Accessibility:**
  - the lamp is `role="img"` with the phase as its label;
  - the phase line is plain text;
  - transcript updates go to `aria-live="polite"`.
- The family's phone does not show her diya. It shows only the board state and "Your move".

---

## 8. Layout system

Breakpoints: **phone** < 700px · **tablet portrait** ≥ 700px and portrait · **landscape** ≥ 1024px and landscape (tablet landscape and desktop).

How the agent (voice and chat) shares the screen with the activity:

| Device | Activity | Agent |
|---|---|---|
| **Phone** (390×844) | Fills the screen; one column. The task button moves to the top of the controls. | A **bottom dock** of about 100px: diya (56px), phase line, the newest agent line (unclamped, grows if needed), and the mic (64px). Tapping the line opens the full transcript as a sheet. "लिखकर बताइए" (type instead) lives in that sheet. |
| **Tablet portrait** (1024×1366, the elder's main device) | Top 80%: title row, canvas or board, controls. | A **wide bottom dock** of about 140px: diya (88px) · her last words (18px muted) and the agent's last line (22px) · mic (84px) and "लिखकर बताइए". |
| **Landscape** (1366×1024, 1440×900) | Right side: canvas or board plus a 300–340px side column (chips, notes, secondary actions). | A **left rail**, 320px (380px at ≥1400px wide): diya (120px) on top, phase, the last three turns of the transcript, and the mic at the bottom. It is a frosted dusk card with a 28px radius. |

- The rail and dock are the same component (`.dock`) laid out three ways. The diya never re-mounts between screens.
- Home has no dock. The diya *is* the hero there, and the mic sits under it.
- Landscape widths are bound on both axes: the board size is `min(100dvh − 270px, 100vw − rail − side − 140px)`.

---

## 9. Components and screens

### 9.1 Header (80px; 72px on phone)
- From left: the "घर" home button (house icon plus word; icon only on phone, labelled "घर — Home"), then the brand (small diya mark and "चौपाल" in Tiro, 30px).
- Right: the presence pill (avatar "रा" with a green dot and "राहुल जुड़े हैं"; avatar only on phone), "हलचल रोकें" (hidden on phone; it lives in the settings sheet there), and the language toggle "English" / "हिंदी".
- All are 56px-tall pills with a 1.5px hairline border.

### 9.2 Home with the diya
- **Greeting:** "शुभ संध्या, कमला जी" (h1, Tiro), with "Good evening" below in Tiro italic, muted. The greeting follows the time of day: सुप्रभात / नमस्ते / शुभ संध्या.
- **Diya:** sits on the chalk horizon. The caption below it is the agent's opening line (lead, 26px): "आज क्या करें? कुछ लिखें, रंगोली बनाएँ, या शतरंज खेलें?"
- **Three activity loops:** chalk circles, each with a motif and a name.
  - सुलेख: a real "क" under a shirorekha.
  - रंगोली: an eight-petal flower.
  - शतरंज: a राजा disc.
  - Names are Tiro 22–36px; the sub-line is 18px (सुंदर लिखना / रंग भरना / राहुल के साथ).
  - The circles sit tangent like kolam dots, with a chalk dot between the first two. They never overlap, so tap areas never collide.
  - Two sit on top and one below (all sizes). Diameter: 164px phone · 240px tablet portrait · min(290px, 33vh) landscape.
- **Voice:** the 88px lit mic plus "बटन दबाकर बोलिए" and an example ("जैसे: “राहुल के साथ शतरंज खेलना है”").
- **Landscape:** greeting, diya and mic in the left column (the horizon stops at mid-screen); the loops in the right column.

### 9.3 Sulekh canvas
- **Title row:** "सुलेख" plus the sub-line "नमूने के ऊपर उँगली से लिखिए — नमूना नहीं मिटेगा".
- **Paper:** 3:2, 18px radius, warm paper gradient with 22% grain and a large marigold halo. A dashed **shirorekha guide** runs at 31.5% height.
- **Reference layer:** the phrase in the chosen style, sized at 31% of the paper width through container units. Ink is `#2B1A12` at 24% fill with a 38% outline (a ghost to trace). `aria-hidden`, because the figure carries the label.
- **Her layer:** indigo `#2E2C7A` strokes, 10–14px round caps, with the `#hand` wobble. A 22px nib dot with a soft ring marks the live pen tip.
- **Layer chips** (top-left of the paper): "नमूना" and "आपकी लकीरें". Each is a toggle (aria-pressed) and also the legend.
- **Controls:**
  - Quiet: "मेरी लकीरें मिटाएँ" (eraser) and "लिखकर दिखाएँ" (replay the kalam order).
  - Task (marigold outline): "हो गया — एल्बम में रखें".
  - On phone the task button comes first and spans the full width.
- **Accessible name:** "लिखने का कागज़: नमूना ‘शांति’, आपकी लकीरें ‘शा’ तक", updated as she writes.

### 9.4 Rangoli and kolam canvas
- **Segmented toggle:** "रंगोली | कोलम", 56px segments. The selected segment is a chalk fill with ink text.
- **Floor:** a square clay floor (`#6E3420 → #5A2A17 → #3E1C10`) with 50% grain and a chalk dot ring.
  - Rangoli is generated as SVG with region ids (`r-beech`, `r-pankhudi-0…7`, `r-patta-0…7`, `r-bahar-0…15`), so voice ("बीच में पीला") and the evals can address regions.
  - Outlines are chalk (2.6px plus the `#chalk` filter). Unfilled regions show bare clay.
  - The **next region** gets a dashed marigold outline (4px, dash 7/6).
- **Kolam:** an N×N dot grid (3–9). Sikku loops run diagonally between the dots and curl around the outer dots, drawn in chalk at 4.5px. Her trace is marigold at 7px over the white reference.
  - A stepper ("− 5 × 5 बिंदु +", 56px buttons) changes the grid.
- **Colour chips:** 8 chips, each with a 30–34px swatch and its Hindi name: लाल, पीला, हरा, नीला, गुलाबी, केसरिया, सफ़ेद, बैंगनी.
  - It is a radiogroup. Selected = 3px chalk border, a ✓ and `aria-checked`.
  - Layout: phone 4×2 grid (68px tall) · tablet portrait 8 in a row · landscape a 2-column list in the side column (64px rows).
- **Note line:** "अगला खाना: **बाहर की लहर** — रंग छूकर भरिए".
- **Controls:** quiet "मेरी लकीरें मिटाएँ"; task "पूरी हुई" / "पूरा हुआ".

### 9.5 Shatranj board
- **Players row:**
  - "आप · सफ़ेद — आपकी चाल" (when it is her turn the pill gets the marigold `--ch-lit` ring).
  - "राहुल · नीला · बेंगलुरु".
  - Each pill has a mini disc swatch.
- **Board:** clay squares (light `#D7A577`, dark `#8E5232`) with 35% grain, in a 12px dark-clay frame with a dashed chalk inset. No coordinates are shown to her; the agent talks in piece names and places ("लाल घेरे वाला हाथी").
- **Discs:** 84% of the square, round, with an engraved inner ring and a 4px "thickness" shadow.
  - **Her side (safed):** ivory face `#FFFAF0 → #F4E8D2 → #E2D0AE`, rim and label `#6A2611`.
  - **Other side (neela):** indigo face `#3A3888 → #26245E`, rim and label `#FFD58C`.
- **Labels:** Mukta 700 at `square × 0.235` when the square is ≥72px. That is ≥18px on the tablet (110px squares give 26px labels).
  - Squares under 72px (phones) switch to **short keys at `square × 0.4` (≥18px)**: रा, व, ऊँट, घो, हा, प्या. ऊँट stays whole so it can never be read as ॐ.
  - A legend strip under the board decodes the keys. Full names stay in every `aria-label` and in the agent's speech.
- **Selected piece:** lifts 6% with scale 1.06, a 4px marigold-400 ring and a 26px glow.
- **Preview (legal moves):** a 30% chalk ring with a dark outline on empty squares. A capture target gets a 4px dashed **laal ring** around the enemy disc.
- **Last move:** from-square marigold tint at 55%; to-square at 80% with a 3px inner amber border. The tint persists until the next move.
- **Capture animation:**
  1. The capturing disc glides from its square to the target over 900ms (settle easing).
  2. The captured disc lifts 18% and scales to 1.12 over 360ms.
  3. It then travels to the captured tray, shrinking to 0.5 and fading, over 540ms (chalk easing).
  4. Optionally a puff of chalk dust (6 specks, 400ms) and a soft wooden "thok".
  5. `aria-live` announces "आपके घोड़े ने राहुल का हाथी लिया".
  - Reduced motion: an instant swap; the tray and tint update.
- **Side column (landscape):** last move in words, the selection hint, quiet "पिछली चालें" and "चाल वापस".
- **Grid semantics:** each square is a button with a label such as "g5: नीला हाथी, इसे ले सकते हैं".

### 9.6 Family phone view (grandson)
- **Header:** brand plus the "हिंदी" toggle; no presence pill (he *is* the presence). The title "With Dadi" has a green **Live** chip, and on wider screens "Kamla Devi · Jaipur".
- **Event banner:** a raised card with the disc that moved and "दादी ने घोड़े से आपका हाथी ले लिया।", plus an English sub-line "Dadi's knight took your rook · g5". He gets notation; she doesn't.
- **Captured tray:** "दादी ने लिए:" followed by a disc key and the full name.
- **Board:** flipped, so his indigo pieces sit at the bottom. It uses the same discs and highlights as her board.
- **Bottom:** "Your move" (lit pill) and quiet "Moves".
- **Landscape:** board left; banner, tray, info and controls right.
- **Privacy note on wide screens:** "You see the board and moves only. No camera, voice or chat from Dadi's house is shared."

### 9.7 Conflict card ("राहुल ने पहले चाल चल दी")
- An `alertdialog` over a dimmed board, max 640px wide, 28px radius, with the kolam-edge ornament on top.
- **Visual:** the disc that moved → "एक घर आगे · अभी-अभी".
- **Title:** "राहुल ने पहले चाल चल दी" (Tiro, 32–44px).
- **Body:** "उन्होंने अपना प्यादा एक घर आगे बढ़ाया। आपकी चाल अभी हुई नहीं थी। बोर्ड बदल गया है, कुछ नहीं बिगड़ा।"
- **One button** (lit, 72px): "ठीक है, बोर्ड देखें".
- Never a red error colour. It comes from the saveIfCurrent conflict and never silently overwrites.

### 9.8 Approval prompt ("क्या यह तस्वीर बच्चों को भेज दूँ?")
- An `alertdialog`.
- **Top row:** a 132px artwork thumbnail (96px on phone) and the recipient list: "किसे: **राहुल, प्रिया**", "कहाँ: **Telegram**".
- **Question:** "क्या यह तस्वीर बच्चों को भेज दूँ?" (Tiro).
- **Promise:** "आपके “हाँ” कहने तक कुछ भी घर से बाहर नहीं जाएगा।"
- **Buttons:** **"हाँ, भेज दो"** (lit, send icon) and **"मत भेजो"** (quiet). They are equal size (72px tall, half width each; stacked full-width on phone with हाँ on top). Equal weight is deliberate: refusing must be as easy as agreeing.
- **Voice hint:** "बोलकर भी कह सकती हैं: “हाँ, भेज दो” या “मत भेजो”".
- **After "मत भेजो":** the dialog closes, the agent says "ठीक है, नहीं भेजा", and nothing is sent.

### 9.9 Album
- A clay-bound **book spread**: a 10–14px clay cover with grain, a marigold ribbon bookmark, and paper pages with a centre gutter shadow.
- **Left page:** the artwork (her indigo writing, rangoli or final board).
- **Right page:**
  - title (Tiro h2);
  - meta "सुलेख · 2 नवम्बर, शाम 6:40 / आपकी लिखावट, कलम वाला नमूना";
  - a status pill "✓ राहुल और प्रिया को भेजा", or nothing if it was never sent;
  - quiet "पढ़कर सुनाइए".
- **Pager bar:** "← पिछला" (quiet) · "पन्ना 3 / 12" · "अगला →" (lit), all 64px.
- **Phone:** one page stacked (art above, words below).
- Page turn: a 420ms cross-fade (chalk easing). No 3D page curl.

### 9.10 Eval results page (for the team and judges, English-led)
- **Title:** "परख *Evaluation*".
- **Sample badge:** a dashed marigold chip shown until real run output replaces the numbers. Never ship sample numbers as results.
- **KPI cards:** with-actions pass rate (lit), without-actions pass rate, median seconds from voice to visible result, Indic render accuracy.
- **Bars by activity:** paired bars, solid marigold for "with actions" and hatched indigo for "without", so they differ by pattern as well as colour. Percent labels sit outside the bars.
- **Case table:** #, case id, the Hindi/Tamil utterance, With / Without (✓ pass / ✕ fail as words plus glyphs), seconds, tokens. On phone, the utterance, seconds and tokens columns hide.

### 9.11 Buttons, chips, focus
- **Lit** (`.ch-btn--lit`): marigold fill, ink text, the `--ch-lit` halo. One per screen.
- **Task** (`.ch-btn--task`): marigold 2.5px outline with marigold-400 text. Used for the activity's finish button while the mic is the lit control.
- **Quiet** (`.ch-btn--quiet`): hairline outline with chalk text.
- **Sizes:** buttons are 64px tall with 22px text and a 26px icon; dialog answers are 72px.
- **Focus:** a 3px marigold-400 outline at 3px offset plus a 9px soft glow, on `:focus-visible` everywhere. Day theme uses indigo.

---

## 10. Iconography

- 24-unit grid, 2px rounded strokes (2.2px on the mic), no fills. Shown at 26px inside 56–64px targets.
- The set matches the outline icon package already in `package.json`: mic, home, eraser, replay, check, book, send, undo, list, arrows, pause, speaker.
- **An icon never appears without a word** on elder screens. Icon-only controls (the phone home button, the mic) carry an `aria-label`, and the mic has the visible label "बोलिए".
- The activity motifs (the letter क, the eight-petal flower, the राजा disc) are illustrations, not icons. Draw them in chalk and marigold.
- No religious symbols in any icon or motif.

---

## 11. Voice and copy

- Always "आप", with polite imperatives: लिखिए, देखिए, बोलिए, छूइए.
- The agent speaks in the first person with feminine verb forms ("मैं देख रही हूँ", "रखूँ?"), matching the default Hindi voice. Phase labels stay gender-neutral (तैयार / बन रहा है / सुनिए / आपकी बारी).
- Addressing her uses feminine forms ("चाहेंगी", "सकती हैं"). These come from her profile, never a hard-coded assumption.
- Name family members (राहुल, प्रिया); never write "user 2".
- Errors say what happened and what stays safe ("कुछ नहीं बिगड़ा").
- Button labels say exactly what will happen ("हो गया — एल्बम में रखें", not "OK").

---

## 12. Accessibility checklist (non-negotiable)

- [x] Contrast: body ≥ 7:1, muted ≥ 4.5:1, UI parts ≥ 3:1 (§3.3, script-checked).
- [x] Text ≥ 18px everywhere in elder views; body 22px.
- [x] Targets ≥ 56px; primary 64–88px.
- [x] Visible `:focus-visible` ring on every control. Tab order follows reading order: header → activity → dock.
- [x] Reduced-motion variant for every animation, plus the in-app "हलचल रोकें".
- [x] Screen-reader labels on the canvas, board squares, lamp, chips (radiogroup) and dialogs (alertdialog with labelledby/describedby). The transcript uses `aria-live="polite"`.
- [x] No colour-only meaning: chips have names, bars have patterns, pass/fail have words, the diya has a text label.
- [x] `lang="hi"` on the root and `lang="en"` on English runs, so screen readers switch voice.

---

## 13. References adapted

Six references were captured locally with Playwright Chromium (desktop 1440×900 and mobile 390×844, scroll sequences, style dumps, video). The captures live in `../.chaupal-work/design-refs/<folder>/`, outside the repo. Each passed through Chaupal's taste before anything was taken; no assets, copy or fonts were copied.

| Captured reference (local folder) | What it is | Move taken | How Chaupal transforms it |
|---|---|---|---|
| `candle-room/` | A candlelit memorial experience where lights come on one gesture at a time | A dark room lit only by small warm sources; progress shown as more light; one gesture at a time | The diya is the **only** light source. Canvases, board and buttons catch its marigold halo (`--ch-lit`), and the sky's radial glow moves to where the lamp's attention is. No altar or ritual framing. Its whisper-thin text was dropped; ours is AAA. |
| `breath-manifesto/` | A mindfulness manifesto with a warm blurred glow field | A thin line drawn across the dark as the opening beat; three interlocking thin circles on a horizon as the menu; a slow breathing glow | The chalk **horizon** under the diya; the **three activity loops** on home. They were re-tuned after critique to sit tangent like kolam dots, because overlapping hit areas fail elders. Labels are 22–36px Devanagari, not tiny caps. The glow breathes at 3.2s. |
| `stamp-book/` | A bilingual journal presented as a bound book | A book spread with a large Previous/Next bar and page n/N at the bottom; a language toggle in the header; a persistent "pause motion" pill | The **album** is a clay-bound book with a marigold ribbon and a 64px "पिछला / पन्ना 3/12 / अगला" bar; हिंदी/English toggle in the header; "हलचल रोकें" always available. |
| `sand-lines/` | A physics study where grains settle onto lines | Powder that gathers into lines on a dark plate; a quiet serif and plain body pairing | Rangoli and kolam outlines are **chalk powder**: an SVG displacement plus powder mask, drawn on with a 1.6s dash reveal on a grained clay floor. Reduced motion shows them instantly. |
| `one-line/` | A portfolio told as one continuous drawn line | A signature drawing itself, then the same line becoming the ground | The sulekh reference **writes itself in kalam stroke order**, and "लिखकर दिखाएँ" replays it. Kolam loops draw one continuous line at a time, and her own line is a separate marigold trace over the white reference. |
| `match-night/` | A picture-book story opened by a glowing button | The one call to action carries a warm halo, as if lit by a flame; the silent alternative is offered up front | The single lit control per screen (mic, or the dialog's yes) carries the diya-glow halo. The silent path is always visible as "लिखकर बताइए" (type instead). |

**From the award galleries' recent winners we deliberately left out:**
- WebGL 3D rooms, which are heavy on low-end tablets;
- scroll-jacked storytelling, which disorients elders;
- custom cursors, which mean nothing on touch;
- tiny tracked-caps labels;
- autoplaying sound.

---

## 14. Critique log

An independent scored critique ran on the first full set of screenshots:
- Design 7.5, Usability 6.0, Creativity 8.0, Content 6.5 → **weighted 7.05**.
- Taste fit 7.0.

The top items were fixed once:
1. Tablet-landscape overflow: the board and floor are now bound by width, and the rail narrows to 320px.
2. The phone dock clipped the agent's instruction: it now shows the newest line, unclamped.
3. Phone chess legibility: short keys at ≥18px plus a legend strip; notation removed from elder copy; full-width board.
4. Hindi copy:
   - conflict wording;
   - sulekh direction;
   - pause label "हलचल रोकें";
   - agent gender made consistent;
   - rangoli phase set to "आपकी बारी".
5. Home and primary actions: non-overlapping loops; the mic kept above the fold on tablet portrait; the horizon kept off the loops; activity finish buttons switched to the marigold outline so the mic stays the one lit control.

Also fixed:
- diya clay grain and stronger phase cues (thicker halo, larger embers, bolder rings);
- album ink layer;
- pager alignment;
- eval bar labels.

**Still open:**
- The diya is vector, not painted. A hand-painted texture pass would lift it further.
- The eval page is the most conventional screen.
- The speaking phase is shown statically in screenshots; in the app it must be driven by TTS amplitude.
