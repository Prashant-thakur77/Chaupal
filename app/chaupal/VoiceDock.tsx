import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import { useLiveTranscription } from "@agent-native/core/client/transcription/use-live-transcription";
import { Keyboard, MessageCircle, Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { speechLang } from "./strings";

const YES = /^(हाँ|हां|हा|haan|han|haa|ha|ji haan|जी हाँ|हाँ जी|bhej do|भेज दो|भेजो|yes|ਹਾਂ|ஆம்|हो|হ্যাঁ)/i;
const NO = /^(नहीं|नही|mat|मत|ruko|रुको|na|nahi|nahin|no|don'?t|ਨਾ|வேண்டாம்|नको|না)/i;

/**
 * The elder's voice: a large mic that listens in her language (browser speech
 * recognition, no audio leaves the device through Chaupal) and hands the words
 * to her agent. A plain "haan" or "mat bhejo" answers a pending family-update
 * card directly, because only her own UI may approve what leaves the house.
 */
export function VoiceDock(props: {
  lang: string;
  t: { speak: string; listening: string; tapToSpeak: string; typeInstead: string };
  approvalPending: boolean;
  onApprove: () => void;
  onDecline: () => void;
  onListeningChange?: (listening: boolean) => void;
  /** The conversation sheet toggle, shown in the dock on narrow screens. */
  chat?: { label: string; open: boolean; onToggle: () => void };
}) {
  const stt = useLiveTranscription({ lang: speechLang(props.lang) });
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const [heard, setHeard] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    props.onListeningChange?.(stt.isActive);
  }, [stt.isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  function deliver(raw: string) {
    const said = raw.trim();
    if (!said) return;
    setHeard(said);
    if (props.approvalPending) {
      if (YES.test(said)) return props.onApprove();
      if (NO.test(said)) return props.onDecline();
    }
    sendToAgentChat({ message: said, submit: true, openSidebar: true });
  }

  async function toggleMic() {
    if (!stt.supported) {
      setTyping(true);
      setTimeout(() => inputRef.current?.focus(), 30);
      return;
    }
    if (stt.isActive) {
      deliver(await stt.stopAndWait(1500));
    } else {
      setHeard(null);
      stt.start();
    }
  }

  return (
    <div className="ch-dock" data-testid="voice-dock" data-typing={typing ? "true" : "false"}>
      {heard || stt.isActive ? (
        <p className="ch-dock-heard" aria-live="polite" lang={speechLang(props.lang)}>
          {stt.isActive ? stt.transcript + (stt.interimText ? ` ${stt.interimText}` : "") || props.t.listening : `“${heard}”`}
        </p>
      ) : (
        <p className="ch-dock-hint">{props.t.tapToSpeak}</p>
      )}
      <div className="ch-dock-row">
        <button
          type="button"
          className="ch-mic"
          data-active={stt.isActive ? "true" : "false"}
          aria-pressed={stt.isActive}
          aria-label={stt.isActive ? props.t.listening : props.t.speak}
          data-testid="mic-button"
          onClick={toggleMic}
        >
          {stt.isActive ? <Square aria-hidden size={34} /> : <Mic aria-hidden size={38} />}
          <span>{stt.isActive ? props.t.listening : props.t.speak}</span>
        </button>
        <button
          type="button"
          className="ch-dock-type"
          aria-label={props.t.typeInstead}
          aria-expanded={typing}
          onClick={() => {
            setTyping((v) => !v);
            setTimeout(() => inputRef.current?.focus(), 30);
          }}
        >
          <Keyboard aria-hidden size={26} />
        </button>
        {props.chat ? (
          <button
            type="button"
            className="ch-dock-type"
            aria-label={props.chat.label}
            aria-expanded={props.chat.open}
            data-testid="chat-toggle"
            onClick={props.chat.onToggle}
          >
            <MessageCircle aria-hidden size={26} />
          </button>
        ) : null}
      </div>
      {typing ? (
        <form
          className="ch-dock-form"
          onSubmit={(e) => {
            e.preventDefault();
            deliver(text);
            setText("");
          }}
        >
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={props.t.typeInstead}
            aria-label={props.t.typeInstead}
            lang={speechLang(props.lang)}
            data-testid="say-input"
          />
          <button type="submit" data-testid="say-submit" aria-label={props.lang === "en" ? "Send" : "भेजें"}>↵</button>
        </form>
      ) : null}
    </div>
  );
}
