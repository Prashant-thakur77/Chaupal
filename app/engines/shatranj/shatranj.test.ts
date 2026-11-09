import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";

import {
  type PhraseResult,
  type ResolveResult,
  applyMove,
  getChessState,
  lexiconCollisions,
  pickAgentReply,
  previewMoves,
  resolveIntent,
  resolvePhrase,
  tagPhrase,
} from "./index";

const START = new Chess().fen();
const fenAfter = (...sans: string[]) => {
  const c = new Chess();
  for (const s of sans) c.move(s);
  return c.fen();
};
/** 1.e4 — Black to move. */
const BLACK_TO_MOVE = fenAfter("e4");
/** 1.a3 e5 — the a1 rook can step straight forward exactly one square (a2). */
const ROOK_ONE_STEP = fenAfter("a3", "e5");
/** Only kingside castling is legal for White. */
const KINGSIDE_ONLY = fenAfter("e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5");
const BOTH_CASTLES = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";

const HINDI = /[ऀ-ॿ]/;

function uci(r: PhraseResult | ResolveResult): string | undefined {
  return r.status === "resolved" ? r.move.uci : undefined;
}
function cands(r: PhraseResult | ResolveResult): string[] {
  return r.status === "ambiguous" ? r.candidates.map((m) => m.uci).sort() : [];
}

describe("lexicon", () => {
  it("has no key that maps to two meanings", () => {
    expect(lexiconCollisions()).toEqual([]);
  });

  it("folds spelling and script variants", () => {
    const kinds = (t: string) => tagPhrase(t).map((x) => (x.tag.kind === "piece" ? `piece:${x.tag.piece}` : x.tag.kind));
    expect(kinds("ghoda")).toEqual(["piece:n"]);
    expect(kinds("ghora")).toEqual(["piece:n"]);
    expect(kinds("घोड़ा")).toEqual(["piece:n"]);
    expect(kinds("घोडा")).toEqual(["piece:n"]); // without nukta
    expect(kinds("ऊंट")).toEqual(["piece:b"]); // anusvara spelling
    expect(kinds("vazeer")).toEqual(["piece:q"]);
    expect(kinds("ਵਜ਼ੀਰ")).toEqual(["piece:q"]);
    expect(kinds("யானையை")).toEqual(["piece:r"]); // Tamil case suffix
    expect(kinds("maar do")).toEqual(["capture"]);
  });
});

describe("getChessState", () => {
  it("describes the start position in Hindi", () => {
    const s = getChessState(START);
    expect(s.turn).toBe("w");
    expect(s.turnHi).toBe("सफ़ेद की चाल");
    expect(s.legalMoves).toHaveLength(20);
    const e4 = s.legalMoves.find((m) => m.uci === "e2e4");
    expect(e4?.descriptionHi).toBe("प्यादा e2 से e4");
    expect(s.legalMoves.find((m) => m.uci === "b1c3")?.descriptionHi).toBe("घोड़ा b1 से c3");
    expect(s.pieces).toHaveLength(32);
    expect(s.pieces.find((p) => p.square === "g1")?.labelHi).toBe("घोड़ा");
  });

  it("reads PGN with history", () => {
    const s = getChessState("1. e4 e5 2. Nf3");
    expect(s.turn).toBe("b");
    expect(s.history.map((h) => [h.ply, h.san, h.by])).toEqual([
      [1, "e4", "w"],
      [2, "e5", "b"],
      [3, "Nf3", "w"],
    ]);
  });
});

