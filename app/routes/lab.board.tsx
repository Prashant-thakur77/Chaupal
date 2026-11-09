import { Chess } from "chess.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";

import {
  ShatranjBoard,
  type Move,
} from "@/components/shatranj/ShatranjBoard";

export function meta() {
  return [{ title: "Chaupal · board lab" }];
}

export function links() {
  return [
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    {
      rel: "preconnect",
      href: "https://fonts.gstatic.com",
      crossOrigin: "anonymous" as const,
    },
    {
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Mukta:wght@400;600;700;800&family=Tiro+Devanagari+Hindi&display=swap",
    },
  ];
}

type Actor = NonNullable<Move["actor"]>;

function useLabGame() {
  const chessRef = useRef(new Chess());
  const [fen, setFen] = useState(() => chessRef.current.fen());
  const [lastMove, setLastMove] = useState<Move | null>(null);

  const play = useCallback(
    (from: string, to: string, actor: Actor) => {
      const chess = chessRef.current;
      try {
        const move = chess.move({ from, to, promotion: "q" });
        setFen(chess.fen());
        setLastMove({
          from: move.from,
          to: move.to,
          san: move.san,
          piece: move.piece,
          captured: move.captured ?? null,
          ply: chess.history().length,
          actor,
        });
        return true;
      } catch {
        return false;
      }
    },
    [],
  );

  const load = useCallback((moves: string[]) => {
    const chess = new Chess();
    let last: Move | null = null;
    for (const san of moves) {
      const move = chess.move(san);
      last = {
        from: move.from,
        to: move.to,
        san: move.san,
        piece: move.piece,
        captured: move.captured ?? null,
        ply: chess.history().length,
        actor: "elder",
      };
    }
    chessRef.current = chess;
    setFen(chess.fen());
    setLastMove(last);
  }, []);

  const legalMoves = useMemo(() => {
    const chess = new Chess(fen);
    return chess
      .moves({ verbose: true })
      .map((move) => ({ from: move.from, to: move.to, san: move.san }));
  }, [fen]);

  const turn = fen.split(" ")[1] as "w" | "b";
  const moveCount = useMemo(() => new Chess(fen).history().length, [fen]);
  return {
    fen,
    lastMove,
    legalMoves,
    turn,
    play,
    load,
    plies: lastMove?.ply ?? moveCount,
  };
}

const BUTTON =
  "min-h-12 rounded-full border border-[#3a345f] bg-[#221e40] px-4 text-[15px] font-semibold text-[#f7f1e6] transition hover:border-[#bcaa8e] active:scale-[0.98] disabled:opacity-40";

export default function BoardLabRoute() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [params] = useSearchParams();
  const rendererParam = params.get("renderer") === "dom" ? "dom" : "auto";
  const game = useLabGame();
  const [orientation, setOrientation] = useState<"w" | "b">("w");
  const [language, setLanguage] = useState<"hi" | "en">(
    params.get("lang") === "en" ? "en" : "hi",
  );
  const [preview, setPreview] = useState<{
    from: string;
    targets: string[];
  } | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const note = useCallback((line: string) => {
    setLog((current) => [line, ...current].slice(0, 6));
  }, []);

  const onMove = useCallback(
    (from: string, to: string, via: "drag" | "tap") => {
      setPreview(null);
      const ok = game.play(from, to, "elder");
      note(`onMove ${from}→${to} via ${via}${ok ? "" : " (illegal)"}`);
      if (!ok) throw new Error("illegal move");
    },
    [game, note],
  );

  const onAnimationComplete = useCallback(
    (ply: number) => note(`animation complete · ply ${ply}`),
    [note],
  );

  const captureSequence = () => {
    setPreview(null);
    game.load(["e4", "d5"]);
    window.setTimeout(() => game.play("e4", "d5", "elder"), 1100);
    window.setTimeout(() => game.play("d8", "d5", "agent"), 2600);
  };

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-auto bg-[#15132b] text-[#f7f1e6]"
      style={{ fontFamily: '"Mukta", system-ui, sans-serif' }}
    >
      <div className="mx-auto flex min-h-full max-w-[1400px] flex-col items-center gap-5 px-3 py-4 lg:flex-row lg:items-center lg:justify-center lg:gap-10 lg:px-8">
        <div className="w-[min(100%,calc(100svh-15rem),56rem)] min-w-[18rem] lg:w-[min(calc(100svh-4rem),62vw,60rem)]">
          <ShatranjBoard
            fen={game.fen}
            orientation={orientation}
            lastMove={game.lastMove}
            preview={preview}
            interactive
            movableColor={game.turn}
            legalMoves={game.legalMoves}
            onMove={onMove}
            onAnimationComplete={onAnimationComplete}
            language={language}
            moveCount={game.plies}
            renderer={rendererParam}
          />
        </div>
        <aside className="flex w-full max-w-[26rem] flex-col gap-3">
          <h1 className="text-[26px] leading-tight font-semibold">
            {language === "hi" ? "शतरंज · प्रयोगशाला" : "Shatranj · board lab"}
          </h1>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={BUTTON}
              data-testid="lab-e2e4"
              onClick={() => {
                setPreview(null);
                if (game.play("e2", "e4", "elder")) note("lab e2→e4");
              }}
            >
              e2e4
            </button>
            <button
              type="button"
              className={BUTTON}
              data-testid="lab-e7e5"
              onClick={() => {
                setPreview(null);
                if (game.play("e7", "e5", "agent")) note("agent e7→e5");
              }}
            >
              {language === "hi" ? "एजेंट: e7e5" : "Agent: e7e5"}
            </button>
            <button
              type="button"
              className={BUTTON}
              data-testid="lab-capture"
              onClick={captureSequence}
            >
              {language === "hi" ? "कटाई क्रम" : "Capture sequence"}
            </button>
            <button
              type="button"
              className={BUTTON}
              data-testid="lab-preview"
              onClick={() =>
                setPreview((current) =>
                  current ? null : { from: "b1", targets: ["a3", "c3"] },
                )
              }
            >
              {language === "hi" ? "घोड़ा b1 दिखाएँ" : "Preview Nb1"}
            </button>
            <button
              type="button"
              className={BUTTON}
              data-testid="lab-flip"
              onClick={() =>
                setOrientation((current) => (current === "w" ? "b" : "w"))
              }
            >
              {language === "hi" ? "बिसात पलटें" : "Flip"}
            </button>
            <button
              type="button"
              className={BUTTON}
              data-testid="lab-language"
              onClick={() =>
                setLanguage((current) => (current === "hi" ? "en" : "hi"))
              }
            >
              {language === "hi" ? "English" : "हिन्दी"}
            </button>
            <button
              type="button"
              className={BUTTON}
              data-testid="lab-reset"
              onClick={() => {
                setPreview(null);
                game.load([]);
              }}
            >
              {language === "hi" ? "फिर से" : "Reset"}
            </button>
          </div>
          <ol
            className="min-h-[7rem] space-y-1 text-[15px] text-[#bcaa8e]"
            data-testid="lab-log"
          >
            {log.map((line, index) => (
              <li key={`${index}-${line}`}>{line}</li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}
