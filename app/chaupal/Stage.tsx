import { AgentPanel } from "@agent-native/toolkit/app/chat";
import { BookImage, History, Users, X } from "lucide-react";
import { Suspense, useEffect, useState } from "react";

import { LivingDiya, useDiyaPhaseFromAgent } from "@/components/diya/LivingDiya";

import { useActionMutation, useLiveSession } from "./live";
import { ApprovalCard, ChoiceChips, ConflictCard, FamilyPanel, HistoryPanel } from "./Overlays";
import { HomeScene } from "./scenes/HomeScene";
import { LANG_LABELS, speechLang, type Lang } from "./strings";
import { VoiceDock } from "./VoiceDock";

// Scenes load with the stage, so an activity is on her screen the moment it
// opens (a lazily loaded board appeared only after the first move).
import RangoliScene from "./scenes/RangoliScene";
import ShatranjScene from "./scenes/ShatranjScene";
import SulekhScene from "./scenes/SulekhScene";

/**
 * The elder's stage. One action per screen: the activity fills the space,
 * the diya shows what her agent is doing, and the mic is always one tap away.
 * Everything drawn here comes from the live session in SQL, so the family
 * phone and outside agents see exactly the same state.
 */
const PHASE_LABEL: Record<string, { hi: string; en: string }> = {
  ready: { hi: "तैयार", en: "Ready" },
  listening: { hi: "सुन रहा है", en: "Listening" },
  receiving: { hi: "समझ रहा है", en: "Understanding" },
  creating: { hi: "बना रहा है", en: "Making" },
  speaking: { hi: "बोल रहा है", en: "Speaking" },
  awaiting: { hi: "आपका इंतज़ार", en: "Waiting for you" },
};
function chatProps(t: { typeInstead: string }, lang: string) {
  const en = lang === "en";
  return {
    className: "ch-chat",
    chatOnly: true,
    showTabBar: false,
    showModelSelector: false,
    showPageHeader: false,
    dynamicSuggestions: false as const,
    composerPlaceholder: t.typeInstead,
    emptyStateText: en
      ? "Namaste. Say or type what you would like: calligraphy, a rangoli, a kolam, or a game of shatranj."
      : "नमस्ते। बोलिए या लिखिए: सुलेख, रंगोली, कोलम या शतरंज।",
    suggestions: en
      ? ["Write शुभ दीपावली for my grandson", "A small rangoli for the door", "Let's play shatranj, I'm white"]
      : ["पोते को दिवाली पर ‘शुभ दीपावली’ दिखाना है", "दरवाज़े के लिए छोटी सी रंगोली", "शतरंज खेलते हैं, मैं सफ़ेद"],
  };
}

function phaseLabel(phase: string, lang: string) {
  const l = PHASE_LABEL[phase] ?? PHASE_LABEL.ready!;
  return lang === "en" ? l.en : l.hi;
}

