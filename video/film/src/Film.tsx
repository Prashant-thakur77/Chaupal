import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { film, type Scene } from "./film";
import { loadFonts, T } from "./theme";
import { INOUT } from "./lib/anim";
import { ChalkFilter } from "./components/World";
import { kolamLoop } from "./components/KolamLoop";
import { Captions } from "./components/Captions";
import { Open } from "./scenes/Open";
import { Stakes } from "./scenes/Stakes";
import { Turn } from "./scenes/Turn";
import { TwoCities } from "./scenes/TwoCities";
import { Screen } from "./scenes/Screen";
import { RangoliReveal } from "./scenes/RangoliReveal";
import { Chabutra } from "./scenes/Chabutra";
import { Proof } from "./scenes/Proof";
import { Recap, Close } from "./scenes/Recap";
import { Telegram } from "./scenes/Telegram";

loadFonts();

const Body: React.FC<{ s: Scene; dur: number }> = ({ s, dur }) => {
  const p = { ...(s as any), dur };
  switch (s.type) {
    case "open": return <Open {...p} />;
    case "stakes": return <Stakes {...p} />;
    case "turn": return <Turn {...p} />;
    case "twocities": return <TwoCities {...p} />;
    case "screen": return <Screen {...p} />;
    case "rangoli": return <RangoliReveal {...p} />;
    case "chabutra": return <Chabutra {...p} />;
    case "proof": return <Proof {...p} />;
    case "recap": return <Recap {...p} />;
    case "close": return <Close {...p} />;
    case "telegram": return <Telegram {...p} />;
    default: return null;
  }
};

const tf = (s: Scene, fps: number) => (!s.transition || s.transition.type === "cut" ? 0 : Math.round((s.transition.dur ?? 0.5) * fps));

export const Film: React.FC = () => {
  const { fps } = useVideoConfig();
  const items: React.ReactNode[] = [];
  film.scenes.forEach((s, i) => {
    const out = i < film.scenes.length - 1 ? tf(s, fps) : 0;
    const dur = Math.round(s.duration * fps);
    items.push(
      <TransitionSeries.Sequence key={s.id} durationInFrames={dur + out} name={`${s.id} ${s.type}`}>
        <AbsoluteFill><Body s={s} dur={dur} /></AbsoluteFill>
      </TransitionSeries.Sequence>,
    );
    if (out > 0) {
      const pres = s.transition!.type === "kolam" ? kolamLoop() : fade();
      items.push(<TransitionSeries.Transition key={`${s.id}-t`} presentation={pres as any} timing={linearTiming({ durationInFrames: out, easing: s.transition!.type === "kolam" ? undefined : INOUT })} />);
    }
  });
  return (
    <AbsoluteFill style={{ backgroundColor: T.bg }}>
      <svg width={0} height={0} style={{ position: "absolute" }}><defs><ChalkFilter /></defs></svg>
      <TransitionSeries>{items}</TransitionSeries>
      {film.captions && <Captions file={film.captions} off={film.captionsOff} />}
    </AbsoluteFill>
  );
};

// Scene i starts at the sum of the previous durations (each sequence is lengthened by its outgoing transition).
export const totalFrames = (fps: number) => film.scenes.reduce((a, s) => a + Math.round(s.duration * fps), 0);
