import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, FONT, T, LIGHT_MODE } from "../theme";
import { ramp, rand, rise } from "../lib/anim";

/** The film's world: an indigo dusk sky, a clay floor, a few slow stars, and one light source (the diya's glow). */
export const Sky: React.FC<{ glow?: { x: number; y: number; r?: number; i?: number }; floor?: number; stars?: boolean }> = ({ glow, floor = 0.34, stars = true }) => {
  const f = useCurrentFrame();
  const g = glow ?? { x: 960, y: 760, r: 900, i: 0.55 };
  const flick = 1 + 0.05 * Math.sin(f * 0.37) + 0.03 * Math.sin(f * 1.13 + 1.7);
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${T.skyTop} 0%, ${T.skyMid} 38%, ${T.skyLow} ${Math.round((1 - floor) * 100)}%, ${T.floorTop} ${Math.round((1 - floor) * 100) + 6}%, ${T.floorBottom} 100%)` }}>
      {stars && Array.from({ length: 46 }).map((_, i) => {
        const x = rand(i * 3.1) * 1920, y = rand(i * 7.7) * 1080 * (1 - floor) * 0.85;
        const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(f * (0.02 + rand(i) * 0.05) + i));
        return <div key={i} style={{ position: "absolute", left: x, top: y, width: 2 + rand(i * 1.3) * 2, height: 2 + rand(i * 1.3) * 2, borderRadius: 9, background: T.ink, opacity: 0.25 * tw * T.starK }} />;
      })}
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at ${g.x}px ${g.y}px, rgba(${T.glow},${(g.i ?? 0.55) * 0.55 * flick * T.glowK}) 0%, rgba(${T.glowWarm},${(g.i ?? 0.55) * 0.22 * flick * T.glowK}) ${Math.round((g.r ?? 900) * 0.35)}px, rgba(${T.glowWarm},0) ${g.r ?? 900}px)` }} />
      <Grain />
    </AbsoluteFill>
  );
};

/** Clay grain and chalk powder: a turbulence texture re-seeded every other frame so the surface lives. */
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.11 * T.grainK }) => {
  const f = useCurrentFrame();
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity, mixBlendMode: T.grainBlend, pointerEvents: "none" }}>
      <filter id={`grain${Math.floor(f / 2) % 7}`}>
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={Math.floor(f / 2) % 7} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#grain${Math.floor(f / 2) % 7})`} />
    </svg>
  );
};

/** SVG filter that gives any stroke or text a rice-flour chalk edge. Put once inside an <svg>. */
export const ChalkFilter: React.FC<{ id?: string; rough?: number }> = ({ id = "chalk", rough = 2.4 }) => (
  <filter id={id} x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves={2} seed={3} result="n" />
    <feDisplacementMap in="SourceGraphic" in2="n" scale={rough} xChannelSelector="R" yChannelSelector="G" result="d" />
    <feTurbulence type="fractalNoise" baseFrequency="2.2" numOctaves={1} seed={9} result="p" />
    <feColorMatrix in="p" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -1.4 1.25" result="mask" />
    <feComposite in="d" in2="mask" operator="in" />
  </filter>
);

/** Chalk text drawn in: letters fade up left to right like a hand writing on the floor. */
export const ChalkText: React.FC<{ text: string; at: number; size: number; color?: string; font?: string; weight?: number; dur?: number; style?: React.CSSProperties }> = ({ text, at, size, color = T.ink, font = FONT.sans, weight = 600, dur = 18, style }) => {
  const f = useCurrentFrame();
  const chars = Array.from(text);
  return (
    <span style={{ fontFamily: font, fontSize: size, fontWeight: weight, color, filter: "url(#chalk)", whiteSpace: "pre", ...style }}>
      {chars.map((ch, i) => (
        <span key={i} style={{ opacity: ramp(f, at + (i / Math.max(1, chars.length)) * dur, 6) }}>{ch}</span>
      ))}
    </span>
  );
};

/** A chalk-drawn path revealed by progress 0..1 (stroke-dashoffset on pathLength 1). */
export const ChalkPath: React.FC<{ d: string; p: number; width?: number; color?: string; opacity?: number }> = ({ d, p, width = 6, color = T.ink, opacity = 1 }) => (
  <path d={d} pathLength={1} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="1 1" strokeDashoffset={1 - Math.max(0, Math.min(1, p))} filter="url(#chalk)" opacity={opacity} />
);

/** The film's one label: a chip that rises 12 px and fades in. */
export const Chip: React.FC<{ at: number; text: string; sub?: string; tone?: "plain" | "accent" | "good" | "bad" | "label"; until?: number; style?: React.CSSProperties }> = ({ at, text, sub, tone = "plain", until, style }) => {
  const f = useCurrentFrame();
  if (f < at) return null;
  const out = until ? 1 - ramp(f, until, 8) : 1;
  const fg = tone === "accent" ? T.accentText : tone === "good" ? T.good : tone === "bad" ? T.bad : tone === "label" ? (LIGHT_MODE ? C.indigo500 : C.indigo300) : T.ink;
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: 2, padding: "10px 18px", borderRadius: 14, background: T.chipBg, border: `1.5px solid ${tone === "plain" ? T.chipBorder : fg}`, boxShadow: `0 8px 30px ${T.shadow}`, ...rise(f, at), opacity: rise(f, at).opacity * out, ...style }}>
      <span style={{ fontFamily: FONT.sans, fontSize: 30, fontWeight: 600, color: fg, lineHeight: 1.25 }}>{text}</span>
      {sub && <span style={{ fontFamily: FONT.sans, fontSize: 26, fontWeight: 500, color: T.inkMuted, lineHeight: 1.2 }}>{sub}</span>}
    </div>
  );
};

/** Honest small print: what a thing is ("illustrative personas", "typed for the recording"). */
export const Note: React.FC<{ at: number; text: string; until?: number; style?: React.CSSProperties }> = ({ at, text, until, style }) => {
  const f = useCurrentFrame();
  if (f < at) return null;
  const out = until ? 1 - ramp(f, until, 8) : 1;
  return (
    <div style={{ position: "absolute", fontFamily: FONT.sans, fontSize: 28, fontWeight: 500, color: T.inkSoft, padding: "6px 16px", borderRadius: 999, background: T.noteBg, ...rise(f, at), opacity: rise(f, at).opacity * out, ...style }}>{text}</div>
  );
};

/** The band that keeps captions readable over bright footage. */
export const Band: React.FC = () => (
  <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 210, background: LIGHT_MODE ? `linear-gradient(0deg, rgba(${T.band},.5), rgba(${T.band},.22) 50%, rgba(${T.band},0))` : `linear-gradient(0deg, rgba(${T.band},.88), rgba(${T.band},.6) 50%, rgba(${T.band},0))`, pointerEvents: "none" }} />
);
