import { Check, Copy, History, Send, Users, X } from "lucide-react";
import { useEffect, useState } from "react";

import type { LiveMove, LiveSession } from "./live";
import type { strings } from "./strings";

type T = ReturnType<typeof strings>;

const PIECE_HI: Record<string, string> = { k: "राजा", q: "वज़ीर", b: "ऊँट", n: "घोड़ा", r: "हाथी", p: "प्यादा" };
const PIECE_EN: Record<string, string> = { k: "King", q: "Queen", b: "Bishop", n: "Knight", r: "Rook", p: "Pawn" };

/** 1–3 phrase choices she can tap; nothing is chosen for her. */
export function ChoiceChips(props: {
  pending: NonNullable<LiveSession["pending"]>;
  t: T;
  lang: string;
  onChoose: (text: string) => void;
}) {
  const options = props.pending.options ?? [];
  if (!options.length || props.pending.chosen) return null;
  return (
    <section className="ch-choices" aria-label={props.t.chooseOne} data-testid="phrase-choices">
      <p className="ch-choices-q">{props.pending.question || props.t.chooseOne}</p>
      <div className="ch-choices-row">
        {options.map((o) => (
          <button
            key={o.text}
            type="button"
            className="ch-choice"
            data-testid={`choose-phrase-${o.text}`}
            onClick={() => props.onChoose(o.text)}
          >
            <span className="ch-choice-text" lang="hi">{o.text}</span>
            {(props.lang === "en" ? o.meaningEn : o.meaningHi) ? (
              <span className="ch-choice-meaning">{props.lang === "en" ? o.meaningEn : o.meaningHi}</span>
            ) : null}
          </button>
        ))}
      </div>
    </section>
  );
}

/** Two people acted at once: nothing was overwritten, and she sees who was first. */
export function ConflictCard(props: { conflict: NonNullable<LiveSession["conflict"]>; lang: string; t: T; onClose: () => void }) {
  const msg = props.lang === "en" ? props.conflict.messageEn : props.conflict.messageHi;
  return (
    <div className="ch-card ch-conflict" role="status" aria-live="polite" data-testid="conflict-card">
      <div className="ch-card-glyph" aria-hidden>
        <Users size={28} />
      </div>
      <div className="ch-card-body">
        <p className="ch-card-title">{msg}</p>
        <p className="ch-card-sub">
          {props.conflict.move.san} · {props.conflict.move.from} → {props.conflict.move.to}
        </p>
      </div>
      <button type="button" className="ch-btn ch-btn-quiet" onClick={props.onClose} data-testid="conflict-ok">
        {props.t.ok}
      </button>
    </div>
  );
}

/** Anything leaving the house waits for her own "haan" here. */
export function ApprovalCard(props: {
  approval: NonNullable<LiveSession["approval"]>;
  lang: string;
  t: T;
  onApprove: () => void;
  onDecline: () => void;
  busy?: boolean;
}) {
  const a = props.approval;
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    setHidden(false);
    if (a.status === "pending") return;
    const id = setTimeout(() => setHidden(true), 8000);
    return () => clearTimeout(id);
  }, [a.id, a.status]);
  if (a.status !== "pending" && hidden) return null;
  if (a.status !== "pending") {
    return (
      <div className="ch-card ch-approval-done" role="status" aria-live="polite" data-testid="approval-result" data-status={a.status}>
        <div className="ch-card-glyph" aria-hidden>{a.status === "sent" ? <Check size={28} /> : <X size={28} />}</div>
        <p className="ch-card-title">{a.status === "sent" ? props.t.sent : props.t.notSent}</p>
      </div>
    );
  }
  return (
    <div
      className="ch-card ch-approval"
      role="alertdialog"
      aria-modal="false"
      aria-labelledby="ch-approval-title"
      data-testid="approval-card"
      data-approval-pending="true"
    >
      {a.imagePath ? <img className="ch-approval-img" src={a.imagePath} alt="" /> : null}
      <div className="ch-card-body">
        <p id="ch-approval-title" className="ch-card-title">{props.t.approvalTitle}</p>
        <p className="ch-approval-msg" lang={props.lang === "en" ? "en" : "hi"}>
          {props.lang === "en" ? a.captionEn : a.captionHi}
        </p>
        <p className="ch-card-sub">{props.t.approvalBody}</p>
      </div>
      <div className="ch-approval-actions">
        <button type="button" className="ch-btn ch-btn-accent" disabled={props.busy} onClick={props.onApprove} data-testid="approve-send">
          <Send aria-hidden size={22} /> {props.t.yesSend}
        </button>
        <button type="button" className="ch-btn ch-btn-quiet" disabled={props.busy} onClick={props.onDecline} data-testid="decline-send">
          {props.t.noDont}
        </button>
      </div>
    </div>
  );
}

