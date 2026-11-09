import type {
  ChaupalInvocationSource,
  ChaupalToolInputMap,
  ChaupalToolName,
  ChaupalWebMcpToolResult,
  WebMcpInvocationRecord,
} from "@/features/webmcp/types";

/**
 * The only boundary between CHAUPAL's provider and its visible React experience.
 * Both person gestures and Agent calls enter the same semantic execute path.
 */
export interface ChaupalWebMcpAdapter {
  getRevision: () => number;
  execute: <TName extends ChaupalToolName>(
    name: TName,
    input: ChaupalToolInputMap[TName],
    source: ChaupalInvocationSource,
  ) => Promise<ChaupalWebMcpToolResult>;
  onInvocation: (record: WebMcpInvocationRecord) => void;
}
