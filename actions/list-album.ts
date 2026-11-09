import { defineAction } from "@agent-native/core/action";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { sessionOf } from "../server/chaupal/kit.js";
import { getDb, schema } from "../server/db/index.js";

export default defineAction({
  description: "List the works kept in her album (newest first): what kind, its title, when, and whether it was shared with family.",
  schema: z.object({ limit: z.coerce.number().int().min(1).max(60).default(30).describe("How many, newest first; defaults to 30") }),
  outputSchema: z.looseObject({ items: z.array(z.looseObject({ id: z.string() })) }),
  http: { method: "GET" },
  mcpTool: true,
  readOnly: true,
  run: async ({ limit }, ctx) => {
    const who = await sessionOf(ctx, { allowFamily: true });
    const rows = await getDb()
      .select({
        id: schema.album.id,
        kind: schema.album.kind,
        title: schema.album.title,
        createdAt: schema.album.createdAt,
        sharedAt: schema.album.sharedAt,
      })
      .from(schema.album)
      .where(eq(schema.album.sessionId, who.session.id))
      .orderBy(desc(schema.album.createdAt))
      .limit(limit);
    return { items: rows.map((r) => ({ ...r, imagePath: `/api/album/${r.id}.svg` })) };
  },
});
