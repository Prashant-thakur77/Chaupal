/**
 * Chaupal's own interface strings. Hindi and English cover the whole UI;
 * Punjabi, Tamil, Marathi and Bengali cover the activity strings an elder
 * hears and reads most (activity names, status lines, the main prompts).
 * Missing keys fall back to Hindi, then English.
 */
export type Lang = "hi" | "en" | "pa" | "ta" | "mr" | "bn";

const en = {
  appName: "Chaupal",
  tagline: "Speak. The board moves. Your family is right there.",
  welcomeTitle: "The village square, on your screen",
  welcomeBody:
    "Say what you would like to do. Your agent writes calligraphy for you to trace, draws a rangoli to colour, and plays shatranj with you, while family far away sits at the same board.",
  start: "Start",
  startHint: "No account needed. Nothing is recorded.",
  speak: "Speak",
  listening: "Listening…",
  tapToSpeak: "Tap and speak in your language",
  typeInstead: "Type instead",
  homeQuestion: "What shall we do today?",
  sulekh: "Sulekh",
  sulekhSub: "Calligraphy to trace",
  rangoli: "Rangoli",
  rangoliSub: "Draw and colour",
  kolam: "Kolam",
  kolamSub: "Dots and one line",
  shatranj: "Shatranj",
  shatranjSub: "Chess with Hindi pieces",
  tryAsk: "Try saying",
  sampleSulekh: "“Pote ko Diwali par ‘शुभ दीपावली’ dikhana hai”",
  sampleRangoli: "“Darwaze ke liye chhoti si rangoli”",
  sampleShatranj: "“Shatranj kholo, main safed”",
  yourTurn: "Your turn",
  theirTurn: (name: string) => `${name}'s turn`,
  agentTurn: "Agent's turn",
  history: "Moves so far",
  noMoves: "No moves yet",
  close: "Close",
  album: "Album",
  home: "Home",
  family: "Family",
  inviteFamily: "Invite family",
  joined: (name: string) => `${name} is here`,
  familyLink: "Open this link on their phone",
  copy: "Copy link",
  copied: "Copied",
  movedFirst: "moved first",
  ok: "OK",
  approvalTitle: "Send this to the family?",
  approvalBody: "Only this picture and message will be sent.",
  yesSend: "Yes, send it",
  noDont: "Don't send",
  sent: "Sent to the family",
  notSent: "Not sent",
  chooseOne: "Choose one",
  eraseMine: "Erase only my lines",
  touchDraw: "Draw with finger",
  fill: "Fill colour",
  trace: "Trace lines",
  colours: "Colours",
  saved: "Saved to album",
  save: "Save to album",
  chat: "Conversation",
  you: "You",
  agent: "Agent",
  elder: "You",
  language: "भाषा / Language",
  proof: "Proof",
  watching: "Watching live",
  playYourSide: "Your side is ready: drag a piece",
  familyHint: (name: string) => `You are at ${name}'s board. Moves appear on both screens.`,
  waitingFor: (name: string) => `Waiting for ${name}`,
  linkExpired: "This link is not active any more. Ask for a new one.",
  noActivity: "Nothing is open yet. When she starts an activity, it appears here live.",
};

type Dict = { [K in keyof typeof en]: (typeof en)[K] };

