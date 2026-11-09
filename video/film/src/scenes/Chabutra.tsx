import React, { useMemo } from "react";
import * as THREE from "three";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT } from "../theme";
import { interp, ramp, rise, OUT, INOUT } from "../lib/anim";
import { Cam, Diya, type Pose } from "../components/Diya3D";
import { Sky } from "../components/World";

/** Under the hood, as a chabutra: the raised clay platform at the centre of a village square, cut open into its tiers.
 *  Top: the surfaces (her voice, her touch, his phone, Claude through an MCP App card, Telegram). Then one set of
 *  defineAction actions (lit by the lamp: the sponsor's tech is the hero). Then shared SQL with revisions and live sync.
 *  At the base, the engines that own the truth. Packets of lamplight climb between tiers; a stale move is refused at the
 *  revision tier; a Telegram packet waits at needsApproval until her "हाँ". Every tier rises on the word that names it. */
type Tier = { id: string; y: number; title: string; sub: string; color: string; hero?: boolean };
const TIERS: Tier[] = [
  { id: "engines", y: 0, title: "Engines own the truth", sub: "HarfBuzz text shaping · rangoli generator · chess.js", color: C.clay600 },
  { id: "sql", y: 1.45, title: "Shared SQL + revisions", sub: "saveIfCurrent · live sync to every screen", color: C.clay500 },
  { id: "actions", y: 2.9, title: "One defineAction set", sub: "open-activity · fill-region · move-chess-piece · …", color: C.terracotta, hero: true },
];
const SAT = [
  { id: "voice", label: "her voice", hi: "आवाज़", a: -0.95 },
  { id: "touch", label: "her touch", hi: "छूना", a: -0.48 },
  { id: "phone", label: "Rahul's phone", hi: "फ़ोन", a: 0 },
  { id: "claude", label: "Claude · MCP App card", hi: "", a: 0.48 },
  { id: "telegram", label: "Telegram", hi: "", a: 0.95 },
];
const satPos = (a: number): [number, number, number] => [Math.sin(a) * 5.9, 4.75, -Math.cos(a) * 1.4 + 0.6];

