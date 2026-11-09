import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { currentApproval, saveCurrentArtwork, type Approval } from "../server/chaupal/family-update.js";
import { ChaupalResult, mutationOptions, respond, sessionChange, sessionOf, sleep } from "../server/chaupal/kit.js";
import { mutate, newId, readActivity } from "../server/chaupal/state.js";
import { getDb } from "../server/db/index.js";

export default defineAction({
  description:
    "When she asks to send what she made to her family (\"bachchon ko bhej do\"), draft the update: a picture of exactly what is on her screen plus a short message you write in her voice and language. It appears as a large card on her screen asking \"क्या यह परिवार को भेज दूँ?\" and waits up to 20 s for her own answer (her tap or her voice in her UI). You cannot approve it for her. Returns status sent, declined, failed or pending. Never say it was sent unless status is sent.",
  schema: z.object({
    messageHi: z.string().min(1).max(300).describe("The message in her language, short and warm, e.g. \"दिवाली की शुभकामनाएँ, आपकी दादी की रंगोली\""),
    messageEn: z.string().max(300).optional().describe("Same message in English for the family card"),
  }),
  outputSchema: ChaupalResult,
  changeResource: sessionChange,
  mcpTool: true,
  timeoutMs: 40_000,
  run: async ({ messageHi, messageEn }, ctx) => {
    const who = await sessionOf(ctx);
    const art = await saveCurrentArtwork(who);
    const id = newId("upd");
    const approval: Approval = {
      id,
      status: "pending",
      captionHi: messageHi,
      captionEn: messageEn ?? messageHi,
      kind: art.kind,
      albumId: art.id,
      imagePath: `/api/album/${art.id}.svg`,
      to: "Telegram (family)",
    };
    await mutate(mutationOptions(ctx, who, "draft-family-update"), async () => ({
      patch: { approval: JSON.stringify(approval), presence: "awaiting" },
      result: null,
      payload: { id, kind: art.kind },
    }));
    const deadline = Date.now() + 20_000;
    let a = await currentApproval(who.session.id);
    while (Date.now() < deadline && a?.id === id && (a.status === "pending" || a.status === "approved")) {
      await sleep(500);
      a = await currentApproval(who.session.id);
    }
    const st = (await readActivity(getDb(), who.session.id))!;
    const status = a?.id === id ? a.status : "replaced";
    return respond(st, {
      updateId: id,
      status,
      sent: status === "sent",
      nothingSent: status !== "sent",
      failureReason: a?.reason ?? null,
      nextStep:
        status === "pending"
          ? "Her answer is still on screen. Wait for her; do not send or claim anything."
          : status === "declined"
            ? "She said no. Nothing was sent."
            : status === "sent"
              ? "It reached the family chat."
              : "It could not be sent; tell her simply.",
    });
  },
});
