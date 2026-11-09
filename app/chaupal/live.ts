import { actionErrorMessage, useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { useEffect, useMemo, useState } from "react";

import { strings } from "./strings";

/** The one live session the screen draws, refetched by framework sync. */
export function useLiveSession() {
  const q = useActionQuery("get-live-session", {}, { refetchOnWindowFocus: true });
  const data = q.data as LiveSession | undefined;
  const lang = useScreenLanguage(data?.language);
  const t = useMemo(() => strings(lang), [lang]);
  return { data, query: q, lang, t };
}

/** ?lang=en on the first visit wins until the session's language changes. */
function useScreenLanguage(sessionLang?: string | null) {
  const [override, setOverride] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search).get("lang");
    if (q) setOverride(q);
  }, []);
  useEffect(() => {
    if (sessionLang && sessionLang !== "hi") setOverride(null);
  }, [sessionLang]);
  return override ?? sessionLang ?? "hi";
}

export { actionErrorMessage, useActionMutation };

export interface LiveStroke {
  id: string;
  points: number[][];
  author: string;
  input: string;
}

export interface LiveMove {
  ply: number;
  san: string;
  from: string;
  to: string;
  piece: string;
  captured: string | null;
  actor: "elder" | "agent" | "family";
  via: string;
  spoken: string | null;
  at: string;
}

export interface LiveSession {
  sessionId: string;
  revision: number;
  scene: "home" | "sulekh" | "rangoli" | "kolam" | "shatranj";
  presence: string;
  caption: string | null;
  inputMode: "none" | "touch" | "air-requested" | "air" | "air-denied";
  historyOpen: boolean;
  language: string;
  pending: { kind: string; token?: string; question?: string | null; options?: { text: string; meaningHi?: string; meaningEn?: string }[]; chosen?: string } | null;
  conflict: { kind: string; by: string; name: string; messageHi: string; messageEn: string; move: { from: string; to: string; san: string } } | null;
  approval: {
    id: string;
    status: "pending" | "approved" | "declined" | "sent" | "failed";
    captionHi?: string;
    captionEn?: string;
    kind?: string;
    imagePath?: string;
    to?: string;
  } | null;
  calligraphy: {
    id: string;
    text: string;
    script: string;
    style: string;
    size: string;
    status: string;
    svg: string;
    altHi: string;
    altEn: string;
  } | null;
  kolam: {
    id: string;
    kind: "pulli" | "rangoli" | "pookalam";
    params: Record<string, unknown> | null;
    svg: string;
    regions: { id: string; zone: string }[];
    altHi: string;
    altEn: string;
    fills: Record<string, { colour: string; by: string }>;
  } | null;
  strokes: { sulekh: LiveStroke[]; rangoli: LiveStroke[]; counts: Record<string, number> };
  chess: {
    id: string;
    fen: string;
    elderColor: "w" | "b";
    opponent: "agent" | "family";
    opponentName: string | null;
    status: string;
    turnOwner: "elder" | "agent" | "family" | null;
    finished: boolean;
    preview: { from: string; squares?: string[]; targets: string[] } | null;
    moves: LiveMove[];
  } | null;
  family: { id: string; name: string; relation: string | null; role: string; lastSeenAt: string | null }[];
  events: { id: string; type: string; actor: string; caller: string | null; ok: boolean; errorCode: string | null; at: string }[];
  validNextActions: string[];
  viewer: { role: "elder" | "family"; name: string | null; familyRole: string | null };
}
