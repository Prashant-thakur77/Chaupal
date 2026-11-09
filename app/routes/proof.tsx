import { useEffect, useState } from "react";

import summary from "../../evals/results/summary.json";
import "@/chaupal/chaupal.css";

export function meta() {
  return [{ title: "चौपाल · प्रमाण · Proof" }];
}

type Arm = { label: string; passed: number; runs: number; rate: string; tokens: number; seconds: number };
type Summary = {
  status: string;
  note?: string;
  generatedAt?: string;
  model?: string;
  cases?: number;
  repetitions?: number;
  control?: Arm;
  candidate?: Arm;
  categories?: { name: string; control: string; candidate: string }[];
  sync?: { p50: number; p95: number; n: number; where: string } | null;
  ocr?: { shaped: number; unshaped: number; shapedPlain: number; unshapedPlain: number; total: number } | null;
  failures?: { caseId: string; reason: string }[];
};

/** The evaluation, as measured. Every number on this page is generated from the run artifacts. */
function Proof() {
  const s = summary as Summary;
  const bar = (a: Arm | undefined) => (a ? Math.round((a.passed / Math.max(1, a.runs)) * 100) : 0);
  return (
    <main className="ch-root ch-stage ch-grain ch-proof" data-testid="proof" data-status={s.status}>
      <header className="ch-topbar">
        <a className="ch-wordmark" href="/">चौपाल</a>
        <span className="ch-pill">प्रमाण · Proof</span>
      </header>
      <section className="ch-proof-body">
        <h1 className="ch-h1">Does her agent finish the job?</h1>
        {s.status !== "ready" || !s.control || !s.candidate ? (
          <p className="ch-lead" data-testid="proof-pending">{s.note ?? "Results are being measured."}</p>
        ) : (
          <>
            <p className="ch-proof-lead">
              {s.cases} frozen cases in an elder's own words, {s.repetitions} repetitions each, the same model ({s.model}) on the same page.
            </p>
            <div className="ch-proof-bars">
              {[s.control, s.candidate].map((a, i) => (
                <div key={a.label} className="ch-proof-row" data-arm={i === 0 ? "control" : "candidate"}>
                  <span className="ch-proof-label">{a.label}</span>
                  <div className="ch-proof-track" aria-hidden>
                    <div className="ch-proof-fill" style={{ width: `${bar(a)}%` }} />
                  </div>
                  <span className="ch-proof-value">
                    {a.passed}/{a.runs} ({a.rate})
                  </span>
                  <span className="ch-card-sub">
                    {a.tokens.toLocaleString("en-IN")} tokens · {a.seconds} s per try
                  </span>
                </div>
              ))}
            </div>
            {s.categories?.length ? (
              <table className="ch-proof-table">
                <thead>
                  <tr><th>Activity</th><th>Browser only</th><th>Chaupal actions</th></tr>
                </thead>
                <tbody>
                  {s.categories.map((c) => (
                    <tr key={c.name}><td>{c.name}</td><td>{c.control}</td><td>{c.candidate}</td></tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            {s.sync ? (
              <p className="ch-proof-lead">
                Family sync ({s.sync.where}): p50 {s.sync.p50} s, p95 {s.sync.p95} s over {s.sync.n} moves.
              </p>
            ) : null}
            {s.ocr ? (
              <p className="ch-proof-lead">
                Indic text read back by OCR: {s.ocr.shaped}/{s.ocr.total} exact for provider-shaped renders vs {s.ocr.unshaped}/{s.ocr.total} for the same text drawn
                without shaping ({s.ocr.shapedPlain} vs {s.ocr.unshapedPlain} with plain fonts).
              </p>
            ) : null}
            {s.failures?.length ? (
              <>
                <h2 className="ch-h2">Where it still fails</h2>
                <ul className="ch-proof-failures">
                  {s.failures.map((f) => (
                    <li key={f.caseId}><strong>{f.caseId}</strong>: {f.reason}</li>
                  ))}
                </ul>
              </>
            ) : null}
            <p className="ch-card-sub">Generated {s.generatedAt} from evals/iterations. Method in EVALUATION.md.</p>
          </>
        )}
      </section>
    </main>
  );
}

export default function ProofRoute() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="ch-boot" />;
  return (
    <div className="theme-chaupal ch-shell" data-theme="day">
      <Proof />
    </div>
  );
}
