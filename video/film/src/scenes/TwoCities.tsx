import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT } from "../theme";
import { interp, ramp, rise, OUT, INOUT } from "../lib/anim";
import { Band, Chip, Note, Sky } from "../components/World";
import { ClipSeq, SegNotes } from "../components/ClipSeq";

type Rect = { x: number; y: number; w: number; h: number; flip?: boolean };

/** The moment people remember: one move, two cities. Her tablet view (lamplight, left) and her grandson's phone view
 *  (city light, right) are two live sessions of the deployed app, recorded at the same time. When the move is made, a chalk line
 *  draws across the seam from her square to the same square on his phone and a marigold disc runs along it; his reply
 *  runs back the same way. The line is a visual; both boards are the real app. */
const TAB = { x: 64, y: 118, s: 860 / 1024, w: 1366, h: 1024 };
const PH = { x: 1452, y: 118, s: 860 / 844, w: 390, h: 844 };

type Sq = { a1: [number, number]; h1: [number, number]; a8: [number, number] };
/** Square centre in film px: from three logged piece centres (a1, h1, a8) when the capture has them, else from the board box. */
const squareCentre = (board: Rect, square: string, panel: typeof TAB, sq?: Sq | null): [number, number] => {
  let c = square.charCodeAt(0) - 97, r = Number(square[1]) - 1;
  if (sq && sq.a1 && sq.h1 && sq.a8) {
    const x = sq.a1[0] + (c * (sq.h1[0] - sq.a1[0])) / 7 + (r * (sq.a8[0] - sq.a1[0])) / 7;
    const y = sq.a1[1] + (c * (sq.h1[1] - sq.a1[1])) / 7 + (r * (sq.a8[1] - sq.a1[1])) / 7;
    return [panel.x + x * panel.s, panel.y + y * panel.s];
  }
  if (board.flip) { c = 7 - c; r = 7 - r; }
  const x = board.x + (c + 0.5) * (board.w / 8);
  const y = board.y + (7 - r + 0.5) * (board.h / 8);
  return [panel.x + x * panel.s, panel.y + y * panel.s];
};

const Line: React.FC<{ from: [number, number]; to: [number, number]; at: number; dur: number; label?: string; f: number }> = ({ from, to, at, dur, label, f }) => {
  if (f < at) return null;
  const p = interp(f, [at, at + dur], [0, 1], OUT);
  const fade = 1 - ramp(f, at + dur + 50, 14);
  const mx = (from[0] + to[0]) / 2, my = Math.min(from[1], to[1]) - 170;
  const d = `M ${from[0]} ${from[1]} Q ${mx} ${my} ${to[0]} ${to[1]}`;
  // point on the quadratic at t
  const q = (t: number) => [
    (1 - t) * (1 - t) * from[0] + 2 * (1 - t) * t * mx + t * t * to[0],
    (1 - t) * (1 - t) * from[1] + 2 * (1 - t) * t * my + t * t * to[1],
  ];
  const [dx, dy] = q(interp(f, [at + 4, at + dur], [0, 1], INOUT));
  return (
    <g opacity={fade}>
      <path d={d} pathLength={1} fill="none" stroke={C.chalk} strokeWidth={5} strokeLinecap="round" strokeDasharray="1 1" strokeDashoffset={1 - p} filter="url(#chalk)" />
      <circle cx={dx} cy={dy} r={16} fill={C.marigold} opacity={p < 1 ? 1 : 1 - ramp(f, at + dur, 8)} />
      <circle cx={dx} cy={dy} r={40} fill={C.marigold} opacity={(p < 1 ? 0.25 : 0)} />
      <circle cx={to[0]} cy={to[1]} r={34 + 30 * ramp(f, at + dur, 12)} fill="none" stroke={C.marigold400} strokeWidth={4} opacity={1 - ramp(f, at + dur, 18)} />
      {label && <text x={mx} y={my + 70} textAnchor="middle" fontFamily={FONT.display} fontSize={54} fill={C.marigold400} opacity={ramp(f, at + dur - 4, 10)} filter="url(#chalk)">{label}</text>}
    </g>
  );
};

