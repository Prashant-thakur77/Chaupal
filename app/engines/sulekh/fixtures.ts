/**
 * Deliberately broken references for the eval's bad-render-repair and
 * fit-repair cases. Each fixture names the code validation must report and
 * the repair that fixes it.
 */

import { renderReferenceInternal, type SulekhReference } from "./render";
import { fontFor, type FontId } from "./scripts";
import { validateReference, type ReferenceCode, type ValidationResult } from "./validate";

export type FixtureKind =
  | "notdef"
  | "opaque-background"
  | "wrong-ratio"
  | "clipped"
  | "text-mismatch"
  | "empty"
  | "broken-cluster"
  | "too-small";

export const FIXTURE_KINDS: readonly FixtureKind[] = [
  "notdef",
  "opaque-background",
  "wrong-ratio",
  "clipped",
  "text-mismatch",
  "empty",
  "broken-cluster",
  "too-small",
];

export interface Fixture {
  kind: FixtureKind;
  /** Eval case family this fixture feeds. */
  evalCase: "bad-render-repair" | "fit-repair";
  requestedText: string;
  ref: SulekhReference;
  expectedCode: ReferenceCode;
  validation: ValidationResult<ReferenceCode>;
  /** What the agent should do; applying it must produce a passing render. */
  repair: string;
}

export type FontLoader = (fontId: FontId) => Promise<Uint8Array>;

export async function makeFixture(kind: FixtureKind, loadFont: FontLoader): Promise<Fixture> {
  const deva = fontFor("devanagari", "kalam");
  const devaBytes = await loadFont(deva.id);
  const base = { script: "devanagari" as const, style: "kalam" as const, size: "medium" as const, fontBytes: devaBytes, fontId: deva.id };
  let requestedText = "शुभ दीपावली";
  let ref: SulekhReference;
  let expectedCode: ReferenceCode;
  let evalCase: Fixture["evalCase"] = "bad-render-repair";
  let repair: string;

  switch (kind) {
    case "notdef": {
      // Tamil text shaped with a Devanagari-only font: every letter is .notdef.
      requestedText = "வணக்கம்";
      ref = await renderReferenceInternal(
        { ...base, text: requestedText, script: "tamil" },
        {},
      );
      expectedCode = "REFERENCE_NOTDEF_GLYPH";
      repair = `Re-render with fontFor("tamil", "kalam") = ${fontFor("tamil", "kalam").id}.`;
      break;
    }
    case "opaque-background": {
      ref = await renderReferenceInternal({ ...base, text: requestedText }, {});
      ref = {
        ...ref,
        svg: ref.svg.replace(/(<svg\b[^>]*>)/, `$1<rect width="1500" height="1000" fill="#fff"/>`),
      };
      expectedCode = "REFERENCE_OPAQUE_BACKGROUND";
      repair = "Re-render with the engine (no background element).";
      break;
    }
    case "wrong-ratio": {
      evalCase = "fit-repair";
      ref = await renderReferenceInternal({ ...base, text: requestedText }, {});
      ref = {
        ...ref,
        width: 1000,
        svg: ref.svg
          .replace('viewBox="0 0 1500 1000"', 'viewBox="250 0 1000 1000"')
          .replace('width="1500"', 'width="1000"'),
      };
      // In the square crop the ink box shifts left by 250 and crowds the edges.
      expectedCode = "REFERENCE_WRONG_RATIO";
      repair = "Re-render on the 1500×1000 (3:2) canvas.";
      break;
    }
    case "clipped": {
      evalCase = "fit-repair";
      ref = await renderReferenceInternal({ ...base, text: requestedText, size: "large" }, { fill: 1.3, noWrap: true });
      expectedCode = "REFERENCE_CLIPPED";
      repair = "Re-render with size medium (the engine fits the run inside the 8% margins).";
      break;
    }
    case "text-mismatch": {
      // Requested कि (ka + i-matra) but the render dropped the matra.
      requestedText = "कि";
      ref = await renderReferenceInternal({ ...base, text: "क" }, {});
      expectedCode = "REFERENCE_TEXT_MISMATCH";
      repair = "Re-render with the exact requested text.";
      break;
    }
    case "empty": {
      ref = await renderReferenceInternal({ ...base, text: " " }, {});
      expectedCode = "REFERENCE_EMPTY";
      repair = "Render the requested phrase; never an empty string.";
      break;
    }
    case "broken-cluster": {
      // A vowel sign with no consonant: HarfBuzz inserts a dotted circle.
      requestedText = "ि";
      ref = await renderReferenceInternal({ ...base, text: requestedText }, {});
      expectedCode = "REFERENCE_BROKEN_CLUSTER";
      repair = "Fix the spelling (e.g. कि) and confirm the phrase before rendering.";
      break;
    }
    case "too-small": {
      evalCase = "fit-repair";
      ref = await renderReferenceInternal({ ...base, text: requestedText, size: "small" }, { fill: 0.3 });
      expectedCode = "REFERENCE_INK_TOO_SMALL";
      repair = "Re-render with size medium or large.";
      break;
    }
  }
  return {
    kind,
    evalCase,
    requestedText,
    ref,
    expectedCode,
    validation: validateReference(ref, requestedText),
    repair,
  };
}
