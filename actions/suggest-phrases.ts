import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { ChaupalResult, sessionChange, mutationOptions, maxWaitMs, respond, sessionOf, sleep } from "../server/chaupal/kit.js";
import { mutate, parseJson, readActivity } from "../server/chaupal/state.js";
import { getDb } from "../server/db/index.js";

const Suggestion = z.object({
  text: z.string().min(1).max(40).describe("Exact phrase in its own script, e.g. शांति"),
  meaningHi: z.string().max(60).optional().describe("Short meaning in Hindi"),
  meaningEn: z.string().max(60).optional().describe("Short meaning in English"),
});

export default defineAction({
  description:
    "Show her 1 to 3 phrase choices for Sulekh calligraphy (only when she asks for ideas or has not named a phrase) and wait up to 10 seconds for her tap. A suggestion is not a choice: if she has not tapped, the choices stay visible and you must wait for her to say or tap one. Never pick for her. Opens Sulekh if needed.",
  schema: z.object({
    suggestions: z.array(Suggestion).min(1).max(3).describe("1 to 3 phrases you suggest, secular by default"),
    question: z.string().max(160).optional().describe("Short question shown above the choices, in her language"),
  }),
  outputSchema: ChaupalResult,
  changeResource: sessionChange,
  mcpTool: true,
  run: async ({ suggestions, question }, ctx) => {
    const who = await sessionOf(ctx);
    const { session } = who;
    const token = crypto.randomUUID().slice(0, 8);
    await mutate(mutationOptions(ctx, who, "suggest-phrases"), async () => ({
      patch: {
        scene: "sulekh",
        pending: JSON.stringify({ kind: "phrase-choice", token, question: question ?? null, options: suggestions }),
        presence: "awaiting",
      },
      result: null,
      payload: { options: suggestions.map((s) => s.text) },
    }));
    const deadline = Date.now() + maxWaitMs(10_000);
    while (Date.now() < deadline) {
      await sleep(400);
      const st = await readActivity(getDb(), session.id);
      const pending = parseJson<{ token?: string; chosen?: string }>(st?.pending);
      if (pending?.token === token && pending.chosen) {
        return respond(st!, {
          choicesShown: suggestions.map((s) => s.text),
          chosenByHer: pending.chosen,
          userGestureReceived: true,
          nextStep: "Make the reference for exactly the chosen text with set-calligraphy-reference.",
        });
      }
      if (pending?.token !== token) break;
    }
    const st = (await readActivity(getDb(), session.id))!;
    return respond(st, {
      choicesShown: suggestions.map((s) => s.text),
      interactionPending: true,
      choicesRemainVisible: true,
      nextStep: "She has not chosen yet. Wait for her to say or tap a phrase; do not choose for her.",
    });
  },
});
