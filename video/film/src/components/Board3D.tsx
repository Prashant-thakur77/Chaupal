import React, { useMemo } from "react";
import * as THREE from "three";
import { FONT, T } from "../theme";
import { interp, OUT, INOUT } from "../lib/anim";

/** A shatranj board in the app's own look: clay squares, round discs labelled in Devanagari.
 *  The position is the one the film plays live (1. Nf3 h5 2. Nh4 Rh6 3. Nf5 a6), so the 3D move matches the capture. */
const NAME: Record<string, string> = { K: "राजा", Q: "वज़ीर", B: "ऊँट", N: "घोड़ा", R: "हाथी", P: "प्यादा" };
const POSITION: [string, string][] = [
  // [square, piece] ; uppercase = hers (white), lowercase = his
  ["a1", "R"], ["b1", "N"], ["c1", "B"], ["d1", "Q"], ["e1", "K"], ["f1", "B"], ["h1", "R"], ["f5", "N"],
  ...["a", "b", "c", "d", "e", "f", "g", "h"].map((c) => [`${c}2`, "P"] as [string, string]),
  ["a8", "r"], ["b8", "n"], ["c8", "b"], ["d8", "q"], ["e8", "k"], ["f8", "b"], ["g8", "n"], ["h6", "r"],
  ["a6", "p"], ["b7", "p"], ["c7", "p"], ["d7", "p"], ["e7", "p"], ["f7", "p"], ["g7", "p"], ["h5", "p"],
];

const texCache = new Map<string, THREE.CanvasTexture>();
const discTex = (label: string, mine: boolean) => {
  const key = label + mine;
  if (texCache.has(key)) return texCache.get(key)!;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = mine ? T.herDisc : T.otherDisc;
  g.beginPath(); g.arc(128, 128, 128, 0, Math.PI * 2); g.fill();
  g.strokeStyle = mine ? T.herInk : T.otherInk; g.lineWidth = 12;
  g.beginPath(); g.arc(128, 128, 112, 0, Math.PI * 2); g.stroke();
  g.fillStyle = mine ? T.herInk : T.otherInk;
  g.font = `700 ${label.length > 4 ? 66 : 80}px ${FONT.sans}`;
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(label, 128, 138);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
};

export const sq = (s: string): [number, number] => [s.charCodeAt(0) - 97 - 3.5, -(Number(s[1]) - 1 - 3.5)];

const Disc: React.FC<{ label: string; mine: boolean; pos: [number, number, number]; tilt?: number; scale?: number }> = ({ label, mine, pos, tilt = 0, scale = 1 }) => (
  <group position={pos} rotation={[tilt, 0, tilt * 0.4]} scale={scale}>
    <mesh castShadow>
      <cylinderGeometry args={[0.42, 0.44, 0.16, 48]} />
      <meshStandardMaterial color={mine ? T.herDisc : T.otherDisc} roughness={0.55} />
    </mesh>
    <mesh position={[0, 0.081, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.42, 48]} />
      <meshStandardMaterial map={discTex(label, mine)} roughness={0.5} />
    </mesh>
  </group>
);

/** move: progress 0..1 of Nf5xh6 (knight lifts, arcs, lands; the rook flies off the board). fly: 0..1 the knight rises toward the camera. */
export const Board3D: React.FC<{ move: number; fly?: number; reveal?: number }> = ({ move, fly = 0, reveal = 1 }) => {
  const squares = useMemo(() => Array.from({ length: 64 }, (_, i) => ({ c: i % 8, r: Math.floor(i / 8) })), []);
  const [fx, fz] = sq("f5");
  const [tx, tz] = sq("h6");
  const m = interp(move, [0, 1], [0, 1], INOUT);
  const kx = fx + (tx - fx) * m, kz = fz + (tz - fz) * m;
  const ky = 0.14 + Math.sin(Math.PI * m) * 1.2 + fly * 3.2;
  const hit = interp(move, [0.55, 1], [0, 1], OUT);
  return (
    <group>
      <mesh position={[0, -0.12, 0]} receiveShadow>
        <boxGeometry args={[8.8, 0.24, 8.8]} />
        <meshStandardMaterial color={T.boardFrame} roughness={0.7} />
      </mesh>
      {squares.map(({ c, r }) => {
        const show = interp(reveal * 64 - (c + r * 1.3), [0, 3], [0, 1]);
        return (
          <mesh key={`${c}-${r}`} position={[c - 3.5, 0.005, r - 3.5]} receiveShadow scale={[show, 1, show]}>
            <boxGeometry args={[1, 0.03, 1]} />
            <meshStandardMaterial color={(c + r) % 2 ? T.boardDark : T.boardLight} roughness={0.85} />
          </mesh>
        );
      })}
      {POSITION.map(([s, p]) => {
        const mine = p === p.toUpperCase();
        const [x, z] = sq(s);
        if (s === "f5") return <Disc key={s} label={NAME.N} mine pos={[kx, ky, kz]} tilt={Math.sin(Math.PI * m) * 0.25 + fly * 0.9} scale={1 + fly * 0.6} />;
        if (s === "h6") {
          if (hit <= 0) return <Disc key={s} label={NAME.R} mine={false} pos={[x, 0.14, z]} />;
          return <Disc key={s} label={NAME.R} mine={false} pos={[x + hit * 2.6, 0.14 + Math.sin(Math.PI * Math.min(1, hit * 1.2)) * 1.4 - hit * 0.6, z - hit * 1.4]} tilt={hit * 2.2} scale={1 - hit * 0.3} />;
        }
        const show = interp(reveal * 64 - 40, [0, 10], [0, 1]);
        return <Disc key={s} label={NAME[p.toUpperCase()]} mine={mine} pos={[x, 0.14 + (1 - show) * 0.6, z]} scale={show} />;
      })}
    </group>
  );
};
