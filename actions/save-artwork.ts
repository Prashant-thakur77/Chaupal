import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { saveCurrentArtwork } from "../server/chaupal/family-update.js";
import { ChaupalResult, mutationOptions, respond, sessionChange, sessionOf } from "../server/chaupal/kit.js";
import { mutate } from "../server/chaupal/state.js";
import createResourceVersion from "@agent-native/core/history/actions/create-resource-version";

export default defineAction({
  description:
    "Keep what is on her screen in her album: the calligraphy with her own strokes, her rangoli or kolam with its colours, or the chess board. Only when she asks to keep or save it. Nothing is shared.",
  schema: z.object({}),
  outputSchema: ChaupalResult,
  changeResource: sessionChange,
  mcpTool: true,
  run: async (_args, ctx) => {
    const who = await sessionOf(ctx);
    const saved = await saveCurrentArtwork(who);
    const { state } = await mutate(mutationOptions(ctx, who, "save-artwork"), async () => ({
      result: null,
      payload: { albumId: saved.id, kind: saved.kind },
    }));
    // The framework's History record of the session, alongside the album row.
    let historyVersion: number | null = null;
    try {
      const version = await createResourceVersion.run(
        {
          resourceType: "chaupal-session",
          resourceId: who.session.id,
          title: saved.title,
          summary: `${saved.kind} saved to album`,
          snapshot: { kind: saved.kind, albumId: saved.id },
          metadata: { imagePath: `/api/album/${saved.id}.svg` },
        },
        ctx,
      );
      historyVersion = version.versionNumber;
    } catch {
      historyVersion = null;
    }
    return respond(state, { saved, historyVersion, sharedWithAnyone: false });
  },
});