describe("resolvePhrase — required phrases (White, start)", () => {
  it("Raja ke saamne waala pyada do ghar aage → e2e4", () => {
    expect(uci(resolvePhrase(START, "Raja ke saamne waala pyada do ghar aage"))).toBe("e2e4");
  });

  it("Baayein waale ghode ko aage beech ki taraf nikaalo → b1c3", () => {
    expect(uci(resolvePhrase(START, "Baayein waale ghode ko aage beech ki taraf nikaalo"))).toBe("b1c3");
  });

  it("same in Devanagari", () => {
    expect(uci(resolvePhrase(START, "बाएँ वाले घोड़े को आगे बीच की तरफ़ निकालो"))).toBe("b1c3");
  });

  it("preview shows both knights and never moves", () => {
    const r = resolvePhrase(START, "Pehle dikhao ghoda kahan ja sakta hai, abhi chalna nahi");
    expect(r.status).toBe("preview");
    if (r.status !== "preview") return;
    expect([...r.squares].sort()).toEqual(["b1", "g1"]);
    expect([...r.targets].sort()).toEqual(["a3", "c3", "f3", "h3"]);
    expect("move" in r).toBe(false);
  });

  it("preview of the left knight, then 'theek, beech waale ghar mein' → c3", () => {
    const p = resolvePhrase(START, "pehle dikhao baayein waala ghoda kahan ja sakta hai");
    expect(p.status).toBe("preview");
    expect(p.context).toMatchObject({ piece: "n", squares: ["b1"] });
    expect(uci(resolvePhrase(START, "theek, beech waale ghar mein", p.context))).toBe("b1c3");
    // Explicit context form works too.
    expect(uci(resolvePhrase(START, "theek, beech waale ghar mein", { piece: "n", squares: ["b1"], targets: ["a3", "c3"] }))).toBe("b1c3");
  });

  it("'beech waale ghar' after previewing both knights is a question, not a guess", () => {
    const p = resolvePhrase(START, "Pehle dikhao ghoda kahan ja sakta hai, abhi chalna nahi");
    const r = resolvePhrase(START, "theek, beech waale ghar mein", p.context);
    expect(r.status).toBe("ambiguous");
    expect(cands(r)).toEqual(["b1c3", "g1f3"]);
  });

  it("Haathi ko tircha ek ghar chalao → illegal with Hindi reason and no substitute", () => {
    const r = resolvePhrase(START, "Haathi ko tircha ek ghar chalao");
    expect(r.status).toBe("illegal");
    if (r.status !== "illegal") return;
    expect(r.code).toBe("WRONG_GEOMETRY");
    expect(r.reasonHi).toContain("हाथी");
    expect(r.reasonHi).toContain("तिरछा");
    expect("move" in r).toBe(false);
    expect(r.context.piece).toBe("r");
  });

  it("'achha, seedha aage' with the rook in context is blocked at the start", () => {
    const first = resolvePhrase(START, "Haathi ko tircha ek ghar chalao");
    const r = resolvePhrase(START, "achha, seedha aage", first.context);
    expect(r.status).toBe("illegal");
    if (r.status === "illegal") {
      expect(r.code).toBe("BLOCKED");
      expect(r.reasonHi).toMatch(/रास्ता बंद/);
    }
  });

  it("'achha, seedha aage' resolves where a rook can step straight forward once", () => {
    const first = resolvePhrase(ROOK_ONE_STEP, "Haathi ko tircha ek ghar chalao");
    expect(first.status).toBe("illegal");
    expect(uci(resolvePhrase(ROOK_ONE_STEP, "achha, seedha aage", first.context))).toBe("a1a2");
  });

  it("e2 se e4, e4, Nf3, e2e4", () => {
    expect(uci(resolvePhrase(START, "e2 se e4"))).toBe("e2e4");
    expect(uci(resolvePhrase(START, "e4"))).toBe("e2e4");
    expect(uci(resolvePhrase(START, "Nf3"))).toBe("g1f3");
    expect(uci(resolvePhrase(START, "e2e4"))).toBe("e2e4");
    expect(uci(resolvePhrase(START, "e2 e4"))).toBe("e2e4");
  });
});

