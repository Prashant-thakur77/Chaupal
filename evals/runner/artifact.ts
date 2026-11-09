import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

export type AgentSurfaceArtifact = {
  path: "artifact";
};

/** Files that make up Chaupal's agent-facing surface: action definitions and the result shapes they return. */
const SURFACE_SERVER_FILES = ["kit.ts", "snapshot.ts", "valid-actions.ts", "capabilities.ts", "chess.ts"];

/**
 * Preserve only the agent-facing surface evaluated in one candidate iteration:
 * every action definition plus the server modules that shape their results.
 * The fixed eval set and the rest of the app stay outside. The exact MCP
 * catalog the model saw is written beside it by the runner.
 */
export function snapshotAgentSurfaceArtifact(options: { repoRoot: string; iterationRoot: string }): AgentSurfaceArtifact {
  const artifactRoot = join(options.iterationRoot, "artifact");
  if (existsSync(artifactRoot)) throw new Error("AGENT_SURFACE_ARTIFACT_ALREADY_EXISTS");
  mkdirSync(join(artifactRoot, "actions"), { recursive: true });
  mkdirSync(join(artifactRoot, "server"), { recursive: true });
  for (const entry of readdirSync(join(options.repoRoot, "actions"))) {
    if (entry.endsWith(".ts")) cpSync(join(options.repoRoot, "actions", entry), join(artifactRoot, "actions", entry));
  }
  for (const entry of SURFACE_SERVER_FILES) {
    cpSync(join(options.repoRoot, "server/chaupal", entry), join(artifactRoot, "server", entry));
  }
  return { path: "artifact" };
}
