# Family sync latency

Measured 2026-11-09T14:48:18.250Z against `http://127.0.0.1:4194`.

Two browser contexts on one household (elder /chaupal, family /family), family plays the other side. Moves alternate through the actions API (elder: board-move, family: family-move). Primary latency = time from the mover's action HTTP response to the other client's DOM [data-testid=shatranj-board] data-move-count reaching the new ply (polled every 25 ms; timeout 30 s). Because a move action holds its response until the elder's board acknowledges the move (up to 4.5 s), the time from the action REQUEST to the other screen is reported too.

| Direction | Moves | Observed | p50 (from response) | p95 | max | p50 (from request) | p95 | max | action call p50 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| All | 50 | 50 | 300 ms | 334 ms | 342 ms | 2788 ms | 4892 ms | 4896 ms | 2786 ms |
| Elder → family phone | 25 | 25 | 304 ms | 312 ms | 313 ms | 4851 ms | 4875 ms | 4875 ms | 4551 ms |
| Family phone → elder | 25 | 25 | 4 ms | 337 ms | 342 ms | 1034 ms | 4892 ms | 4896 ms | 1030 ms |
