import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, T } from "../theme";
import { interp, pop, ramp, rise, OUT } from "../lib/anim";
import { Sky } from "../components/World";

/** Proof, as chalk dots on the floor: one dot per run. The control (same model, browser control only) fills first in
 *  chalk, then Chaupal's actions in marigold, then the badge. Below, the text-shaping check as two chalk bars.
 *  Every value comes from facts.json; while the eval is pending the panel says so and shows no number. */
const Dots: React.FC<{ runs: number; passed: number; at: number; color: string; x: number; y: number; cols: number }> = ({ runs, passed, at, color, x, y, cols }) => {
  const f = useCurrentFrame();
  return (
    <g>
      {Array.from({ length: runs }).map((_, i) => {
        const r = Math.floor(i / cols), c = i % cols;
        const lit = i < passed && f >= at + i * 1.2;
        return <circle key={i} cx={x + c * 40} cy={y + r * 40} r={lit ? 14 : 10} fill={lit ? color : "none"} stroke={T.line} strokeWidth={lit ? 0 : 2.5} opacity={ramp(f, 12 + i * 0.4, 8) * (lit ? 1 : 0.7)} filter="url(#chalk)" />;
      })}
    </g>
  );
};

export const Proof: React.FC<any> = (p) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const at = (s: number) => Math.round(s * fps);
  const ev = p.eval ?? { ready: false };
  const ocr = p.ocr;
  const aA = at(p.atControl ?? 2.5), aB = at(p.atOurs ?? 5), aBadge = at(p.atBadge ?? 7), aO = at(p.atOcr ?? 9);
  const cols = 14;
  const drift = Math.min(1, f / Math.max(1, p.dur));
  return (
    <AbsoluteFill style={{ transform: `scale(${1 + 0.03 * drift}) translateX(${-12 * drift}px)` }}>
      <Sky glow={{ x: 1100 + 400 * drift, y: 560, r: 1100, i: 0.4 + 0.1 * Math.sin(f * 0.05) }} floor={0.0} />
      <div style={{ position: "absolute", left: 96, top: 64, ...rise(f, 4) }}>
        <div style={{ fontFamily: FONT.display, fontSize: 66, color: T.ink }}>Measured, not claimed</div>
        <div style={{ fontFamily: FONT.sans, fontSize: 30, color: T.inkSoft }}>
          {ev.ready ? `${ev.cases} cases in an elder's voice × ${ev.reps} runs · same model, same cases` : "same model, same cases written in an elder's voice"}
        </div>
      </div>
      {ev.ready ? (
        <>
          <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
            <Dots runs={ev.A.runs} passed={ev.A.passed} at={aA} color={T.ink} x={130} y={300} cols={cols} />
            <Dots runs={ev.B.runs} passed={ev.B.passed} at={aB} color={T.accent} x={1010} y={300} cols={cols} />
          </svg>
          {[{ k: ev.A, x: 110, a: aA, name: "Browser control only", color: T.ink }, { k: ev.B, x: 990, a: aB, name: "Chaupal's actions", color: T.accentText }].map((c, i) => (
            <div key={i} style={{ position: "absolute", left: c.x, top: 232 + Math.ceil(c.k.runs / cols) * 40 + 90, ...rise(f, c.a + 6) }}>
              <div style={{ fontFamily: FONT.sans, fontSize: 34, fontWeight: 600, color: c.color }}>{c.name}</div>
              <div style={{ fontFamily: FONT.display, fontSize: 92, color: c.color, lineHeight: 1 }}>
                {Math.round(c.k.passed * interp(f, [c.a, c.a + 0.9 * fps], [0, 1], OUT))}<span style={{ fontSize: 48, color: T.inkSoft }}> / {c.k.runs} passed</span>
              </div>
              <div style={{ fontFamily: FONT.sans, fontSize: 28, color: T.inkMuted }}>{c.k.tokens.toLocaleString("en-IN")} tokens · {c.k.seconds} s per try</div>
            </div>
          ))}
          {ev.better && f >= aBadge && (
            <div style={{ position: "absolute", left: 1330, top: 120, whiteSpace: "nowrap", transform: `scale(${pop(f, fps, aBadge)})`, fontFamily: FONT.display, fontSize: 52, color: T.onAccent, background: T.accent, borderRadius: 999, padding: "10px 30px" }}>
              +{ev.B.passed - ev.A.passed} passed runs
            </div>
          )}
        </>
      ) : (
        <div style={{ position: "absolute", left: 110, top: 270, width: 1700, height: 330, border: `3px dashed ${T.accent}`, borderRadius: 24, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, ...rise(f, 6) }}>
          <div style={{ fontFamily: FONT.sans, fontSize: 44, fontWeight: 700, color: T.accentText }}>PLACEHOLDER: evaluation results pending</div>
          <div style={{ fontFamily: FONT.sans, fontSize: 30, color: T.inkSoft }}>filled from evals/results/summary.json when the official runs finish; no number is shown until then</div>
        </div>
      )}
      {ocr && (
        <div style={{ position: "absolute", left: 110, top: 660, width: 1700, ...rise(f, aO) }}>
          <div style={{ fontFamily: FONT.sans, fontSize: 34, fontWeight: 600, color: T.ink }}>Text shaping: OCR reads the exact phrase back</div>
          {[{ v: ocr.shaped, label: "shaped by HarfBuzz", color: T.accent }, { v: ocr.unshaped, label: "unshaped text", color: T.ink }].map((b, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 14 }}>
              <div style={{ width: 300, fontFamily: FONT.sans, fontSize: 30, color: T.inkSoft }}>{b.label}</div>
              <div style={{ height: 34, width: (1000 * b.v / ocr.n) * interp(f, [aO + 4 + i * 6, aO + 4 + i * 6 + 0.8 * fps], [0, 1], OUT), background: b.color, borderRadius: 8, filter: "url(#chalk)" }} />
              <div style={{ fontFamily: FONT.display, fontSize: 44, color: b.color }}>{b.v}<span style={{ fontSize: 30, color: T.inkMuted }}> / {ocr.n}</span></div>
            </div>
          ))}
        </div>
      )}
      {p.failure && (
        <div style={{ position: "absolute", left: 110, top: 880, right: 110, fontFamily: FONT.sans, fontSize: 30, fontWeight: 600, color: T.bad, ...rise(f, at(p.atFail ?? 20)) }}>
          {p.failure}
        </div>
      )}
      <div style={{ position: "absolute", left: 110, bottom: 70, right: 110, fontFamily: FONT.sans, fontSize: 26, color: T.inkMuted, ...rise(f, aO + 12) }}>
        {p.footnote}
      </div>
    </AbsoluteFill>
  );
};
