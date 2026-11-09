import { getOrgContext } from "@agent-native/core/org";
import {
  createAgentChatPlugin,
  loadActionsFromStaticRegistry,
} from "@agent-native/core/server";

import actionsRegistry from "../../.generated/actions-registry.js";
import { CHAUPAL_SYSTEM_PROMPT } from "../chaupal/prompt.js";
import { isFamilyGuest } from "../lib/guest.js";
import {
  searchConversationReferences,
  validateConversationReferences,
} from "../lib/composer-references.js";

const INITIAL_TOOL_NAMES = [
  "get-session-state",
  "open-activity",
  "suggest-phrases",
  "set-calligraphy-reference",
  "set-input-mode",
  "start-air-writing",
  "clear-my-strokes",
  "set-rangoli-reference",
  "set-kolam-reference",
  "fill-region",
  "get-chess-state",
  "preview-moves",
  "move-chess-piece",
  "wait-for-person-move",
  "invite-family",
  "draft-family-update",
  "send-family-update",
  "set-language",
  "show-history",
];

export default createAgentChatPlugin({
  appId: "chaupal",
  mentionProviders: {
    chats: {
      label: "composerSources.group",
      search: searchConversationReferences,
    },
  },
  prepareRequest: async (details) => {
    const owner = (details as { ownerEmail?: string }).ownerEmail;
    if (isFamilyGuest(owner)) {
      throw new Error("The family view does not run the elder's agent.");
    }
    await validateConversationReferences(details.references);
  },
  actions: loadActionsFromStaticRegistry(actionsRegistry),
  mcp: { connectorCatalog: [], appApprovalPage: true },
  initialToolNames: INITIAL_TOOL_NAMES,
  resolveOrgId: async (event) => (await getOrgContext(event)).orgId,
  systemPrompt: CHAUPAL_SYSTEM_PROMPT,
});
