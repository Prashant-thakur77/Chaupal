import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * The eval host for Chaupal: one fresh household per session, its live
 * server state, and an MCP client that calls Chaupal's actions as that
 * household. Every session is isolated by its own signed guest identity, so
 * sessions can run in parallel against one server.
 */

export type Household = {
  baseUrl: string;
  cookieName: string;
  cookieValue: string;
  cookieHeader: string;
  /** The household's guest identity; used only to scope MCP calls. */
  email: string;
};

export type EvalToolDescriptor = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, unknown>;
};

/**
 * Framework tools in the MCP catalog that are not Chaupal actions (cross-app
 * routing, org admin, catalog search). Excluded identically from every
 * candidate session; every Chaupal action in the catalog is kept.
 */
export const NON_CHAUPAL_MCP_TOOLS = new Set([
  "ask_app",
  "ask_app_status",
  "list_apps",
  "open_app",
  "tool-search",
  "invite-organization-member",
  "list-organization-members",
]);

const DEFAULT_TOKEN_FILE = resolve(import.meta.dirname, "../../../.chaupal-work/eval-mcp-token");

export function readMcpToken() {
  const path = process.env.CHAUPAL_EVAL_MCP_TOKEN_FILE ?? DEFAULT_TOKEN_FILE;
  const token = readFileSync(path, "utf8").trim();
  if (!token) throw new Error("EVAL_MCP_TOKEN_MISSING");
  return token;
}

export async function startHousehold(baseUrl: string): Promise<Household> {
  const response = await fetch(`${baseUrl}/api/household/start`, { redirect: "manual" });
  const setCookie = response.headers.get("set-cookie") ?? "";
  const match = /(chaupal_guest)=([^;]+)/.exec(setCookie);
  if (!match) throw new Error(`EVAL_HOUSEHOLD_START_FAILED:${response.status}`);
  const [, cookieName, cookieValue] = match;
  const payload = JSON.parse(
    Buffer.from(cookieValue!.split(".")[0]!, "base64url").toString("utf8"),
  ) as { viewerEmail?: string };
  if (!payload.viewerEmail) throw new Error("EVAL_HOUSEHOLD_IDENTITY_MISSING");
  return {
    baseUrl,
    cookieName: cookieName!,
    cookieValue: cookieValue!,
    cookieHeader: `${cookieName}=${cookieValue}`,
    email: payload.viewerEmail,
  };
}

export async function readLiveSession(household: Household) {
  const response = await fetch(`${household.baseUrl}/_agent-native/actions/get-live-session`, {
    headers: { cookie: household.cookieHeader },
  });
  if (!response.ok) throw new Error(`EVAL_LIVE_SESSION_${response.status}`);
  return (await response.json()) as Record<string, any>;
}

/** Arm the one-time faulty Sulekh render for a recovery case (CHAUPAL_EVAL=1 only). */
export async function armProviderFixture(
  household: Household,
  firstResult: "broken-shaping" | "wrong-ratio",
) {
  const response = await fetch(`${household.baseUrl}/_agent-native/actions/set-eval-fixture`, {
    method: "POST",
    headers: { cookie: household.cookieHeader, "content-type": "application/json" },
    body: JSON.stringify({ sulekh: firstResult }),
  });
  if (!response.ok) throw new Error(`EVAL_FIXTURE_ARM_FAILED:${response.status}`);
}

/**
 * The server truth the grader reads, without SVG bodies or stroke points:
 * scene, revision, calligraphy, kolam regions and fills, stroke counts,
 * chess, family, approval and recent events.
 */
export function compactLiveSession(snapshot: Record<string, any>) {
  const svgViewBox = (svg: unknown) =>
    typeof svg === "string" ? (/viewBox="([^"]+)"/.exec(svg)?.[1] ?? null) : null;
  return {
    sessionId: snapshot.sessionId,
    revision: snapshot.revision,
    scene: snapshot.scene,
    language: snapshot.language,
    inputMode: snapshot.inputMode,
    historyOpen: snapshot.historyOpen,
    pending: snapshot.pending ?? null,
    approval: snapshot.approval
      ? { id: snapshot.approval.id, status: snapshot.approval.status, kind: snapshot.approval.kind }
      : null,
    calligraphy: snapshot.calligraphy
      ? {
          id: snapshot.calligraphy.id,
          text: snapshot.calligraphy.text,
          script: snapshot.calligraphy.script,
          style: snapshot.calligraphy.style,
          size: snapshot.calligraphy.size,
          status: snapshot.calligraphy.status,
          validation: snapshot.calligraphy.validation ?? null,
          viewBox: svgViewBox(snapshot.calligraphy.svg),
        }
      : null,
    kolam: snapshot.kolam
      ? {
          id: snapshot.kolam.id,
          kind: snapshot.kolam.kind,
          params: snapshot.kolam.params,
          validation: snapshot.kolam.validation
            ? {
                valid: snapshot.kolam.validation.valid,
                failed: (snapshot.kolam.validation.checks ?? [])
                  .filter((check: { ok: boolean }) => !check.ok)
                  .map((check: { id: string }) => check.id),
                checks: (snapshot.kolam.validation.checks ?? []).map((check: { id: string }) => check.id),
              }
            : null,
          regionCount: (snapshot.kolam.regions ?? []).length,
          fills: Object.fromEntries(
            Object.entries(snapshot.kolam.fills ?? {}).map(([id, fill]) => [id, (fill as { colour: string }).colour]),
          ),
        }
      : null,
    strokes: snapshot.strokes?.counts ?? {},
    chess: snapshot.chess
      ? {
          id: snapshot.chess.id,
          fen: snapshot.chess.fen,
          elderColor: snapshot.chess.elderColor,
          opponent: snapshot.chess.opponent,
          opponentName: snapshot.chess.opponentName,
          turnOwner: snapshot.chess.turnOwner,
          preview: snapshot.chess.preview ?? null,
          moves: (snapshot.chess.moves ?? []).map(
            (move: { ply: number; from: string; to: string; san: string; actor: string; via: string }) => ({
              ply: move.ply,
              from: move.from,
              to: move.to,
              san: move.san,
              actor: move.actor,
              via: move.via,
            }),
          ),
        }
      : null,
    family: (snapshot.family ?? []).map((member: { name: string; role: string; joinPath?: string }) => ({
      name: member.name,
      role: member.role,
      hasJoinPath: Boolean(member.joinPath),
    })),
    events: (snapshot.events ?? []).map(
      (event: { type: string; actor: string; caller: string; ok: boolean; errorCode: string | null; at: string }) => ({
        type: event.type,
        actor: event.actor,
        caller: event.caller,
        ok: event.ok,
        errorCode: event.errorCode,
        at: event.at,
      }),
    ),
  };
}

