import { Eraser, Hand } from "lucide-react";

import { SulekhCanvas } from "@/components/canvas/SulekhCanvas";

import { useActionMutation, type LiveSession } from "../live";
import type { strings } from "../strings";

/** Sulekh: the provider-shaped reference faint beneath, her own ink above. */
export default function SulekhScene(props: { data: LiveSession; t: ReturnType<typeof strings>; lang: string }) {
  const { data, t } = props;
  const addStroke = useActionMutation("add-stroke");
  const report = useActionMutation("report-input-mode");
  const clear = useActionMutation("clear-my-strokes");
  const setMode = useActionMutation("set-input-mode");
  const ref = data.calligraphy && data.calligraphy.status === "valid" ? data.calligraphy : null;
  const mine = data.strokes.counts.sulekh ?? 0;
  return (
    <div className="ch-activity ch-sulekh">
      <SulekhCanvas
        reference={ref ? { text: ref.text, svg: ref.svg, altHi: ref.altHi, altEn: ref.altEn, script: ref.script, style: ref.style } : null}
        strokes={data.strokes.sulekh}
        inputMode={data.inputMode}
        language={props.lang === "en" ? "en" : "hi"}
        onStroke={(points, input) => addStroke.mutate({ layer: "sulekh", points, input })}
        onInputModeReport={(mode) => report.mutate({ mode })}
      />
      {ref ? (
        <div className="ch-activity-tools">
          {data.inputMode === "none" ? (
            <button type="button" className="ch-btn ch-btn-quiet" onClick={() => setMode.mutate({ mode: "touch" })} data-testid="touch-draw">
              <Hand aria-hidden size={22} /> {t.touchDraw}
            </button>
          ) : null}
          {mine > 0 ? (
            <button
              type="button"
              className="ch-btn ch-btn-quiet"
              data-testid="erase-mine"
              onClick={() => clear.mutate({ personConfirmed: true })}
            >
              <Eraser aria-hidden size={22} /> {t.eraseMine}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
