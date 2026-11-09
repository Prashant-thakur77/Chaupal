import { defineAction } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { config } from "../server/chaupal/config.js";

import { ChaupalResult, mutationOptions, respond, sessionChange, sessionOf } from "../server/chaupal/kit.js";
import { mutate, newId, nowIso } from "../server/chaupal/state.js";
import { familyGuestEmail } from "../server/lib/guest.js";
import { schema } from "../server/db/index.js";

export default defineAction({
  description:
    "Invite a family member (e.g. her grandson Rahul) to her live Chaupal with a private link they open on their phone. They see the same live activity. With playsOtherSide:true and shatranj open, they take the other side of the board and you stop moving for that side. Only their link sees her activity; camera, audio and chat are never shared.",
  schema: z.object({
    name: z.string().min(1).max(40).describe("Family member's name as she says it, e.g. Rahul"),
    relation: z.string().max(40).optional().describe("Relation in her words, e.g. pota (grandson)"),
    playsOtherSide: z.boolean().default(false).describe("true when she wants them to play the other side of the chess board"),
  }),
  outputSchema: ChaupalResult,
  changeResource: sessionChange,
  mcpTool: true,
  run: async ({ name, relation, playsOtherSide }, ctx) => {
    const who = await sessionOf(ctx);
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
    const linkId = newId("fam");
    const { state } = await mutate(mutationOptions(ctx, who, "invite-family"), async (tx, st) => {
      await tx.insert(schema.familyLinks).values({
        id: linkId,
        sessionId: st.sessionId,
        ownerEmail: st.ownerEmail,
        token,
        name,
        relation: relation ?? null,
        role: playsOtherSide ? "player" : "viewer",
      });
      // The framework's share grant: the family guest identity may read and
      // play in this one household session, so live-sync events reach them.
      await tx.insert(schema.sessionShares).values({
        id: newId("shr"),
        resourceId: st.sessionId,
        principalType: "user",
        principalId: familyGuestEmail(linkId),
        role: "editor",
        createdBy: st.ownerEmail,
        createdAt: nowIso(),
      });
      if (playsOtherSide && st.chessGameId) {
        await tx
          .update(schema.chessGames)
          .set({ opponent: "family", opponentName: name, updatedAt: nowIso() })
          .where(eq(schema.chessGames.id, st.chessGameId));
      }
      return { result: null, payload: { name, playsOtherSide } };
    });
    const base = config.publicUrl();
    const joinPath = `/api/family/join?t=${token}`;
    return respond(state, {
      invited: { name, relation: relation ?? null, playsOtherSide },
      joinPath,
      joinUrl: base ? `${base.replace(/\/$/, "")}${joinPath}` : null,
      shownOnHerScreen: true,
      note: playsOtherSide
        ? `${name} now plays the other side. Do not move for ${name}.`
        : `${name} can watch live.`,
    });
  },
});