export function Stage() {
  const { data, lang, t } = useLiveSession();
  const [listening, setListening] = useState(false);
  const [panel, setPanel] = useState<"none" | "family">("none");
  const [chatOpen, setChatOpen] = useState(false);
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1100px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const choose = useActionMutation("choose-suggestion");
  const dismissConflict = useActionMutation("dismiss-conflict");
  const showHistory = useActionMutation("show-history");
  const setLanguage = useActionMutation("set-language");
  const approve = useActionMutation("answer-family-update", { uiOnly: true });

  const approvalPending = data?.approval?.status === "pending";
  const choicePending = Boolean(data?.pending?.options?.length && !data?.pending?.chosen);
  const phase = useDiyaPhaseFromAgent({
    awaiting: approvalPending || choicePending,
    speaking: false,
    listening,
  });

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = speechLang(lang).slice(0, 2);
  }, [lang]);

  if (!data) {
    return (
      <main className="ch-root ch-stage ch-grain" data-testid="chaupal-stage" data-scene="loading" aria-busy="true">
        <div className="ch-stage-loading">
          <LivingDiya phase="ready" size={140} language={lang === "en" ? "en" : "hi"} />
        </div>
      </main>
    );
  }

  const familyName = data.family[0]?.name ?? null;
  const scene = data.scene;

  return (
    <main
      className="ch-root ch-stage ch-grain"
      data-testid="chaupal-stage"
      data-scene={scene}
      data-revision={data.revision}
      data-language={lang}
      data-presence={phase}
      lang={speechLang(lang).slice(0, 2)}
    >
      <header className="ch-topbar">
        <div className="ch-brand">
          {scene !== "home" ? <LivingDiya phase={phase} size={56} language={lang === "en" ? "en" : "hi"} /> : null}
          <span className="ch-wordmark">{t.appName}</span>
        </div>
        <nav className="ch-topnav" aria-label="Chaupal">
          {data.family.length ? (
            <span className="ch-pill" data-testid="family-present">
              <span className="ch-dot" aria-hidden /> {t.joined(familyName!)}
            </span>
          ) : null}
          <button type="button" className="ch-icon-btn" aria-label={t.family} aria-pressed={panel === "family"} onClick={() => setPanel(panel === "family" ? "none" : "family")}>
            <Users size={24} />
          </button>
          {scene === "shatranj" ? (
            <button
              type="button"
              className="ch-icon-btn"
              aria-label={t.history}
              aria-pressed={data.historyOpen}
              data-testid="history-toggle"
              onClick={() => showHistory.mutate({ open: !data.historyOpen })}
            >
              <History size={24} />
            </button>
          ) : null}
          <a className="ch-icon-btn" href="/album" aria-label={t.album}>
            <BookImage size={24} />
          </a>
          <label className="ch-lang">
            <span className="sr-only">{t.language}</span>
            <select
              value={lang}
              data-testid="language-select"
              onChange={(e) => setLanguage.mutate({ language: e.target.value as Lang })}
            >
              {(Object.keys(LANG_LABELS) as Lang[]).map((l) => (
                <option key={l} value={l}>
                  {LANG_LABELS[l]}
                </option>
              ))}
            </select>
          </label>
        </nav>
      </header>

      <div className="ch-body">
        {wide && scene !== "home" ? (
          <aside className="ch-companion" aria-label={t.chat}>
            <div className="ch-companion-diya">
              <LivingDiya phase={phase} size={150} caption={data.caption} language={lang === "en" ? "en" : "hi"} />
            </div>
            <span className="ch-phase" data-phase={phase}>{phaseLabel(phase, lang)}</span>
            <div className="ch-companion-chat-slot" aria-hidden />
            <VoiceDock
              lang={lang}
              t={t}
              approvalPending={approvalPending}
              onApprove={() => data.approval && approve.mutate({ id: data.approval.id, decision: "approve" })}
              onDecline={() => data.approval && approve.mutate({ id: data.approval.id, decision: "decline" })}
              onListeningChange={setListening}
            />
          </aside>
        ) : null}
        <section className="ch-scene" data-testid={`scene-${scene}`}>
        <Suspense fallback={null}>
          {scene === "home" ? <HomeScene t={t} phase={phase} lang={lang} caption={data.caption} /> : null}
          {scene === "sulekh" ? <SulekhScene data={data} t={t} lang={lang} /> : null}
          {scene === "rangoli" || scene === "kolam" ? <RangoliScene data={data} t={t} lang={lang} /> : null}
          {scene === "shatranj" ? <ShatranjScene data={data} t={t} lang={lang} viewer="elder" /> : null}
        </Suspense>
        {data.historyOpen && data.chess ? (
          <HistoryPanel
            moves={data.chess.moves}
            lang={lang}
            t={t}
            familyName={data.chess.opponent === "family" ? data.chess.opponentName : familyName}
            onClose={() => showHistory.mutate({ open: false })}
          />
        ) : null}
        {panel === "family" ? (
          <FamilyPanel
            family={data.family}
            joinPath={(data.family[0] as { joinPath?: string } | undefined)?.joinPath ?? null}
            t={t}
            onClose={() => setPanel("none")}
          />
        ) : null}
      </section>

      </div>
      <div className="ch-overlays">
        {data.pending ? (
          <ChoiceChips pending={data.pending} t={t} lang={lang} onChoose={(text) => choose.mutate({ text })} />
        ) : null}
        {data.conflict ? (
          <ConflictCard conflict={data.conflict} lang={lang} t={t} onClose={() => dismissConflict.mutate({})} />
        ) : null}
        {data.approval ? (
          <ApprovalCard
            approval={data.approval}
            lang={lang}
            t={t}
            busy={approve.isPending}
            onApprove={() => approve.mutate({ id: data.approval!.id, decision: "approve" })}
            onDecline={() => approve.mutate({ id: data.approval!.id, decision: "decline" })}
          />
        ) : null}
      </div>

      {!wide || scene === "home" ? (
        <VoiceDock
          lang={lang}
          t={t}
          approvalPending={approvalPending}
          onApprove={() => data.approval && approve.mutate({ id: data.approval.id, decision: "approve" })}
          onDecline={() => data.approval && approve.mutate({ id: data.approval.id, decision: "decline" })}
          onListeningChange={setListening}
          chat={{ label: t.chat, open: chatOpen, onToggle: () => setChatOpen((v) => !v) }}
        />
      ) : null}
      <div
        className="ch-chat-host"
        data-mode={wide && scene !== "home" ? "rail" : chatOpen ? "sheet" : "hidden"}
        role={wide && scene !== "home" ? undefined : "dialog"}
        aria-label={t.chat}
      >
        {!(wide && scene !== "home") ? (
          <header>
            {t.chat}
            <button type="button" className="ch-icon-btn" aria-label={t.close} onClick={() => setChatOpen(false)}>
              <X size={22} />
            </button>
          </header>
        ) : null}
        <AgentPanel {...chatProps(t, lang)} />
      </div>
    </main>
  );
}
