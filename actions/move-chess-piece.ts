import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";

import { moveFromPhrase, playMove, resolveWords } from "../server/chaupal/chess.js";
import { ChaupalResult, ExpectedRevision, respond, sessionChange, sessionOf } from "../server/chaupal/kit.js";
import { recordConflict } from "../server/chaupal/conflict.js";

export default defineAction({
  description:
    "Make one chess move on her live board. For HER move (actor \"elder\"), pass her own words as `phrase` (Hindi, Hinglish, Punjabi or Tamil, e.g. \"raja ke saamne waala pyada do ghar aage\") and Chaupal resolves them against the live position, or pass from/to squares. Submit what she asked even if it looks illegal: Chaupal rejects an illegal move with a reason (CHESS_ILLEGAL_MOVE), asks back when her words fit two moves (CHESS_AMBIGUOUS with a question to ask her), and leaves the board unchanged; never substitute another move. actor \"agent\" plays your own reply (from/to) only when it is your turn AND she asked you to play against her or to answer her move (e.g. \"phir aap chalna\"); after making her move, do not add a reply on your own: tell her it is the other side's turn and let her decide. The move animates on her screen before this returns.",
  schema: z.object({
    phrase: z.string().max(200).optional().describe("Her words for the move; resolved by Chaupal (use instead of from/to for her move)"),
    from: z.string().regex(/^[a-h][1-8]$/).optional().describe("From square, e.g. e2 (with to)"),
    to: z.string().regex(/^[a-h][1-8]$/).optional().describe("To square, e.g. e4 (with from)"),
    actor: z.enum(["elder", "agent"]).describe('"elder" for her own move, "agent" for your reply'),
    spokenMove: z.string().max(200).optional().describe("Her words for this move, as she said them"),
    promotion: z.enum(["q", "r", "b", "n"]).optional().describe("Promotion piece if a pawn reaches the last rank; defaults to q"),
    personConfirmed: z.boolean().describe("true when she asked for this move (required for actor elder)"),
    expectedRevision: ExpectedRevision,
  }),
  outputSchema: ChaupalResult,
  changeResource: sessionChange,
  mcpTool: true,
  run: async (args, ctx) => {
    if (args.actor === "elder" && !args.personConfirmed) {
      fail("Only move her pieces when she asked for that move.", { errorCode: "PERSON_CONFIRMATION_REQUIRED" });
    }
    const who = await sessionOf(ctx);
    let from = args.from;
    let to = args.to;
    let promotion: string | undefined = args.promotion;
    if (!from || !to) {
      if (!args.phrase) fail("Give her words as phrase, or from and to squares.", { errorCode: "CHESS_MOVE_REQUIRED" });
      const resolved = moveFromPhrase(await resolveWords(who, args.phrase!));
      from = resolved.from;
      to = resolved.to;
      promotion = resolved.promotion ?? promotion;
    }
    try {
      const out = await playMove({
        ctx,
        who,
        from: from!,
        to: to!,
        promotion,
        actor: args.actor,
        via: args.actor === "elder" ? "voice" : "agent",
        spoken: args.spokenMove ?? args.phrase,
        expectedRevision: args.expectedRevision,
      });
      return respond(out.state, {
        moved: out.move,
        ply: out.ply,
        gameStatus: out.status,
        visibleOnHerScreen: out.visibleOnHerScreen,
        rulesValidated: true,
      });
    } catch (error) {
      await recordConflict(who, error, args.actor);
      throw error;
    }
  },
});
