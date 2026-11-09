import { fail } from "@agent-native/core/action";

import {
  applyFills,
  generateDesign,
  minLoops,
  parseFillPhrase,
  presetParams,
  resolveColour,
  resolveZone,
  type DesignParams,
} from "../../app/engines/kolam/index.js";
import { schema } from "../db/index.js";
import type { DbOrTx } from "./state.js";
import { newId } from "./state.js";

export { minLoops };

/** Generate, validate and store a design; the agent only sets parameters. */
export async function storeDesign(tx: DbOrTx, st: { sessionId: string; ownerEmail: string }, params: DesignParams) {
  let design;
  try {
    design = generateDesign(params);
  } catch (error) {
    fail(`Those design settings are out of range: ${(error as Error).message}`, { errorCode: "DESIGN_PARAMS_INVALID" });
  }
  if (!design!.validation.valid) {
    fail("The generated design did not pass validation.", {
      errorCode: "DESIGN_INVALID",
      details: { checks: design!.validation.checks.filter((c) => !c.ok).slice(0, 5) },
    });
  }
  const id = newId("kol");
  await tx.insert(schema.kolamRefs).values({
    id,
    sessionId: st.sessionId,
    ownerEmail: st.ownerEmail,
    kind: design!.kind,
    params: JSON.stringify(design!.params),
    svg: design!.svg,
    regions: JSON.stringify(design!.regions.map((r) => ({ id: r.id, zone: r.zone, zones: r.zones, role: r.role }))),
    validation: JSON.stringify(design!.validation),
    altHi: design!.altHi,
    altEn: design!.altEn,
  });
  return { id, design: design! };
}

export function festivalParams(festival: string) {
  return presetParams(festival as never);
}

/**
 * Turn a fill request into exact region ids. Her words ("beech mein peela,
 * bahar laal") are parsed by a fixed lexicon; anything it cannot place is
 * returned as unresolved, never guessed.
 */
export function planFills(
  params: DesignParams,
  input: { phrase?: string | undefined; fills?: { regionId?: string | undefined; zone?: string | undefined; colour: string }[] | undefined },
) {
  const design = generateDesign(params);
  const known = new Set(design.regions.map((r) => r.id));
  const out: { regionId: string; colour: string }[] = [];
  const unresolved: { text: string; reason: string }[] = [];
  const asked: { zone?: string; regionId?: string; colour: string }[] = [];
  if (input.phrase) {
    const parsed = parseFillPhrase(input.phrase);
    for (const f of parsed.fills) asked.push({ zone: f.zone, colour: f.colour });
    for (const u of parsed.unresolved) unresolved.push({ text: u.text, reason: u.reason });
  }
  for (const f of input.fills ?? []) asked.push(f);
  for (const a of asked) {
    const colour = resolveColour(a.colour);
    if (!colour) {
      unresolved.push({ text: a.colour, reason: "unknown colour" });
      continue;
    }
    const ids = a.regionId ? (known.has(a.regionId) ? [a.regionId] : []) : resolveZone(design, a.zone ?? "");
    if (!ids.length) {
      unresolved.push({ text: a.regionId ?? a.zone ?? "", reason: "no such part of this design" });
      continue;
    }
    for (const id of ids) out.push({ regionId: id, colour });
  }
  // Last instruction for a region wins.
  const dedup = new Map<string, string>();
  for (const f of out) dedup.set(f.regionId, f.colour);
  const fills = Array.from(dedup, ([regionId, colour]) => ({ regionId, colour }));
  const preview = applyFills(design, fills.map((f) => ({ regionId: f.regionId, colour: f.colour as never })));
  return { fills, unresolved, changed: preview.changed };
}
