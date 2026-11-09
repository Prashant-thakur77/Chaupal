/**
 * Verify the frozen suite and every retained official iteration.
 *
 *   pnpm eval:verify
 *
 * Checks the eval definition rules, the iteration matrix and locks, hashes,
 * that private files and secrets never reach retained artifacts, the computed
 * acceptance gate, and that EVALUATION.md and the trajectory match freshly
 * generated output.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { buildResultsBlock } from "./write-results";
import { buildOptimizationTrajectory, readOptimizationTrajectory } from "./trajectory";
import type { EvalCase } from "./grading";

const ROOT = resolve(import.meta.dirname, "../..");
const EVALS = join(ROOT, "evals");
const ITERATIONS = join(EVALS, "iterations");
const failures: string[] = [];
const fail = (message: string) => failures.push(message);

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function sha256File(path: string) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function walk(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root).flatMap((entry) => {
    const path = join(root, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

// ------------------------------------------------------------ definition
const definitionPath = join(EVALS, "evals.json");
const definitionText = readFileSync(definitionPath, "utf8");
const definition = JSON.parse(definitionText) as {
  model: string;
  maxTokens: number;
  caseTimeoutMs: number;
  officialRepetitions: number;
  cases: EvalCase[];
};
const evalSetHash = `sha256:${sha256File(definitionPath)}`;

for (const banned of ["chaupal_", "requiredTools", "toolCoverage", "setup", "humanFixture"]) {
  if (definitionText.includes(banned)) fail(`evals.json must not contain '${banned}'.`);
}
const UTTERANCE_BANNED =
  /(eval:\/\/|webmcp|\btool\b|\bschema\b|assertion|fixture|revision|\bsvg\b|3:2|\balpha\b|mcp|action|get-|set-)/i;
const ids = new Set<string>();
const CATEGORIES = new Set(["sulekh", "shatranj", "interface", "rangoli", "family"]);
if (definition.cases.length !== 21) fail(`Expected exactly 21 cases, found ${definition.cases.length}.`);
for (const evalCase of definition.cases) {
  if (ids.has(evalCase.id)) fail(`Duplicate case id ${evalCase.id}.`);
  ids.add(evalCase.id);
  if (!CATEGORIES.has(evalCase.category)) fail(`${evalCase.id}: unknown category ${evalCase.category}.`);
  for (const utterance of [evalCase.prompt, ...(evalCase.followups ?? []).map(({ prompt }) => prompt)]) {
    if (UTTERANCE_BANNED.test(utterance)) fail(`${evalCase.id}: utterance mentions provider mechanics: ${utterance}`);
  }
  if ((evalCase.followups?.length ?? 0) > 1) fail(`${evalCase.id}: at most one follow-up.`);
  const outcomes = evalCase.assertions.filter(({ visibleOutcome }) => visibleOutcome);
  if (outcomes.length !== 1) fail(`${evalCase.id}: exactly one visible-outcome assertion required.`);
  const outcome = outcomes[0];
  if (outcome && outcome.requiresInteractionEvidence !== true) fail(`${evalCase.id}: outcome must require interaction evidence.`);
  for (const id of ["CONVERSATION-QUALITY-001", "AGENT-TRUTH-001"]) {
    if (!evalCase.assertions.some((assertion) => assertion.id === id)) fail(`${evalCase.id}: missing ${id}.`);
  }
  if (evalCase.kind === "recovery" && !outcome?.requiresRejectedAttempt) {
    fail(`${evalCase.id}: recovery case needs requiresRejectedAttempt.`);
  }
  if (evalCase.kind === "human-in-loop" && !evalCase.assertions.some(({ personAction }) => personAction)) {
    fail(`${evalCase.id}: human-in-loop case needs a personAction.`);
  }
  if (outcome?.visibleOutcome?.startsWith("sulekh-") || outcome?.visibleOutcome === "activity-switched-to-shatranj-with-reference") {
    if (!outcome.providerFixture) fail(`${evalCase.id}: Sulekh outcome needs a providerFixture.`);
  }
  if (outcome?.requiresRejectedAttempt && outcome.providerFixture && outcome.providerFixture.correctedResult !== "valid") {
    fail(`${evalCase.id}: recovery fixture needs correctedResult 'valid'.`);
  }
}
for (const kind of ["recovery", "consent-withheld", "human-in-loop"]) {
  if (!definition.cases.some((evalCase) => evalCase.kind === kind)) fail(`Suite needs at least one ${kind} case.`);
}

// ------------------------------------------------------------ raw evidence stays private
const gitignore = existsSync(join(ROOT, ".gitignore")) ? readFileSync(join(ROOT, ".gitignore"), "utf8") : "";
if (!/^evals\/\.raw\/?$/m.test(gitignore)) fail(".gitignore must ignore evals/.raw/.");

// ------------------------------------------------------------ iterations
const names = existsSync(ITERATIONS)
  ? readdirSync(ITERATIONS).filter((name) => /^iteration-\d{3}$/.test(name)).sort()
  : [];
names.forEach((name, index) => {
  if (name !== `iteration-${String(index + 1).padStart(3, "0")}`) fail(`Iterations must be contiguous from 001 (found ${name}).`);
});
const PRIVATE = new Set(["tool-trace.json", "transcript.json", "execution.json", "screenshot.png", "feedback.json", "result.json"]);
for (const name of names) {
  const root = join(ITERATIONS, name);
  const manifest = readJson<Record<string, any>>(join(root, "manifest.json"));
  const benchmark = readJson<Record<string, any>>(join(root, "benchmark.json"));
  const expectedConfiguration = name === "iteration-001" ? "browser-control" : "chaupal-actions";
  if (manifest.configuration !== expectedConfiguration) fail(`${name}: configuration must be ${expectedConfiguration}.`);
  if (manifest.immutable !== true) fail(`${name}: manifest must be immutable.`);
  if (manifest.model !== definition.model) fail(`${name}: model lock ${manifest.model}.`);
  if (manifest.maxTokens !== definition.maxTokens) fail(`${name}: maxTokens lock.`);
  if (manifest.caseTimeoutMs !== definition.caseTimeoutMs) fail(`${name}: case timeout lock.`);
  if (manifest.repetitions !== definition.officialRepetitions) fail(`${name}: repetitions lock.`);
  if (!(manifest.executionConcurrency >= 1 && manifest.executionConcurrency <= 3)) fail(`${name}: execution concurrency 1–3.`);
  if (manifest.evalSetHash !== evalSetHash) fail(`${name}: evalSetHash differs from the frozen evals.json.`);
  if (!/^sha256:[0-9a-f]{64}$/.test(manifest.fixtureHash ?? "")) fail(`${name}: fixtureHash format.`);
  if (manifest.totalSessions !== definition.cases.length * definition.officialRepetitions) fail(`${name}: session count.`);
  if (Object.keys(manifest.rawArtifactHashes ?? {}).length !== manifest.totalSessions) fail(`${name}: one raw hash per session.`);
  for (const hash of Object.values(manifest.rawArtifactHashes ?? {})) {
    if (!/^[0-9a-f]{64}$/.test(String(hash))) fail(`${name}: raw hash format.`);
  }
  if (Object.keys(benchmark.configurations ?? {}).join() !== manifest.configuration) fail(`${name}: benchmark must hold one configuration.`);
  if (manifest.configuration === "browser-control" && manifest.registeredToolCount !== 0) fail(`${name}: control exposes no actions.`);
  if (manifest.configuration === "chaupal-actions") {
    if (!(manifest.registeredToolCount > 0)) fail(`${name}: candidate exposes actions.`);
    if (!existsSync(join(root, "artifact", "mcp-catalog.json"))) fail(`${name}: artifact/mcp-catalog.json missing.`);
  }
  for (const evalCase of definition.cases) {
    for (let repetition = 1; repetition <= definition.officialRepetitions; repetition += 1) {
      const caseRoot = join(root, "cases", evalCase.id, String(repetition));
      for (const file of ["timing.json", "grading.json", "outputs/final-response.txt"]) {
        if (!existsSync(join(caseRoot, file))) fail(`${name}: missing ${relative(root, join(caseRoot, file))}.`);
      }
      const gradingPath = join(caseRoot, "grading.json");
      if (existsSync(gradingPath)) {
        const grading = readJson<Record<string, any>>(gradingPath);
        const quality = grading.assertionResults?.find((result: { id: string }) => result.id === "CONVERSATION-QUALITY-001");
        if (!quality?.details?.method) fail(`${name}: ${evalCase.id}/${repetition} lacks conversation-quality evidence.`);
        if (!Array.isArray(grading.domTimeline) || !grading.domTimeline.length) fail(`${name}: ${evalCase.id}/${repetition} lacks a DOM timeline.`);
      }
    }
  }
  for (const file of walk(root)) {
    const base = file.split("/").pop()!;
    if (PRIVATE.has(base)) fail(`${name}: private file retained: ${relative(root, file)}.`);
    if (/\.(json|txt|md|ts)$/.test(file)) {
      const text = readFileSync(file, "utf8");
      if (/sk-ant-[A-Za-z0-9_-]{8,}/.test(text)) fail(`${name}: API-key-like string in ${relative(root, file)}.`);
      if (text.includes("data:image/")) fail(`${name}: embedded image data in ${relative(root, file)}.`);
    }
  }
}

// ------------------------------------------------------------ gate, trajectory and doc
if (names.length) {
  const trajectory = readOptimizationTrajectory(ITERATIONS);
  const bundle = buildOptimizationTrajectory(ITERATIONS);
  const jsonPath = join(EVALS, "optimization/trajectory.json");
  const svgPath = join(EVALS, "optimization/trajectory.svg");
  if (!bundle || !existsSync(jsonPath) || readFileSync(jsonPath, "utf8") !== bundle.json) fail("trajectory.json is stale.");
  if (!bundle || !existsSync(svgPath) || readFileSync(svgPath, "utf8") !== bundle.svg) fail("trajectory.svg is stale.");
  if (trajectory?.attempts[0]?.decision !== "control") fail("The first iteration must be the control.");
  const doc = existsSync(join(ROOT, "EVALUATION.md")) ? readFileSync(join(ROOT, "EVALUATION.md"), "utf8") : "";
  const block = /<!-- results:start -->[\s\S]*?<!-- results:end -->/.exec(doc)?.[0];
  if (block !== buildResultsBlock()) fail("EVALUATION.md results block is stale (run pnpm eval:results).");
}

if (failures.length) {
  process.stderr.write(`Evaluation verification failed (${failures.length}):\n- ${failures.join("\n- ")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Evaluation verified: ${definition.cases.length} frozen cases, ${names.length} official iteration(s).\n`);
}
