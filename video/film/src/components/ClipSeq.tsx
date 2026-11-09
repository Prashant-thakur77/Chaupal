import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Note } from "./World";

/** A real capture played as a list of segments: each starts at `at` (scene seconds) from `from` (clip seconds),
 *  optionally sped up (`rate`). Where time is cut or sped up, the segment carries an honest note
 *  ("the agent took 19 s · cut", "sped up ×4"). Used by every product scene, so a long agent wait never plays dead. */
export type Seg = { at: number; from: number; rate?: number; note?: string };

export const ClipSeq: React.FC<{ src: string; segs?: Seg[]; from?: number; w: number; h: number; notes?: boolean; noteStyle?: React.CSSProperties }> = ({ src, segs, from = 0, w, h, notes = true, noteStyle }) => {
  const { fps } = useVideoConfig();
  const list: Seg[] = segs && segs.length ? segs : [{ at: 0, from }];
  return (
    <AbsoluteFill>
      {list.map((s, i) => {
        const a = Math.round(s.at * fps);
        const b = i + 1 < list.length ? Math.round(list[i + 1].at * fps) : undefined;
        return (
          <Sequence key={i} from={a} durationInFrames={b !== undefined ? b - a : undefined} layout="none">
            <OffthreadVideo src={staticFile(src)} trimBefore={Math.round(s.from * fps)} playbackRate={s.rate ?? 1} muted style={{ width: w, height: h, display: "block" }} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

/** The notes for a segment list, placed by the caller (outside any zoomed layer so they stay readable). */
export const SegNotes: React.FC<{ segs?: Seg[]; style?: React.CSSProperties }> = ({ segs, style }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {(segs ?? []).filter((s) => s.note).map((s, i) => (
        <Note key={i} at={Math.round(s.at * fps)} until={Math.round((s.at + 2.6) * fps)} text={s.note!} style={{ right: 40, top: 96, ...style }} />
      ))}
    </>
  );
};