const hi: Dict = {
  appName: "चौपाल",
  tagline: "आप बोलिए। मोहरा चलेगा। परिवार साथ बैठा है।",
  welcomeTitle: "गाँव की चौपाल, आपकी स्क्रीन पर",
  welcomeBody:
    "बस बोलिए कि क्या करना है। आपका साथी आपके लिए सुलेख लिखता है जिसे आप दोहराएँ, रंगोली बनाता है जिसमें आप रंग भरें, और आपके साथ शतरंज खेलता है, जबकि दूर बैठा परिवार उसी बिसात पर साथ होता है।",
  start: "शुरू करें",
  startHint: "कोई खाता नहीं चाहिए। कुछ रिकॉर्ड नहीं होता।",
  speak: "बोलिए",
  listening: "सुन रहा हूँ…",
  tapToSpeak: "दबाइए और अपनी भाषा में बोलिए",
  typeInstead: "लिखकर बताइए",
  homeQuestion: "आज क्या करें?",
  sulekh: "सुलेख",
  sulekhSub: "दोहराने के लिए सुंदर लिखावट",
  rangoli: "रंगोली",
  rangoliSub: "रेखा खींचें, रंग भरें",
  kolam: "कोलम",
  kolamSub: "बिंदु और एक ही रेखा",
  shatranj: "शतरंज",
  shatranjSub: "हिंदी मोहरों के साथ",
  tryAsk: "ऐसे कहिए",
  sampleSulekh: "“पोते को दिवाली पर ‘शुभ दीपावली’ दिखाना है”",
  sampleRangoli: "“दरवाज़े के लिए छोटी सी रंगोली”",
  sampleShatranj: "“शतरंज खोलो, मैं सफ़ेद”",
  yourTurn: "आपकी चाल",
  theirTurn: (name: string) => `${name} की चाल`,
  agentTurn: "साथी की चाल",
  history: "अब तक की चालें",
  noMoves: "अभी कोई चाल नहीं",
  close: "बंद करें",
  album: "एल्बम",
  home: "घर",
  family: "परिवार",
  inviteFamily: "परिवार को बुलाएँ",
  joined: (name: string) => `${name} जुड़ गए`,
  familyLink: "यह लिंक उनके फ़ोन पर खोलें",
  copy: "लिंक कॉपी करें",
  copied: "कॉपी हो गया",
  movedFirst: "ने पहले चाल चल दी",
  ok: "ठीक है",
  approvalTitle: "क्या यह परिवार को भेज दूँ?",
  approvalBody: "सिर्फ़ यही तस्वीर और संदेश जाएगा।",
  yesSend: "हाँ, भेज दो",
  noDont: "मत भेजो",
  sent: "परिवार को भेज दिया",
  notSent: "नहीं भेजा",
  chooseOne: "एक चुनिए",
  eraseMine: "सिर्फ़ मेरी लकीरें मिटाओ",
  touchDraw: "उँगली से लिखें",
  fill: "रंग भरें",
  trace: "रेखा खींचें",
  colours: "रंग",
  saved: "एल्बम में रख दिया",
  save: "एल्बम में रखें",
  chat: "बातचीत",
  you: "आप",
  agent: "साथी",
  elder: "आप",
  language: "भाषा / Language",
  proof: "प्रमाण",
  watching: "सीधा देख रहे हैं",
  playYourSide: "आपकी तरफ़ तैयार है: मोहरा खींचें",
  familyHint: (name: string) => `आप ${name} की बिसात पर हैं। चालें दोनों स्क्रीन पर दिखती हैं।`,
  waitingFor: (name: string) => `${name} का इंतज़ार`,
  linkExpired: "यह लिंक अब चालू नहीं है। नया लिंक माँगिए।",
  noActivity: "अभी कुछ खुला नहीं है। जब वे कुछ शुरू करेंगी, यहाँ सीधा दिखेगा।",
};

