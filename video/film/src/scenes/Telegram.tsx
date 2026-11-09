import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT, T } from "../theme";
import { interp, ramp, rise, OUT } from "../lib/anim";
import { Band, Note, Sky } from "../components/World";
import { ClipSeq, SegNotes } from "../components/ClipSeq";
import { Pending } from "./TwoCities";

/** Her "हाँ" and the real delivery. Left: her screen (real capture): the approval card with the picture, her tap, the
 *  sent state. Right: what was actually sent, the same picture and caption, under a proof line built from the API's
 *  own reply (message id, time). No Telegram app UI is drawn and no branding is used. If the owner records the
 *  Telegram chat on his phone (video/footage/telegram-phone.mp4), that real recording replaces the card. */
const PANEL = { x: 60, y: 120, s: 0.74, w: 1366, h: 1024 };

export const Telegram: React.FC<any> = (p) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const at = (s: number) => Math.round(s * fps);
  const res = at(p.resultAt ?? 3);
  const cardIn = interp(f, [res - 4, res + 12], [0, 1], OUT);
  const drift = 1 + 0.03 * Math.min(1, f / Math.max(1, p.dur));
  return (
    <AbsoluteFill style={{ background: T.bg }}>
      <Sky glow={{ x: 700, y: 900, r: 1200, i: 0.4 }} floor={0.14} stars={false} />
      <AbsoluteFill style={{ transform: `scale(${drift})`, transformOrigin: "30% 50%" }}>
        <div style={{ position: "absolute", left: PANEL.x, top: PANEL.y, width: PANEL.w * PANEL.s, height: PANEL.h * PANEL.s, borderRadius: 22, overflow: "hidden",
          boxShadow: `0 18px 48px ${T.shadow}, 0 0 0 8px ${T.frame}`, opacity: ramp(f, 0, 12) }}>
          {p.src ? <ClipSeq src={p.src} segs={p.segments} w={PANEL.w * PANEL.s} h={PANEL.h * PANEL.s} /> : <Pending what={p.what ?? "telegram capture"} />}
        </div>
      </AbsoluteFill>
      {/* the other end: the user's own phone recording if supplied, else the exact picture and caption that were sent */}
      <div style={{ position: "absolute", left: 1150, top: p.phoneRec ? 60 : 150, width: 680, opacity: cardIn, transform: `translateY(${(1 - cardIn) * 18}px)` }}>
        {p.phoneRec ? (
          <div>
            <div style={{ width: 288, height: 640, borderRadius: 36, overflow: "hidden", boxShadow: `0 18px 48px ${T.shadow}, 0 0 0 8px ${T.frame}` }}>
              <Sequence from={res - 4} layout="none">
                <OffthreadVideo src={staticFile(p.phoneRec)} muted style={{ width: 288, height: 640, objectFit: "cover", display: "block" }} />
              </Sequence>
            </div>
            <div style={{ fontFamily: FONT.sans, fontSize: 26, color: T.inkMuted, marginTop: 14, width: 560 }}>{p.phoneLabel}</div>
          </div>
        ) : (
          <div style={{ background: T.chipBg, border: `1.5px solid ${T.chipBorder}`, borderRadius: 24, padding: 26, boxShadow: `0 18px 48px ${T.shadow}` }}>
            <div style={{ fontFamily: FONT.sans, fontSize: 28, fontWeight: 600, color: T.inkMuted, marginBottom: 14 }}>what was sent to the family chat</div>
            {p.picture && <Img src={staticFile(p.picture)} style={{ width: 360, height: 360, borderRadius: 16, display: "block", background: T.bg }} />}
            {p.captionHi && <div style={{ fontFamily: FONT.display, fontSize: 40, color: T.ink, marginTop: 18, lineHeight: 1.2 }}>{p.captionHi}</div>}
            {p.captionEn && <div style={{ fontFamily: FONT.sans, fontSize: 28, color: T.inkSoft, marginTop: 4 }}>{p.captionEn}</div>}
          </div>
        )}
        {p.proof && (
          <div style={{ marginTop: 22, ...rise(f, res + 8) }}>
            <span style={{ display: "inline-block", fontFamily: FONT.sans, fontSize: 28, fontWeight: 600, color: T.onAccent, background: T.accent, padding: "10px 18px", borderRadius: 14, lineHeight: 1.3 }}>{p.proof}</span>
            <div style={{ fontFamily: FONT.sans, fontSize: 26, color: T.inkMuted, marginTop: 10, width: 680 }}>{p.proofSub ?? "from the Telegram Bot API reply to this send"}</div>
          </div>
        )}
      </div>
      {(p.notes ?? []).map((n: any, i: number) => (
        <Note key={i} at={at(n.at)} until={n.until ? at(n.until) : undefined} text={n.text} style={{ left: 60, bottom: 250 }} />
      ))}
      <SegNotes segs={p.segments} style={{ top: undefined, bottom: 300, right: undefined, left: 60 }} />
      <Band />
    </AbsoluteFill>
  );
};
