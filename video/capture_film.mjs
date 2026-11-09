#!/usr/bin/env node
// Records every product shot of the film from the DEPLOYED app, as real sessions:
//   hero     her tablet (1366x1024) and Rahul's phone (390x844) on one household, recorded at the same time:
//            set-up moves through the actions API, then the hero move through the in-app agent (typed into the dock),
//            the move landing on his phone, and his reply tapped on the phone
//   sulekh   the agent writes "शुभ दीपावली" from her request; tracing (drawn by this script); "मेरी लकीरें मिटाएँ"
//            (his phone recorded too, for the picture-in-picture of the greeting arriving)
//   rangoli  the Diwali rangoli; "बीच में पीला, बाहर लाल" through the agent; the engine's SVG is saved for the reveal
//   guard    "यह रंगोली बच्चों को भेज दो" -> the approval card -> "मत भेजो"; then Rahul moves first and the agent's
//            stale move is refused (the conflict card)
// Frames come from Chrome's screencast (JPEG q92) at dpr 1.5, so the 2x camera pushes stay sharp.
// Output: film/public/captures/<shot>-<page>.mp4 + log.json (event times in seconds from each clip's start, element
// boxes in CSS px of the page). Never run it while a Remotion render is running (RAM).
//
//   node video/capture_film.mjs [--base https://chaupal.prashantthakur.dev] [--only hero,sulekh] [--headed]
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const BASE = arg("--base", "https://chaupal.prashantthakur.dev");
const ONLY = arg("--only", "hero,sulekh,rangoli,guard").split(",");
const OUT = path.join(HERE, "film", "public", "captures");
const FRAMES = "/home/prashant/projects/.chaupal-work/film/capture";
const LOGF = path.join(OUT, "log.json");
const DPR = 1.5;
// --agent: her request is typed into the in-app agent dock and the agent answers (needs the agent chat working on the
// deployed app). Default: her words go straight to the same action the agent would call (move-chess-piece with her
// phrase, set-calligraphy-reference, fill-region with her phrase, draft-family-update); the film labels those steps.
// --agent hero,sulekh : those shots go through the in-app agent; the rest through the actions (labelled in the film)
const AGENT_SHOTS = process.argv.includes("--agent") ? (arg("--agent", "") || "hero,sulekh,rangoli,guard").split(",") : [];
let AGENT = false;
fs.mkdirSync(OUT, { recursive: true });
const log = fs.existsSync(LOGF) ? JSON.parse(fs.readFileSync(LOGF, "utf8")) : {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exe = process.env.CHROME_PATH || path.join(process.env.HOME, ".cache/ms-playwright/chromium-1254/chrome-linux64/chrome");

// a soft round touch mark (she taps; no arrow cursor on a tablet)
const TOUCH = `(() => { if (window.__touch) return; const mk = () => {
  const d = document.createElement('div'); d.id='__touch';
  Object.assign(d.style,{position:'fixed',left:'0',top:'0',width:'44px',height:'44px',borderRadius:'50%',zIndex:2147483647,pointerEvents:'none',
    background:'rgba(255,200,102,.35)',border:'3px solid rgba(255,244,214,.95)',boxShadow:'0 0 18px rgba(244,169,60,.6)',transform:'translate(-200px,-200px)',opacity:'0',transition:'opacity 200ms'});
  document.documentElement.appendChild(d);
  window.__touch = { at(x,y,on){ d.style.transition='transform 0ms, opacity 200ms'; d.style.transform='translate('+(x-22)+'px,'+(y-22)+'px)'; d.style.opacity= on?'1':'0'; },
    move(x,y,ms){ d.style.transition='transform '+ms+'ms cubic-bezier(.22,.9,.24,1), opacity 200ms'; d.style.transform='translate('+(x-22)+'px,'+(y-22)+'px)'; d.style.opacity='1'; },
    ripple(x,y){ const r=document.createElement('div'); Object.assign(r.style,{position:'fixed',left:(x-26)+'px',top:(y-26)+'px',width:'52px',height:'52px',borderRadius:'50%',border:'3px solid rgba(255,244,214,.95)',zIndex:2147483646,pointerEvents:'none',transform:'scale(.4)',opacity:'1',transition:'transform 500ms cubic-bezier(.2,.8,.2,1), opacity 500ms'}); document.documentElement.appendChild(r); requestAnimationFrame(()=>{r.style.transform='scale(1.6)';r.style.opacity='0';}); setTimeout(()=>r.remove(),650); } };
}; if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', mk); else mk(); })();`;

const browser = await chromium.launch({ headless: !process.argv.includes("--headed"), executablePath: exe,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars", "--disable-dev-shm-usage"] });

const api = async (ctx, name, body, method = "POST") => {
  const r = await ctx.request.fetch(`${BASE}/_agent-native/actions/${name}`, { method, data: method === "POST" ? body ?? {} : undefined, headers: { "content-type": "application/json" }, timeout: 120000 });
  const txt = await r.text();
  let j; try { j = JSON.parse(txt); } catch { j = { raw: txt.slice(0, 300) }; }
  if (!r.ok()) console.log(`  ! ${name} ${r.status()} ${txt.slice(0, 240)}`);
  return j;
};

/** Screencast one page; frames carry Chrome's own timestamps so two pages share one clock. */
const recorder = async (ctx, page, name, w, h) => {
  const cdp = await ctx.newCDPSession(page);
  const dir = path.join(FRAMES, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const frames = [];
  let stopped = false;
  cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
    if (stopped) return; // a late frame after stop: ignore (its folder may be gone)
    const f = path.join(dir, `${String(frames.length).padStart(6, "0")}.jpg`);
    try { fs.writeFileSync(f, Buffer.from(data, "base64")); frames.push({ f, t: metadata.timestamp }); } catch {}
    try { await cdp.send("Page.screencastFrameAck", { sessionId }); } catch {}
  });
  return {
    start: () => cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: Math.round(w * DPR), maxHeight: Math.round(h * DPR), everyNthFrame: 1 }),
    stop: async () => { stopped = true; await cdp.send("Page.stopScreencast").catch(() => {}); await cdp.detach().catch(() => {}); },
    encode: (t0, t1, out) => {
      if (!frames.length) throw new Error(`${name}: no frames`);
      frames.sort((a, b) => a.t - b.t);
      let s = "ffconcat version 1.0\n";
      // hold the first frame from t0 so every clip of a shot starts on the same clock
      const lead = Math.max(0.001, frames[0].t - t0);
      s += `file '${frames[0].f}'\nduration ${lead.toFixed(4)}\n`;
      frames.forEach((fr, i) => {
        const next = i + 1 < frames.length ? frames[i + 1].t : t1;
        s += `file '${fr.f}'\nduration ${Math.max(0.001, next - fr.t).toFixed(4)}\n`;
      });
      s += `file '${frames.at(-1).f}'\n`;
      const list = path.join(dir, "list.ffconcat");
      fs.writeFileSync(list, s);
      const W = Math.round(w * DPR / 2) * 2, H = Math.round(h * DPR / 2) * 2;
      const tmp = out.replace(/\.mp4$/, ".part.mp4");
      execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list, "-vf",
        `fps=30,scale=${W}:${H}:flags=lanczos:in_color_matrix=bt601:out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709`,
        "-c:v", "libx264", "-crf", "15", "-preset", "veryfast", "-movflags", "+faststart", tmp]);
      fs.renameSync(tmp, out);
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
};

