# Direction: Chaupal

**Style:** hybrid documentary (decided by the user): real moving footage of India at dusk opens the film, the hero
two-session moment of the live app (tablet view + phone view) comes early, then the product told through Remotion 3D and chalk animation, the
required "Under the hood" stack, proof, recap, end card. Target ~2:30 (no length rule; soft).

## The idea, in one sentence

The film is lit by one lamp: everything happens in the diya's light on a clay floor at dusk, and the light travels
along a rice-flour chalk line from her square to the city where her family lives.

## The world

A chaupal at dusk, the hour when the square fills. Three materials, all from the app's own design contract
(DESIGN.md: "fired clay with grain, lime-washed walls, an indigo evening sky, rice-flour chalk, brass, marigold"):

- **Indigo sky** (`#15132B` → `#2E2955`) with a few slow stars: every backdrop.
- **Clay floor** (`#5A2A17`, grain): the ground every graphic is drawn on.
- **Rice-flour chalk** (`#F7F1E6`, powder edge): every line, number and diagram is drawn in chalk, stroke by stroke,
  the way a rangoli starts with dots and one line.
- **The diya** (marigold `#F4A93C`, flame core `#FFF4D6`): the only light source. Where the story needs attention, the
  light pools there; everything else falls to dusk.

Real footage is graded into this world: warm, slightly desaturated, lifted blacks pushed toward indigo.

## Signature transition: the kolam loop

A grid of chalk dots (pulli) fades up over the outgoing shot. One unbroken chalk line weaves around the dots, the
way a pulli kolam is drawn, and closes on itself. The moment it closes, the inside of the loop fills with diya light
and opens like an iris onto the next scene. Used at four section changes: story → turn, turn → product,
product → under the hood, proof → recap. Sound: a dry chalk scrape under the line, a single santoor note on the
frame the loop closes. Built in code (an SVG path generated from the dot grid, stroke-dashoffset + an expanding mask).

Other transitions, each with a cause: a match cut from the real diya footage to the 3D diya; the 3D board's disc
flying out of frame into the real capture; the chalk line between the two screens; a cut on the click that causes
the next screen; a light sweep (the lamp turning toward the next panel).

## The moment people remember (~0:30)

**One move, two cities.** A split frame: her tablet on the left, in lamplight; her grandson's phone on the right,
cooler city light. Her Hindi request appears: "घोड़े से उसका हाथी मार दो" (take his rook with the knight). One beat of
silence. The घोड़ा disc takes the हाथी on her board; a chalk line draws itself across the seam from her screen to his,
a small marigold disc runs along it, and the same move lands on his live phone view. The measured sync time (read from
`evals/results/summary.json` or `evals/measure/sync-latency*.json`) is written in chalk on the line. Then he plays back
from the phone and it returns the same way. Both screens are real captures of the deployed app; the chalk line is a
visual, not a claim. No other project can make this frame: the elder's language, the family, and Agent-Native live
sync in one shot.

## Bespoke scenes (written for this film)
1. `KolamLoop` — the signature transition (procedural dot grid + weaving path + iris).
2. `Diya3D` — a clay diya turned on a lathe in three.js, a frame-driven flame (no shader time), light falloff on the
   clay floor; opens the turn and closes the film.
3. `TwoCities` — the memorable split frame with the chalk sync line and the number.
4. `ChalkNumbers` — the stakes: numbers drawn in chalk on clay, counting up, one dot grid made physical.
5. `Board3D` — a shatranj board with Devanagari discs in 3D (procedural), the disc that leaps from the 3D world into
   the real capture.
6. `RangoliReveal` — the engine's real rangoli SVG (`kolam-samples/rangoli-diwali.svg`) drawn on in chalk, then filled.
7. `Chabutra` (the arch3d restyle) — the stack as a raised clay platform (chabutra) under a lamp: tiers of clay slabs,
   chalk labels, packets as small marigold lights, the guard as a stale packet refused at the revision tier and a
   Telegram packet held at the needsApproval gate until "हाँ".

## Look
- Type: Tiro Devanagari Hindi for display (Hindi and its matched Latin italic), Mukta for body, numbers and captions.
  Hindi always leads, English as a smaller separate line (the app's own rule).
- Texture: clay grain + chalk powder (procedural noise), soft vignette, diya glow.
- Story beats: warm, slow (slow pushes, 2–4 s shots). Product beats: bright and crisp, the real UI full and flat,
  camera pushing in on what the voice names.
- One ease `cubic-bezier(0.16, 1, 0.3, 1)`; camera moves in-out; durations 150/300/600 ms; every label enters with a
  12 px rise + fade; lines draw on over 0.9–1.6 s with a long tail (the app's own motion contract).
- Honest labels: "Illustrative personas · live app, real screens", "request typed for the recording", "tracing drawn
  by the recording script", "sped up ×N" where any take is sped up.

## Sound
One continuous composed theme in raag Bhupali (evening, pentatonic S R G P D) with Sa = D, all synthesised in numpy
(nothing to license, nothing Content ID can claim):
- tanpura drone from the first frame (Pa–Sa–Sa–Sa cycle, buzzing plucks);
- bansuri alaap over the story, free time, slow meend glides;
- santoor enters with the product (the drop on the first live frame), tremolo patterns on Sa–Re–Ga;
- tabla in keherwa (8 beats, ~84 bpm) under the product, dropping to a sparse theka under the architecture;
- one silent beat before the move lands on the phone; a lift (fuller tabla, bansuri up an octave) under the recap;
- resolve on Sa with the tanpura alone under the end card.
Signature sound: chalk scrape + one santoor note when the kolam loop closes. Disc capture: a soft wooden clack.
Colour fill: a powder "puff". One narrator throughout, calm adult Indian-English-friendly voice.

## References taken, as moves only
- A pulli kolam being drawn (one continuous line around dots) → the signature transition.
- Apple product films' single light source on a hero object → the diya as the only light in every 3D shot.
- Crossbeam: real footage first, a music lift into the finale montage.
- Meld: the refusal as an event inside the world → the stale packet refused at the revision tier.
- 3Blue1Brown: numbers that build → stats drawn in chalk and counted up, a dot grid filling.
