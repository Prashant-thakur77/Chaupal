import { LivingDiya, type DiyaPhase } from "@/components/diya/LivingDiya";

import { useActionMutation } from "../live";
import type { strings } from "../strings";

const TILES = ["sulekh", "rangoli", "kolam", "shatranj"] as const;

const GLYPH: Record<(typeof TILES)[number], string> = {
  sulekh: "अ",
  rangoli: "✿",
  kolam: "⁘",
  shatranj: "♞",
};

/** Home: the diya, one question, and four doors she can tap or simply ask for. */
export function HomeScene(props: { t: ReturnType<typeof strings>; phase: DiyaPhase; lang: string; caption: string | null }) {
  const open = useActionMutation("open-activity");
  const { t } = props;
  return (
    <div className="ch-home">
      <div className="ch-home-diya">
        <LivingDiya phase={props.phase} size="fill" caption={props.caption} language={props.lang === "en" ? "en" : "hi"} />
      </div>
      <h1 className="ch-h1 ch-home-q">{t.homeQuestion}</h1>
      <div className="ch-tiles" role="list">
        {TILES.map((k) => (
          <button
            key={k}
            type="button"
            role="listitem"
            className="ch-tile"
            data-testid={`open-${k}`}
            disabled={open.isPending}
            onClick={() => open.mutate({ activity: k })}
          >
            <span className="ch-tile-glyph" aria-hidden>{GLYPH[k]}</span>
            <span className="ch-tile-name">{t[k]}</span>
            <span className="ch-tile-sub">{t[`${k}Sub` as "sulekhSub"]}</span>
          </button>
        ))}
      </div>
      <p className="ch-home-try">
        <span>{t.tryAsk}:</span> {t.sampleSulekh}
      </p>
    </div>
  );
}