export function moveLine(m: LiveMove, lang: string, names: { elder: string; agent: string; family: string }) {
  const who = m.actor === "elder" ? names.elder : m.actor === "family" ? names.family : names.agent;
  const piece = lang === "en" ? PIECE_EN[m.piece] : PIECE_HI[m.piece];
  const cap = m.captured ? (lang === "en" ? ` × ${PIECE_EN[m.captured]}` : ` × ${PIECE_HI[m.captured]}`) : "";
  return { who, text: `${piece} ${m.from}→${m.to}${cap}` };
}

/** The game record, readable: who moved what, in her language. */
export function HistoryPanel(props: {
  moves: LiveMove[];
  lang: string;
  t: T;
  familyName: string | null;
  onClose: () => void;
}) {
  const names = { elder: props.t.you, agent: props.t.agent, family: props.familyName ?? props.t.family };
  return (
    <aside className="ch-history" aria-label={props.t.history} data-testid="history-panel" data-history-open="true">
      <header className="ch-history-head">
        <History aria-hidden size={22} />
        <h2>{props.t.history}</h2>
        <button type="button" className="ch-icon-btn" aria-label={props.t.close} onClick={props.onClose}>
          <X size={22} />
        </button>
      </header>
      {props.moves.length === 0 ? (
        <p className="ch-history-empty">{props.t.noMoves}</p>
      ) : (
        <ol className="ch-history-list">
          {props.moves.map((m) => {
            const line = moveLine(m, props.lang, names);
            return (
              <li key={m.ply} data-actor={m.actor}>
                <span className="ch-history-ply">{Math.ceil(m.ply / 2)}.</span>
                <span className="ch-history-who">{line.who}</span>
                <span className="ch-history-move">{line.text}</span>
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
}

/** The invite: a link to open on the family member's phone, and who is here. */
export function FamilyPanel(props: {
  family: LiveSession["family"];
  joinPath: string | null;
  t: T;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const url = props.joinPath && typeof window !== "undefined" ? `${window.location.origin}${props.joinPath}` : null;
  return (
    <aside className="ch-family" aria-label={props.t.family} data-testid="family-panel">
      <header className="ch-history-head">
        <Users aria-hidden size={22} />
        <h2>{props.t.family}</h2>
        <button type="button" className="ch-icon-btn" aria-label={props.t.close} onClick={props.onClose}>
          <X size={22} />
        </button>
      </header>
      {props.family.map((f) => (
        <p key={f.id} className="ch-family-member" data-testid="family-member">
          <span className="ch-dot" aria-hidden /> {props.t.joined(f.name)}
          {f.relation ? <span className="ch-card-sub"> · {f.relation}</span> : null}
        </p>
      ))}
      {url ? (
        <div className="ch-family-link">
          <p className="ch-card-sub">{props.t.familyLink}</p>
          <code data-testid="family-link">{url}</code>
          <button
            type="button"
            className="ch-btn ch-btn-quiet"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            <Copy aria-hidden size={20} /> {copied ? props.t.copied : props.t.copy}
          </button>
        </div>
      ) : null}
    </aside>
  );
}
