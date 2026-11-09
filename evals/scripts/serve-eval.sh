#!/usr/bin/env bash
# Start the Chaupal node-server build used for evaluation runs.
#
#   evals/scripts/serve-eval.sh --build   # build, copy to the eval output dir, then serve
#   evals/scripts/serve-eval.sh           # serve the last copied build
#
# - The build is copied out of .output (which deploys use) into
#   $CHAUPAL_EVAL_OUTPUT (default ../.chaupal-work/eval-output) and served from
#   there with cwd = repo root, so fonts load from ./public/fonts.
# - Port 4194 (override with CHAUPAL_EVAL_PORT).
# - Its own PGlite directory, never data/pglite.
# - Environment from .env (ANTHROPIC_API_KEY, CHAUPAL_EVAL, ...); nothing is printed.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="$(cd "$ROOT/.." && pwd)/.chaupal-work"
OUT="${CHAUPAL_EVAL_OUTPUT:-$WORK/eval-output}"
cd "$ROOT"
if [[ "${1:-}" == "--build" ]]; then
  NODE_OPTIONS=--max-old-space-size=3072 pnpm build
  rm -rf "$OUT"
  cp -r .output "$OUT"
fi
# Externals the server imports at runtime (e.g. @electric-sql/pglite) resolve
# from the repo's node_modules.
[[ -e "$OUT/node_modules" ]] || ln -s "$ROOT/node_modules" "$OUT/node_modules"
set -a
# shellcheck disable=SC1091
. ./.env
set +a
export PORT="${CHAUPAL_EVAL_PORT:-4194}"
export NITRO_PORT="$PORT"
export HOST="127.0.0.1"
export NITRO_HOST="127.0.0.1"
export CHAUPAL_EVAL=1
# A long-lived local server (not a hosted function), so the embedded PGlite is allowed.
export NETLIFY_LOCAL=true
# Signing secret for the per-household guest cookies (GET /api/household/start).
export BETTER_AUTH_SECRET="${CHAUPAL_EVAL_AUTH_SECRET:-$(openssl rand -hex 32)}"
# Static MCP bearer for the eval runner. With no AGENT_NATIVE_OWNER_EMAIL set,
# each MCP request names its household via X-Agent-Native-Owner-Email, so every
# eval session calls tools as its own household. Kept in a 0600 file, never logged.
unset AGENT_NATIVE_OWNER_EMAIL
TOKEN_FILE="$WORK/eval-mcp-token"
if [[ ! -s "$TOKEN_FILE" ]]; then
  ( umask 077; openssl rand -hex 32 > "$TOKEN_FILE" )
fi
export ACCESS_TOKEN="$(cat "$TOKEN_FILE")"
export DATABASE_URL="${CHAUPAL_EVAL_DATABASE_URL:-pglite:$WORK/eval-pglite}"
exec node "$OUT/server/index.mjs"
