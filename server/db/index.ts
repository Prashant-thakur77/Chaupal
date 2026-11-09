import { createGetDb } from "@agent-native/core/db";
import { registerShareableResource } from "@agent-native/core/sharing";

import * as schema from "./schema.js";

export const getDb = createGetDb(schema);
export { schema };

/**
 * A household's Chaupal session is the shared resource. The elder owns it;
 * a family member's guest identity gets an editor grant when they join, so
 * the framework's live-sync events reach their phone.
 */
registerShareableResource({
  type: "chaupal-session",
  resourceTable: schema.sessions,
  sharesTable: schema.sessionShares,
  displayName: "Chaupal session",
  titleColumn: "elderName",
  getResourcePath: () => "/chaupal",
  allowPublic: false,
  getDb,
});