const box = async (page, sel) => {
  const b = await page.locator(sel).first().boundingBox();
  return b ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } : null;
};
const tap = async (page, sel, ms = 550) => {
  const el = page.locator(sel).first();
  await el.waitFor({ state: "visible", timeout: 30000 });
  const b = await el.boundingBox();
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await page.evaluate(([x, y, ms]) => window.__touch && window.__touch.move(x, y, ms), [x, y, ms]);
  await sleep(ms + 80);
  await page.evaluate(([x, y]) => window.__touch && window.__touch.ripple(x, y), [x, y]);
  await el.click();
  await sleep(250);
  await page.evaluate(() => window.__touch && window.__touch.at(-200, -200, false));
};
/** Types her request into the dock like a person would (visible typing), then sends it. Returns [typeStart, submit]. */
const say = async (page, text, clock) => {
  const input = page.locator('[data-testid="say-input"]');
  for (const sel of [".ch-dock-type", '[data-testid="chat-toggle"]']) {
    if (await input.isVisible().catch(() => false)) break;
    if (await page.locator(sel).first().isVisible().catch(() => false)) { await tap(page, sel); await sleep(700); }
  }
  await input.waitFor({ state: "visible", timeout: 20000 });
  await input.click();
  const t1 = clock();
  await page.keyboard.type(text, { delay: 55 });
  await sleep(500);
  // the send button can sit under the board's frame layer at tablet size: show the touch on it, then press it in the DOM
  const sb = await page.locator('[data-testid="say-submit"]').first().boundingBox();
  if (sb) {
    const x = sb.x + sb.width / 2, y = sb.y + sb.height / 2;
    await page.evaluate(([x, y]) => { window.__touch && window.__touch.move(x, y, 350); }, [x, y]);
    await sleep(430);
    await page.evaluate(([x, y]) => window.__touch && window.__touch.ripple(x, y), [x, y]);
  }
  await page.locator('[data-testid="say-submit"]').first().evaluate((b) => b.click());
  await sleep(250);
  await page.evaluate(() => window.__touch && window.__touch.at(-200, -200, false));
  return [t1, clock()];
};
const moveCount = (page) => page.locator('[data-testid="shatranj-board"]').getAttribute("data-move-count").then(Number).catch(() => -1);
const until = async (fn, timeout = 120000, every = 200) => {
  const t = Date.now();
  while (Date.now() - t < timeout) { if (await fn()) return true; await sleep(every); }
  return false;
};
const squares = async (page) => {
  const c = async (s) => { const b = await page.locator(`[data-testid="piece-${s}"]`).first().boundingBox(); return b ? [b.x + b.width / 2, b.y + b.height / 2] : null; };
  return { a1: await c("a1"), h1: await c("h1"), a8: await c("a8") };
};
const ready = (page) => page.waitForSelector('[data-testid="chaupal-stage"][data-scene]:not([data-scene="loading"])', { timeout: 90000 });