export const TwoCities: React.FC<any> = (p) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const at = (s: number | undefined) => (s === undefined ? 1e9 : Math.round(s * fps));
  const enter = ramp(f, 0, 16);
  const tb: Rect = p.tabletBoard ?? { x: 456, y: 160, w: 736, h: 736 };
  const pb: Rect = p.phoneBoard ?? { x: 18, y: 222, w: 354, h: 354, flip: true };
  const from = squareCentre(tb, p.square ?? "h6", TAB, p.squares?.tablet);
  const to = squareCentre(pb, p.square ?? "h6", PH, p.squares?.phone);
  const rFrom = squareCentre(pb, p.replySquare ?? "h6", PH, p.squares?.phone);
  const rTo = squareCentre(tb, p.replySquare ?? "h6", TAB, p.squares?.tablet);
  // camera: lean into her tablet while she asks, then pull back to see both cities for the landing
  const push = interp(f, [at(p.requestAt) - 6, at(p.requestAt) + 14, at(p.landAt) - 18, at(p.landAt)], [0, 1, 1, 0], INOUT);
  const S = (1 + 0.18 * push) * (1 + 0.035 * Math.min(1, f / Math.max(1, p.dur))); // a slow push under everything: never a frozen frame
  const ox = -260 * push, oy = 40 * push;
  return (
    <AbsoluteFill style={{ background: C.night950 }}>
      <Sky glow={{ x: 600, y: 700, r: 1100, i: 0.6 }} floor={0.18} />
      {/* his side of the frame is a cooler, city light */}
      <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(0,0,0,0) 62%, rgba(40,60,120,.35) 74%, rgba(20,30,70,.55))" }} />
      <AbsoluteFill style={{ transformOrigin: "40% 50%", transform: `translate(${ox}px, ${oy}px) scale(${S})` }}>
        <div style={{ position: "absolute", left: TAB.x, top: TAB.y, width: TAB.w * TAB.s, height: TAB.h * TAB.s, borderRadius: 26, overflow: "hidden", boxShadow: "0 30px 90px rgba(0,0,0,.55), 0 0 0 10px #0b0a18, 0 0 120px rgba(244,169,60,.25)", opacity: enter, transform: `translateX(${(1 - enter) * -60}px)` }}>
          {p.tablet ? <ClipSeq src={p.tablet} segs={p.segments} from={p.from} w={TAB.w * TAB.s} h={TAB.h * TAB.s} /> : <Pending what="tablet capture" />}
        </div>
        <div style={{ position: "absolute", left: PH.x, top: PH.y, width: PH.w * PH.s, height: PH.h * PH.s, borderRadius: 40, overflow: "hidden", boxShadow: "0 30px 90px rgba(0,0,0,.55), 0 0 0 10px #0b0a18, 0 0 90px rgba(120,150,255,.18)", opacity: enter, transform: `translateX(${(1 - enter) * 60}px)` }}>
          {p.phone ? <ClipSeq src={p.phone} segs={p.segments} from={p.from} w={PH.w * PH.s} h={PH.h * PH.s} /> : <Pending what="phone capture" />}
        </div>
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <Line from={from} to={to} at={at(p.landAt) - Math.round(0.35 * fps)} dur={Math.round(0.6 * fps)} label={p.syncLabel} f={f} />
          <Line from={rFrom} to={rTo} at={at(p.replyAt) - Math.round(0.35 * fps)} dur={Math.round(0.6 * fps)} f={f} />
        </svg>
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 70, top: 34 }}><Chip at={6} text="उनका टैबलेट" sub="her view · tablet size" until={at(p.requestAt) - 4} /></div>
      <div style={{ position: "absolute", right: 70, top: 34 }}><Chip at={14} text="राहुल का फ़ोन" sub="his view · phone size" until={at(p.requestAt) - 4} /></div>
      {p.request && (
        <div style={{ position: "absolute", left: 120, bottom: 230 }}>
          <Chip at={at(p.requestAt)} until={at(p.landAt) + 20} text={p.request.hi} sub={p.request.en} tone="accent" />
        </div>
      )}
      <Note at={8} text="Illustrative personas · the deployed app in two live sessions" style={{ left: "50%", transform: "translateX(-50%)", top: 40 }} until={at(p.requestAt)} />
      {p.typedNote && <Note at={at(p.requestAt)} until={at(p.landAt) + 20} text={p.typedNote} style={{ left: 120, bottom: 330 }} />}
      {p.speedNote && <Note at={at(p.speedNote.at)} until={at(p.speedNote.until)} text={p.speedNote.text} style={{ right: 60, bottom: 230 }} />}
      <SegNotes segs={p.segments} style={{ top: 120 }} />
      <Band />
    </AbsoluteFill>
  );
};

export const Pending: React.FC<{ what: string }> = ({ what }) => (
  <AbsoluteFill style={{ background: C.night800, alignItems: "center", justifyContent: "center", border: `3px dashed ${C.marigold}` }}>
    <div style={{ fontFamily: FONT.sans, fontSize: 32, fontWeight: 600, color: C.marigold400, textAlign: "center", padding: 30 }}>PLACEHOLDER: {what}<br />(recorded last, from the deployed app)</div>
  </AbsoluteFill>
);
