import React, { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useCurrentFrame } from "remotion";
import { C } from "../theme";
import { rand } from "../lib/anim";

/** Canvas textures are made once per page (they only depend on constants). */
const memo = <T,>(fn: () => T) => { let v: T | null = null; return () => (v ??= fn()); };

const flameTex = memo(() => {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 256;
  const g = c.getContext("2d")!;
  // teardrop: a radial core stretched upward
  const grad = g.createRadialGradient(64, 190, 4, 64, 160, 120);
  grad.addColorStop(0, "rgba(255,250,235,1)");
  grad.addColorStop(0.25, "rgba(255,226,150,1)");
  grad.addColorStop(0.55, "rgba(244,169,60,.85)");
  grad.addColorStop(1, "rgba(208,100,58,0)");
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(64, 8);
  g.bezierCurveTo(98, 90, 112, 150, 104, 196);
  g.bezierCurveTo(96, 236, 32, 236, 24, 196);
  g.bezierCurveTo(16, 150, 30, 90, 64, 8);
  g.fill();
  return new THREE.CanvasTexture(c);
});

const glowTex = memo(() => {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(255,214,140,1)"); r.addColorStop(0.3, "rgba(244,169,60,.35)"); r.addColorStop(1, "rgba(244,169,60,0)");
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
});

/** Terracotta with a band of white dots under the rim, like the app's diya. */
const clayTex = memo(() => {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = C.terracotta; g.fillRect(0, 0, 1024, 256);
  for (let i = 0; i < 4000; i++) { // clay grain
    g.fillStyle = `rgba(${rand(i) > 0.5 ? "60,20,8" : "255,200,160"},${0.05 + rand(i * 3) * 0.06})`;
    g.fillRect(rand(i * 7) * 1024, rand(i * 11) * 256, 2, 2);
  }
  g.fillStyle = "#F7F1E6";
  for (let i = 0; i < 48; i++) { g.beginPath(); g.arc(i * (1024 / 48) + 10, 52, 5, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = "#F7F1E6"; g.lineWidth = 3;
  for (let i = 0; i < 24; i++) { g.beginPath(); g.arc(i * (1024 / 24) + 21, 96, 14, 0, Math.PI); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
});

const floorTex = memo(() => {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = C.clay700; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = `rgba(${rand(i) > 0.5 ? "30,12,5" : "160,90,60"},${0.05 + rand(i * 5) * 0.08})`;
    g.fillRect(rand(i * 13) * 512, rand(i * 17) * 512, 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(8, 8);
  return t;
});

/** The diya: a lathe-turned clay bowl with a pinched spout, a wick, a frame-driven flame and the light it throws. */
export const Diya: React.FC<{ lit: number; x?: number; z?: number; scale?: number }> = ({ lit, x = 0, z = 0, scale = 1 }) => {
  const f = useCurrentFrame();
  const bowl = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    const prof: [number, number][] = [[0, 0], [0.55, 0.02], [0.85, 0.12], [1.05, 0.3], [1.16, 0.46], [1.2, 0.52], [1.12, 0.52], [1.0, 0.4], [0.7, 0.28], [0, 0.24]];
    prof.forEach(([r, y]) => pts.push(new THREE.Vector2(r, y)));
    const geo = new THREE.LatheGeometry(pts, 96);
    // pinch a spout toward +x
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
      const a = Math.atan2(vz, vx);
      const k = Math.exp(-(a * a) / 0.08) * Math.max(0, vy - 0.15) * 1.6;
      pos.setX(i, vx * (1 + k * 0.55));
      pos.setY(i, vy + k * 0.12);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);
  const flick = 0.9 + 0.08 * Math.sin(f * 0.43) + 0.05 * Math.sin(f * 1.31 + 0.6) + 0.03 * Math.sin(f * 2.7);
  const sway = 0.06 * Math.sin(f * 0.21) + 0.03 * Math.sin(f * 0.77);
  const L = Math.max(0, Math.min(1, lit));
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh geometry={bowl} castShadow receiveShadow>
        <meshStandardMaterial map={clayTex()} roughness={0.85} metalness={0.02} side={THREE.DoubleSide} />
      </mesh>
      {/* oil */}
      <mesh position={[0, 0.36, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.92, 48]} />
        <meshStandardMaterial color="#6b4a12" roughness={0.15} metalness={0.3} emissive="#3a2405" emissiveIntensity={0.4 * L} />
      </mesh>
      {/* wick */}
      <mesh position={[1.12, 0.6, 0]} rotation={[0, 0, -0.6]}>
        <cylinderGeometry args={[0.025, 0.035, 0.28, 8]} />
        <meshStandardMaterial color="#2a1a0c" />
      </mesh>
      {/* flame */}
      <group position={[1.2, 0.72, 0]} rotation={[0, 0, sway]}>
        <sprite scale={[0.36 * L * flick, 0.78 * L * flick, 1]} position={[0, 0.3 * L, 0]}>
          <spriteMaterial map={flameTex()} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={L} />
        </sprite>
        <sprite scale={[2.6 * L * flick, 2.6 * L * flick, 1]} position={[0, 0.25, 0]}>
          <spriteMaterial map={glowTex()} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.55 * L} />
        </sprite>
        <pointLight color="#ffb45a" intensity={9 * L * flick} distance={14} decay={1.6} position={[0, 0.3, 0]} />
      </group>
    </group>
  );
};

/** The floor of the square: clay with a ring of chalk dots (pulli) around the lamp. */
export const Floor: React.FC<{ dots?: number; ringR?: number }> = ({ dots = 1, ringR = 2.4 }) => (
  <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[80, 80]} />
      <meshStandardMaterial map={floorTex()} roughness={0.95} color="#ffffff" />
    </mesh>
    {Array.from({ length: 40 }).map((_, i) => {
      const a = (i / 40) * Math.PI * 2;
      const show = Math.max(0, Math.min(1, dots * 40 - i));
      return (
        <mesh key={i} position={[Math.cos(a) * ringR, 0.012, Math.sin(a) * ringR]} rotation={[-Math.PI / 2, 0, 0]} scale={show}>
          <circleGeometry args={[0.055, 12]} />
          <meshBasicMaterial color={C.chalk} transparent opacity={0.85} />
        </mesh>
      );
    })}
  </group>
);

export type Pose = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov?: number };

/** Places the camera from a pose every frame (never useFrame in a Remotion render). */
export const Cam: React.FC<{ pose: Pose }> = ({ pose }) => {
  const { camera } = useThree();
  const cam = camera as THREE.PerspectiveCamera;
  cam.fov = pose.fov ?? 32;
  cam.aspect = 1920 / 1080;
  cam.position.set(pose.x, pose.y, pose.z);
  cam.lookAt(pose.lx, pose.ly, pose.lz);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  return null;
};

export const lerpPose = (a: Pose, b: Pose, t: number): Pose => ({
  x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t,
  lx: a.lx + (b.lx - a.lx) * t, ly: a.ly + (b.ly - a.ly) * t, lz: a.lz + (b.lz - a.lz) * t,
  fov: (a.fov ?? 32) + ((b.fov ?? 32) - (a.fov ?? 32)) * t,
});
