/**
 * Kolam / rangoli / pookalam engine: shared types.
 *
 * The provider owns the design; the agent only chooses parameters. Every
 * fillable part of a design is a Region with a stable id and semantic zone
 * tags, so voice/tap fills and eval assertions can address it exactly.
 */

export const COLOUR_NAMES = [
  "laal",
  "peela",
  "hara",
  "neela",
  "gulabi",
  "kesariya",
  "safed",
  "jamuni",
  "bhura",
] as const;

/** Canonical (Hinglish) colour name. */
export type ColourName = (typeof COLOUR_NAMES)[number];

/** A region's fill: a named colour, or "none" (uncoloured). */
export type FillValue = ColourName | "none";

export type PulliSymmetry = "2-fold" | "4-fold" | "8-fold";

export type MotifName =
  | "lotus"
  | "diya"
  | "peacock-feather"
  | "mango-leaf"
  | "geometric";

export const MOTIF_NAMES: readonly MotifName[] = [
  "lotus",
  "diya",
  "peacock-feather",
  "mango-leaf",
  "geometric",
];

export interface KolamParams {
  kind: "pulli";
  /** N for an N×N dot grid, 3..9. */
  grid: number;
  symmetry: PulliSymmetry;
  /** "single" (default) asks for one continuous line (ek hi rekha). */
  loops?: "single" | "any";
  /** Varies the mirror layout; same params + seed → same design. */
  seed?: number;
  /** Optional prefill colours: cells are coloured ring by ring. */
  palette?: ColourName[];
}

export interface RangoliParams {
  kind: "rangoli";
  template: "radial";
  /** Motif rings around the centre medallion, 2..5. */
  rings: number;
  /** Motifs used ring by ring (cycled). */
  motifs: MotifName[];
  /** Petal count around the medallion, 6..16; sets the rotational order. */
  petals: number;
  /** Optional prefill colours. Without it every region starts "none". */
  palette?: ColourName[];
}

export interface PookalamParams {
  kind: "pookalam";
  /** Flower rings around the centre, 3..7. */
  rings: number;
  /** Optional prefill colours (flower palette). */
  palette?: ColourName[];
}

export type DesignParams = KolamParams | RangoliParams | PookalamParams;
export type DesignKind = DesignParams["kind"];

export type RegionRole = "area" | "line" | "dots";

export interface DotInfo {
  /** "r,c" (0-based row, column). */
  id: string;
  row: number;
  col: number;
  cx: number;
  cy: number;
  r: number;
}

export interface Region {
  /** Stable id, unique within a design. SVG element id is `r-${id}`. */
  id: string;
  /** Primary zone ("center", "ring-2", "border", "loop", "dots", ...). */
  zone: string;
  /** All zone tags (includes `zone`), e.g. ["ring-3", "outer", "petal", "petal-4"]. */
  zones: string[];
  role: RegionRole;
  fill: FillValue;
  /** Path data (M/C/Z only, absolute, 2-decimal). Empty for the dots region. */
  d: string;
  /** Only for the dots region. */
  dots?: DotInfo[];
  /** Loop number (1-based) for pulli line regions. */
  loop?: number;
}

/** Non-fillable chalk detail (outlines, decorative bindus). */
export interface Decoration {
  id: string;
  d: string;
  /** "stroke" = chalk outline, "fill" = solid chalk dot. */
  style: "stroke" | "fill";
}

/** A transform the design claims to be invariant under (about 500,500). */
export interface SymmetryOp {
  name: string;
  /** 2x2 linear part [a, b, c, d]: x' = a x + b y, y' = c x + d y (centred). */
  m: [number, number, number, number];
}

export interface DesignMeta {
  /** e.g. "4-fold" (pulli) or "8-fold" (rotational order for radial designs). */
  symmetry: string;
  symmetryOps: SymmetryOp[];
  loopCount?: number;
  /** Pulli: internal mirror positions in doubled grid coordinates "x,y". */
  mirrors?: string[];
  /** Pulli curve stroke width in px. */
  lineWidth?: number;
  ringCount?: number;
  /** Rangoli: motifs actually drawn, in ring order. */
  motifs?: MotifName[];
}

export interface ValidationCheck {
  id: string;
  ok: boolean;
  detail: string;
  /** "error" checks decide `valid`; "info" checks are reported only. */
  severity: "error" | "info";
}

export interface Validation {
  valid: boolean;
  checks: ValidationCheck[];
}

export interface LoopInfo {
  id: string;
  /** Number of dot-cell segments the loop passes through. */
  segments: number;
}

/** Output of generateDesign; also the input to applyFills. JSON-safe. */
export interface Design {
  params: DesignParams;
  kind: DesignKind;
  regions: Region[];
  decorations: Decoration[];
  dots?: DotInfo[];
  loops?: LoopInfo[];
  meta: DesignMeta;
  validation: Validation;
  svg: string;
  altHi: string;
  altEn: string;
}

export interface FillRequest {
  /** Exact region id (takes precedence over zone). */
  regionId?: string;
  /** Zone tag or zone word ("center", "beech", "ring-2", "bahar", ...). */
  zone?: string;
  /** Colour in any supported language, or "none" to clear. */
  colour: string;
}

export interface ParsedFill {
  /** Canonical zone tag: "center", "outer", "border", "ring-2", "petal", ... */
  zone: string;
  colour: ColourName;
  /** The clause text this came from. */
  source: string;
}

export interface UnresolvedPart {
  text: string;
  reason: "zone-missing" | "colour-missing" | "ambiguous" | "unknown";
  /** Words that were not in the lexicon. */
  unknownWords?: string[];
}

export interface ParseResult {
  fills: ParsedFill[];
  unresolved: UnresolvedPart[];
}
