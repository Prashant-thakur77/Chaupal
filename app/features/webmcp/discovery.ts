import {
  CHAUPAL_TOOL_NAMES,
  CHAUPAL_WEBMCP_CONTRACT_VERSION,
} from "@/features/webmcp/contract";

export const CHAUPAL_WEBMCP_DISCOVERY_ELEMENT_ID =
  "chaupal-webmcp-agent-discovery";
export const CHAUPAL_WEBMCP_TRANSPORT = "document.modelContext";
export const CHAUPAL_WEBMCP_TOOL_SCOPE = "current-browser-tab";
export const CHAUPAL_WEBMCP_DISCOVERY_CHANNEL = "webmcp-capability-fetchTools";
export const CHAUPAL_WEBMCP_AGENT_HINT =
  "CHAUPAL actions are page-defined, tab-scoped WebMCP tools. Browser agents should discover them from the current tab's WebMCP capability with fetchTools(); the global task tool list alone is not an authoritative availability check.";

export const CHAUPAL_WEBMCP_DISCOVERY_MANIFEST = {
  schemaVersion: 1,
  provider: "CHAUPAL",
  contractVersion: CHAUPAL_WEBMCP_CONTRACT_VERSION,
  transport: CHAUPAL_WEBMCP_TRANSPORT,
  registrationApi: "document.modelContext.registerTool",
  toolScope: CHAUPAL_WEBMCP_TOOL_SCOPE,
  discovery: {
    capability: "webmcp",
    operation: "fetchTools",
    channel: CHAUPAL_WEBMCP_DISCOVERY_CHANNEL,
  },
  toolPrefix: "chaupal_",
  toolCount: CHAUPAL_TOOL_NAMES.length,
  tools: CHAUPAL_TOOL_NAMES,
  agentHint: CHAUPAL_WEBMCP_AGENT_HINT,
  safety:
    "Discovery metadata does not grant permission. Tool calls still require the person's request and the tool contract's confirmation boundaries.",
} as const;

export const CHAUPAL_WEBMCP_DISCOVERY_JSON = JSON.stringify(
  CHAUPAL_WEBMCP_DISCOVERY_MANIFEST,
).replace(/</g, "\\u003c");
