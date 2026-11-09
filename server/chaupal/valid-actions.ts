/**
 * The actions that make sense from the current scene. Every result carries
 * this list, and every handler enforces the same rules, so an agent that
 * follows it never hits a guard and one that ignores it is told why.
 */
export interface ValidActionInput {
  scene: string;
  hasCalligraphyRef: boolean;
  hasKolamRef: boolean;
  inputMode: string;
  chessTurnOwner: "elder" | "agent" | "family" | null;
  chessFinished: boolean;
  familyLinked: boolean;
  approvalPending: boolean;
  pendingChoice: boolean;
}

export function validNextActions(s: ValidActionInput): string[] {
  const out = [
    "get-capabilities",
    "get-session-state",
    "set-language",
    "project-presence",
    "show-history",
    "open-activity",
    "invite-family",
  ];
  if (s.scene !== "home") out.push("go-home", "save-artwork");
  if (s.scene === "sulekh") {
    out.push("suggest-phrases", "set-calligraphy-reference");
    if (s.hasCalligraphyRef) {
      out.push("set-input-mode", "start-air-writing", "clear-my-strokes");
    }
  }
  if (s.scene === "rangoli" || s.scene === "kolam") {
    out.push("suggest-designs", "set-kolam-reference", "set-rangoli-reference");
    if (s.hasKolamRef) {
      out.push("fill-region", "set-input-mode", "clear-my-strokes");
    }
  }
  if (s.scene === "shatranj") {
    out.push("get-chess-state");
    if (!s.chessFinished) {
      out.push("preview-moves", "move-chess-piece");
      if (s.chessTurnOwner === "elder") out.push("wait-for-person-move");
      if (s.familyLinked) out.push("family-move");
    }
  }
  if (s.scene !== "home") out.push("draft-family-update", "list-album");
  if (s.approvalPending) out.push("send-family-update");
  if (s.approvalPending) out.push("cancel-family-update");
  return Array.from(new Set(out));
}