describe("captures", () => {
  it("ghode se uska oont maar do — exactly one capture", () => {
    const fen = "4k3/8/8/1b6/8/2N5/8/4K3 w - - 0 1";
    const r = resolvePhrase(fen, "ghode se uska oont maar do");
    expect(uci(r)).toBe("c3b5");
  });

  it("ghode se uska oont maar do — two possible captures → ambiguous Hindi question", () => {
    const fen = "4k3/8/8/1b1b4/8/2N5/8/4K3 w - - 0 1";
    const r = resolvePhrase(fen, "ghode se uska oont maar do");
    expect(r.status).toBe("ambiguous");
    expect(cands(r)).toEqual(["c3b5", "c3d5"]);
    if (r.status === "ambiguous") expect(r.questionHi).toMatch(HINDI);
  });

  it("no such capture → illegal, nothing substituted", () => {
    const r = resolvePhrase(START, "ghode se uska oont maar do");
    expect(r.status).toBe("illegal");
    if (r.status === "illegal") expect(r.code).toBe("NO_CAPTURE");
  });

  it("English: knight takes bishop", () => {
    expect(uci(resolvePhrase("4k3/8/8/1b6/8/2N5/8/4K3 w - - 0 1", "knight takes bishop"))).toBe("c3b5");
  });
});

describe("castling", () => {
  it("raja ko bachao, castling kar do → O-O when only kingside is legal", () => {
    const r = resolvePhrase(KINGSIDE_ONLY, "raja ko bachao, castling kar do");
    expect(r.status).toBe("resolved");
    if (r.status === "resolved") expect(r.move.san).toBe("O-O");
  });

  it("both sides legal → ambiguous with a Hindi question", () => {
    const r = resolvePhrase(BOTH_CASTLES, "raja ko bachao, castling kar do");
    expect(r.status).toBe("ambiguous");
    if (r.status === "ambiguous") {
      expect(r.candidates.map((m) => m.san).sort()).toEqual(["O-O", "O-O-O"]);
      expect(r.questionHi).toContain("किलाबंदी");
    }
    expect(resolvePhrase(BOTH_CASTLES, "chhoti kila bandi").status).toBe("resolved");
    const long = resolvePhrase(BOTH_CASTLES, "wazir ki taraf castling");
    expect(long.status === "resolved" && long.move.san).toBe("O-O-O");
  });

  it("'raja ko bachao' alone is not read as castling", () => {
    expect(resolvePhrase(KINGSIDE_ONLY, "raja ko bachao").status).toBe("no-match");
  });

  it("castling unavailable at the start → illegal", () => {
    const r = resolvePhrase(START, "castling kar do");
    expect(r.status).toBe("illegal");
  });
});

describe("Punjabi and Tamil", () => {
  it("ਘੋੜਾ ਅੱਗੇ at the start → ambiguous between the two knights", () => {
    const r = resolvePhrase(START, "ਘੋੜਾ ਅੱਗੇ");
    expect(r.status).toBe("ambiguous");
    expect(cands(r)).toEqual(["b1a3", "b1c3", "g1f3", "g1h3"]);
  });

  it("khabbe wala ghoda agge → ambiguous a3/c3 at start, resolved when a3 is taken", () => {
    const r = resolvePhrase(START, "khabbe wala ghoda agge");
    expect(cands(r)).toEqual(["b1a3", "b1c3"]);
    expect(uci(resolvePhrase(ROOK_ONE_STEP, "khabbe wala ghoda agge"))).toBe("b1c3");
    expect(uci(resolvePhrase(ROOK_ONE_STEP, "ਖੱਬੇ ਵਾਲਾ ਘੋੜਾ ਅੱਗੇ"))).toBe("b1c3");
  });

  it("குதிரையை முன்னே நகர்த்து → ambiguous at start; with இடது and a3 taken → b1c3", () => {
    expect(resolvePhrase(START, "குதிரையை முன்னே நகர்த்து").status).toBe("ambiguous");
    expect(uci(resolvePhrase(ROOK_ONE_STEP, "இடது குதிரையை முன்னே நகர்த்து"))).toBe("b1c3");
  });

  it("a bare 'baayein waala' answers 'which knight?'", () => {
    const first = resolvePhrase(START, "ghoda aage");
    expect(first.status).toBe("ambiguous");
    const r = resolvePhrase(START, "baayein waala", first.context);
    expect(cands(r)).toEqual(["b1a3", "b1c3"]);
  });
});