const Slab: React.FC<{ t: Tier; show: number; pulse: number }> = ({ t, show, pulse }) => (
  <group position={[0, t.y - (1 - show) * 2.2, 0]} scale={[1, 1, 1]}>
    <mesh castShadow receiveShadow>
      <boxGeometry args={[7.2, 0.5, 3.4]} />
      <meshStandardMaterial color={t.color} roughness={0.8} transparent opacity={show} emissive={t.hero ? C.marigold : "#000"} emissiveIntensity={t.hero ? 0.12 + 0.25 * pulse : 0} />
    </mesh>
    {/* chalk border on the top face */}
    <lineSegments position={[0, 0.252, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <edgesGeometry args={[new THREE.PlaneGeometry(6.8, 3.0)]} />
      <lineBasicMaterial color={C.chalk} transparent opacity={0.7 * show} />
    </lineSegments>
  </group>
);

const Packet: React.FC<{ p: [number, number, number]; color: string; size?: number; o?: number }> = ({ p, color, size = 0.13, o = 1 }) => (
  <group position={p}>
    <mesh><sphereGeometry args={[size, 16, 16]} /><meshBasicMaterial color={color} transparent opacity={o} /></mesh>
    <mesh><sphereGeometry args={[size * 2.6, 16, 16]} /><meshBasicMaterial color={color} transparent opacity={0.18 * o} depthWrite={false} /></mesh>
  </group>
);

const lerp3 = (a: number[], b: number[], t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export const Chabutra: React.FC<any> = (p) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const D: number = p.dur;
  const cue = (k: string, d: number) => Math.round(((p.cues ?? {})[k] ?? d) * fps);
  const cS = cue("surfaces", 2.2), cA = cue("actions", 0.6), cQ = cue("sql", 9), cE = cue("engines", 15);
  const cStale = cue("stale", 11.5), cGate = cue("gate", 6.5), cYes = cue("yes", 8.2);
  const orbit = interp(f, [0, D], [-0.15, 0.15], INOUT); // ~17 degrees in all
  const r = interp(f, [0, D], [15.5, 13.2], INOUT);
  const pose: Pose = { x: Math.sin(orbit) * r, y: 6.6, z: Math.cos(orbit) * r, lx: 0, ly: 2.2, lz: 0, fov: 34 };
  const show = (at: number) => interp(f, [at, at + 0.6 * fps], [0, 1], OUT);
  const shown: Record<string, number> = { engines: show(cE), sql: show(cQ), actions: show(cA) };
  const pulse = 0.5 + 0.5 * Math.sin(f * 0.15);

  // a projector for HTML labels (same pose as the 3D camera)
  const cam = useMemo(() => new THREE.PerspectiveCamera(34, 1920 / 1080, 0.1, 100), []);
  cam.position.set(pose.x, pose.y, pose.z); cam.lookAt(pose.lx, pose.ly, pose.lz); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  const proj = (v: [number, number, number]) => { const w = new THREE.Vector3(...v).project(cam); return [(w.x + 1) * 960, (1 - w.y) * 540]; };

  // packets: from each surface down into the actions tier, then into SQL, then back up (looping, staggered)
  const packets: React.ReactNode[] = [];
  SAT.forEach((s, i) => {
    if (f < cS + i * 6) return;
    const cyc = 2.4 * fps;
    const t = ((f - cS - i * 11) % cyc) / cyc;
    const top = satPos(s.a);
    const mid = [top[0] * 0.35, 3.25, 0.3];
    const low = [top[0] * 0.2, 1.75, 0.3];
    let pos: [number, number, number];
    if (t < 0.4) pos = lerp3(top, mid, t / 0.4);
    else if (t < 0.65 && f > cQ) pos = lerp3(mid, low, (t - 0.4) / 0.25);
    else pos = lerp3(f > cQ ? low : mid, top, Math.max(0, (t - 0.65) / 0.35));
    if (s.id === "telegram" && f > cGate - 30 && f < cYes + 40) return; // the held packet is drawn below
    packets.push(<Packet key={s.id} p={pos} color={C.marigold400} o={ramp(f, cS + i * 6, 8)} />);
  });
  // the stale move: comes down from the agent's lane, hits the revision tier, is refused
  const staleT = interp(f, [cStale - 0.7 * fps, cStale], [0, 1], INOUT);
  const bounce = interp(f, [cStale, cStale + 0.5 * fps], [0, 1], OUT);
  const stalePos = f < cStale ? lerp3([-1.6, 4.4, 0.4], [-1.2, 1.8, 0.4], staleT) : lerp3([-1.2, 1.8, 0.4], [-2.6, 2.9, 1.4], bounce);
  // the held Telegram packet
  const tg = satPos(SAT[4].a);
  const gate: [number, number, number] = [tg[0] * 0.62, 4.2, 0.5];
  const heldPos = f < cGate ? lerp3([0.8, 3.3, 0.3], gate, interp(f, [cGate - 0.6 * fps, cGate], [0, 1], INOUT)) : f < cYes ? gate : lerp3(gate, tg, interp(f, [cYes, cYes + 0.5 * fps], [0, 1], OUT));

  const L = (v: [number, number, number]) => proj(v);
  const [gx, gy] = L(gate);
  const [sx, sy] = L([-1.2, 1.8, 0.4]);
  return (
    <AbsoluteFill>
      <Sky glow={{ x: 960, y: 420, r: 1000, i: 0.35 }} floor={0.3} />
      <ThreeCanvas width={1920} height={1080} camera={{ fov: 34, near: 0.1, far: 100 }} gl={{ antialias: true, preserveDrawingBuffer: true }}>
        <Cam pose={pose} />
        <ambientLight intensity={0.55} color="#b9b2ff" />
        <hemisphereLight args={["#9c9cf0", "#5A2A17", 0.45]} />
        <directionalLight position={[-6, 10, 8]} intensity={0.6} color="#9c9cf0" />
        <group position={[3.9, 3.15, 1.1]} scale={0.45}><Diya lit={ramp(f, cA, 18)} /></group>
        {TIERS.map((t) => <Slab key={t.id} t={t} show={shown[t.id]} pulse={pulse} />)}
        {SAT.map((s, i) => {
          const o = ramp(f, cS + i * 5, 10);
          const [x, y, z] = satPos(s.a);
          return (
            <group key={s.id} position={[x, y + (1 - o) * 1.2, z]} scale={o}>
              <mesh><cylinderGeometry args={[0.42, 0.46, 0.16, 32]} /><meshStandardMaterial color={s.id === "telegram" ? C.indigo300 : C.chalk100} roughness={0.5} /></mesh>
            </group>
          );
        })}
        {packets}
        {f > cStale - 0.7 * fps && f < cStale + 0.9 * fps && <Packet p={stalePos} color={C.bad} size={0.15} o={1 - ramp(f, cStale + 0.5 * fps, 10)} />}
        {f > cGate - 0.6 * fps && f < cYes + 0.6 * fps && <Packet p={heldPos} color={C.marigold} size={0.15} />}
        {f > cGate - 0.3 * fps && f < cYes + 0.4 * fps && (
          <mesh position={gate} rotation={[0, 0, 0]}>
            <torusGeometry args={[0.42, 0.04, 12, 48]} />
            <meshBasicMaterial color={f < cYes ? C.marigold400 : C.good} />
          </mesh>
        )}
      </ThreeCanvas>
      {TIERS.map((t, i) => (
        <div key={t.id} style={{ position: "absolute", left: 40, top: 300 + (2 - i) * 210, width: 520, opacity: shown[t.id], transform: `translateY(${(1 - shown[t.id]) * 12}px)` }}>
          <div style={{ fontFamily: FONT.display, fontSize: 40, color: t.hero ? C.marigold400 : C.chalk, lineHeight: 1.1 }}>{t.title}</div>
          <div style={{ fontFamily: FONT.sans, fontSize: 27, fontWeight: 500, color: C.chalkSoft, marginTop: 6, lineHeight: 1.25 }}>{t.sub}</div>
        </div>
      ))}
      {SAT.map((s, i) => {
        const [x, y] = L(satPos(s.a));
        return (
          <div key={s.id} style={{ position: "absolute", left: x, top: y - 92, textAlign: "center", opacity: rise(f, cS + i * 5 + 6).opacity, transform: `translateX(-50%) ${rise(f, cS + i * 5 + 6).transform}` }}>
            <div style={{ fontFamily: FONT.sans, fontSize: 28, fontWeight: 600, color: C.chalk, whiteSpace: "nowrap" }}>{s.label}</div>
          </div>
        );
      })}
      {f >= cStale && f < cStale + 2.4 * fps && (
        <div style={{ position: "absolute", left: sx - 470, top: sy + 30, ...rise(f, cStale) }}>
          <div style={{ fontFamily: FONT.sans, fontSize: 30, fontWeight: 600, color: C.bad, background: "rgba(14,12,32,.85)", padding: "8px 16px", borderRadius: 12, border: `1.5px solid ${C.bad}` }}>stale revision · refused, nothing changes</div>
        </div>
      )}
      {f >= cGate && f < cYes + 1.6 * fps && (
        <div style={{ position: "absolute", left: gx + 40, top: gy - 120, ...rise(f, cGate) }}>
          <div style={{ fontFamily: FONT.sans, fontSize: 30, fontWeight: 600, color: f < cYes ? C.marigold400 : C.good, background: "rgba(14,12,32,.85)", padding: "8px 16px", borderRadius: 12, border: `1.5px solid ${f < cYes ? C.marigold400 : C.good}` }}>
            {f < cYes ? "needsApproval · waiting for her" : "हाँ, भेज दो · sent after her yes"}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
