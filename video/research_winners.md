# Demo film research: sponsor framing and comparable winners

Researched 2026-11-09. Everything below was seen on the page or in the video's own caption track. "est." marks an estimate made from the transcript, because no video was watched.

## Hackathon facts that shape the film

- Submission is "a public Clips demo of your working app" (https://www.builder.io/hackathon). The rules say "Record a public Clips demonstration showing the actual application in use" and "The recording must be viewable without a login or access request" (https://www.builder.io/hackathon/rules). **No maximum length is stated.**
- Judging (https://www.builder.io/hackathon/rules): Usefulness and Execution 40% ("A clear problem and a complete working flow."), Creativity and Design 20%, Innovation 20% ("rather than adding AI without a clear purpose"), Cleverness and Use of Agent-Native 20% ("Resourceful use of Agent-Native to bring the interface, agent behavior, and application capabilities together.").
- Prizes: $5,000 / $2,500 / $1,500 / $750 / $250.
- I found no earlier Builder.io hackathon or winners list, so the comparable winners below are from the OpenAI WebMCP Challenge (2026).

## Sponsor framing (verbatim)

| # | Phrase | Source |
|---|---|---|
| 1 | "Build AI agents with interfaces people love to use." (hackathon headline) | https://www.builder.io/hackathon |
| 2 | "Define a capability once with `defineAction()`. Your React UI, agent, and integrations call the same code." | https://www.builder.io/hackathon |
| 3 | "the agent and UI share the same actions, data, and application state." | https://www.builder.io/blog/introducing-agent-native (Oct 14 2026, Steve Sewell & Vishwas Gopinath) |
| 4 | "An agentic app is an AI agent that comes with its own app, and the two work as one." | same |
| 5 | "the agent and the UI are equal partners, so anything you can do in the UI, the agent can do too." | same |
| 6 | "Every Agent-Native app is also an MCP server." | same |
| 7 | "One action powers every app surface: UI, agent, HTTP, MCP, A2A, and CLI." | https://www.agent-native.com/docs |
| 8 | "Work done by the agent appears in the UI, and work done in the UI is available to the agent." | https://github.com/BuilderIO/agent-native |
| 9 | "if the UIs can do it, the agent can do it. And if the agent can do it, the UIs can do it." | https://www.builder.io/blog/agent-native-apps (Apr 21 2026) |
| 10 | "Agent + app, not either/or" | same |
| 11 | "Live sync keeps the UI in sync: database changes stream over SSE, with polling as the universal fallback." | https://www.agent-native.com/docs/key-concepts (read in the docs bundled with the installed `@agent-native/core`) |

**Feature names, exactly as written:**

- **Actions / `defineAction`** appear everywhere.
- **Dispatch:** "the workspace control plane" (https://www.agent-native.com/docs/dispatch).
- **Clips:** one of three example agentic apps, and also the submission recorder (https://clips.agent-native.com/).
- **"MCP Apps":** "inline UIs in Claude/ChatGPT" (https://www.agent-native.com/docs/mcp-apps).
- **WebMCP:** "a proposed browser API for making page capabilities available to an agent running in that browser" (https://www.agent-native.com/docs/webmcp).
- **"Agent-Native Toolkit":** described in the launch post.
- **Approvals:** the launch post says users can require approval before sensitive actions. The API flag is `needsApproval` (docs: webmcp, actions-other-surfaces).
- **"live sync"**.
- **Not found:** the phrase "agent is a first-class user" does not appear anywhere I looked. The closest wording is "Render the agent as a first-class participant when it edits." (docs `toolkit-collaboration`). Use "equal partners" instead.

**Sponsor videos.** I found no official launch video; the launch post embeds none. Steve Sewell's channel ("Steve (Builder.io)") has these:

- **"How to build agent-native apps (and what to avoid)"**, 4:57, https://www.youtube.com/watch?v=Yu-0bi0yXhc
  - First sentence: "This is the biggest mistake I see people constantly make when making AI applications."
  - It emphasises a good/better/best ladder: tools plus a loop, then streaming UI with stop and feedback, then an agent native to the app. It stresses that "the agent and the UI to always be in sync" and that buttons should delegate to the agent rather than "just make an LLM call".
- **"Introducing Clips - Open-Source, Agent-Native Loom alternative"**, 2:01, https://www.youtube.com/watch?v=EqmOsEK5DCg
  - First sentence: "If you've ever found it tedious and time-consuming to type out all your feedback to an agent ... there's a way better way now."
  - It opens on a problem and is demoing by about 10s (est.).
- **"Introducing /webmcp - make your agent workflows visual"**, 3:48, https://www.youtube.com/watch?v=nul9dFjZqlY. The transcript was blocked (HTTP 429), so I have no first sentence.

Pattern across the sponsor's own videos: they are short (2 to 5 minutes), first person, name the pain in the first sentence, and the product is on screen almost at once.

## Winners table

Source: the OpenAI WebMCP Challenge, "Meet the winners" (https://webmcp.devpost.com/updates/46049-meet-the-winners).

- About 2,500 projects were submitted.
- There were 10 equal, unranked winners. Each received "$3,500 in cash" ($3,000 from OpenAI plus $500 from Netlify) and sponsor credits.
- Lengths come from YouTube page metadata (`lengthSeconds`). First sentences come from each video's caption track.

| Project | Prize | Video | Length | Product first on screen | Hook | Proof number vs baseline? | First sentence |
|---|---|---|---|---|---|---|---|
| the base repo (Korean elders: calligraphy plus Janggi) | WebMCP winner | https://www.youtube.com/watch?v=Ybw8i32SRGM | 2:28 | est. ~28s (named at 28s) | problem (person group) | Problem stat only: "95.4 for digital access, but only 56.2 for digital capability". No product-vs-baseline number. | "When the places that sustained creative life become unreachable, the web may be the only way back." |
| Alza (floor plan to 3D) | WebMCP winner | https://www.youtube.com/watch?v=RihMFcMstvI | 2:15 | est. 0s | demo-first (finished result) | No baseline. Counts only ("31 typed tools"). Shows an approval gate at about 95 to 110s. | "This house was drawn, measured, furnished, and checked by an AI agent." |
| ArchMorph (home design) | WebMCP winner | https://www.youtube.com/watch?v=wN3q1ukrrqY | 0:56 | est. 0s | demo-first | No ("57 architectural tools") | "This is Archmorph, an architecture studio in the browser, built so a person and an AI agent can design the same building together." |
| Aisle (wedding seating) | WebMCP winner | https://www.youtube.com/watch?v=81zaJ8tASLo | 2:50 | est. ~10s (named), demo by ~30s | problem | No | "Planning a wedding is not easy." |
| Roque Nights (stargazing planner) | WebMCP winner | https://www.youtube.com/watch?v=Jwx0U-7YtfQ | 2:48 | est. ~21s | person (the builder, at a real telescope) | No baseline. Output facts ("New moon, 9 hours of darkness"). | "Hi, I'm Sebastian. I am an AI engineer at the Gran Telescopio Canarias..." |
| Bouquet Studio (flowers) | WebMCP winner | https://www.youtube.com/watch?v=bHujILKVW54 | 2:36 | est. ~7s | person scenario | No | "After years together, your teammate is leaving." |
| Mandate (scoped agent access) | WebMCP winner | https://www.youtube.com/watch?v=dQ29bnnl8W4 | 2:49 | est. ~14s ("This CRM is the host application") | problem | No ("for 10 minutes") | "Fine-grained access control is a solved problem." |
| Faraday (MRI/CT viewer) | WebMCP winner | https://www.youtube.com/watch?v=I8VAziwIzh0 | 0:56 | est. 0s | demo-first | No. Human approval before export at about 28s. | "Faraday is a reading room for MRI and CT that agents can actually operate." |

Two more winners I checked:

- **JupyterLite WebMCP** (https://www.youtube.com/watch?v=B_7dSo4hH0k), 2:34, demo-first. The product is on screen at about 7s (est.).
- **Observatory** (https://www.youtube.com/watch?v=XLIquI5aeeg), 2:46, opens with the person ("Good morning everyone. My name is Martin."). The product is on screen at about 12s (est.).

**Closest precedent to Chaupal: the base repo.**

- It has the same core shape: isolated elders, calligraphy, and a traditional board game played by voice or natural language against the agent.
- Its arc is: problem stat, then each activity in turn, with "the elder still writes, adjusts, and decides", then a thesis line ("turns technical access into human access").
- It has no family-joins-live beat, no non-English voice on screen, and no comparison against a baseline.
- Judges in this space may have seen it, so Chaupal's film should lead with what is new: Hindi voice, family joining live from another city, and Agent-Native actions, live sync and approvals.

## Shared patterns

1. **Short.** 8 of the 10 winners run 2:15 to 2:50 and two run 0:56. The sponsor's own videos run 2 to 5 minutes.
2. **The product shows up fast.** Half are demo-first with the product at about 0 to 10s (est.). Even the problem-led films name the product within about 30s.
3. **The first sentence is a single concrete line.** It is either a vivid result ("This house was drawn ... by an AI agent"), a human moment ("your teammate is leaving"), or one plainly stated pain.
4. **Agent and person share one live surface.** Each film shows both editing the same canvas, and several show a human approval gate (Alza, Faraday, Mandate). This matches the sponsor's "equal partners" and "same actions" message.
5. **No before/after proof numbers.** Numbers are tool counts or a problem stat (the base repo). None of the winners shows a measured improvement against a baseline. Closing lines are a short thesis plus "open source, live now".
