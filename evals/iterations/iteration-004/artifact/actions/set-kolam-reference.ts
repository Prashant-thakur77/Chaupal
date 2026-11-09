import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { ChaupalResult, ExpectedRevision, mutationOptions, respond, sessionChange, sessionOf } from "../server/chaupal/kit.js";
import { minLoops, storeDesign } from "../server/chaupal/kolam.js";
import { mutate } from "../server/chaupal/state.js";

export default defineAction({
  description:
    "Draw a pulli kolam for her to trace: an N×N dot grid (3 to 9) with sikku loops weaving around every dot, generated and validated by Chaupal (closed curves, symmetry). 2-fold or 4-fold on an odd grid gives one continuous line; even grids need at least 2 loops and 8-fold needs at least N. Opens Kolam. Her traced lines stay on her own layer.",
  schema: z.object({
    grid: z.number().int().min(3).max(9).describe("Dots per side, 3 to 9 (5 means 5×5)"),
    symmetry: z.enum(["2-fold", "4-fold", "8-fold"]).default("4-fold").describe("2-fold | 4-fold | 8-fold; defaults to 4-fold"),
    seed: z.number().int().min(0).max(9999).optional().describe("Variation number for a different pattern with the same grid"),
    expectedRevision: ExpectedRevision,
  }),
  outputSchema: ChaupalResult,
  changeResource: sessionChange,
  mcpTool: true,
  run: async ({ grid, symmetry, seed, expectedRevision }, ctx) => {
    const who = await sessionOf(ctx);
    const { state, result } = await mutate(mutationOptions(ctx, who, "set-kolam-reference", { expectedRevision }), async (tx, st) => {
      const { id, design } = await storeDesign(tx, st, { kind: "pulli", grid, symmetry, loops: "single", seed: seed ?? 0 });
      return {
        patch: { scene: "kolam", kolamRefId: id, pending: null, presence: "ready", inputMode: st.inputMode === "none" ? "touch" : st.inputMode },
        result: {
          kind: "pulli",
          grid,
          symmetry,
          loopCount: design.meta.loopCount,
          minimumLoopsForThisSymmetry: minLoops(grid, symmetry),
          valid: design.validation.valid,
          regions: design.regions.length,
          altHi: design.altHi,
          altEn: design.altEn,
        },
        payload: { grid, symmetry },
      };
    });
    return respond(state, { design: result, visibleOutcome: "kolam-ready", herStrokesPreserved: true });
  },
});