// ---------- one household for the whole film: her tablet + his phone
const elder = await browser.newContext({ viewport: { width: 1366, height: 1024 }, deviceScaleFactor: DPR, colorScheme: "dark", hasTouch: true });
await elder.addInitScript(TOUCH);
const ep = await elder.newPage();
ep.on("pageerror", (e) => console.log("elder pageerror:", e.message.slice(0, 200)));
await ep.goto(BASE + "/api/household/start", { waitUntil: "domcontentloaded", timeout: 120000 });
await api(elder, "set-language", { language: "hi" }).catch(() => {});
await api(elder, "open-activity", { activity: "shatranj", newGame: true });
const inv = await api(elder, "invite-family", { name: "Rahul", relation: "pota", playsOtherSide: true });
if (!inv.joinPath) { console.error("invite failed", JSON.stringify(inv).slice(0, 300)); process.exit(1); }
const fam = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true, colorScheme: "dark" });
await fam.addInitScript(TOUCH);
const fp = await fam.newPage();
await fp.goto(BASE + inv.joinPath, { waitUntil: "domcontentloaded", timeout: 120000 });
await ep.goto(BASE + "/chaupal", { waitUntil: "domcontentloaded", timeout: 120000 });
await ready(ep);
await ep.waitForSelector('[data-testid="shatranj-board"]', { timeout: 90000 });
await fp.waitForSelector('[data-testid="shatranj-board"]', { timeout: 90000 });
const famApi = (name, body) => api(fam, name, body);