/** Activity strings in four more languages (the rest falls back to Hindi). */
const partial: Record<"pa" | "ta" | "mr" | "bn", Partial<Dict>> = {
  pa: {
    appName: "ਚੌਪਾਲ",
    homeQuestion: "ਅੱਜ ਕੀ ਕਰੀਏ?",
    speak: "ਬੋਲੋ",
    listening: "ਸੁਣ ਰਿਹਾ ਹਾਂ…",
    sulekh: "ਸੁਲੇਖ",
    sulekhSub: "ਸੋਹਣੀ ਲਿਖਾਈ",
    rangoli: "ਰੰਗੋਲੀ",
    rangoliSub: "ਲਕੀਰ ਖਿੱਚੋ, ਰੰਗ ਭਰੋ",
    kolam: "ਕੋਲਮ",
    shatranj: "ਸ਼ਤਰੰਜ",
    shatranjSub: "ਪੰਜਾਬੀ ਮੋਹਰਿਆਂ ਨਾਲ",
    yourTurn: "ਤੁਹਾਡੀ ਚਾਲ",
    eraseMine: "ਸਿਰਫ਼ ਮੇਰੀਆਂ ਲਕੀਰਾਂ ਮਿਟਾਓ",
    yesSend: "ਹਾਂ, ਭੇਜ ਦਿਓ",
    noDont: "ਨਾ ਭੇਜੋ",
  },
  ta: {
    appName: "சௌபால்",
    homeQuestion: "இன்று என்ன செய்யலாம்?",
    speak: "பேசுங்கள்",
    listening: "கேட்கிறேன்…",
    sulekh: "அழகெழுத்து",
    sulekhSub: "பார்த்து எழுதுங்கள்",
    rangoli: "ரங்கோலி",
    rangoliSub: "கோடு வரைந்து வண்ணம் தீட்டுங்கள்",
    kolam: "கோலம்",
    kolamSub: "புள்ளிகளும் ஒரே கோடும்",
    shatranj: "சதுரங்கம்",
    shatranjSub: "இந்தி காய்களுடன்",
    yourTurn: "உங்கள் நகர்வு",
    eraseMine: "என் கோடுகளை மட்டும் அழி",
    yesSend: "ஆம், அனுப்புங்கள்",
    noDont: "அனுப்ப வேண்டாம்",
  },
  mr: {
    appName: "चौपाल",
    homeQuestion: "आज काय करूया?",
    speak: "बोला",
    listening: "ऐकतोय…",
    sulekh: "सुलेखन",
    sulekhSub: "गिरवण्यासाठी सुंदर अक्षर",
    rangoli: "रांगोळी",
    rangoliSub: "रेषा काढा, रंग भरा",
    kolam: "कोलम",
    shatranj: "बुद्धिबळ",
    shatranjSub: "हिंदी सोंगट्यांसह",
    yourTurn: "तुमची चाल",
    eraseMine: "फक्त माझ्या रेषा पुसा",
    yesSend: "हो, पाठवा",
    noDont: "पाठवू नका",
  },
  bn: {
    appName: "চৌপাল",
    homeQuestion: "আজ কী করবেন?",
    speak: "বলুন",
    listening: "শুনছি…",
    sulekh: "সুলেখ",
    sulekhSub: "সুন্দর হাতের লেখা",
    rangoli: "আলপনা",
    rangoliSub: "রেখা টানুন, রং ভরুন",
    kolam: "কোলম",
    shatranj: "দাবা",
    shatranjSub: "হিন্দি ঘুঁটি দিয়ে",
    yourTurn: "আপনার চাল",
    eraseMine: "শুধু আমার রেখা মুছুন",
    yesSend: "হ্যাঁ, পাঠান",
    noDont: "পাঠাবেন না",
  },
};

export function strings(lang: string | null | undefined): Dict {
  if (lang === "en") return en;
  if (lang === "pa" || lang === "ta" || lang === "mr" || lang === "bn") {
    return { ...hi, ...partial[lang] } as Dict;
  }
  return hi;
}

/** BCP-47 tag for speech recognition and the html lang attribute. */
export function speechLang(lang: string | null | undefined) {
  switch (lang) {
    case "en":
      return "en-IN";
    case "pa":
      return "pa-IN";
    case "ta":
      return "ta-IN";
    case "mr":
      return "mr-IN";
    case "bn":
      return "bn-IN";
    default:
      return "hi-IN";
  }
}

export const LANG_LABELS: Record<Lang, string> = {
  hi: "हिंदी",
  en: "English",
  pa: "ਪੰਜਾਬੀ",
  ta: "தமிழ்",
  mr: "मराठी",
  bn: "বাংলা",
};
