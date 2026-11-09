import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { film } from "./film";
import { C, FONT, loadFonts } from "./theme";
import { Sky, ChalkFilter } from "./components/World";

loadFonts();

/** 1280x720: two real frames of the live app (her tablet view, his phone view) on the dusk floor, the name and four words. */
export const Thumbnail: React.FC = () => {
  const t = (film as any).thumb ?? {};
  return (
    <AbsoluteFill style={{ background: C.night950 }}>
      <svg width={0} height={0} style={{ position: "absolute" }}><defs><ChalkFilter /></defs></svg>
      <div style={{ transform: "scale(0.6667)", transformOrigin: "0 0", width: 1920, height: 1080, position: "absolute" }}>
        <Sky glow={{ x: 1250, y: 620, r: 1000, i: 0.7 }} floor={0.2} />
      </div>
      {t.tablet && <Img src={staticFile(t.tablet)} style={{ position: "absolute", left: 560, top: 110, width: 560, borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,.6), 0 0 0 6px #0b0a18" }} />}
      {t.phone && <Img src={staticFile(t.phone)} style={{ position: "absolute", left: 1040, top: 180, width: 200, borderRadius: 22, boxShadow: "0 20px 60px rgba(0,0,0,.6), 0 0 0 6px #0b0a18" }} />}
      <div style={{ position: "absolute", left: 56, top: 120, width: 520 }}>
        <div style={{ fontFamily: FONT.display, fontSize: 132, color: C.chalk, lineHeight: 1, filter: "url(#chalk)" }}>चौपाल</div>
        <div style={{ fontFamily: FONT.display, fontSize: 66, color: C.marigold400, lineHeight: 1.08, marginTop: 34 }}>One board,<br />two cities</div>
      </div>
      <div style={{ position: "absolute", inset: 10, borderRadius: 26, border: `3px solid ${C.night600}` }} />
    </AbsoluteFill>
  );
};