describe("Black's perspective", () => {
  // Black sits on the rank-8 side facing White: Black's forward is towards
  // rank 1 and Black's LEFT hand points at the h-file. So Black's left knight
  // is g8 and Black's left rook is h8.
  it("Black's left knight forward towards the centre is g8-f6", () => {
    expect(uci(resolvePhrase(BLACK_TO_MOVE, "Baayein waale ghode ko aage beech ki taraf nikaalo"))).toBe("g8f6");
    expect(uci(resolvePhrase(BLACK_TO_MOVE, "daayein waale ghode ko aage beech ki taraf"))).toBe("b8c6");
  });

  it("Black's king pawn two squares forward is e7-e5", () => {
    expect(uci(resolvePhrase(BLACK_TO_MOVE, "Raja ke saamne waala pyada do ghar aage"))).toBe("e7e5");
  });

  it("Black's left rook is h8; structured intent agrees", () => {
    const p = previewMoves(BLACK_TO_MOVE, "haathi", "left");
    expect(p.status).toBe("preview");
    if (p.status === "preview") expect(p.squares).toEqual(["h8"]);
    const r = resolveIntent(BLACK_TO_MOVE, { piece: "n", which: "left", direction: "forward" });
    expect(cands(r)).toEqual(["g8f6", "g8h6"]);
  });

  it("Black's 'peeche' is towards rank 8", () => {
    const fen = fenAfter("e4", "Nf6", "d3");
    expect(uci(resolvePhrase(fen, "ghoda peeche"))).toBe("f6g8");
  });
});

describe("more phrasings", () => {
  it("English word order: the pawn in front of the king", () => {
    expect(uci(resolvePhrase(START, "the pawn in front of the king two squares forward"))).toBe("e2e4");
  });

  it("Punjabi Gurmukhi and romanized: raje de saahmne wala piada", () => {
    expect(uci(resolvePhrase(START, "ਰਾਜੇ ਦੇ ਸਾਹਮਣੇ ਵਾਲਾ ਪਿਆਦਾ ਦੋ ਘਰ ਅੱਗੇ"))).toBe("e2e4");
    expect(uci(resolvePhrase(START, "raje de saahmne wala piada do ghar agge"))).toBe("e2e4");
  });

  it("Tamil: the pawn in front of the king, two squares forward", () => {
    expect(uci(resolvePhrase(START, "ராஜா முன்னால் உள்ள சிப்பாயை இரண்டு கட்டம் முன்னே நகர்த்து"))).toBe("e2e4");
  });

  it("raja ka ghoda = the king's knight", () => {
    expect(cands(resolvePhrase(START, "raja ka ghoda aage"))).toEqual(["g1f3", "g1h3"]);
    expect(cands(resolvePhrase(START, "daayein taraf wala ghoda"))).toEqual(["g1f3", "g1h3"]);
  });

  it("negation drops the negated word", () => {
    expect(uci(resolvePhrase(START, "ghoda nahi, raja ke saamne wala pyada do ghar"))).toBe("e2e4");
  });

  it("'oont f7 pe maar do' — the named piece captures on the square", () => {
    expect(uci(resolvePhrase(KINGSIDE_ONLY, "oont f7 pe maar do"))).toBe("c4f7");
  });

  it("'Nf3 dikhao' previews the g1 knight", () => {
    const r = resolvePhrase(START, "Nf3 dikhao");
    expect(r.status === "preview" && r.squares).toEqual(["g1"]);
  });
});

