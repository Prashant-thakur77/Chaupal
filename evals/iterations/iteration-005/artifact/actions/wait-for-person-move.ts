import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { waitForPersonMove } from "../server/chaupal/chess.js";
import { ChaupalResult, respond, sessionOf } from "../server/chaupal/kit.js";
import { readActivity } from "../server/chaupal/state.js";
import { getDb } from "../server/db/index.js";

export default defineAction({
  description:
    "Use only when she said she will move by hand on the board and it is her turn: waits (up to 45 s) for her drag or tap, then returns her move and whether you should reply. It never waits for future speech; if she has not moved, it returns timedOut and you simply wait for her.",
  schema: z.object({}),
  outputSchema: ChaupalResult,
  mcpTool: true,
  readOnly: true,
  timeoutMs: 60_000,
  run: async (_args, ctx) => {
    const who = await sessionOf(ctx);
    const out = await waitForPersonMove(who);
    const st = (await readActivity(getDb(), who.session.id))!;
    return respond(st, out);
  },
});
