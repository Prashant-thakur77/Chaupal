# Family sync latency

Measured 2026-11-09T15:10:59.630Z against `http://127.0.0.1:4194`.

Two browser contexts on one household (elder /chaupal, family /family), family plays the other side. Moves alternate through the actions API (elder: board-move, family: family-move). Primary latency = time from the mover's action HTTP response to the other client's DOM [data-testid=shatranj-board] data-move-count reaching the new ply (polled every 25 ms; timeout 30 s). Because a move action holds its response until the elder's board acknowledges the move (up to 4.5 s before the fix, 3 s after), the other screen can already show the move before the response arrives; the time from the action REQUEST to the other screen is the honest end-to-end bound and is reported too.

| Direction | Moves | Observed | p50 (from response) | p95 | max | p50 (from request) | p95 | max | action call p50 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| All | 50 | 50 | 2 ms | 4 ms | 6 ms | 1032 ms | 1037 ms | 1050 ms | 1029 ms |
| Elder → family phone | 25 | 25 | 3 ms | 4 ms | 6 ms | 1031 ms | 1038 ms | 1050 ms | 1029 ms |
| Family phone → elder | 25 | 25 | 2 ms | 4 ms | 4 ms | 1032 ms | 1036 ms | 1036 ms | 1029 ms |
