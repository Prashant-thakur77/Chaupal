// Turns the evaluation artifacts into every number the project shows:
// evals/results/summary.json (read by the /proof page), README.md and
// (rendered from docs/templates). Nothing here is typed by hand.
//
//   node scripts/build-results.mjs [--control iteration-001] [--candidate iteration-NNN]
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const read = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));
const iterDir = join(root, "evals", "iterations");
const iterations = existsSync(iterDir) ? readdirSync(iterDir).filter((d) => d.startsWith("iteration-")).sort() : [];

// The candidate shown is the last accepted one in the trajectory (computed gate).
let candidateIter = arg("candidate");
if (!candidateIter && existsSync(join(root, "evals/optimization/trajectory.json"))) {
  const t = read("evals/optimization/trajectory.json");
  const accepted = (t.attempts ?? []).filter((a) => a.decision === "accepted");
  candidateIter = accepted.at(-1)?.iteration;
}
const controlIter = arg("control") ?? iterations[0];
if (!controlIter || !candidateIter) {
  console.error("No official control and accepted candidate iterations found yet.");
  process.exit(1);
}

function arm(iteration, label) {
  const b = read(`evals/iterations/${iteration}/benchmark.json`);
  const [config, m] = Object.entries(b.configurations)[0];
  return {
    label,
    config,
    iteration,
    passed: m.passed,
    runs: m.runs,
    rate: `${(m.passRate * 100).toFixed(1)}%`,
    tokens: Math.round(m.meanTokensPerRun),
    seconds: Math.round((m.meanWallTimeMs / 1000) * 10) / 10,
    categories: b.categories ?? {},
  };
}
const control = arm(controlIter, "A. Browser control only");
const candidate = arm(candidateIter, "B. Chaupal actions");
const manifest = read(`evals/iterations/${candidateIter}/manifest.json`);

const categories = Object.keys(candidate.categories).map((name) => {
  const c = control.categories[name] ? Object.values(control.categories[name])[0] : null;
  const k = Object.values(candidate.categories[name])[0];
  const fmt = (m) => (m ? `${m.passed}/${m.runs}` : "n/a");
  return { name, control: fmt(c), candidate: fmt(k) };
});

let sync = null;
for (const f of ["evals/measure/sync-latency.deployed.json", "evals/measure/sync-latency.json"]) {
  if (existsSync(join(root, f))) {
    const s = read(f);
    const sec = (ms) => Math.round((ms / 1000) * 100) / 100;
    // End to end: from the mover's request until the other screen shows the move.
    const a = s.all ?? s;
    sync = { p50: sec(a.fromRequestP50Ms ?? s.fromRequestP50Ms), p95: sec(a.fromRequestP95Ms ?? s.fromRequestP95Ms), n: a.moves ?? s.n, where: s.where ?? s.baseUrl ?? f };
    break;
  }
}

const ra = read("evals/render-accuracy/results.json");
const tot = (armName) => ra.totals[armName]?.exact ?? ra.totals[armName]?.exactMatches;
const ocr = { shaped: tot("shaped"), unshaped: tot("unshaped"), shapedPlain: tot("shaped-plain"), unshapedPlain: tot("unshaped-plain"), total: 50 };

const failures = existsSync(join(root, "evals/results/failures.json")) ? read("evals/results/failures.json") : [];

const summary = {
  status: "ready",
  generatedAt: new Date().toISOString(),
  model: manifest.model,
  cases: manifest.caseCount,
  repetitions: manifest.repetitions,
  control,
  candidate,
  categories,
  sync,
  ocr,
  failures,
};
writeFileSync(join(root, "evals/results/summary.json"), JSON.stringify(summary, null, 2) + "\n");

const tokens = {
  A_PASS: control.passed, A_RUNS: control.runs, A_RATE: control.rate, A_TOKENS: control.tokens.toLocaleString("en-IN"), A_SECS: control.seconds,
  B_PASS: candidate.passed, B_RUNS: candidate.runs, B_RATE: candidate.rate, B_TOKENS: candidate.tokens.toLocaleString("en-IN"), B_SECS: candidate.seconds,
  SYNC_P50: sync?.p50 ?? "n/a", SYNC_P95: sync?.p95 ?? "n/a", SYNC_N: sync?.n ?? "n/a",
  OCR_SHAPED: ocr.shaped, OCR_UNSHAPED: ocr.unshaped, OCR_SHAPED_PLAIN: ocr.shapedPlain, OCR_UNSHAPED_PLAIN: ocr.unshapedPlain,
  FAILURE_ONE_LINE: failures[0] ? `${failures[0].reason}` : "see EVALUATION.md",
};
for (const name of ["README.md"]) {
  let text = readFileSync(join(root, "docs/templates", name), "utf8");
  text = text.replace(/\{\{([A-Z0-9_]+)\}\}/g, (m, k) => (k in tokens ? String(tokens[k]) : m));
  const left = text.match(/\{\{[A-Z0-9_]+\}\}/g);
  if (left) console.warn(`${name}: unfilled tokens ${left.join(", ")}`);
  writeFileSync(join(root, name), text);
}
console.log(`summary: control ${control.passed}/${control.runs}, candidate ${candidate.passed}/${candidate.runs} (${candidateIter})`);