const shot = async (id, pages, body) => {
  AGENT = AGENT_SHOTS.includes(id);
  console.log(`== ${id}${AGENT ? " (in-app agent)" : ""}`);
  const recs = [];
  for (const [p, name, w, h] of pages) recs.push([await recorder(p === ep ? elder : fam, p, `${id}-${name}`, w, h), name]);
  await sleep(600);
  const t0 = Date.now() / 1000;
  for (const [r] of recs) await r.start();
  const clock = () => +(Date.now() / 1000 - t0).toFixed(3);
  const entry = await body(clock);
  await sleep(400);
  const t1 = Date.now() / 1000;
  for (const [r] of recs) await r.stop();
  for (const [r, name] of recs) r.encode(t0, t1, path.join(OUT, `${id}-${name}.mp4`));
  entry.duration = +(t1 - t0).toFixed(2);
  log[id] = entry;
  fs.writeFileSync(LOGF, JSON.stringify(log, null, 1));
  console.log(`   ${id}: ${entry.duration}s`, JSON.stringify(entry.events));
};

// ---------- HERO: one move, two cities
if (ONLY.includes("hero")) {
  // set-up position: 1. Nf3 h5 2. Nh4 Rh6 3. Nf5 a6  (her moves through her actions, his through his)
  for (const [w, b] of [[["g1", "f3"], ["h7", "h5"]], [["f3", "h4"], ["h8", "h6"]], [["h4", "f5"], ["a7", "a6"]]]) {
    await api(elder, "move-chess-piece", { from: w[0], to: w[1], actor: "elder", personConfirmed: true });
    await sleep(700);
    await famApi("family-move", { from: b[0], to: b[1] });
    await sleep(700);
  }
  await until(async () => (await moveCount(ep)) === 6 && (await moveCount(fp)) === 6, 30000);
  await sleep(1500);
  await shot("hero", [[ep, "tablet", 1366, 1024], [fp, "phone", 390, 844]], async (clock) => {
    const ev = {};
    await sleep(2500);
    if (AGENT) [ev.request, ev.submit] = await say(ep, "घोड़े से उसका हाथी मार दो", clock);
    else { ev.request = ev.submit = clock(); const r = await api(elder, "move-chess-piece", { phrase: "घोड़े से उसका हाथी मार दो", actor: "elder", personConfirmed: true }); ev.resolved = r.move?.san ?? r.san ?? r.chess?.lastMove?.san ?? null; }
    await until(async () => (await moveCount(ep)) >= 7, 150000);
    ev.landTablet = clock();
    await until(async () => (await moveCount(fp)) >= 7, 30000, 25);
    ev.land = clock();
    await sleep(AGENT ? 5000 : 2600); // let her agent's reply appear in the chat panel
    ev.reply = clock();
    await tap(fp, '[data-testid="piece-g7"]', 450);
    await tap(fp, '[data-testid="dest-h6"]', 450);
    ev.replyPhone = clock();
    await until(async () => (await moveCount(ep)) >= 8, 30000, 25);
    ev.replyTablet = clock();
    await sleep(3500);
    const sq = { tablet: await squares(ep), phone: await squares(fp) };
    await ep.screenshot({ path: path.join(OUT, "thumb-tablet.png") });
    await fp.screenshot({ path: path.join(OUT, "thumb-phone.png") });
    log.thumb = { tablet: "captures/thumb-tablet.png", phone: "captures/thumb-phone.png" };
    return { mode: AGENT ? "agent" : "action", tablet: "captures/hero-tablet.mp4", phone: "captures/hero-phone.mp4", events: ev, squares: sq,
      boards: { tablet: await box(ep, '[data-testid="shatranj-board"]'), phone: await box(fp, '[data-testid="shatranj-board"]') },
      dock: await box(ep, '[data-testid="voice-dock"]'), recap: [ev.landTablet - 0.6, ev.replyTablet - 0.4] };
  });
}

