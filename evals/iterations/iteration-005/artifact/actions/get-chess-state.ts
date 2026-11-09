import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { chessView, requireGame } from "../server/chaupal/chess.js";
import { ChaupalResult, respond, sessionOf } from "../server/chaupal/kit.js";

export default defineAction({
  description:
    "Read the live shatranj board: FEN, whose turn it is (elder, agent or family), every legal move for the side to move with Hindi piece names and descriptions, all pieces, check/mate status, and the revision. Read this before resolving a spoken move; never invent a position.",
  schema: z.object({}),
  outputSchema: ChaupalResult,
  http: { method: "GET" },
  mcpTool: true,
  readOnly: true,
  run: async (_args, ctx) => {
    const who = await sessionOf(ctx, { allowFamily: true });
    const { state, game } = await requireGame(who);
    return respond(state, { position: chessView(game) });
  },
});
