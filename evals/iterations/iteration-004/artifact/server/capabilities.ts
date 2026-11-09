/** Static description of what Chaupal offers, returned by get-capabilities. */
export const CAPABILITIES = {
  provider: "Chaupal",
  purpose:
    "An elder speaks in her own language; her agent opens a live activity she can continue herself: Sulekh calligraphy to trace, rangoli or pulli kolam to trace and colour, or shatranj (chess with Hindi piece names) on one live board that family can join from another city.",
  ownership: {
    elder: "intention, strokes, colours, moves, corrections, approvals",
    agent: "conversation, interpretation of her words, choosing among valid options, parameters, explanations, drafting family messages",
    chaupal: "live state, text shaping, design generation, chess rules, validation, visible results, revisions",
  },
  activities: {
    sulekh: {
      scripts: ["devanagari (hi, mr, sa)", "gurmukhi (pa)", "tamil (ta)", "bengali (bn)", "urdu nastaliq (ur)"],
      styles: ["kalam (reed pen, shirorekha)", "brush", "modern"],
      sizes: ["small", "medium", "large"],
      howReferencesAreMade:
        "Chaupal shapes the exact text with HarfBuzz and an OFL calligraphic font and renders black ink on transparent 3:2 canvas with safe margins. You choose phrase, script, style and size; you never draw pixels.",
      herLayer: "Her strokes stay on their own layer. clear-my-strokes erases only her layer; the reference stays.",
      camera: "Air-writing uses the camera only after she explicitly asks; the browser asks her for permission. Touch drawing needs no camera.",
    },
    rangoli: {
      kinds: ["pulli kolam (N×N dots, 3–9)", "radial rangoli (motif rings)", "pookalam (flower rings)"],
      colours: ["laal", "peela", "hara", "neela", "gulabi", "kesariya", "safed"],
      festivalPresets: ["diwali", "pongal", "onam", "lohri", "navratri"],
      note: "Ask before assuming a festival. No religious symbol is used by default.",
    },
    shatranj: {
      pieces: { k: "राजा", q: "वज़ीर", b: "ऊँट", n: "घोड़ा", r: "हाथी", p: "प्यादा" },
      rules: "chess.js owns rules, turn and legal moves. Illegal requests are rejected with no substitute and the board stays as it was.",
      perspective: "left/right/forward are from the side to move's own seat.",
    },
  },
  family: {
    invite: "invite-family creates a private link; the family member sees the same live session and may play the other side.",
    privacy: "Camera frames, audio and transcripts are never shared with family. Only the shared activity state and works she approves.",
    updates: "send-family-update needs her approval every time; if she says no, nothing is sent.",
  },
} as const;
