import { Chess } from "chess.js";
import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { getDb, schema } from "../db/index.js";
import {
  activeStrokes,
  type ActivityRow,
  parseJson,
  recentEvents,
  strokeCounts,
} from "./state.js";
import { validNextActions } from "./valid-actions.js";

export type ChessTurnOwner = "elder" | "agent" | "family";

export async function loadCalligraphyRef(id: string | null) {
  if (!id) return null;
  const rows = await getDb()
    .select()
    .from(schema.calligraphyRefs)
    .where(eq(schema.calligraphyRefs.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function loadKolamRef(id: string | null) {
  if (!id) return null;
  const rows = await getDb()
    .select()
    .from(schema.kolamRefs)
    .where(eq(schema.kolamRefs.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function loadFills(kolamRefId: string | null) {
  if (!kolamRefId) return [];
  return getDb()
    .select()
    .from(schema.fills)
    .where(eq(schema.fills.kolamRefId, kolamRefId))
    .orderBy(asc(schema.fills.createdAt))
    .limit(500);
}

/** Latest colour per region, in fill order. */
export function currentFills(
  rows: { regionId: string; colour: string; by: string }[],
): Record<string, { colour: string; by: string }> {
  const out: Record<string, { colour: string; by: string }> = {};
  for (const r of rows) out[r.regionId] = { colour: r.colour, by: r.by };
  return out;
}

export async function loadGame(id: string | null) {
  if (!id) return null;
  const rows = await getDb()
    .select()
    .from(schema.chessGames)
    .where(eq(schema.chessGames.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function loadMoves(gameId: string) {
  return getDb()
    .select()
    .from(schema.chessMoves)
    .where(eq(schema.chessMoves.gameId, gameId))
    .orderBy(asc(schema.chessMoves.ply))
    .limit(600);
}

export async function activeFamily(sessionId: string) {
  return getDb()
    .select()
    .from(schema.familyLinks)
    .where(
      and(
        eq(schema.familyLinks.sessionId, sessionId),
        isNull(schema.familyLinks.revokedAt),
      ),
    )
    .orderBy(desc(schema.familyLinks.createdAt))
    .limit(5);
}

export function turnOwner(
  game: { fen: string; elderColor: string; opponent: string } | null,
): ChessTurnOwner | null {
  if (!game) return null;
  const turn = game.fen.split(" ")[1] === "b" ? "b" : "w";
  if (turn === game.elderColor) return "elder";
  return game.opponent === "family" ? "family" : "agent";
}

export function gameFinished(fen: string) {
  const c = new Chess(fen);
  return c.isGameOver();
}

/**
 * The full live session. The UI renders from this; tools get the compact
 * projection from `agentView`.
 */
export async function buildSnapshot(state: ActivityRow) {
  const sessionId = state.sessionId;
  const [calligraphy, kolam, game, family, counts, events] = await Promise.all([
    loadCalligraphyRef(state.calligraphyRefId),
    loadKolamRef(state.kolamRefId),
    loadGame(state.chessGameId),
    activeFamily(sessionId),
    strokeCounts(sessionId),
    recentEvents(sessionId, 40),
  ]);
  const [fills, moves, sulekhStrokes, rangoliStrokes] = await Promise.all([
    loadFills(kolam?.id ?? null),
    game ? loadMoves(game.id) : Promise.resolve([]),
    activeStrokes(sessionId, "sulekh"),
    activeStrokes(sessionId, "rangoli"),
  ]);
  const owner = turnOwner(game);
  const finished = game ? gameFinished(game.fen) : false;
  const approval = parseJson<Record<string, unknown>>(state.approval);
  const pending = parseJson<Record<string, unknown>>(state.pending);
  const next = validNextActions({
    scene: state.scene,
    hasCalligraphyRef: Boolean(calligraphy && calligraphy.status === "valid"),
    hasKolamRef: Boolean(kolam),
    inputMode: state.inputMode,
    chessTurnOwner: owner,
    chessFinished: finished,
    familyLinked: family.length > 0,
    approvalPending: Boolean(approval && approval.status === "pending"),
    pendingChoice: Boolean(pending),
  });
  return {
    sessionId,
    revision: state.revision,
    scene: state.scene,
    presence: state.presence,
    caption: state.caption,
    inputMode: state.inputMode,
    historyOpen: state.historyOpen === 1,
    pending,
    conflict: parseJson<Record<string, unknown>>(state.conflict),
    approval,
    calligraphy: calligraphy
      ? {
          id: calligraphy.id,
          text: calligraphy.text,
          script: calligraphy.script,
          style: calligraphy.style,
          size: calligraphy.size,
          status: calligraphy.status,
          svg: calligraphy.svg,
          altHi: calligraphy.altHi,
          altEn: calligraphy.altEn,
          validation: parseJson(calligraphy.validation),
        }
      : null,
    kolam: kolam
      ? {
          id: kolam.id,
          kind: kolam.kind,
          params: parseJson(kolam.params),
          svg: kolam.svg,
          regions: parseJson<{ id: string; zone: string }[]>(kolam.regions) ?? [],
          validation: parseJson(kolam.validation),
          altHi: kolam.altHi,
          altEn: kolam.altEn,
          fills: currentFills(fills),
        }
      : null,
    strokes: {
      sulekh: sulekhStrokes.map((s) => ({
        id: s.id,
        points: parseJson<number[][]>(s.points) ?? [],
        author: s.author,
        input: s.input,
      })),
      rangoli: rangoliStrokes.map((s) => ({
        id: s.id,
        points: parseJson<number[][]>(s.points) ?? [],
        author: s.author,
        input: s.input,
      })),
      counts,
    },
    chess: game
      ? {
          id: game.id,
          fen: game.fen,
          elderColor: game.elderColor,
          opponent: game.opponent,
          opponentName: game.opponentName,
          status: game.status,
          turnOwner: owner,
          finished,
          preview: parseJson<{ from: string; targets: string[] }>(game.preview),
          moves: moves.map((m) => ({
            ply: m.ply,
            san: m.san,
            from: m.fromSq,
            to: m.toSq,
            piece: m.piece,
            captured: m.captured,
            actor: m.actor,
            via: m.via,
            spoken: m.spoken,
            at: m.createdAt,
          })),
        }
      : null,
    family: family.map((f) => ({
      id: f.id,
      name: f.name,
      relation: f.relation,
      role: f.role,
      lastSeenAt: f.lastSeenAt,
    })),
    events: events.map((e) => ({
      id: e.id,
      type: e.type,
      actor: e.actor,
      caller: e.caller,
      ok: e.ok === 1,
      errorCode: e.errorCode,
      revisionAfter: e.revisionAfter,
      at: e.createdAt,
    })),
    validNextActions: next,
  };
}

export type Snapshot = Awaited<ReturnType<typeof buildSnapshot>>;

/** What an agent needs: no SVG bodies, no stroke points. */
export function agentView(s: Snapshot) {
  return {
    sessionId: s.sessionId,
    revision: s.revision,
    scene: s.scene,
    presence: s.presence,
    inputMode: s.inputMode,
    historyOpen: s.historyOpen,
    pendingChoice: s.pending,
    approval: s.approval,
    conflict: s.conflict,
    calligraphy: s.calligraphy
      ? {
          text: s.calligraphy.text,
          script: s.calligraphy.script,
          style: s.calligraphy.style,
          size: s.calligraphy.size,
          status: s.calligraphy.status,
          altEn: s.calligraphy.altEn,
        }
      : null,
    kolam: s.kolam
      ? {
          kind: s.kolam.kind,
          params: s.kolam.params,
          regions: s.kolam.regions.map((r) => ({
            id: r.id,
            zone: r.zone,
            colour: s.kolam!.fills[r.id]?.colour ?? null,
          })),
        }
      : null,
    myStrokes: s.strokes.counts,
    chess: s.chess
      ? {
          fen: s.chess.fen,
          elderColor: s.chess.elderColor,
          opponent: s.chess.opponent,
          opponentName: s.chess.opponentName,
          turnOwner: s.chess.turnOwner,
          finished: s.chess.finished,
          moveCount: s.chess.moves.length,
          lastMove: s.chess.moves[s.chess.moves.length - 1] ?? null,
          preview: s.chess.preview,
        }
      : null,
    family: s.family.map((f) => ({ name: f.name, relation: f.relation, role: f.role })),
    validNextActions: s.validNextActions,
  };
}
