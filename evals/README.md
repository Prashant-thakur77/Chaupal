# Chaupal evaluation

Does Chaupal's action set turn an Indian elder's spoken request into the correct, visible, continuing activity more reliably than the same model working the same page without the actions?

## What is here

| Path | What it is |
|---|---|
| `evals.json` | The frozen suite: 21 cases in the elder's voice (Hindi in Devanagari and Latin, Hinglish, Punjabi, Tamil, Marathi), with assertions. Its SHA-256 is written into every manifest; it is never edited after the first official run. |
| `runner/run-agent-eval.ts` | The hand-written tool loop: one fresh household per session, Playwright browser, Anthropic model, scripted person actions, DOM + live-session timeline, LLM conversation judge, grading, artifacts. |
| `runner/grading.ts` | Route-neutral deterministic grading of the complete visible outcome (her screen, the family phone, the live session). |
| `runner/browser-control.ts` | The four generic browser tools (`browser_read_page`, `browser_click`, `browser_type`, `browser_wait`). |
| `runner/browser-host.ts` | Household start, live-session reads, the eval-only fixture switch, and the per-household MCP client. |
| `runner/trajectory.ts` | Computed acceptance gate and the trajectory chart. |
| `runner/write-results.ts` | Writes the results table into `EVALUATION.md` between `<!-- results:start -->` and `<!-- results:end -->` (nothing else in the file changes). |
| `runner/verify-artifacts.ts` | Checks the suite rules, every iteration's locks, hashes and files, the gate, and that the doc and chart are current. |
| `iterations/iteration-NNN/` | Immutable official runs. `001` is the control; `002+` are candidates. |
| `optimization/trajectory.{json,svg}` | Generated from the iterations. |
| `measure/sync-latency.ts` | Family sync latency between two screens of one household. |
| `.raw/` | Ignored by git: raw model responses, transcripts, tool traces, screenshots, staging and canary/pilot runs. Only their SHA-256 values reach the manifests. |

## Conditions

- **A. `browser-control` (iteration 001).** Same model, same system prompt, same limits; only the four browser tools on the elder's `/chaupal` page. `browser_read_page` returns visible text, every visible control with role, accessible name, `data-testid` and its `data-*` attributes, plus the visible state landmarks (stage, board, canvases, panels). `browser_type` also chooses an option of a `<select>`.
- **B. `chaupal-actions` (iteration 002+).** The same four browser tools plus Chaupal's actions, taken from the app's own MCP catalog (`tools/list` on `/mcp`) with names, descriptions and input schemas unchanged. Framework tools that are not Chaupal actions (`ask_app`, `ask_app_status`, `list_apps`, `open_app`, `tool-search`, `invite-organization-member`, `list-organization-members`) are left out, identically in every session. Calls go over MCP `tools/call`; the runner authenticates with a static bearer and names the session's household in `X-Agent-Native-Owner-Email`, so every call acts as that household only.
- In both arms the in-app agent's own entry points (chat rail, chat button, voice/typed dock) are hidden and refused: typing the request there would hand the task to a different agent.

## Session mechanics

- Each session: `GET /api/household/start` (no redirect) gives a fresh `chaupal_guest` cookie; the browser context and every call use it, so sessions are isolated and can run in parallel.
- Model `claude-sonnet-5-5` via `@anthropic-ai/sdk`, `max_tokens` 1500, default settings, prompt caching on the system prompt and the newest turn (same for both arms). 150 s wall clock per case. One follow-up per case at most, injected when the model stops calling tools.
- Usage per session: input, cache-write input, cache-read input and output tokens; tokens/try counts all of them. Seconds/try is the agent session's wall time; a bounded wait (max 8 s) for her screen to draw the server's latest revision before the final read is recorded separately as `finalSettleMs`.
- Person actions are scripted with Playwright and fire as soon as their surface is visible, including while an action call is still pending (a waiting move, the approval card): draw one stroke on the Sulekh or rangoli canvas, tap e2 then e4 on her board, tap e7 then e5 on the family phone (a second browser context opened from the join link), tap "मत भेजो" on the approval card. `getUserMedia` always throws `NotAllowedError`.
- Recovery cases arm a one-time faulty render with the eval-only `set-eval-fixture` action before the session starts (both arms).
- Conversation quality: the same model as an independent judge with a structured-output schema (adult respect, clarity, warmth, agency, context fit, 0–3; pass iff every score ≥ 2 and no disqualifier).

## Run it

```bash
# 1. Build the node server once into ../.chaupal-work/eval-output and serve it on :4194
#    (own PGlite directory, env from .env, a fresh per-start auth secret and MCP bearer).
evals/scripts/serve-eval.sh --build      # later starts: evals/scripts/serve-eval.sh
evals/scripts/stop-eval.sh

# 2. Runs (CHAUPAL_EVAL_CANDIDATE_URL defaults to http://127.0.0.1:4194)
CHAUPAL_EVAL_CONFIGURATION=browser-control CHAUPAL_EVAL_CANARY_CASE=chess-shared-turn pnpm eval:canary
CHAUPAL_EVAL_CONFIGURATION=chaupal-actions CHAUPAL_EVAL_CASES=rangoli-recolour,family-second-player pnpm eval:pilot
pnpm eval:official                       # next iteration-NNN: 001 = control, 002+ = candidate, 2 repetitions
pnpm eval:official -- --resume-workspace evals/.raw/.staging-iteration-NNN-<ts>   # after an interruption

# 3. Results, chart and checks
pnpm eval:results                        # EVALUATION.md block + optimization/trajectory.{json,svg}
pnpm eval:verify

# 4. Family sync latency (any base URL, e.g. the deployed one)
pnpm eval:sync-latency -- --base-url http://127.0.0.1:4194 --moves 50
```

Environment: `CHAUPAL_EVAL_EXECUTION_CONCURRENCY` (default 2, max 3), `CHAUPAL_EVAL_GRADING_CONCURRENCY` (default 2), `CHAUPAL_EVAL_CANARY_CASE`, `CHAUPAL_EVAL_CASES` (pilot only), `CHAUPAL_EVAL_MCP_TOKEN_FILE`. `ANTHROPIC_API_KEY` comes from the environment or `.env` and is never written to any artifact.

## Iteration protocol

Freeze the suite first. Run the control as iteration 001. Each later iteration changes one bounded part of the agent-facing surface (an action description, schema, result field or guard), re-runs the full suite, and is kept only if the computed gate in `runner/trajectory.ts` accepts it: task success above the control; after the first accepted candidate, success at least the previous accepted one's and tokens or time lower, neither more than 10% worse. Failed and rejected iterations are kept. The success definition is never lowered.
