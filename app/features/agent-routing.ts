export const CHAUPAL_AGENT_TAB_TITLE = "CHAUPAL — Use WebMCP";
export const CHAUPAL_AGENT_ROUTING_ELEMENT_ID = "chaupal-agent-routing";
export const CHAUPAL_AGENT_PRIMARY_INTERFACE = "webmcp";
export const CHAUPAL_AGENT_CONTROL_MODE = "webmcp-first";
export const CHAUPAL_AGENT_WEBMCP_PRIORITY = "required-when-available";
export const CHAUPAL_AGENT_BROWSER_CONTROL_FALLBACK =
  "only-when-current-tab-webmcp-is-unavailable";
export const CHAUPAL_AGENT_ROUTING_HINT =
  "Check current-tab WebMCP first. When CHAUPAL WebMCP tools are available, every Agent action must use the matching chaupal_* tool instead of DOM inspection, clicks, or typing. Use browser control only after current-tab WebMCP is confirmed unavailable. If WebMCP is connected but no tool matches, report that instead of searching the DOM.";

export const CHAUPAL_AGENT_ROUTING_MANIFEST = {
  schemaVersion: 1,
  provider: "CHAUPAL",
  primaryInterface: CHAUPAL_AGENT_PRIMARY_INTERFACE,
  controlMode: CHAUPAL_AGENT_CONTROL_MODE,
  webMcpPriority: CHAUPAL_AGENT_WEBMCP_PRIORITY,
  browserControlFallback: CHAUPAL_AGENT_BROWSER_CONTROL_FALLBACK,
  directUiControlOwner: "person",
  actionOrder: [
    "fetch-current-tab-webmcp-tools",
    "when-available-call-the-matching-chaupal-tool",
    "use-browser-control-only-if-current-tab-webmcp-is-unavailable",
  ],
  agentHint: CHAUPAL_AGENT_ROUTING_HINT,
} as const;

export const CHAUPAL_AGENT_ROUTING_JSON = JSON.stringify(
  CHAUPAL_AGENT_ROUTING_MANIFEST,
).replace(/</g, "\\u003c");
