import { defineAction, fail } from "@agent-native/core/action";
import { Chess } from "chess.js";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { pieceHi, requireGame } from "../server/chaupal/chess.js";
import { ChaupalResult, mutationOptions, respond, sessionChange, sessionOf } from "../server/chaupal/kit.js";
import { mutate } from "../server/chaupal/state.js";
import { schema } from "../server/db/index.js";

export default defineAction({
  description:
    "Show her on the board where one piece can go, without moving anything (\"pehle dikhao\"). Give the square of the piece (e.g. b1). Listing squares in chat is not a preview; this highlights them on her screen. The turn and position stay unchanged.",
  schema: z.object({
    square: z.string().regex(/^[a-h][1-8]$/).describe("Square of the piece to preview, e.g. b1"),
  }),
  outputSchema: ChaupalResult,
  changeResource: sessionChange,
  mcpTool: true,
  run: async ({ square }, ctx) => {
    const who = await sessionOf(ctx);
    const { game } = await requireGame(who);
    const chess = new Chess(game.fen);
    const piece = chess.get(square as never);
    if (!piece) fail(`There is no piece on ${square}.`, { errorCode: "CHESS_NO_PIECE" });
    const targets = chess.moves({ square: square as never, verbose: true }).map((m) => m.to);
    const { state } = await mutate(mutationOptions(ctx, who, "preview-moves"), async (tx) => {
      await tx
        .update(schema.chessGames)
        .set({ preview: JSON.stringify({ from: square, targets }) })
        .where(eq(schema.chessGames.id, game.id));
      return { result: null, payload: { square, targets } };
    });
    return respond(state, {
      previewShown: { from: square, piece: piece!.type, pieceHi: pieceHi(piece!.type), targets },
      boardUnchanged: true,
      noMoveMade: true,
    });
  },
});
