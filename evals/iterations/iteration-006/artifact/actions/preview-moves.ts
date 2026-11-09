import { defineAction, fail } from "@agent-native/core/action";
import { Chess } from "chess.js";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { pieceHi, requireGame, resolveWords } from "../server/chaupal/chess.js";
import { ChaupalResult, mutationOptions, respond, sessionChange, sessionOf } from "../server/chaupal/kit.js";
import { mutate } from "../server/chaupal/state.js";
import { schema } from "../server/db/index.js";

export default defineAction({
  description:
    "Show her on the board where a piece can go, without moving anything (\"pehle dikhao ghoda kahan ja sakta hai\"). Pass her words as `phrase`, or the piece's square. Listing squares in chat is not a preview; this highlights them on her screen. The turn and position stay unchanged.",
  schema: z.object({
    phrase: z.string().max(200).optional().describe("Her words, e.g. \"ghoda kahan ja sakta hai\""),
    square: z.string().regex(/^[a-h][1-8]$/).optional().describe("Square of the piece to preview, e.g. b1"),
  }),
  outputSchema: ChaupalResult,
  changeResource: sessionChange,
  mcpTool: true,
  run: async ({ square, phrase }, ctx) => {
    const who = await sessionOf(ctx);
    const { game } = await requireGame(who);
    const chess = new Chess(game.fen);
    let squares: string[] = [];
    if (square) {
      squares = [square];
    } else if (phrase) {
      const r = await resolveWords(who, phrase);
      if (r.status === "preview") squares = r.squares;
      else if (r.status === "resolved") squares = [r.move.from];
      else if (r.status === "ambiguous") squares = Array.from(new Set(r.candidates.map((c) => c.from)));
      else fail(`Chaupal could not tell which piece she means: ${(r as { reasonEn?: string }).reasonEn ?? ""}`, { errorCode: "CHESS_NOT_UNDERSTOOD", details: { reasonHi: (r as { reasonHi?: string }).reasonHi } });
    } else {
      fail("Give her words as phrase or a square.", { errorCode: "CHESS_PREVIEW_TARGET_REQUIRED" });
    }
    square = squares[0]!;
    const piece = chess.get(square as never);
    if (!piece) fail(`There is no piece on ${square}.`, { errorCode: "CHESS_NO_PIECE" });
    const targets = Array.from(new Set(squares.flatMap((sq) => chess.moves({ square: sq as never, verbose: true }).map((m) => m.to))));
    const { state } = await mutate(mutationOptions(ctx, who, "preview-moves"), async (tx) => {
      await tx
        .update(schema.chessGames)
        .set({ preview: JSON.stringify({ from: square, squares, targets }) })
        .where(eq(schema.chessGames.id, game.id));
      return { result: null, payload: { square, targets } };
    });
    return respond(state, {
      previewShown: { from: square, squares, piece: piece!.type, pieceHi: pieceHi(piece!.type), targets },
      boardUnchanged: true,
      noMoveMade: true,
    });
  },
});
