#!/usr/bin/env bash
# Stop the evaluation server started by serve-eval.sh (whatever listens on its port).
PORT="${CHAUPAL_EVAL_PORT:-4194}"
PID="$(ss -ltnpH "sport = :$PORT" 2>/dev/null | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)"
if [[ -z "$PID" ]]; then
  echo "nothing listening on $PORT"
  exit 0
fi
PARENT="$(ps -o ppid= -p "$PID" | tr -d ' ')"
kill "$PID" 2>/dev/null || true
if [[ -n "$PARENT" ]] && ps -o args= -p "$PARENT" | grep -q "index.mjs"; then
  kill "$PARENT" 2>/dev/null || true
fi
# The server can ignore SIGTERM while a shutdown hook hangs; it still holds the
# PGlite lock, so escalate.
for _ in 1 2 3 4 5 6; do
  kill -0 "$PID" 2>/dev/null || break
  sleep 0.5
done
kill -0 "$PID" 2>/dev/null && kill -9 "$PID" 2>/dev/null
echo "stopped $PID"