// ---------- SULEKH: the agent writes, she traces, only her lines erase
if (ONLY.includes("sulekh")) {
  await api(elder, "open-activity", { activity: "sulekh" });
  await ep.waitForSelector('[data-testid="sulekh-canvas"]', { timeout: 60000 });
  await sleep(2000);
  await shot("sulekh", [[ep, "tablet", 1366, 1024], [fp, "phone", 390, 844]], async (clock) => {
    const ev = {};
    await sleep(2000);
    if (AGENT) [ev.request, ev.submit] = await say(ep, "पोते को दिवाली पर 'शुभ दीपावली' दिखाना है", clock);
    else { ev.request = ev.submit = clock(); await api(elder, "set-calligraphy-reference", { text: "शुभ दीपावली" }); }
    await until(async () => (await ep.locator('[data-testid="sulekh-reference"]').getAttribute("data-reference-text").catch(() => null)) === "शुभ दीपावली", 150000);
    ev.reference = clock();
    await sleep(AGENT ? 5000 : 2500);
    if (await ep.locator('[data-testid="touch-draw"]').isVisible().catch(() => false)) { await tap(ep, '[data-testid="touch-draw"]'); await sleep(900); }
    const ref = await box(ep, '[data-testid="sulekh-reference"]');
    const layer = await box(ep, '[data-testid="stroke-layer"]');
    ev.traceStart = clock();
    // her tracing, drawn by this script: the headline (shirorekha) of each word, then a few downstrokes
    const R = ref || layer;
    const P = (u, v) => [R.x + u * R.w, R.y + v * R.h];
    const strokes = [
      [[0.17, 0.44], [0.33, 0.44]], [[0.40, 0.44], [0.86, 0.44]],
      [[0.22, 0.44], [0.21, 0.52], [0.24, 0.58], [0.20, 0.62]], [[0.30, 0.44], [0.30, 0.57]],
      [[0.47, 0.44], [0.46, 0.55], [0.50, 0.58]], [[0.62, 0.44], [0.62, 0.57]], [[0.80, 0.44], [0.80, 0.58]],
    ];
    for (const s of strokes) {
      const pts = [];
      for (let i = 0; i < s.length - 1; i++) for (let k = 0; k < 14; k++) { const t = k / 14; pts.push(P(s[i][0] + (s[i + 1][0] - s[i][0]) * t, s[i][1] + (s[i + 1][1] - s[i][1]) * t)); }
      pts.push(P(...s.at(-1)));
      await ep.evaluate(([x, y]) => window.__touch && window.__touch.at(x, y, true), pts[0]);
      await ep.mouse.move(...pts[0]); await ep.mouse.down();
      for (const p of pts) { await ep.mouse.move(p[0], p[1], { steps: 2 }); await ep.evaluate(([x, y]) => window.__touch && window.__touch.move(x, y, 0), p); await sleep(16); }
      await ep.mouse.up(); await sleep(260);
    }
    await ep.evaluate(() => window.__touch && window.__touch.at(-200, -200, false));
    ev.traceEnd = clock();
    await sleep(1800);
    await tap(ep, '[data-testid="erase-mine"]');
    ev.erase = clock();
    await sleep(3000);
    return { mode: AGENT ? "agent" : "action", src: "captures/sulekh-tablet.mp4", pip: "captures/sulekh-phone.mp4", events: ev,
      boxes: { dock: await box(ep, '[data-testid="voice-dock"]'), reference: ref, erase: await box(ep, '[data-testid="erase-mine"]').catch(() => null) },
      recap: [ev.reference + 0.8, ev.traceEnd - 1.0] };
  });
}

