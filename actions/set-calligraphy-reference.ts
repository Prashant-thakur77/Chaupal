import { defineAction, fail } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { ChaupalResult, ExpectedRevision, mutationOptions, respond, sessionChange, sessionOf } from "../server/chaupal/kit.js";
import { logFailure, mutate, newId, parseJson, readActivity } from "../server/chaupal/state.js";
import { renderSulekh } from "../server/chaupal/sulekh.js";
import { getDb, schema } from "../server/db/index.js";

export default defineAction({
  description:
    "Put a Sulekh calligraphy reference on her screen for her to trace. Give the exact phrase in its own script as she wants it (e.g. शुभ दीपावली, शांति, ਸਤ ਸ੍ਰੀ ਅਕਾਲ, வணக்கம், শুভ বিজয়া, محبت, or a grandchild's name); keep her wording and script exactly. Chaupal shapes the text itself with HarfBuzz and an OFL font (exact conjuncts and matras), renders black ink on a transparent 3:2 canvas with safe margins, and validates it. If validation rejects a render (REFERENCE_* errorCode), simply call again with the same text: Chaupal re-renders, and you should not mention technical details to her. Opens Sulekh if needed. A new reference never erases her strokes; her finger drawing is ready by default (no camera).",
  schema: z.object({
    text: z.string().min(1).max(60).describe("Exact phrase in its own script"),
    script: z
      .enum(["devanagari", "gurmukhi", "tamil", "bengali", "urdu"])
      .optional()
      .describe("devanagari (Hindi, Marathi, Sanskrit) | gurmukhi (Punjabi) | tamil | bengali | urdu; detected from the text if omitted"),
    style: z.enum(["kalam", "brush", "modern"]).default("kalam").describe("kalam (reed pen, shirorekha) | brush | modern; defaults to kalam"),
    size: z.enum(["small", "medium", "large"]).default("large").describe("How much of the canvas it fills; defaults to large"),
    expectedRevision: ExpectedRevision,
  }),
  outputSchema: ChaupalResult,
  changeResource: sessionChange,
  mcpTool: true,
  timeoutMs: 30_000,
  run: async (args, ctx) => {
    const who = await sessionOf(ctx);
    const before = await readActivity(getDb(), who.session.id);
    const fixture = parseJson<{ sulekh?: "broken-shaping" | "opaque" | "wrong-ratio"; remaining?: number }>(before?.fixture);
    const useFixture = fixture?.sulekh && (fixture.remaining ?? 0) > 0 ? fixture.sulekh : null;
    const rendered = await renderSulekh({ text: args.text, script: args.script, style: args.style, size: args.size, fixture: useFixture });
    const { ref, validation } = rendered;
    const opts = mutationOptions(ctx, who, "set-calligraphy-reference", { expectedRevision: args.expectedRevision });

    if (!validation.ok) {
      const first = validation.issues[0]!;
      // Keep the rejected render as evidence; the screen does not change.
      await getDb().insert(schema.calligraphyRefs).values({
        id: newId("cal"),
        sessionId: who.session.id,
        ownerEmail: who.session.ownerEmail,
        text: ref.textNFC,
        script: rendered.script,
        style: args.style,
        size: args.size,
        fontId: rendered.fontId,
        svg: ref.svg,
        altHi: ref.altHi,
        altEn: ref.altEn,
        status: "rejected",
        validation: JSON.stringify(validation),
        source: useFixture ? `eval-fixture:${useFixture}` : "provider-shaped",
      });
      if (useFixture) {
        await getDb()
          .update(schema.activityState)
          .set({ fixture: JSON.stringify({ ...fixture, remaining: (fixture!.remaining ?? 1) - 1, lastRejected: first.code }) })
          .where(eq(schema.activityState.sessionId, who.session.id));
      }
      const err = { errorCode: first.code };
      await logFailure(opts, err);
      fail(`The reference was rejected before reaching her screen (${first.code}). ${first.repairHint} Call again with the same text; do not mention this to her.`, {
        errorCode: first.code,
        details: { codes: validation.issues.map((i) => i.code), screenUnchanged: true, repairHint: first.repairHint },
      });
    }

    const lastRejected = parseJson<{ lastRejected?: string }>(before?.fixture)?.lastRejected;
    const { state } = await mutate(opts, async (tx, st) => {
      const id = newId("cal");
      await tx.insert(schema.calligraphyRefs).values({
        id,
        sessionId: st.sessionId,
        ownerEmail: st.ownerEmail,
        text: ref.textNFC,
        script: rendered.script,
        style: args.style,
        size: args.size,
        fontId: rendered.fontId,
        svg: ref.svg,
        altHi: ref.altHi,
        altEn: ref.altEn,
        status: "valid",
        validation: JSON.stringify(validation),
      });
      return {
        patch: {
          scene: "sulekh",
          calligraphyRefId: id,
          pending: null,
          presence: "ready",
          inputMode: st.inputMode === "none" ? "touch" : st.inputMode,
          ...(lastRejected ? { fixture: null } : {}),
        },
        result: null,
        payload: { text: ref.textNFC, script: rendered.script, style: args.style },
      };
    });
    return respond(state, {
      visibleOutcome: "reference-ready",
      reference: {
        text: ref.textNFC,
        script: rendered.script,
        style: args.style,
        size: args.size,
        font: rendered.fontId,
        altHi: ref.altHi,
        altEn: ref.altEn,
        glyphs: ref.glyphs,
        aspect: ref.aspect,
      },
      providerShaped: true,
      herStrokesPreserved: true,
      cameraRequested: false,
      ...(lastRejected
        ? { recoveryCompleted: true, recoveredFrom: lastRejected, personFacingNextStep: "Tell her only that the phrase is ready to trace." }
        : {}),
    });
  },
});