export type CompactLiveSession = ReturnType<typeof compactLiveSession>;

/** The family join path for the first linked family member, if any. */
export function familyJoinPath(snapshot: Record<string, any>): string | null {
  return (snapshot.family ?? []).find((member: { joinPath?: string }) => member.joinPath)?.joinPath ?? null;
}

type JsonRpcResponse = {
  result?: Record<string, any>;
  error?: { code: number; message: string };
};

/**
 * A Streamable HTTP MCP client scoped to one household. The static bearer
 * authenticates the runner; the owner header names this session's household,
 * so every call acts as that elder and nobody else.
 */
export class HouseholdMcpClient {
  private nextId = 1;
  private sessionId: string | null = null;

  constructor(
    private readonly household: Household,
    private readonly token: string,
  ) {}

  private headers() {
    return {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${this.token}`,
      "x-agent-native-owner-email": this.household.email,
      ...(this.sessionId ? { "mcp-session-id": this.sessionId } : {}),
    };
  }

  private async rpc(method: string, params: Record<string, unknown>, signal?: AbortSignal, notify = false) {
    const id = notify ? undefined : this.nextId++;
    const response = await fetch(`${this.household.baseUrl}/mcp`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ jsonrpc: "2.0", ...(id ? { id } : {}), method, params }),
      signal,
    });
    this.sessionId = response.headers.get("mcp-session-id") ?? this.sessionId;
    const text = await response.text();
    if (notify) return null;
    if (!response.ok && !text) throw new Error(`EVAL_MCP_HTTP_${response.status}`);
    const lines = text.match(/^data: (.*)$/gm);
    const body = (lines?.length
      ? JSON.parse(lines[lines.length - 1]!.slice(6))
      : JSON.parse(text)) as JsonRpcResponse;
    if (body.error) throw new Error(`EVAL_MCP_RPC_ERROR:${body.error.code}:${body.error.message}`);
    return body.result ?? null;
  }

  async initialize() {
    await this.rpc("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "chaupal-eval-runner", version: "1.0.0" },
    });
    await this.rpc("notifications/initialized", {}, undefined, true);
  }

  async listTools(): Promise<EvalToolDescriptor[]> {
    const result = await this.rpc("tools/list", {});
    return ((result?.tools ?? []) as EvalToolDescriptor[]).map((tool) => ({
      name: tool.name,
      description: tool.description ?? "",
      inputSchema: tool.inputSchema ?? { type: "object", properties: {} },
      annotations: tool.annotations ?? {},
    }));
  }

  /** Returns the text the MCP host would show, plus whether it was an error. */
  async callTool(name: string, args: Record<string, unknown>, signal?: AbortSignal) {
    const result = await this.rpc("tools/call", { name, arguments: args }, signal);
    const text = ((result?.content ?? []) as Array<{ type: string; text?: string }>)
      .filter((part) => part.type === "text")
      .map((part) => part.text ?? "")
      .join("\n");
    const isError = result?.isError === true;
    const errorCode = isError
      ? (/\(errorCode: ([A-Za-z0-9_]+)\)/.exec(text)?.[1] ??
        (result?.structuredContent?.error?.errorCode as string | undefined) ??
        "TOOL_ERROR")
      : null;
    let structured: Record<string, unknown> | null = null;
    if (!isError) {
      try {
        structured = JSON.parse(text) as Record<string, unknown>;
      } catch {
        structured = (result?.structuredContent as Record<string, unknown>) ?? null;
      }
    }
    return { text, isError, errorCode, structured };
  }
}

export function repoRoot() {
  return resolve(import.meta.dirname, "../..");
}

export function chaupalSourceFiles() {
  const root = repoRoot();
  return {
    actions: join(root, "actions"),
    server: join(root, "server/chaupal"),
  };
}