// ---------- RANGOLI: the generator draws, she names the colours
if (ONLY.includes("rangoli")) {
  await api(elder, "open-activity", { activity: "rangoli" });
  await api(elder, "set-rangoli-reference", { festival: "diwali" });
  await ep.waitForSelector('[data-testid="rangoli-canvas"] svg', { timeout: 60000 });
  await sleep(2500);
  const svg0 = await ep.locator('[data-testid="rangoli-canvas"] svg[data-kind]').first().evaluate((n) => n.outerHTML).catch(() => null);
  if (svg0) fs.writeFileSync(path.join(HERE, "film", "public", "svg", "captured-rangoli.svg"), svg0);
  const filled = () => ep.locator('[data-testid="rangoli-canvas"] [data-region-id]').evaluateAll((els) => els.filter((e) => { const f = e.getAttribute("fill"); return f && f !== "none" && f !== "transparent"; }).length).catch(() => 0);
  const before = await filled();
  await shot("rangoli", [[ep, "tablet", 1366, 1024]], async (clock) => {
    const ev = {};
    await sleep(2000);
    if (AGENT) [ev.request, ev.submit] = await say(ep, "बीच में पीला, बाहर लाल", clock);
    else { ev.request = ev.submit = clock(); await api(elder, "fill-region", { phrase: "बीच में पीला, बाहर लाल" }); }
    await until(async () => (await filled()) > before + 1, 150000);
    ev.filled = clock();
    await sleep(4500);
    const svg1 = await ep.locator('[data-testid="rangoli-canvas"] svg[data-kind]').first().evaluate((n) => n.outerHTML).catch(() => null);
    if (svg1) fs.writeFileSync(path.join(HERE, "film", "public", "svg", "captured-rangoli-filled.svg"), svg1);
    return { mode: AGENT ? "agent" : "action", src: "captures/rangoli-tablet.mp4", events: ev, boxes: { canvas: await box(ep, '[data-testid="rangoli-canvas"]') }, recap: [ev.filled + 0.5] };
  });
}

// ---------- GUARD: nothing leaves without her yes; a stale move is refused
if (ONLY.includes("guard")) {
  if (!ONLY.includes("rangoli")) { // a fresh household: put a filled rangoli on her screen first
    await api(elder, "open-activity", { activity: "rangoli" });
    await api(elder, "set-rangoli-reference", { festival: "diwali" });
    await api(elder, "fill-region", { phrase: "बीच में पीला, बाहर लाल" });
    await ep.waitForSelector('[data-testid="rangoli-canvas"] svg', { timeout: 60000 });
    await sleep(2500);
  }
  await shot("guard", [[ep, "tablet", 1366, 1024]], async (clock) => {
    const ev = {};
    await sleep(1500);
    if (AGENT) [ev.request, ev.submit] = await say(ep, "यह रंगोली बच्चों को भेज दो", clock);
    // the draft call holds until she answers on her screen, so it is not awaited here
    else { ev.request = ev.submit = clock(); api(elder, "draft-family-update", { messageHi: "दिवाली की रंगोली, आपके लिए", messageEn: "A Diwali rangoli, for you" }).then((r) => { ev.draftResult = r.status ?? r.errorCode ?? null; }).catch(() => {}); }
    await ep.waitForSelector('[data-testid="approval-card"]', { timeout: 150000 });
    ev.cardShown = clock();
    // the card's picture is a raster made on the server: wait until it has really loaded before the beat
    ev.imageLoaded = await ep.waitForFunction(() => { const i = document.querySelector('[data-testid="approval-card"] img'); return !!i && i.complete && i.naturalWidth > 0; }, null, { timeout: 45000 }).then(() => true).catch(() => false);
    ev.card = clock();
    const card = await box(ep, '[data-testid="approval-card"]');
    await sleep(3000);
    await tap(ep, '[data-testid="decline-send"]');
    ev.decline = clock();
    await ep.waitForSelector('[data-testid="approval-result"]', { timeout: 30000 }).catch(() => {});
    ev.result = clock();
    ev.resultStatus = await ep.locator('[data-testid="approval-result"]').getAttribute("data-status").catch(() => null);
    await sleep(2500);
    // Rahul moves first; the agent's move, made on the board as it was a moment ago, is refused
    await api(elder, "open-activity", { activity: "shatranj" });
    await ep.waitForSelector('[data-testid="shatranj-board"]', { timeout: 30000 });
    await sleep(1500);
    await api(elder, "move-chess-piece", { from: "e2", to: "e4", actor: "elder", personConfirmed: true });
    await until(async () => (await moveCount(fp)) >= 9, 30000, 50);
    const st = await api(elder, "get-session-state", undefined, "GET").catch(() => ({}));
    const rev = st.revision ?? st.state?.revision;
    await sleep(1200);
    await tap(fp, '[data-testid="piece-d7"]', 300);
    await tap(fp, '[data-testid="dest-d5"]', 300);
    ev.familyMove = clock();
    await sleep(300);
    const r = await api(elder, "move-chess-piece", { from: "d7", to: "d6", actor: "agent", personConfirmed: false, expectedRevision: rev });
    ev.staleResult = r.errorCode ?? r.error ?? "ok?";
    await ep.waitForSelector('[data-testid="conflict-card"]', { timeout: 30000 }).catch(() => {});
    ev.conflict = clock();
    await sleep(4000);
    return { mode: AGENT ? "agent" : "action", src: "captures/guard-tablet.mp4", events: ev, boxes: { card, conflict: await box(ep, '[data-testid="conflict-card"]') }, recap: [ev.card + 0.6, ev.conflict + 0.6] };
  });
}

