import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT } from "../theme";
import { interp, ramp, rise, OUT } from "../lib/anim";
import { Sky } from "../components/World";

/** The stakes, drawn in chalk on the clay floor. Two numbers, each with its source:
 *  the share of Indians over 60 (2022 -> 2050) as two chalk columns that grow, then the digital-confusion share as a
 *  10x10 grid of chalk dots where that many light up marigold in a wave. Values come from facts.json. */
export const Stakes: React.FC<any> = (p) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a1 = Math.round(p.at1 * fps), a2 = Math.round(p.at2 * fps);
  const share22: number = p.share2022, share50: number = p.share2050, dig: number = p.digital;
  const swap = ramp(f, a2 - 10, 16); // the first figure slides left and dims as the second arrives
  const count = (v: number, at: number, d = 0.9) => v * interp(f, [at, at + d * fps], [0, 1], OUT);
  const colH = 520;
  const bar = (v: number, max: number, at: number) => (colH * v * interp(f, [at, at + 0.9 * fps], [0, 1], OUT)) / max;
  return (
    <AbsoluteFill>
      <Sky glow={{ x: 960, y: 900, r: 1200, i: 0.45 }} floor={0.5} />
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {/* figure 1: share of people 60+ */}
        <g transform={`translate(${-360 * swap}, 0)`} opacity={1 - swap}>
          {[{ v: share22, y: "2022", at: a1 + 6, x: 640 }, { v: share50, y: "2050", at: a1 + 20, x: 900 }].map((c, i) => {
            const h = bar(c.v, share50, c.at);
            return (
              <g key={i} style={{ opacity: ramp(f, c.at - 6, 8) }}>
                <rect x={c.x} y={880 - h} width={170} height={h} fill="none" stroke={i ? C.marigold : C.chalk} strokeWidth={6} filter="url(#chalk)" />
                {Array.from({ length: Math.floor(h / 22) }).map((_, k) => (
                  <line key={k} x1={c.x + 8} y1={872 - k * 22} x2={c.x + 162} y2={872 - k * 22 - 18} stroke={i ? C.marigold : C.chalk} strokeWidth={3} opacity={0.55} filter="url(#chalk)" />
                ))}
                <text x={c.x + 85} y={930} textAnchor="middle" fontFamily={FONT.sans} fontSize={40} fontWeight={600} fill={C.chalkSoft}>{c.y}</text>
                <text x={c.x + 85} y={860 - h} textAnchor="middle" fontFamily={FONT.display} fontSize={i ? 92 : 66} fill={i ? C.marigold400 : C.chalk} filter="url(#chalk)">
                  {count(c.v, c.at).toFixed(1)}%
                </text>
              </g>
            );
          })}
          <line x1={560} y1={882} x2={1160} y2={882} stroke={C.chalk} strokeWidth={4} filter="url(#chalk)" opacity={ramp(f, a1, 10)} />
        </g>
      </svg>
      <div style={{ position: "absolute", left: 1190 - 360 * swap, top: 300, width: 600, ...rise(f, a1 + 30), opacity: rise(f, a1 + 30).opacity * (1 - swap) }}>
        <div style={{ fontFamily: FONT.display, fontSize: 60, color: C.chalk, lineHeight: 1.15 }}>Indians over 60</div>
        <div style={{ fontFamily: FONT.sans, fontSize: 40, color: C.chalkSoft, marginTop: 10 }}>share of the population, doubling by 2050</div>
        <div style={{ fontFamily: FONT.sans, fontSize: 30, color: C.muted, marginTop: 18 }}>{p.src1}</div>
      </div>
      {/* figure 2: the dot grid */}
      {f >= a2 - 10 && (
        <>
          <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, ...rise(f, a2 - 10, 12) }}>
            {Array.from({ length: 100 }).map((_, i) => {
              const r = Math.floor(i / 10), c = i % 10;
              const lit = i < dig && f >= a2 + 8 + (r + c) * 1.6;
              return <circle key={i} cx={1080 + c * 62} cy={250 + r * 62} r={lit ? 19 : 13} fill={lit ? C.marigold : "none"} stroke={C.chalk} strokeWidth={lit ? 0 : 3} opacity={lit ? 1 : 0.8} filter="url(#chalk)" />;
            })}
          </svg>
          <div style={{ position: "absolute", left: 120, top: 330, width: 820, ...rise(f, a2 + 4) }}>
            <div style={{ fontFamily: FONT.display, fontSize: 150, color: C.marigold400, lineHeight: 1 }}>{Math.round(count(dig, a2 + 8, 1.0))}%</div>
            <div style={{ fontFamily: FONT.display, fontSize: 56, color: C.chalk, lineHeight: 1.2, marginTop: 16 }}>of older people surveyed find digital tools “too confusing”</div>
            <div style={{ fontFamily: FONT.sans, fontSize: 30, color: C.muted, marginTop: 18 }}>{p.src2}</div>
          </div>
        </>
      )}
    </AbsoluteFill>
  );
};
