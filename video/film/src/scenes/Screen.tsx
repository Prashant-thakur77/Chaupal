import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";
import { interp, ramp, OUT, INOUT } from "../lib/anim";
import { Band, Chip, Note, Sky } from "../components/World";
import { Pending } from "./TwoCities";
import { ClipSeq, SegNotes } from "../components/ClipSeq";

type Box = { x: number; y: number; w: number; h: number };
type Zoom = { at: number; dur?: number; box: Box; scale?: number };

/** The real product, recorded from the deployed app at tablet size (1366x1024), shown as a lit panel on the dusk floor.
 *  The camera pushes in on what the voice names (boxes are page pixels from the capture log) and comes back.
 *  Optional: his phone view as a picture-in-picture (the greeting arriving on his side), chips, honest notes. */
const PANEL = { x: (1920 - 1366 * 1.0) / 2, y: 28, s: 1.0, w: 1366, h: 1024 };

export const Screen: React.FC<any> = (p) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const at = (s: number) => Math.round(s * fps);
  const W = 1920, H = 1080;
  const zooms: Zoom[] = (p.zooms ?? []).slice().sort((a: Zoom, b: Zoom) => a.at - b.at);
  const kf: { t: number; s: number; x: number; y: number }[] = [{ t: 0, s: 1, x: W / 2, y: H / 2 }];
  const move = Math.round(fps * 0.6);
  zooms.forEach((z, i) => {
    const cx = PANEL.x + (z.box.x + z.box.w / 2) * PANEL.s, cy = PANEL.y + (z.box.y + z.box.h / 2) * PANEL.s;
    const fit = Math.min((W * 0.7) / (z.box.w * PANEL.s), (H * 0.6) / (z.box.h * PANEL.s));
    const s = z.scale ?? Math.max(1.2, Math.min(2.0, fit));
    const x = Math.max(W / (2 * s), Math.min(W - W / (2 * s), cx));
    const y = Math.max(H / (2 * s), Math.min(H - H / (2 * s), cy));
    const t = Math.max(kf[kf.length - 1].t + 2, at(z.at) - move);
    const prev = kf[kf.length - 1];
    kf.push({ t, s: prev.s, x: prev.x, y: prev.y });
    kf.push({ t: t + move, s, x, y });
    const hold = at(z.dur ?? 2.4);
    const next = zooms[i + 1];
    const until = next ? at(next.at) - move : Infinity;
    if (until - (t + move + hold) > fps * 1.2) {
      kf.push({ t: t + move + hold, s, x, y });
      kf.push({ t: t + move * 2 + hold, s: 1, x: W / 2, y: H / 2 });
    }
  });
  const ts = kf.map((k) => k.t);
  const v = (g: (k: (typeof kf)[number]) => number, t: number) => (kf.length > 1 ? interp(t, ts, kf.map(g)) : g(kf[0]));
  const drift = 1 + 0.02 * Math.min(1, f / Math.max(1, p.dur));
  const S = v((k) => k.s, f) * drift;
  const FX = v((k) => k.x, f), FY = v((k) => k.y, f);
  const speed = Math.abs(v((k) => k.s, f + 1) - v((k) => k.s, f)) + (Math.abs(v((k) => k.x, f + 1) - FX) + Math.abs(v((k) => k.y, f + 1) - FY)) / 400;
  const blur = Math.min(2.5, speed * 30);
  const enter = ramp(f, 0, 14);
  return (
    <AbsoluteFill style={{ background: C.night950, overflow: "hidden" }}>
      <Sky glow={{ x: 960, y: 980, r: 1200, i: 0.5 }} floor={0.12} />
      <AbsoluteFill style={{ transformOrigin: "0 0", transform: `translate(${W / 2 - S * FX}px, ${H / 2 - S * FY}px) scale(${S})`, filter: blur > 0.25 ? `blur(${blur}px)` : undefined }}>
        <div style={{ position: "absolute", left: PANEL.x, top: PANEL.y, width: PANEL.w, height: PANEL.h, borderRadius: 24, overflow: "hidden", opacity: enter, boxShadow: "0 30px 90px rgba(0,0,0,.6), 0 0 0 8px #0b0a18, 0 0 160px rgba(244,169,60,.22)" }}>
          {p.src ? <ClipSeq src={p.src} segs={p.segments} from={p.from} w={PANEL.w} h={PANEL.h} /> : <Pending what={p.what ?? "screen capture"} />}
        </div>
      </AbsoluteFill>
      {p.pip && f >= at(p.pip.at) && (
        <div style={{ position: "absolute", right: 56, bottom: 120, width: 300, height: 650, borderRadius: 34, overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,.6), 0 0 0 8px #0b0a18",
          opacity: ramp(f, at(p.pip.at), 10) * (p.pip.until ? 1 - ramp(f, at(p.pip.until), 10) : 1), transform: `translateY(${(1 - interp(f, [at(p.pip.at), at(p.pip.at) + 14], [0, 1], OUT)) * 40}px)` }}>
          <OffthreadVideo src={staticFile(p.pip.src)} trimBefore={Math.round((p.pip.from ?? 0) * fps)} muted style={{ width: 300, height: 650 }} />
        </div>
      )}
      {(p.chips ?? []).map((c: any, i: number) => (
        <div key={i} style={{ position: "absolute", left: c.x ?? 80, top: c.y, bottom: c.y === undefined ? 230 : undefined }}>
          <Chip at={at(c.at)} until={c.until ? at(c.until) : undefined} text={c.text} sub={c.sub} tone={c.tone ?? "accent"} />
        </div>
      ))}
      {(p.notes ?? []).map((n: any, i: number) => (
        <Note key={i} at={at(n.at)} until={n.until ? at(n.until) : undefined} text={n.text} style={{ right: 40, bottom: 250 }} />
      ))}
      <SegNotes segs={p.segments} style={{ top: undefined, bottom: 300 }} />
      <Band />
    </AbsoluteFill>
  );
};
