import { Chess } from "chess.js";
import { useMemo, useRef } from "react";

import { ShatranjBoard } from "@/components/shatranj/ShatranjBoard";

import { useActionMutation, type LiveSession } from "../live";
import type { strings } from "../strings";

/**
 * Shatranj on one live board. The elder's hand moves and her family member's
 * moves go through the same chess.js rules as the agent's spoken moves; the
 * board reports each finished animation so a waiting move call can return.
 */
export default function ShatranjScene(props: {
  data: LiveSession;
  t: ReturnType<typeof strings>;
  lang: string;
  viewer: "elder" | "family";
}) {
  const { data, t } = props;
  const chess = data.chess;
  const boardMove = useActionMutation("board-move");
  const familyMove = useActionMutation("family-move");
  const ack = useActionMutation("ack-board");
  const acked = useRef(0);

  const myColor: "w" | "b" | null = !chess
    ? null
    : props.viewer === "elder"
      ? chess.elderColor
      : chess.opponent === "family"
        ? chess.elderColor === "w" ? "b" : "w"
        : null;
  const myTurn = Boolean(
    chess && !chess.finished && (props.viewer === "elder" ? chess.turnOwner === "elder" : chess.turnOwner === "family"),
  );
  const legal = useMemo(() => {
    if (!chess || !myTurn) return [];
    try {
      return new Chess(chess.fen).moves({ verbose: true }).map((m) => ({ from: m.from, to: m.to, san: m.san }));
    } catch {
      return [];
    }
  }, [chess?.fen, myTurn]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!chess) return null;
  const last = chess.moves[chess.moves.length - 1] ?? null;
  const opponentLabel = chess.opponent === "family" ? (chess.opponentName ?? t.family) : t.agent;
  const turnText =
    chess.turnOwner === "elder"
      ? props.viewer === "elder" ? t.yourTurn : t.theirTurn(props.lang === "en" ? "Her" : "उनकी")
      : chess.turnOwner === "family"
        ? props.viewer === "family" ? t.yourTurn : t.theirTurn(opponentLabel)
        : t.agentTurn;

  return (
    <div className="ch-activity ch-shatranj" data-testid="shatranj-scene" data-turn-owner={chess.turnOwner ?? ""}>
      <div className="ch-turn" aria-live="polite" data-testid="turn-banner" data-my-turn={myTurn ? "true" : "false"}>
        <span className="ch-dot" aria-hidden data-on={myTurn ? "true" : "false"} /> {turnText}
      </div>
      <div className="ch-board-wrap">
        <ShatranjBoard
          fen={chess.fen}
          orientation={myColor ?? chess.elderColor}
          herColor={chess.elderColor}
          lastMove={last ? { from: last.from, to: last.to, san: last.san, piece: last.piece, captured: last.captured, ply: last.ply, actor: last.actor } : null}
          preview={chess.preview ? { from: chess.preview.from, targets: chess.preview.targets } : null}
          interactive={myTurn}
          movableColor={myTurn ? myColor : null}
          legalMoves={legal}
          moveCount={chess.moves.length}
          language={props.lang === "en" ? "en" : "hi"}
          onMove={async (from, to, via) => {
            if (props.viewer === "family") await familyMove.mutateAsync({ from, to, expectedRevision: data.revision });
            else await boardMove.mutateAsync({ from, to, via, expectedRevision: data.revision });
          }}
          onAnimationComplete={(ply) => {
            if (props.viewer !== "elder" || ply <= acked.current) return;
            acked.current = ply;
            ack.mutate({ gameId: chess.id, ply });
          }}
        />
      </div>
    </div>
  );
}
