/**
 * Family sync latency: one household, the elder's screen (/chaupal) and the
 * family phone (/family) open in two browser contexts on a shatranj board
 * where the family member plays the other side. Moves alternate through the
 * actions API (elder: board-move, family: family-move). For each move we time
 * from the mover's action response to the OTHER client's DOM showing the new
 * data-move-count.
 *
 *   pnpm eval:sync-latency [--base-url http://127.0.0.1:4194] [--moves 50] [--out-name sync-latency]
 *
 * Writes evals/measure/<out-name>.json and <out-name>.md.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { chromium, type Page } from "@playwright/test";
import { Chess } from "chess.js";

function arg(name: string, fallback: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1]! : fallback;
}

const BASE = arg("--base-url", process.env.CHAUPAL_SYNC_BASE_URL ?? "http://127.0.0.1:4194").replace(/\/$/, "");
const MOVES = Number(arg("--moves", "50"));
const OUT_DIR = import.meta.dirname;
const OUT_NAME = arg("--out-name", "sync-latency");

async function cookieFrom(response: Response) {
  const raw = response.headers.get("set-cookie") ?? "";
  const match = /(chaupal_guest)=([^;]+)/.exec(raw);
  if (!match) throw new Error(`no guest cookie (${response.status})`);
  return { name: match[1]!, value: match[2]! };
}

async function call(cookie: { name: string; value: string }, name: string, body: Record<string, unknown>) {
  try {
    return await callOnce(cookie, name, body);
  } catch (error) {
    // A dropped connection (not an app error): try once more. If the first
    // attempt did land, the retry is refused as "not your turn", which means
    // the move is already on the board.
    if (!(error instanceof TypeError)) throw error;
    try {
      return await callOnce(cookie, name, body);
    } catch (retryError) {
      if (String(retryError).includes("CHESS_NOT_YOUR_TURN")) return { landedOnFirstAttempt: true };
      throw retryError;
    }
  }
}

async function callOnce(cookie: { name: string; value: string }, name: string, body: Record<string, unknown>) {
  const response = await fetch(`${BASE}/_agent-native/actions/${name}`, {
    method: "POST",
    headers: { cookie: `${cookie.name}=${cookie.value}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await response.json()) as Record<string, any>;
  if (!response.ok) throw new Error(`${name} ${response.status}: ${JSON.stringify(json).slice(0, 300)}`);
  return json;
}

async function moveCount(page: Page) {
  return Number(await page.getAttribute('[data-testid="shatranj-board"]', "data-move-count"));
}

function percentile(sorted: number[], p: number) {
  if (!sorted.length) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index]!;
}

async function main() {
  const elderCookie = await cookieFrom(await fetch(`${BASE}/api/household/start`, { redirect: "manual" }));
  await call(elderCookie, "open-activity", { activity: "shatranj", elderColor: "w", newGame: true });
  const invite = await call(elderCookie, "invite-family", { name: "Rahul", relation: "pota", playsOtherSide: true });
  const familyCookie = await cookieFrom(await fetch(`${BASE}${invite.joinPath}`, { redirect: "manual" }));

  const browser = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage", "--disable-gpu"] });
  const results: Array<{ ply: number; mover: string; san: string; observer: string; latencyMs: number | null; fromRequestMs: number | null; actionMs: number }> = [];
  try {
    const elderContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await elderContext.addCookies([{ ...elderCookie, url: BASE }]);
    const elder = await elderContext.newPage();
    await elder.goto(`${BASE}/chaupal`, { waitUntil: "commit", timeout: 90_000 });
    await elder.waitForSelector('[data-testid="shatranj-board"]', { timeout: 45_000 });

    const familyContext = await browser.newContext({ viewport: { width: 420, height: 860 } });
    await familyContext.addCookies([{ ...familyCookie, url: BASE }]);
    const family = await familyContext.newPage();
    await family.goto(`${BASE}/family`, { waitUntil: "commit", timeout: 90_000 });
    await family.waitForSelector('[data-testid="shatranj-board"]', { timeout: 45_000 });
    await elder.waitForTimeout(1500);

    const game = new Chess();
    for (let ply = 1; ply <= MOVES; ply += 1) {
      if (game.isGameOver()) game.reset();
      const legal = game.moves({ verbose: true });
      // Deterministic, quiet choice: prefer non-captures, first in list order rotated by ply.
      const quiet = legal.filter((move) => !move.captured);
      const pool = quiet.length ? quiet : legal;
      const move = pool[(ply * 7) % pool.length]!;
      game.move(move);
      const mover = ply % 2 === 1 ? "elder" : "family";
      const observer = mover === "elder" ? family : elder;
      const expected = ply;
      let latencyMs: number | null = null;
      let fromRequestMs: number | null = null;
      const sent = performance.now();
      if (mover === "elder") {
        await call(elderCookie, "board-move", { from: move.from, to: move.to, via: "tap", promotion: move.promotion });
      } else {
        await call(familyCookie, "family-move", { from: move.from, to: move.to, promotion: move.promotion });
      }
      const answered = performance.now();
      try {
        await observer.waitForFunction(
          (count) => Number(document.querySelector('[data-testid="shatranj-board"]')?.getAttribute("data-move-count")) >= count,
          expected,
          { timeout: 30_000, polling: 25 },
        );
        latencyMs = performance.now() - answered;
        fromRequestMs = performance.now() - sent;
      } catch {
        latencyMs = null;
      }
      results.push({ ply, mover, san: move.san, observer: mover === "elder" ? "family" : "elder", latencyMs, fromRequestMs, actionMs: answered - sent });
      process.stdout.write(`ply ${ply} ${mover} ${move.san} -> ${latencyMs === null ? "TIMEOUT" : `${Math.round(latencyMs)} ms (request ${Math.round(fromRequestMs ?? -1)} ms)`}\n`);
      // Let both boards settle (the elder's board animates each move) before the next one.
      await elder.waitForFunction(
        (count) => Number(document.querySelector('[data-testid="shatranj-board"]')?.getAttribute("data-move-count")) >= count,
        expected,
        { timeout: 30_000 },
      ).catch(() => undefined);
      await elder.waitForTimeout(400);
      void moveCount;
    }
  } finally {
    await browser.close();
  }

  const summarize = (rows: typeof results) => {
    const values = rows.map((row) => row.latencyMs).filter((value): value is number => value !== null).sort((a, b) => a - b);
    const fromRequest = rows.map((row) => row.fromRequestMs).filter((value): value is number => value !== null).sort((a, b) => a - b);
    const action = rows.map((row) => row.actionMs).sort((a, b) => a - b);
    return {
      fromRequestP50Ms: percentile(fromRequest, 50),
      fromRequestP95Ms: percentile(fromRequest, 95),
      fromRequestMaxMs: fromRequest.length ? fromRequest[fromRequest.length - 1]! : null,
      actionP50Ms: percentile(action, 50),
      moves: rows.length,
      observed: values.length,
      timeouts: rows.length - values.length,
      p50Ms: percentile(values, 50),
      p95Ms: percentile(values, 95),
      maxMs: values.length ? values[values.length - 1]! : null,
      meanMs: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
    };
  };
  const all = summarize(results);
  const elderToFamily = summarize(results.filter((row) => row.mover === "elder"));
  const report = {
    // Headline: elder → family phone, measured from the mover's action response.
    p50Ms: elderToFamily.p50Ms === null ? null : Math.round(elderToFamily.p50Ms),
    p95Ms: elderToFamily.p95Ms === null ? null : Math.round(elderToFamily.p95Ms),
    n: elderToFamily.observed,
    where: BASE,
    headline: "elder → family phone, from the mover's action response",
    caveat:
      "The move call returns only after her board acknowledges the move, and the other screen often shows the move before that, so from-response numbers can be near zero. End-to-end from the request: fromRequestP50Ms / fromRequestP95Ms.",
    fromRequestP50Ms: elderToFamily.fromRequestP50Ms === null ? null : Math.round(elderToFamily.fromRequestP50Ms),
    fromRequestP95Ms: elderToFamily.fromRequestP95Ms === null ? null : Math.round(elderToFamily.fromRequestP95Ms),
    measuredAt: new Date().toISOString(),
    baseUrl: BASE,
    method:
      "Two browser contexts on one household (elder /chaupal, family /family), family plays the other side. Moves alternate through the actions API (elder: board-move, family: family-move). Primary latency = time from the mover's action HTTP response to the other client's DOM [data-testid=shatranj-board] data-move-count reaching the new ply (polled every 25 ms; timeout 30 s). Because a move action holds its response until the elder's board acknowledges the move (up to 4.5 s before the fix, 3 s after), the other screen can already show the move before the response arrives; the time from the action REQUEST to the other screen is the honest end-to-end bound and is reported too.",
    all,
    elderToFamily,
    familyToElder: summarize(results.filter((row) => row.mover === "family")),
    moves: results.map((row) => ({
      ...row,
      latencyMs: row.latencyMs === null ? null : Math.round(row.latencyMs),
      fromRequestMs: row.fromRequestMs === null ? null : Math.round(row.fromRequestMs),
      actionMs: Math.round(row.actionMs),
    })),
  };
  writeFileSync(join(OUT_DIR, `${OUT_NAME}.json`), `${JSON.stringify(report, null, 2)}\n`);
  const ms = (value: number | null) => (value === null ? "n/a" : `${Math.round(value)} ms`);
  const row = (label: string, s: ReturnType<typeof summarize>) =>
    `| ${label} | ${s.moves} | ${s.observed} | ${ms(s.p50Ms)} | ${ms(s.p95Ms)} | ${ms(s.maxMs)} | ${ms(s.fromRequestP50Ms)} | ${ms(s.fromRequestP95Ms)} | ${ms(s.fromRequestMaxMs)} | ${ms(s.actionP50Ms)} |`;
  writeFileSync(
    join(OUT_DIR, `${OUT_NAME}.md`),
    [
      "# Family sync latency",
      "",
      `Measured ${report.measuredAt} against \`${BASE}\`.`,
      "",
      report.method,
      "",
      "| Direction | Moves | Observed | p50 (from response) | p95 | max | p50 (from request) | p95 | max | action call p50 |",
      "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
      row("All", report.all),
      row("Elder → family phone", report.elderToFamily),
      row("Family phone → elder", report.familyToElder),
      "",
    ].join("\n"),
  );
  process.stdout.write(`${JSON.stringify({ all: report.all, elderToFamily: report.elderToFamily, familyToElder: report.familyToElder })}\n`);
}

void main().catch((error) => {
  process.stderr.write(`sync-latency failed: ${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
