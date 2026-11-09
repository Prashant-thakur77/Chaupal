import { Eraser } from "lucide-react";
import { useState } from "react";

import { RangoliCanvas } from "@/components/canvas/RangoliCanvas";

import { useActionMutation, type LiveSession } from "../live";
import type { strings } from "../strings";

export const PALETTE = [
  { id: "laal", hex: "#e0473b", hi: "लाल", en: "Red" },
  { id: "peela", hex: "#f6c33b", hi: "पीला", en: "Yellow" },
  { id: "hara", hex: "#43a95e", hi: "हरा", en: "Green" },
  { id: "neela", hex: "#4f7fe0", hi: "नीला", en: "Blue" },
  { id: "gulabi", hex: "#e66ca7", hi: "गुलाबी", en: "Pink" },
  { id: "kesariya", hex: "#f28a2e", hi: "केसरिया", en: "Saffron" },
  { id: "safed", hex: "#f7f1e6", hi: "सफ़ेद", en: "White" },
];

/** Rangoli and kolam: the generated design, her colours, her traced lines. */
export default function RangoliScene(props: { data: LiveSession; t: ReturnType<typeof strings>; lang: string }) {
  const { data, t } = props;
  const [colour, setColour] = useState("peela");
  const addStroke = useActionMutation("add-stroke");
  const report = useActionMutation("report-input-mode");
  const clear = useActionMutation("clear-my-strokes");
  const fill = useActionMutation("fill-region");
  const k = data.kolam;
  const mine = data.strokes.counts.rangoli ?? 0;
  return (
    <div className="ch-activity ch-rangoli">
      <RangoliCanvas
        design={k ? { kind: k.kind, svg: k.svg, regions: k.regions, fills: k.fills, altHi: k.altHi, altEn: k.altEn } : null}
        strokes={data.strokes.rangoli}
        inputMode={data.inputMode}
        palette={PALETTE}
        selectedColour={colour}
        language={props.lang === "en" ? "en" : "hi"}
        onStroke={(points, input) => addStroke.mutate({ layer: "rangoli", points, input })}
        onInputModeReport={(mode) => report.mutate({ mode })}
        onFillRegion={(regionId, c) => {
          setColour(c);
          fill.mutate({ fills: [{ regionId, colour: c }], by: "elder-tap" });
        }}
      />
      {k && mine > 0 ? (
        <div className="ch-activity-tools">
          <button type="button" className="ch-btn ch-btn-quiet" data-testid="erase-mine" onClick={() => clear.mutate({ personConfirmed: true })}>
            <Eraser aria-hidden size={22} /> {t.eraseMine}
          </button>
        </div>
      ) : null}
    </div>
  );
}
