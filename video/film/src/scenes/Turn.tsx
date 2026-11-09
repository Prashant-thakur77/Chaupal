import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { C, FONT, T, LIGHT_MODE } from "../theme";
import { interp, ramp, rise, OUT, INOUT } from "../lib/anim";
import { Cam, Diya, Floor, lerpPose, type Pose } from "../components/Diya3D";
import { Board3D } from "../components/Board3D";
import { Sky } from "../components/World";

/** The turn. Darkness; a clay diya lights (match cut from the lamps in the footage), the camera comes down to the flame,
 *  चौपाल is written in chalk beside it. Then the light falls on a shatranj board in the app's own look, and the knight
 *  takes the rook: the same move the live app is about to play. The disc lifts toward the lens into the next scene. */
export const Turn: React.FC<any> = (p) => {
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const D: number = p.dur;
  const boardAt = Math.round((p.boardAt ?? D / fps * 0.55) * fps);
  const wordsAt = Math.round((p.wordsAt ?? 3.2) * fps);
  const lit = interp(f, [8, 8 + 1.1 * fps], [0, 1], OUT);
  const A: Pose = { x: 0.6, y: 3.4, z: 9.5, lx: 0.6, ly: 0.6, lz: 0, fov: 30 };
  const B: Pose = { x: 2.6, y: 2.1, z: 5.6, lx: 0.9, ly: 0.75, lz: 0, fov: 30 };
  const pose = lerpPose(A, B, interp(f, [0, boardAt], [0, 1], INOUT));
  const inBoard = f >= boardAt;
  const bt = f - boardAt;
  const bd = D - boardAt;
  const BA: Pose = { x: 0, y: 9.5, z: 8.2, lx: 0.3, ly: 0, lz: 0.6, fov: 34 };
  const BB: Pose = { x: 2.2, y: 6.4, z: 5.4, lx: 2.6, ly: 0, lz: -1.6, fov: 34 };
  const bpose = lerpPose(BA, BB, interp(bt, [0, bd], [0, 1], INOUT));
  const move = interp(bt, [bd * 0.35, bd * 0.62], [0, 1]);
  const fly = interp(bt, [bd * 0.8, bd], [0, 1], INOUT);
  const cross = ramp(f, boardAt - 8, 10);
  return (
    <AbsoluteFill style={{ background: T.bg }}>
      {!inBoard && (
        <AbsoluteFill style={{ opacity: 1 - cross }}>
          <Sky glow={{ x: 1180, y: 600, r: 700 * lit + 1, i: 0.25 * lit }} floor={0.36} />
          <ThreeCanvas width={1920} height={1080} camera={{ fov: 30, near: 0.1, far: 120 }} gl={{ antialias: true, preserveDrawingBuffer: true }}>
            <Cam pose={pose} />
            <fog attach="fog" args={[T.fog, 9, 26]} />
            <ambientLight intensity={LIGHT_MODE ? 0.55 : 0.12} color={T.ambient} />
            <hemisphereLight args={[T.hemiSky, T.hemiGround, LIGHT_MODE ? 0.8 : 0.25]} />
            {LIGHT_MODE && <directionalLight position={[5, 12, 8]} intensity={1.3} color="#FFF6E8" />}
            <Floor dots={interp(f, [0.6 * fps, 2.2 * fps], [0, 1])} ringR={2.3} />
            <Diya lit={lit} />
          </ThreeCanvas>
          <div style={{ position: "absolute", right: 130, top: 170, textAlign: "right" }}>
            <div style={{ fontFamily: FONT.display, fontSize: 168, color: T.ink, lineHeight: 1, filter: "url(#chalk)", ...rise(f, Math.round(1.3 * fps), 14) }}>चौपाल</div>
            <div style={{ fontFamily: FONT.display, fontStyle: "italic", fontSize: 64, color: T.accentText, marginTop: 6, ...rise(f, Math.round(1.7 * fps)) }}>Chaupal</div>
            <div style={{ display: "flex", gap: 30, marginTop: 58, justifyContent: "flex-end" }}>
              {[["लिखना", "writes"], ["रंगोली", "draws"], ["शतरंज", "plays"]].map(([hi, en], i) => (
                <div key={i} style={{ ...rise(f, wordsAt + i * 9) }}>
                  <div style={{ fontFamily: FONT.display, fontSize: 58, color: T.ink }}>{hi}</div>
                  <div style={{ fontFamily: FONT.sans, fontSize: 30, color: T.inkMuted }}>{en}</div>
                </div>
              ))}
            </div>
          </div>
        </AbsoluteFill>
      )}
      {f >= boardAt - 8 && (
        <AbsoluteFill style={{ opacity: cross }}>
          <Sky glow={{ x: 1300, y: 420, r: 900, i: 0.4 }} floor={0.2} stars={false} />
          <ThreeCanvas width={1920} height={1080} camera={{ fov: 34, near: 0.1, far: 120 }} gl={{ antialias: true, preserveDrawingBuffer: true }}>
            <Cam pose={bpose} />
            <ambientLight intensity={LIGHT_MODE ? 0.8 : 0.35} color={T.ambient} />
            <pointLight position={[4.5, 4.5, 1]} intensity={42} distance={30} decay={1.6} color="#ffb45a" />
            <directionalLight position={[-6, 9, 6]} intensity={LIGHT_MODE ? 0.9 : 0.5} color={T.key} />
            <Board3D move={move} fly={fly} reveal={interp(bt, [0, 0.8 * fps], [0, 1], OUT)} />
          </ThreeCanvas>
          <div style={{ position: "absolute", right: 90, top: 70, textAlign: "right", ...rise(f, boardAt + 14) }}>
            <div style={{ fontFamily: FONT.display, fontSize: 64, color: T.ink }}>घोड़े से उसका हाथी</div>
            <div style={{ fontFamily: FONT.sans, fontSize: 32, color: T.inkMuted }}>knight takes rook</div>
          </div>
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ background: C.flame, opacity: interp(f, [durationInFrames - 6, durationInFrames], [0, 0.0]) }} />
    </AbsoluteFill>
  );
};
