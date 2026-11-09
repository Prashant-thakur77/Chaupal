import { sql } from "drizzle-orm";
import { integer, pgTable, text } from "drizzle-orm/pg-core";

/**
 * Chaupal's shared state. The elder's agent, her own taps and strokes, the
 * family member's phone and outside agents all read and write these rows
 * through the same actions. `activity_state.revision` is the single counter
 * that every mutation moves, so a stale caller can be rejected.
 */

export const sessions = pgTable("chaupal_sessions", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  elderName: text("elder_name"),
  language: text("language").notNull().default("hi"),
  createdAt: text("created_at").notNull().default(sql`now()`),
  updatedAt: text("updated_at").notNull().default(sql`now()`),
});

export const activityState = pgTable("chaupal_activity_state", {
  sessionId: text("session_id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  revision: integer("revision").notNull().default(0),
  /** home | sulekh | rangoli | kolam | shatranj */
  scene: text("scene").notNull().default("home"),
  /** ready | listening | receiving | creating | speaking | awaiting */
  presence: text("presence").notNull().default("ready"),
  caption: text("caption"),
  /** none | touch | air-requested | air | air-denied */
  inputMode: text("input_mode").notNull().default("none"),
  /** JSON: pending choice / suggestions waiting for the elder's tap */
  pending: text("pending"),
  historyOpen: integer("history_open").notNull().default(0),
  calligraphyRefId: text("calligraphy_ref_id"),
  kolamRefId: text("kolam_ref_id"),
  chessGameId: text("chess_game_id"),
  /** JSON: last conflict shown to the elder (friendly card) */
  conflict: text("conflict"),
  /** JSON: a family update waiting for the elder's approval */
  approval: text("approval"),
  updatedAt: text("updated_at").notNull().default(sql`now()`),
});

export const calligraphyRefs = pgTable("chaupal_calligraphy_refs", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  ownerEmail: text("owner_email").notNull(),
  text: text("text").notNull(),
  script: text("script").notNull(),
  style: text("style").notNull(),
  size: text("size").notNull(),
  fontId: text("font_id"),
  svg: text("svg").notNull(),
  altHi: text("alt_hi").notNull(),
  altEn: text("alt_en").notNull(),
  /** valid | rejected */
  status: text("status").notNull(),
  validation: text("validation").notNull(),
  source: text("source").notNull().default("provider-shaped"),
  createdAt: text("created_at").notNull().default(sql`now()`),
});

export const kolamRefs = pgTable("chaupal_kolam_refs", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  ownerEmail: text("owner_email").notNull(),
  /** pulli | rangoli | pookalam */
  kind: text("kind").notNull(),
  params: text("params").notNull(),
  svg: text("svg").notNull(),
  regions: text("regions").notNull(),
  validation: text("validation").notNull(),
  altHi: text("alt_hi").notNull(),
  altEn: text("alt_en").notNull(),
  createdAt: text("created_at").notNull().default(sql`now()`),
});

export const strokes = pgTable("chaupal_strokes", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  ownerEmail: text("owner_email").notNull(),
  /** sulekh | rangoli */
  layer: text("layer").notNull(),
  refId: text("ref_id"),
  /** JSON array of [x, y, pressure] in 0..1 canvas units */
  points: text("points").notNull(),
  /** elder | family */
  author: text("author").notNull().default("elder"),
  /** touch | air */
  input: text("input").notNull().default("touch"),
  clearedAt: text("cleared_at"),
  createdAt: text("created_at").notNull().default(sql`now()`),
});

export const fills = pgTable("chaupal_fills", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  ownerEmail: text("owner_email").notNull(),
  kolamRefId: text("kolam_ref_id").notNull(),
  regionId: text("region_id").notNull(),
  colour: text("colour").notNull(),
  /** elder-tap | elder-voice | agent | family */
  by: text("by").notNull(),
  createdAt: text("created_at").notNull().default(sql`now()`),
});

export const chessGames = pgTable("chaupal_chess_games", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  ownerEmail: text("owner_email").notNull(),
  fen: text("fen").notNull(),
  /** w | b — the side the elder plays */
  elderColor: text("elder_color").notNull().default("w"),
  /** agent | family */
  opponent: text("opponent").notNull().default("agent"),
  opponentName: text("opponent_name"),
  /** playing | checkmate | stalemate | draw | resigned */
  status: text("status").notNull().default("playing"),
  /** JSON: legal-move preview currently shown (no move made) */
  preview: text("preview"),
  createdAt: text("created_at").notNull().default(sql`now()`),
  updatedAt: text("updated_at").notNull().default(sql`now()`),
});

export const chessMoves = pgTable("chaupal_chess_moves", {
  id: text("id").primaryKey(),
  gameId: text("game_id").notNull(),
  sessionId: text("session_id").notNull(),
  ownerEmail: text("owner_email").notNull(),
  ply: integer("ply").notNull(),
  san: text("san").notNull(),
  fromSq: text("from_sq").notNull(),
  toSq: text("to_sq").notNull(),
  piece: text("piece").notNull(),
  captured: text("captured"),
  /** elder | agent | family */
  actor: text("actor").notNull(),
  /** voice | drag | tap | agent | family */
  via: text("via").notNull(),
  spoken: text("spoken"),
  fenAfter: text("fen_after").notNull(),
  createdAt: text("created_at").notNull().default(sql`now()`),
});

export const familyLinks = pgTable("chaupal_family_links", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  ownerEmail: text("owner_email").notNull(),
  token: text("token").notNull().unique(),
  name: text("name").notNull(),
  relation: text("relation"),
  /** player (may play the other side) | viewer */
  role: text("role").notNull().default("player"),
  lastSeenAt: text("last_seen_at"),
  revokedAt: text("revoked_at"),
  createdAt: text("created_at").notNull().default(sql`now()`),
});

export const album = pgTable("chaupal_album", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  ownerEmail: text("owner_email").notNull(),
  /** sulekh | rangoli | kolam | shatranj */
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  /** Composite SVG of the reference plus her strokes and fills */
  svg: text("svg").notNull(),
  refId: text("ref_id"),
  sharedAt: text("shared_at"),
  createdAt: text("created_at").notNull().default(sql`now()`),
});

export const events = pgTable("chaupal_events", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  ownerEmail: text("owner_email").notNull(),
  type: text("type").notNull(),
  /** elder | agent | family | system */
  actor: text("actor").notNull(),
  /** ui | agent | mcp | webmcp | http | family | eval */
  caller: text("caller"),
  revisionBefore: integer("revision_before"),
  revisionAfter: integer("revision_after"),
  ok: integer("ok").notNull().default(1),
  errorCode: text("error_code"),
  payload: text("payload"),
  createdAt: text("created_at").notNull().default(sql`now()`),
});
