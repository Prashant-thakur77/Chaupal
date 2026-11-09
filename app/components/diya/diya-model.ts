export type DiyaPhase =
  | "ready"
  | "listening"
  | "receiving"
  | "creating"
  | "speaking"
  | "awaiting";

export type DiyaLanguage = "hi" | "en";
export type DiyaReaction = "celebrate" | "recoil";

export const DIYA_PHASES: readonly DiyaPhase[] = [
  "ready",
  "listening",
  "receiving",
  "creating",
  "speaking",
  "awaiting",
];

export const DIYA_PHASE_LABELS: Record<DiyaLanguage, Record<DiyaPhase, string>> =
  {
    hi: {
      ready: "तैयार",
      listening: "सुन रहा है",
      receiving: "समझ रहा है",
      creating: "बना रहा है",
      speaking: "बोल रहा है",
      awaiting: "आपका इंतज़ार",
    },
    en: {
      ready: "Ready",
      listening: "Listening",
      receiving: "Understanding",
      creating: "Making",
      speaking: "Speaking",
      awaiting: "Waiting for you",
    },
  };

export const DIYA_NAME: Record<DiyaLanguage, string> = {
  hi: "दीया",
  en: "Diya",
};

/** Same vitality contract as the base repo's presence Orb. */
export const PRESENCE_VITALITY: Record<DiyaPhase, number> = {
  ready: 0.92,
  listening: 0.98,
  receiving: 0.82,
  creating: 1,
  speaking: 0.96,
  awaiting: 0.48,
};

/**
 * Distinct body languages, not a speed control: listening leans in,
 * receiving ripples, creating circulates and brightens, speaking pulses,
 * awaiting settles low and calm while still glowing.
 */
export const PRESENCE_BEHAVIOR: Record<DiyaPhase, number> = {
  ready: 0,
  listening: 1,
  receiving: 2,
  creating: 3,
  speaking: 4,
  awaiting: 5,
};

export function diyaAriaLabel(phase: DiyaPhase, language: DiyaLanguage) {
  return `${DIYA_NAME[language]}: ${DIYA_PHASE_LABELS[language][phase]}`;
}
