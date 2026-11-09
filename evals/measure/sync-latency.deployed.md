# Family sync latency

Measured 2026-11-09T16:09:49.413Z against `https://chaupal.prashantthakur.dev`.

Two browser contexts on one household (elder /chaupal, family /family), family plays the other side. Moves alternate through the actions API (elder: board-move, family: family-move). Primary latency = time from the mover's action HTTP response to the other client's DOM [data-testid=shatranj-board] data-move-count reaching the new ply (polled every 25 ms; timeout 30 s). Because a move action holds its response until the elder's board acknowledges the move (up to 4.5 s before the fix, 3 s after), the other screen can already show the move before the response arrives; the time from the action REQUEST to the other screen is the honest end-to-end bound and is reported too.

| Direction | Moves | Observed | p50 (from response) | p95 | max | p50 (from request) | p95 | max | action call p50 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| All | 50 | 50 | 3 ms | 93 ms | 3407 ms | 3945 ms | 5065 ms | 6733 ms | 3866 ms |
| Elder → family phone | 25 | 25 | 3 ms | 93 ms | 3407 ms | 3868 ms | 5065 ms | 6733 ms | 3691 ms |
| Family phone → elder | 25 | 25 | 3 ms | 23 ms | 1169 ms | 3990 ms | 4821 ms | 5635 ms | 3988 ms |
