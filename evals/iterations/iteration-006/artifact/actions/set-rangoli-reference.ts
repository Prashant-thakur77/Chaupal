import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { ChaupalResult, ExpectedRevision, mutationOptions, respond, sessionChange, sessionOf } from "../server/chaupal/kit.js";
import { festivalParams, storeDesign } from "../server/chaupal/kolam.js";
import { mutate } from "../server/chaupal/state.js";

const Colour = z.enum(["laal", "peela", "hara", "neela", "gulabi", "kesariya", "safed", "jamuni", "bhura"]);

export default defineAction({
  description:
    "Draw a rangoli (radial motif rings) or pookalam (concentric flower rings) for her to trace and colour, generated and validated by Chaupal. Motifs: lotus, diya, peacock-feather, mango-leaf, geometric (no religious symbols). Named colours: laal, peela, hara, neela, gulabi, kesariya, safed, jamuni, bhura. Pass a festival preset (diwali, pongal, onam, lohri, navratri) only when she named the festival; otherwise ask or leave it plain. Without a palette the design is uncoloured so she can fill it. Opens Rangoli.",
  schema: z.object({
    kind: z.enum(["rangoli", "pookalam"]).default("rangoli").describe("rangoli | pookalam; defaults to rangoli"),
    festival: z.enum(["diwali", "pongal", "onam", "lohri", "navratri"]).optional().describe("Only when she named the festival"),
    rings: z.number().int().min(2).max(7).optional().describe("Rings: rangoli 2–5, pookalam 3–7; small ≈ 2–3"),
    motifs: z.array(z.enum(["lotus", "diya", "peacock-feather", "mango-leaf", "geometric"])).max(4).optional().describe("Rangoli motif rings, inner to outer"),
    petals: z.number().int().min(6).max(16).optional().describe("Rangoli petal count, 6–16"),
    palette: z.array(Colour).max(6).optional().describe("Starting colours, centre outwards; omit for uncoloured"),
    expectedRevision: ExpectedRevision,
  }),
  outputSchema: ChaupalResult,
  changeResource: sessionChange,
  mcpTool: true,
  run: async (args, ctx) => {
    const who = await sessionOf(ctx);
    let params: Record<string, unknown>;
    if (args.festival) {
      params = festivalParams(args.festival) as unknown as Record<string, unknown>;
      if (args.rings) params.rings = args.rings;
      if (args.palette) params.palette = args.palette;
    } else if (args.kind === "pookalam") {
      params = { kind: "pookalam", rings: args.rings ?? 4, ...(args.palette ? { palette: args.palette } : {}) };
    } else {
      params = {
        kind: "rangoli",
        template: "radial",
        rings: Math.min(5, Math.max(2, args.rings ?? 3)),
        motifs: args.motifs?.length ? args.motifs : ["lotus", "mango-leaf"],
        petals: args.petals ?? 8,
        ...(args.palette ? { palette: args.palette } : {}),
      };
    }
    const { state, result } = await mutate(mutationOptions(ctx, who, "set-rangoli-reference", { expectedRevision: args.expectedRevision }), async (tx, st) => {
      const { id, design } = await storeDesign(tx, st, params as never);
      return {
        patch: { scene: "rangoli", kolamRefId: id, pending: null, presence: "ready", inputMode: st.inputMode === "none" ? "touch" : st.inputMode },
        result: {
          kind: design.kind,
          festival: args.festival ?? null,
          params: design.params,
          valid: design.validation.valid,
          regions: design.regions.length,
          zones: Array.from(new Set(design.regions.map((r) => r.zone))).slice(0, 20),
          altHi: design.altHi,
          altEn: design.altEn,
        },
        payload: { kind: design.kind, festival: args.festival ?? null },
      };
    });
    return respond(state, { design: result, visibleOutcome: "rangoli-ready", herStrokesPreserved: true });
  },
});
