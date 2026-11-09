import React, { useEffect, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT } from "../theme";
import { interp, ramp, rise, OUT, INOUT } from "../lib/anim";
import { Sky } from "../components/World";

/** The rangoli engine's own output (the SVG the app generates, region ids and all), drawn on the clay floor the way it
 *  is made by hand: chalk outline ring by ring from the centre, then the colours settle in like powder. The camera starts
 *  looking down at the floor and tilts up as the design completes. */
const useSvg = (file: string) => {
  const [txt, setTxt] = useState<string | null>(null);
  const [h] = useState(() => delayRender("svg " + file));
  useEffect(() => {
    fetch(staticFile(file)).then((r) => r.text()).then((t) => { setTxt(t); continueRender(h); }).catch(() => continueRender(h));
  }, [file, h]);
  return txt;
};

export const RangoliReveal: React.FC<any> = (p) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const D: number = p.dur;
  const outline = useSvg(p.outline ?? "svg/rangoli-uncoloured.svg");
  const filled = useSvg(p.filled ?? "svg/rangoli-filled.svg");
  const ref = useRef<HTMLDivElement>(null);
  const draw = interp(f, [6, D * 0.62], [0, 1], OUT);
  const colour = interp(f, [D * 0.55, D * 0.85], [0, 1], OUT);
  // per-path stroke reveal, staggered from the centre outward (paths are in ring order in the engine's SVG)
  useEffect(() => {
    const root = ref.current?.querySelector("svg");
    if (!root) return;
    const paths = Array.from(root.querySelectorAll("path"));
    paths.forEach((el, i) => {
      const k = Math.max(0, Math.min(1, draw * 1.35 - (i / paths.length) * 0.35));
      el.setAttribute("pathLength", "1");
      el.setAttribute("stroke-dasharray", "1 1");
      el.setAttribute("stroke-dashoffset", String(1 - k));
      el.setAttribute("stroke", C.chalk);
      el.setAttribute("stroke-width", "3");
      el.setAttribute("fill", "none");
    });
  });
  const tilt = interp(f, [0, D], [58, 8], INOUT);
  const scale = interp(f, [0, D], [0.9, 1.08], INOUT);
  return (
    <AbsoluteFill>
      <Sky glow={{ x: 960, y: 560, r: 900, i: 0.55 }} floor={0.62} stars />
      <AbsoluteFill style={{ perspective: 1400, alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "relative", width: 860, height: 860, transform: `rotateX(${tilt}deg) scale(${scale})`, transformOrigin: "50% 60%" }}>
          <div style={{ position: "absolute", inset: -40, borderRadius: 30, background: `radial-gradient(circle, ${C.clay700} 0%, ${C.clay800} 75%, rgba(58,26,12,0) 100%)` }} />
          <div ref={ref} style={{ position: "absolute", inset: 0, filter: "url(#chalk)" }} dangerouslySetInnerHTML={{ __html: (outline ?? "").replace(/<svg /, '<svg width="860" height="860" ') }} />
          <div style={{ position: "absolute", inset: 0, opacity: colour, filter: "url(#chalk)" }} dangerouslySetInnerHTML={{ __html: (filled ?? "").replace(/<svg /, '<svg width="860" height="860" ') }} />
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 90, top: 90, ...rise(f, 10) }}>
        <div style={{ fontFamily: FONT.display, fontSize: 86, color: C.chalk }}>रंगोली</div>
        <div style={{ fontFamily: FONT.sans, fontSize: 32, color: C.muted }}>drawn by the app's rangoli generator</div>
      </div>
      <div style={{ position: "absolute", right: 90, top: 110, textAlign: "right", ...rise(f, Math.round(D * 0.55)) }}>
        <div style={{ fontFamily: FONT.sans, fontSize: 30, color: C.chalkSoft }}>{p.caption ?? "8 petals · 4 rings · 8-fold symmetry"}</div>
      </div>
    </AbsoluteFill>
  );
};
