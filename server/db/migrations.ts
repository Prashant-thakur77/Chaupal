import type { MigrationEntry } from "@agent-native/core/db";

/** Append only. Never edit an entry that has been applied. */
export const chaupalMigrations: MigrationEntry[] = [
  {
    version: 1,
    name: "chaupal-core-tables-v2",
    sql: `
CREATE TABLE IF NOT EXISTS chaupal_sessions (
  id TEXT PRIMARY KEY,
  owner_email TEXT NOT NULL,
  elder_name TEXT,
  language TEXT NOT NULL DEFAULT 'hi',
  created_at TEXT NOT NULL DEFAULT now(),
  updated_at TEXT NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chaupal_sessions_owner_idx ON chaupal_sessions(owner_email);
CREATE TABLE IF NOT EXISTS chaupal_activity_state (
  session_id TEXT PRIMARY KEY,
  owner_email TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  scene TEXT NOT NULL DEFAULT 'home',
  presence TEXT NOT NULL DEFAULT 'ready',
  caption TEXT,
  input_mode TEXT NOT NULL DEFAULT 'none',
  pending TEXT,
  history_open INTEGER NOT NULL DEFAULT 0,
  calligraphy_ref_id TEXT,
  kolam_ref_id TEXT,
  chess_game_id TEXT,
  conflict TEXT,
  approval TEXT,
  updated_at TEXT NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS chaupal_calligraphy_refs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  text TEXT NOT NULL,
  script TEXT NOT NULL,
  style TEXT NOT NULL,
  size TEXT NOT NULL,
  font_id TEXT,
  svg TEXT NOT NULL,
  alt_hi TEXT NOT NULL,
  alt_en TEXT NOT NULL,
  status TEXT NOT NULL,
  validation TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'provider-shaped',
  created_at TEXT NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chaupal_calligraphy_refs_session_idx ON chaupal_calligraphy_refs(session_id);
CREATE TABLE IF NOT EXISTS chaupal_kolam_refs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  kind TEXT NOT NULL,
  params TEXT NOT NULL,
  svg TEXT NOT NULL,
  regions TEXT NOT NULL,
  validation TEXT NOT NULL,
  alt_hi TEXT NOT NULL,
  alt_en TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chaupal_kolam_refs_session_idx ON chaupal_kolam_refs(session_id);
CREATE TABLE IF NOT EXISTS chaupal_strokes (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  layer TEXT NOT NULL,
  ref_id TEXT,
  points TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT 'elder',
  input TEXT NOT NULL DEFAULT 'touch',
  cleared_at TEXT,
  created_at TEXT NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chaupal_strokes_session_idx ON chaupal_strokes(session_id, layer);
CREATE TABLE IF NOT EXISTS chaupal_fills (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  kolam_ref_id TEXT NOT NULL,
  region_id TEXT NOT NULL,
  colour TEXT NOT NULL,
  by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chaupal_fills_ref_idx ON chaupal_fills(kolam_ref_id);
CREATE TABLE IF NOT EXISTS chaupal_chess_games (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  fen TEXT NOT NULL,
  elder_color TEXT NOT NULL DEFAULT 'w',
  opponent TEXT NOT NULL DEFAULT 'agent',
  opponent_name TEXT,
  status TEXT NOT NULL DEFAULT 'playing',
  preview TEXT,
  created_at TEXT NOT NULL DEFAULT now(),
  updated_at TEXT NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS chaupal_chess_moves (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  ply INTEGER NOT NULL,
  san TEXT NOT NULL,
  from_sq TEXT NOT NULL,
  to_sq TEXT NOT NULL,
  piece TEXT NOT NULL,
  captured TEXT,
  actor TEXT NOT NULL,
  via TEXT NOT NULL,
  spoken TEXT,
  fen_after TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS chaupal_chess_moves_game_ply_idx ON chaupal_chess_moves(game_id, ply);
CREATE TABLE IF NOT EXISTS chaupal_family_links (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  relation TEXT,
  role TEXT NOT NULL DEFAULT 'player',
  last_seen_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS chaupal_album (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  svg TEXT NOT NULL,
  ref_id TEXT,
  shared_at TEXT,
  created_at TEXT NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chaupal_album_session_idx ON chaupal_album(session_id);
CREATE TABLE IF NOT EXISTS chaupal_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  type TEXT NOT NULL,
  actor TEXT NOT NULL,
  caller TEXT,
  revision_before INTEGER,
  revision_after INTEGER,
  ok INTEGER NOT NULL DEFAULT 1,
  error_code TEXT,
  payload TEXT,
  created_at TEXT NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chaupal_events_session_idx ON chaupal_events(session_id, created_at);
`,
  },
  {
    version: 2,
    name: "chaupal-session-sharing",
    sql: `
ALTER TABLE chaupal_sessions ADD COLUMN IF NOT EXISTS org_id TEXT;
ALTER TABLE chaupal_sessions ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private';
CREATE TABLE IF NOT EXISTS chaupal_session_shares (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL,
  principal_type TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  role TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS chaupal_session_shares_resource_idx ON chaupal_session_shares(resource_id);
CREATE INDEX IF NOT EXISTS chaupal_session_shares_principal_idx ON chaupal_session_shares(principal_type, principal_id);
ALTER TABLE chaupal_activity_state ADD COLUMN IF NOT EXISTS fixture TEXT;
`,
  },
  {
    version: 3,
    name: "chaupal-session-shares-notified",
    sql: `ALTER TABLE chaupal_session_shares ADD COLUMN IF NOT EXISTS notified_at TEXT;`,
  },
];
