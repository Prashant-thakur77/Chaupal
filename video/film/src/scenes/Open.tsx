import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT } from "../theme";
import { interp, ramp, rise } from "../lib/anim";
import { Band, Chip, Note, Sky } from "../components/World";

type Shot = { src: string | null; from?: number; dur: number; push?: number; pan?: number; what: string; rate?: number };
type Pin = { at: number; text: string; sub?: string; x: number; y: number; dot?: [number, number] };

/** Real footage of India at dusk, graded into the film's world (warm, a little desaturated, blacks pushed to indigo).
 *  Shots cross-dissolve on 12 frames; each pushes or pans slowly. Pins are chalk labels stuck onto the footage. */
export const Open: React.FC<any> = (p) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shots: Shot[] = p.shots ?? [];
  let t = 0;
  const X = 12;
  return (
    <AbsoluteFill style={{ background: C.night950 }}>
      {shots.map((s, i) => {
        const a = Math.round(t * fps);
        const d = Math.round(s.dur * fps);
        t += s.dur;
        const local = f - a;
        const op = Math.min(ramp(f, a - (i ? X : 0), i ? X : 1), 1 - ramp(f, a + d, X));
        if (local < -X || local > d + X) return null;
        const k = Math.max(0, Math.min(1, (local + X) / (d + 2 * X)));
        const sc = 1.04 + (s.push ?? 0.05) * k;
        const tx = (s.pan ?? 0) * (k - 0.5) * 120;
        return (
          <AbsoluteFill key={i} style={{ opacity: op }}>
            {s.src ? (
              <Sequence from={a - X} layout="none">
                <AbsoluteFill style={{ transform: `translateX(${tx}px) scale(${sc})` }}>
                  <OffthreadVideo src={staticFile(s.src)} trimBefore={Math.round((s.from ?? 0) * fps)} playbackRate={s.rate ?? 1} muted
                    style={{ width: 1920, height: 1080, objectFit: "cover", filter: "sepia(.22) saturate(.82) contrast(1.06) brightness(.92)" }} />
                </AbsoluteFill>
              </Sequence>
            ) : (
              <AbsoluteFill>
                <Sky glow={{ x: 960, y: 820, r: 900, i: 0.4 }} />
                <div style={{ position: "absolute", top: 120, width: "100%", textAlign: "center", fontFamily: FONT.sans, fontSize: 34, color: C.marigold400 }}>FOOTAGE PENDING: {s.what}</div>
              </AbsoluteFill>
            )}
          </AbsoluteFill>
        );
      })}
      {/* the grade: indigo in the shadows, lamplight in the highlights */}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(21,19,43,.42), rgba(21,19,43,.08) 45%, rgba(58,26,12,.25))`, mixBlendMode: "multiply" }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 55%, rgba(0,0,0,0) 45%, rgba(14,12,32,.65) 100%)" }} />
      {(p.pins ?? []).map((pin: Pin, i: number) => {
        const at = Math.round(pin.at * fps);
        return (
          <React.Fragment key={i}>
            {pin.dot && f >= at && (
              <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
                <circle cx={pin.dot[0]} cy={pin.dot[1]} r={9} fill={C.marigold} opacity={ramp(f, at, 8)} />
                <line x1={pin.dot[0]} y1={pin.dot[1]} x2={pin.x} y2={pin.y + 30} stroke={C.chalk} strokeWidth={3} strokeDasharray="1000" strokeDashoffset={1000 * (1 - ramp(f, at, 14))} filter="url(#chalk)" />
              </svg>
            )}
            <div style={{ position: "absolute", left: pin.x, top: pin.y }}><Chip at={at + 6} text={pin.text} sub={pin.sub} tone="accent" /></div>
          </React.Fragment>
        );
      })}
      {(p.notes ?? []).map((n: { at: number; text: string; until?: number }, i: number) => (
        <Note key={i} at={Math.round(n.at * fps)} until={n.until ? Math.round(n.until * fps) : undefined} text={n.text} style={{ right: 40, top: 36 }} />
      ))}
      <Band />
    </AbsoluteFill>
  );
};
