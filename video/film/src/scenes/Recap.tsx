import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { C, FONT, T, LIGHT_MODE } from "../theme";
import { interp, ramp, rise, OUT, INOUT } from "../lib/anim";
import { Sky } from "../components/World";
import { Cam, Diya, Floor, type Pose } from "../components/Diya3D";

/** "What nobody else does": a fast montage of the real captures (about one second a cut, a flash on each) behind the
 *  recap lines, which land one by one with the voice; the strongest number last. */
export const Recap: React.FC<any> = (p) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const clips: { src: string; from?: number }[] = p.clips ?? [];
  const cut = Math.round((p.cut ?? 1.0) * fps);
  const i = Math.floor(f / cut);
  const c = clips.length ? clips[i % clips.length] : null;
  const flash = 1 - ramp(f % cut, 0, 4);
  const lines: { at: number; text: string; strong?: boolean }[] = p.lines ?? [];
  return (
    <AbsoluteFill style={{ background: T.bg }}>
      {c ? (
        <Sequence from={i * cut} durationInFrames={cut} layout="none">
          <AbsoluteFill style={{ transform: `scale(${1.08 + 0.04 * ((f % cut) / cut)})`, filter: LIGHT_MODE ? "saturate(.95)" : "brightness(.55) saturate(.9)" }}>
            <OffthreadVideo src={staticFile(c.src)} trimBefore={Math.round((c.from ?? 0) * fps)} muted style={{ width: 1920, height: 1080, objectFit: "cover" }} />
          </AbsoluteFill>
        </Sequence>
      ) : (
        <Sky glow={{ x: 960, y: 800, r: 1000, i: 0.5 }} />
      )}
      <AbsoluteFill style={{ background: C.flame, opacity: 0.18 * flash }} />
      <AbsoluteFill style={{ background: LIGHT_MODE ? `linear-gradient(90deg, rgba(${T.recapWash},.94) 0%, rgba(${T.recapWash},.88) 52%, rgba(${T.recapWash},.2) 78%, rgba(${T.recapWash},0) 92%)` : `linear-gradient(90deg, rgba(${T.recapWash},.92) 0%, rgba(${T.recapWash},.72) 50%, rgba(${T.recapWash},.18) 100%)` }} />
      <div style={{ position: "absolute", left: 110, top: 150, display: "flex", flexDirection: "column", gap: 26 }}>
        {lines.map((l, k) => {
          const a = Math.round(l.at * fps);
          if (f < a) return null;
          return (
            <div key={k} style={{ fontFamily: FONT.display, fontSize: l.strong ? 76 : 62, color: l.strong ? T.accentText : T.ink, lineHeight: 1.1, ...rise(f, a, 8) }}>
              {l.text}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** The close: back to the lamp. The diya burns steady on the clay floor, the camera pulls back, the name settles. */
export const Close: React.FC<any> = (p) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const D: number = p.dur;
  const k = interp(f, [0, D], [0, 1], INOUT);
  const pose: Pose = { x: 1.4 + 1.2 * k, y: 2.4 + 1.9 * k, z: 7.2 + 3.7 * k, lx: 0.9, ly: 0.7 + 0.3 * k, lz: 0, fov: 30 };
  const nameAt = Math.round((p.nameAt ?? 2.2) * fps);
  return (
    <AbsoluteFill style={{ background: T.bg }}>
      <Sky glow={{ x: 1180, y: 640, r: 800, i: 0.3 }} floor={0.36} />
      <ThreeCanvas width={1920} height={1080} camera={{ fov: 30, near: 0.1, far: 120 }} gl={{ antialias: true, preserveDrawingBuffer: true }}>
        <Cam pose={pose} />
        <fog attach="fog" args={[T.fog, 10, 28]} />
        <ambientLight intensity={LIGHT_MODE ? 0.55 : 0.12} color={T.ambient} />
        <hemisphereLight args={[T.hemiSky, T.hemiGround, LIGHT_MODE ? 0.8 : 0.25]} />
        {LIGHT_MODE && <directionalLight position={[5, 12, 8]} intensity={1.3} color="#FFF6E8" />}
        <group position={[2.2 + 2.0 * k, 0, 0]}>
          <Floor dots={1} ringR={2.3} />
          <Diya lit={1} />
        </group>
      </ThreeCanvas>
      <div style={{ position: "absolute", left: 140, top: 250 }}>
        <div style={{ fontFamily: FONT.display, fontSize: 176, color: T.ink, lineHeight: 1, filter: "url(#chalk)", ...rise(f, nameAt, 14) }}>चौपाल</div>
        <div style={{ fontFamily: FONT.display, fontStyle: "italic", fontSize: 66, color: T.accentText, marginTop: 8, ...rise(f, nameAt + 8) }}>Chaupal</div>
        <div style={{ fontFamily: FONT.display, fontSize: 44, color: T.inkSoft, marginTop: 40, maxWidth: 900, lineHeight: 1.25, ...rise(f, nameAt + 20) }}>{p.tagline}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 44, ...rise(f, nameAt + 32) }}>
          {(p.links ?? []).map((l: string, i: number) => <div key={i} style={{ fontFamily: FONT.sans, fontSize: i ? 30 : 40, fontWeight: i ? 500 : 600, color: i ? T.inkMuted : T.ink }}>{l}</div>)}
        </div>
      </div>
    </AbsoluteFill>
  );
};
