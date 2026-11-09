import { Chess } from "chess.js";

import type { Snapshot } from "./snapshot.js";

/* The "subah" look, matching the screens: paper ground, warm ink, teal for her lines. */
const BG = "#faf6ef";
const INK = "#2b1a12";
const LINE = "#8a4b2e";
const HER = "#2b6b6c";
/** Engine outlines are chalk-white (made for a dark floor); here they draw in warm brown. */
const recolourChalk = (svg: string) => svg.replace(/(fill|stroke)="#(?:f4efe6|fbf8f1|f7f1e6)"/gi, `$1="${LINE}"`);
const HEX: Record<string, string> = {
  laal: "#e0473b",
  peela: "#f6c33b",
  hara: "#43a95e",
  neela: "#4f7fe0",
  gulabi: "#e66ca7",
  kesariya: "#f28a2e",
  safed: "#f7f1e6",
  baingani: "#9b6bd3",
};
const PIECE_HI: Record<string, string> = { k: "राजा", q: "वज़ीर", b: "ऊँट", n: "घोड़ा", r: "हाथी", p: "प्यादा" };

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function strokePaths(strokes: { points: number[][] }[], w: number, h: number, colour: string, width: number) {
  return strokes
    .map((s) => {
      const pts = s.points.map((p) => `${(p[0]! * w).toFixed(1)},${(p[1]! * h).toFixed(1)}`).join(" ");
      return `<polyline points="${pts}" fill="none" stroke="${colour}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join("");
}

/** Inner content of an SVG document (drops the outer <svg> element). */
function inner(svg: string) {
  return svg.replace(/^[\s\S]*?<svg\b[^>]*>/, "").replace(/<\/svg>\s*$/, "");
}

/**
 * A picture of what is on her screen, for the album and for a family update
 * she approves: the reference or design, her own lines and colours, or the
 * board. Nothing else (no camera, no conversation) is ever included.
 */
export function composeArtwork(s: Snapshot): { svg: string; kind: string; title: string } | null {
  if (s.scene === "sulekh" && s.calligraphy && s.calligraphy.status === "valid") {
    const ref = inner(s.calligraphy.svg).replace(/fill="#000"/g, `fill="${INK}"`);
    return {
      kind: "sulekh",
      title: s.calligraphy.text,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 1000" width="1500" height="1000"><rect width="1500" height="1000" fill="${BG}"/><g opacity="0.42">${ref}</g>${strokePaths(s.strokes.sulekh, 1500, 1000, HER, 14)}</svg>`,
    };
  }
  if ((s.scene === "rangoli" || s.scene === "kolam") && s.kolam) {
    const fills = s.kolam.fills;
    let body = recolourChalk(inner(s.kolam.svg));
    body = body.replace(/<path([^>]*?)data-region-id="([^"]+)"([^>]*?)\/?>/g, (whole, a, id, b) => {
      const f = fills[id];
      if (!f) return whole;
      const attrs = `${a}data-region-id="${id}"${b}`.replace(/\sfill="[^"]*"/, "");
      return `<path${attrs} fill="${HEX[f.colour] ?? f.colour}"/>`;
    });
    return {
      kind: s.kolam.kind === "pulli" ? "kolam" : "rangoli",
      title: s.kolam.altEn,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000"><rect width="1000" height="1000" fill="${BG}"/>${body}${strokePaths(s.strokes.rangoli, 1000, 1000, HER, 8)}</svg>`,
    };
  }
  if (s.scene === "shatranj" && s.chess) {
    const chess = new Chess(s.chess.fen);
    const flip = s.chess.elderColor === "b";
    const cell = 110;
    const off = 40;
    let squares = "";
    let pieces = "";
    const last = s.chess.moves[s.chess.moves.length - 1];
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const file = flip ? 7 - f : f;
        const rank = flip ? r : 7 - r;
        const sq = `${"abcdefgh"[file]}${rank + 1}`;
        const dark = (file + rank) % 2 === 0;
        const hl = last && (last.from === sq || last.to === sq);
        squares += `<rect x="${off + f * cell}" y="${off + r * cell}" width="${cell}" height="${cell}" fill="${hl ? "#f0cf8c" : dark ? "#c4936b" : "#f1dfc4"}"/>`;
        const p = chess.get(sq as never);
        if (p) {
          const cx = off + f * cell + cell / 2;
          const cy = off + r * cell + cell / 2;
          const face = p.color === s.chess.elderColor ? "#fdf6ea" : "#2b6b6c";
          const ink = p.color === s.chess.elderColor ? "#6a2611" : "#fdf3e1";
          pieces += `<circle cx="${cx}" cy="${cy}" r="44" fill="${face}" stroke="${ink}" stroke-width="4"/><text x="${cx}" y="${cy + 10}" text-anchor="middle" font-family="Tiro Devanagari Hindi, Mukta, sans-serif" font-size="${p.type === "p" ? 22 : 26}" fill="${ink}">${esc(PIECE_HI[p.type]!)}</text>`;
        }
      }
    }
    return {
      kind: "shatranj",
      title: `शतरंज · ${s.chess.moves.length} चालें`,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 960" width="960" height="960"><rect width="960" height="960" fill="${BG}"/>${squares}${pieces}</svg>`,
    };
  }
  return null;
}
