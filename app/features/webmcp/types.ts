export type ChaupalLanguage = "ko" | "en";
export type ChaupalActivity = "calligraphy" | "janggi";
export type ChaupalStage = "home" | "activity" | "private" | "review" | "handoff";
export type ChaupalPresence =
  | "ready"
  | "listening"
  | "receiving"
  | "creating"
  | "speaking"
  | "awaiting"
  | "connected";
export type WebMcpProviderStatus = "checking" | "connected" | "demo" | "error";
export type ChaupalInvocationSource = "webmcp" | "person";
export type ChaupalInspectorTab = "history" | "tools";
export type ChaupalCalligraphyInputMode =
  | "idle"
  | "requesting"
  | "hand"
  | "fallback";

export type ChaupalToolName =
  | "chaupal_get_capabilities"
  | "chaupal_get_session_state"
  | "chaupal_get_execution_log"
  | "chaupal_set_language"
  | "chaupal_set_webmcp_panel"
  | "chaupal_project_agent_presence"
  | "chaupal_go_home"
  | "chaupal_open_activity"
  | "chaupal_set_calligraphy_reference"
  | "chaupal_start_calligraphy_camera"
  | "chaupal_stop_calligraphy_camera"
  | "chaupal_clear_calligraphy"
  | "chaupal_get_janggi_state"
  | "chaupal_wait_for_person_janggi_move"
  | "chaupal_move_janggi_piece"
  | "chaupal_open_support_note"
  | "chaupal_prepare_support_review"
  | "chaupal_create_local_handoff"
  | "chaupal_get_handoff_status"
  | "chaupal_return_to_activity";

export type EmptyToolInput = Record<string, never>;

export type CalligraphySuggestion = {
  character: string;
  label: string;
  reading?: string;
  meaning?: string;
};

export interface ChaupalToolInputMap {
  chaupal_get_capabilities: EmptyToolInput;
  chaupal_get_session_state: EmptyToolInput;
  chaupal_get_execution_log: EmptyToolInput;
  chaupal_set_language: { language: ChaupalLanguage };
  chaupal_set_webmcp_panel: {
    open: boolean;
    tab?: ChaupalInspectorTab;
  };
  chaupal_project_agent_presence: {
    phase: ChaupalPresence;
    caption?: string;
  };
  chaupal_go_home: { personConfirmed: boolean };
  chaupal_open_activity: {
    activity: ChaupalActivity;
    caption?: string;
    question?: string;
    suggestions?: CalligraphySuggestion[];
  };
  chaupal_set_calligraphy_reference: {
    character: string;
    reading?: string;
    meaning?: string;
    caption?: string;
    referenceImageUrl: string;
    referenceImageAlt?: string;
  };
  chaupal_start_calligraphy_camera: { personExplicitlyAsked: boolean };
  chaupal_stop_calligraphy_camera: { personExplicitlyAsked: boolean };
  chaupal_clear_calligraphy: { personConfirmed: boolean };
  chaupal_get_janggi_state: EmptyToolInput;
  chaupal_wait_for_person_janggi_move: EmptyToolInput;
  chaupal_move_janggi_piece: {
    action: "preview" | "move" | "pass" | "reset";
    actor: "person" | "agent";
    pieceId?: string;
    toRow?: number;
    toCol?: number;
    spokenMove?: string;
    personConfirmed: boolean;
  };
  chaupal_open_support_note: {
    personExplicitlyAsked: boolean;
    summary: string;
    desiredOutcome: string;
  };
  chaupal_prepare_support_review: { minimumDisclosure: string };
  chaupal_create_local_handoff: { seenRevision: number };
  chaupal_get_handoff_status: EmptyToolInput;
  chaupal_return_to_activity: EmptyToolInput;
}

type StructuredResult = Record<string, unknown>;

export interface ChaupalToolResultMap {
  chaupal_get_capabilities: StructuredResult & {
    provider: "CHAUPAL";
    toolCount: number;
    validNextActions: ChaupalToolName[];
  };
  chaupal_get_session_state: StructuredResult & {
    stage: ChaupalStage;
    activity: ChaupalActivity | null;
    revision: number;
    validNextActions: ChaupalToolName[];
  };
  chaupal_get_execution_log: StructuredResult & {
    invocations: WebMcpInvocationRecord[];
    newestFirst: true;
  };
  chaupal_set_language: StructuredResult & { language: ChaupalLanguage };
  chaupal_set_webmcp_panel: StructuredResult & {
    open: boolean;
    tab: ChaupalInspectorTab;
  };
  chaupal_project_agent_presence: StructuredResult & {
    revision: number;
    phase: ChaupalPresence;
  };
  chaupal_go_home: StructuredResult & { stage: "home"; activity: null };
  chaupal_open_activity: StructuredResult & {
    stage: ChaupalStage;
    activity: ChaupalActivity;
    revision: number;
  };
  chaupal_set_calligraphy_reference: StructuredResult & {
    revision: number;
    calligraphy: StructuredResult & {
      character: string;
      referenceImagePresent: boolean;
    };
    assetValidation: StructuredResult & { trueAlpha: true };
  };
  chaupal_start_calligraphy_camera: StructuredResult & { revision: number };
  chaupal_stop_calligraphy_camera: StructuredResult & { revision: number };
  chaupal_clear_calligraphy: StructuredResult & { revision: number };
  chaupal_get_janggi_state: StructuredResult & { revision: number };
  chaupal_wait_for_person_janggi_move: StructuredResult;
  chaupal_move_janggi_piece: StructuredResult & {
    revision: number;
    action: "preview" | "move" | "pass" | "reset";
    actor: "person" | "agent";
  };
  chaupal_open_support_note: StructuredResult & {
    stage: "private";
    revision: number;
  };
  chaupal_prepare_support_review: StructuredResult & {
    stage: "review";
    revision: number;
  };
  chaupal_create_local_handoff: StructuredResult & {
    stage: "handoff";
    revision: number;
  };
  chaupal_get_handoff_status: StructuredResult & { revision: number };
  chaupal_return_to_activity: StructuredResult & {
    stage: "activity";
    activity: ChaupalActivity;
    revision: number;
  };
}

export type ChaupalWebMcpContent = {
  type: "text";
  text: string;
};

export type ChaupalWebMcpToolResult<
  TStructured extends StructuredResult = StructuredResult,
> = {
  content: ChaupalWebMcpContent[];
  structuredContent?: TStructured;
};

export type ChaupalToolDescriptor = {
  name: ChaupalToolName;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, boolean>;
};

export type BrowserWebMcpTool = ChaupalToolDescriptor & {
  execute: (
    input: Record<string, unknown>,
  ) => ChaupalWebMcpToolResult | Promise<ChaupalWebMcpToolResult>;
};

export type WebMcpInvocationRecord = {
  id: string;
  tool: ChaupalToolName;
  source: ChaupalInvocationSource;
  status: "running" | "succeeded" | "failed";
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  revisionBefore: number;
  revisionAfter: number | null;
  errorCode: string | null;
};

export type ChaupalToolExecutor = <TName extends ChaupalToolName>(
  name: TName,
  input: ChaupalToolInputMap[TName],
  source?: ChaupalInvocationSource,
) => Promise<ChaupalWebMcpToolResult>;
