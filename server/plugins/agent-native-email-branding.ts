import { defineAppConfig } from "@agent-native/core/server";

export default defineAppConfig({
  app: {
    name: "Chaupal",
    sourceTemplate: "chat",
    homePath: "/chaupal",
  },
  agent: {
    engine: "anthropic",
    model: "claude-sonnet-5-5",
  },
});
