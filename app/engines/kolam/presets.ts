/**
 * Festival presets: parameter bundles with secular motifs. They are only
 * used when a festival is explicitly asked for (presetParams / suggestDesigns).
 */
import type { ColourName, DesignParams } from "./types";

export const FESTIVALS = ["diwali", "pongal", "onam", "lohri", "navratri"] as const;
export type Festival = (typeof FESTIVALS)[number];

export interface Preset {
  festival: Festival;
  labelHi: string;
  labelEn: string;
  params: DesignParams;
}

const MARIGOLD: ColourName[] = ["kesariya", "peela", "laal", "gulabi"];

export const PRESETS: Record<Festival, Preset> = {
  diwali: {
    festival: "diwali",
    labelHi: "दिवाली: दीये और कमल, गेंदे के रंग",
    labelEn: "Diwali: diyas and lotus in marigold colours",
    params: { kind: "rangoli", template: "radial", rings: 4, motifs: ["diya", "lotus", "geometric"], petals: 8, palette: MARIGOLD },
  },
  pongal: {
    festival: "pongal",
    labelHi: "पोंगल: कोलम जैसे ज्यामितीय नमूने और आम के पत्ते",
    labelEn: "Pongal: kolam-like geometric pattern with mango leaves",
    params: { kind: "rangoli", template: "radial", rings: 3, motifs: ["geometric", "mango-leaf"], petals: 12, palette: ["peela", "hara", "laal", "safed"] },
  },
  onam: {
    festival: "onam",
    labelHi: "ओणम: फूलों का पूकलम",
    labelEn: "Onam: flower pookalam",
    params: { kind: "pookalam", rings: 6, palette: ["peela", "kesariya", "safed", "laal", "jamuni", "hara"] },
  },
  lohri: {
    festival: "lohri",
    labelHi: "लोहड़ी: आग जैसे गरम रंग, पत्ते और ज्यामितीय नमूने",
    labelEn: "Lohri: warm fire colours with leaves and geometric pattern",
    params: { kind: "rangoli", template: "radial", rings: 3, motifs: ["mango-leaf", "geometric"], petals: 10, palette: ["laal", "kesariya", "peela", "hara"] },
  },
  navratri: {
    festival: "navratri",
    labelHi: "नवरात्रि: मोरपंख और कमल, गहरे रंग",
    labelEn: "Navratri: peacock feathers and lotus in rich colours",
    params: { kind: "rangoli", template: "radial", rings: 4, motifs: ["peacock-feather", "lotus", "geometric"], petals: 9, palette: ["neela", "hara", "jamuni", "gulabi", "peela"] },
  },
};

export function isFestival(v: string): v is Festival {
  return (FESTIVALS as readonly string[]).includes(v);
}

/** Parameters for a festival preset (a fresh copy). */
export function presetParams(festival: Festival): DesignParams {
  return structuredClone(PRESETS[festival].params);
}