describe("resolveIntent", () => {
  it("accepts lexicon words for pieces", () => {
    expect(uci(resolveIntent(START, { piece: "ghoda", which: "right", direction: ["forward", "towards-center"] }))).toBe("g1f3");
    expect(uci(resolveIntent(START, { piece: "knight", to: "c3" }))).toBe("b1c3");
  });

  it("from-square of the opponent's piece is illegal", () => {
    const r = resolveIntent(START, { from: "e7", to: "e5" });
    expect(r.status === "illegal" && r.code).toBe("NOT_YOUR_PIECE");
  });

  it("promotion: asks which piece unless told", () => {
    const fen = "8/P7/8/8/8/8/8/4K2k w - - 0 1";
    const r = resolvePhrase(fen, "a7 se a8");
    expect(r.status).toBe("ambiguous");
    if (r.status === "ambiguous") expect(r.questionHi).toContain("वज़ीर");
    expect(uci(resolveIntent(fen, { from: "a7", to: "a8", promotion: "wazir" }))).toBe("a7a8q");
    expect(uci(resolvePhrase(fen, "a8=Q"))).toBe("a7a8q");
  });

  it("illegal SAN is reported, not replaced", () => {
    const r = resolvePhrase(START, "Nf6");
    expect(r.status).toBe("illegal");
  });

  it("nothing to ground → no-match", () => {
    expect(resolvePhrase(START, "seedha aage").status).toBe("no-match");
    expect(resolvePhrase(START, "kuch bhi").status).toBe("no-match");
  });
});

describe("applyMove", () => {
  it("applies a legal move", () => {
    const r = applyMove(START, "e2e4");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.fen).toBe(BLACK_TO_MOVE);
      expect(r.move.descriptionHi).toBe("प्यादा e2 से e4");
    }
  });

  it("illegal leaves the position unchanged", () => {
    const before = getChessState(START);
    const r = applyMove(START, "e2e5");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("ILLEGAL_MOVE");
      expect(r.fen).toBe(START);
    }
    expect(getChessState(START)).toEqual(before);
  });

  it("phrase resolution never changes the position", () => {
    const before = getChessState(START);
    resolvePhrase(START, "Haathi ko tircha ek ghar chalao");
    resolvePhrase(START, "Raja ke saamne waala pyada do ghar aage");
    expect(getChessState(START)).toEqual(before);
  });

  it("NOT_YOUR_TURN and STALE_POSITION", () => {
    const a = applyMove(START, { from: "e7", to: "e5" });
    expect(!a.ok && a.code).toBe("NOT_YOUR_TURN");
    const b = applyMove(START, "e2e4", null, { player: "b" });
    expect(!b.ok && b.code).toBe("NOT_YOUR_TURN");
    const c = applyMove(START, "e2e4", BLACK_TO_MOVE);
    expect(!c.ok && c.code).toBe("STALE_POSITION");
    expect(applyMove(START, "e2e4", START).ok).toBe(true);
  });

  it("keeps PGN when given PGN", () => {
    const r = applyMove("1. e4 e5", "Nf3");
    expect(r.ok && r.pgn).toContain("2. Nf3");
  });
});

describe("pickAgentReply (gentle)", () => {
  it("is deterministic and legal", () => {
    const a = pickAgentReply(BLACK_TO_MOVE);
    const b = pickAgentReply(BLACK_TO_MOVE);
    expect(a?.move.uci).toBe(b?.move.uci);
    const legal = new Chess(BLACK_TO_MOVE).moves({ verbose: true }).map((m) => m.lan);
    expect(legal).toContain(a?.move.uci);
  });

  it("takes an undefended queen", () => {
    const r = pickAgentReply("3rk3/8/8/3Q4/8/8/8/4K3 b - - 0 1");
    expect(r?.move.uci).toBe("d8d5");
    expect(r?.reasonHi).toMatch(HINDI);
  });

  it("returns null when the game is over", () => {
    expect(pickAgentReply("7k/6Q1/6K1/8/8/8/8/8 b - - 0 1")).toBeNull();
  });
});
