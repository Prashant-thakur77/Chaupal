import React, { useEffect, useMemo, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT, T } from "../theme";

type W = { text: string; startMs: number; endMs: number };

/** Word-timed captions in chalk: spoken words chalk-white, the word being said in marigold with a small pop, the rest of
 *  the phrase a step down. A phrase ends with its sentence, so nothing hangs into a silence. Off where kinetic type
 *  already says the words. (Burned only in the muted/social copy; the master uploads film.srt instead.) */
export const Captions: React.FC<{ file: string; off?: [number, number][] }> = ({ file, off = [] }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [caps, setCaps] = useState<W[] | null>(null);
  const [h] = useState(() => delayRender("captions"));
  useEffect(() => {
    fetch(staticFile(file)).then((r) => r.json()).then((c) => { setCaps(c); continueRender(h); }).catch(() => continueRender(h));
  }, [file, h]);
  const pages = useMemo(() => {
    const out: W[][] = [];
    let cur: W[] = [];
    for (const w of caps ?? []) {
      const prev = cur[cur.length - 1];
      const chars = cur.reduce((a, x) => a + x.text.length, 0);
      if (prev && (/[.?!:]$/.test(prev.text.trim()) || chars + w.text.length > 52 || w.startMs - prev.endMs > 450 || (/,$/.test(prev.text.trim()) && chars > 28))) {
        out.push(cur);
        cur = [];
      }
      cur.push(w);
    }
    if (cur.length) out.push(cur);
    return out;
  }, [caps]);
  const t = f / fps;
  const ms = t * 1000;
  if (off.some(([a, b]) => t >= a && t < b)) return null;
  const page = pages.find((p) => ms >= p[0].startMs - 40 && ms < p[p.length - 1].endMs + 280);
  if (!page) return null;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 64, pointerEvents: "none" }}>
      <div style={{ maxWidth: 1500, textAlign: "center", fontFamily: FONT.sans, fontWeight: 600, fontSize: 46, lineHeight: 1.2, whiteSpace: "pre-wrap", textShadow: `0 0 14px rgba(${T.textShadow},.95), 0 2px 6px rgba(${T.textShadow},.9)` }}>
        {page.map((k, i) => {
          const now = ms >= k.startMs && ms < k.endMs + 60;
          return (
            <span key={i} style={{ color: now ? T.accentText : ms >= k.startMs ? T.ink : T.inkFaint, display: "inline-block", transform: now ? "scale(1.06)" : undefined }}>
              {i === 0 ? k.text.trimStart() : k.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