// ---------- TELEGRAM: her "हाँ" sends the picture to the family's Telegram chat (one real message per run)
if (ONLY.includes("telegram")) {
  if (!ONLY.includes("rangoli")) {
    await api(elder, "open-activity", { activity: "rangoli" });
    await api(elder, "set-rangoli-reference", { festival: "diwali" });
    await api(elder, "fill-region", { phrase: "बीच में पीला, बाहर लाल" });
    await ep.waitForSelector('[data-testid="rangoli-canvas"] svg', { timeout: 60000 });
    await sleep(2500);
  }
  await shot("telegram", [[ep, "tablet", 1366, 1024]], async (clock) => {
    const ev = {};
    await sleep(1200);
    ev.request = clock();
    let draft = null;
    api(elder, "draft-family-update", { messageHi: "दिवाली की रंगोली, आपके लिए", messageEn: "A Diwali rangoli, for you" }).then((r) => { draft = r; }).catch(() => {});
    await ep.waitForSelector('[data-testid="approval-card"]', { timeout: 150000 });
    await ep.waitForFunction(() => { const i = document.querySelector('[data-testid="approval-card"] img'); return !!i && i.complete && i.naturalWidth > 0; }, null, { timeout: 45000 }).catch(() => {});
    ev.card = clock();
    const card = await box(ep, '[data-testid="approval-card"]');
    await sleep(2600);
    await tap(ep, '[data-testid="approve-send"]');
    ev.approve = clock();
    await ep.waitForSelector('[data-testid="approval-result"][data-status="sent"], [data-testid="approval-result"][data-status="failed"]', { timeout: 60000 }).catch(() => {});
    ev.result = clock();
    ev.resultStatus = await ep.locator('[data-testid="approval-result"]').getAttribute("data-status").catch(() => null);
    const result = await box(ep, '[data-testid="approval-result"]');
    await sleep(3500);
    for (let i = 0; i < 20 && !draft; i++) await sleep(500);
    const st = await api(elder, "get-session-state", undefined, "GET").catch(() => ({}));
    const a = st.approval || {};
    const tg = { status: a.status ?? draft?.status ?? ev.resultStatus, messageId: a.telegramMessageId ?? null, decidedAt: a.decidedAt ?? null,
      captionHi: a.captionHi ?? null, captionEn: a.captionEn ?? null, imagePath: a.imagePath ?? null, draftStatus: draft?.status ?? null };
    if (tg.imagePath) {
      const r = await elder.request.get(BASE + tg.imagePath).catch(() => null);
      if (r && r.ok()) { fs.writeFileSync(path.join(HERE, "film", "public", "svg", "telegram-sent.svg"), await r.body()); tg.picture = "svg/telegram-sent.svg"; }
    }
    console.log("   telegram:", JSON.stringify(tg));
    return { mode: "action", src: "captures/telegram-tablet.mp4", events: ev, telegram: tg, boxes: { card, result }, recap: [ev.result + 0.5] };
  });
}

await browser.close();
console.log("log ->", LOGF);
