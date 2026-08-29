# GleeScout — High-Level Roadmap

Source of truth: `docs/Home Assignment.pdf`. This is a LEVEL 1
roadmap: milestone-level only. Detailed tasks are created one
milestone at a time in `tasks/current/`.

Legend: **[REQUIRED]** = needed to satisfy an explicit assignment
requirement. **[BONUS]** = assignment-listed bonus, optional.
**[SUPPORT]** = not itself required, but necessary to make a required
part work (e.g. project scaffolding).

## Scope Discipline

Per the assignment's own guidance ("a thoughtful, focused solution is
better than a large unfinished one"), every milestone/task is checked
against this order before it's built:

1. Is this explicitly required by the assignment?
2. If not, is it necessary to support an explicit requirement?
3. If neither, is it a high-value bonus worth the cost?
4. If none of the above, don't build it.

Consequences of this for how the milestones below are read:

- **Bonus work is not committed scope.** M13 (agent trace) is the
  only planned bonus and is the first thing cut if time is
  constrained — everything else in this roadmap ranks above it.
- **Tests and error handling are embedded, not batched at the end.**
  M16/M17 below describe an ongoing practice applied as each
  milestone lands (e.g. Gemini-call error handling ships with M3/M4,
  Firecrawl error handling ships with M7/M8; extraction-merge tests
  ship with M2/M3, ranking tests ship with M9), not a separate
  terminal cleanup pass. They stay in the table for traceability
  against the "Technical Expectations" requirement, not because
  they're deferred.
- **README/DESIGN.md are maintained incrementally** (updated as
  relevant decisions/milestones land) and only need a final pass at
  the end for coherence, not a from-scratch write-up.
- **No production infrastructure** (search indexes, background jobs,
  persistent caches, etc.) is added merely because it would be
  expected at scale — the assignment explicitly excludes it here;
  that thinking belongs in `DESIGN.md`'s Production Evolution section
  instead of in the codebase.

This roadmap stays high-level and may be resequenced or trimmed as
implementation evidence comes in — it is not a commitment to build
all 19 rows as literally listed if a simpler path emerges.

| ID | Title | Goal | Assignment Requirement(s) | Depends on |
|----|-------|------|---------------------------|------------|
| M0 | Project setup | Repo scaffolding, memory bank, skills, CLAUDE.md (this session) | Technical Expectations — runnable local repo | — |
| M1 | Backend scaffold | Minimal Fastify + TS + Zod app, env config, health check | [SUPPORT] | M0 |
| M2 | Domain models & conversation state | Zod schemas for EventRequirements, ConversationState, phase enum; in-memory session store | Part 1, item 6 ("maintain structured event and requirement data behind the conversation") [REQUIRED] | M1 |
| M3 | Gemini requirement extraction | Gemini client wrapper; extract service category + attribute values + confidence from a user message; validate into state | Part 1, items 1–3 [REQUIRED] | M2 |
| M4 | Dynamic question policy | Deterministic date/time+location core only (see D6) + LLM-proposed category-specific attributes, incl. budget; missing-attribute detection over nullable-value slots; readiness gate; LLM phrases the next question(s). (A process-wide cross-session attribute-definition cache was considered and deferred — see D6 — no concrete benefit demonstrated yet; not required for M4 to function.) | Part 1, items 2, 4, 5 [REQUIRED] | M3 |
| M5 | Conversation API | Fastify routes: start conversation, post message, get current conversation state (frontend needs this to render chat/phase — not the M13 agent-trace bonus); per-session request serialization (see D11) so concurrent messages to the same session can't overwrite each other's extracted info, with a concurrency integration test | Part 1 (delivery surface for the whole flow) [REQUIRED] | M4 |
| M6 | Evidence/provenance model | Shared types for FACT (source, url, retrievedAt) used by research & enrichment | Part 2 & Part 5 ("we should always be able to understand which information is observed... versus inferred/simulated") [REQUIRED] | M2 |
| M7 | Firecrawl provider research | Query generation from EventRequirements; Firecrawl search/scrape; structured candidate extraction; dedup; cap at 3–5 | Part 2 [REQUIRED] | M5, M6 |
| M8 | Enrichment | Additional-source scraping (reviews/FAQ/etc.) + LLM analysis of review text → INFERRED tags with evidence pointers | Part 3 (enrichment) [REQUIRED] | M7 |
| M9 | Ranking | Deterministic, explainable weighted scorer (requirement match, geo fit, price fit, reputation, evidence quality) + rationale string | Part 3 (ranking, "generic sort by star rating is not enough") [REQUIRED] | M8 |
| M10 | Provider-specific questions | Deterministic gap analysis (user requirements vs. known provider FACTs) + LLM phrasing of only the gap questions, **for a single provider** — invoked on-demand when the user selects that provider in the UI (see D14), never run as a batch across all ranked candidates | Part 4 [REQUIRED] | M9 (data shape); triggered via M12's selection route |
| M11 | Provider response simulation | LLM simulates that one provider's answers to its M10 questions; strictly tagged SIMULATED; never overwrites FACT — runs immediately after M10 within the same on-demand selection call (see D14) | Part 5 [REQUIRED] | M10 |
| M12 | Recommendation API | **Two routes** (see D14): (1) list route — assembles the M9-ranked provider cards, FACT + INFERRED + rationale only, no SIMULATED data yet since M10/M11 haven't run for any candidate; (2) selection route — client resends the chosen card's full provider data, server runs M10 then M11 for it and returns its questions + simulated answers | Part 6 [REQUIRED] | M9 (list route); M10, M11 (select route) |
| M13 | Agent trace (bonus, **cut first**) | Per-session trace of orchestrator steps; debug endpoint | Bonus — "agent trace/debug view" [BONUS] | M5, M7, M9, M11 |
| M14 | UI/UX design | Three substantially different UX concepts via `ui-ux-design` skill; STOP for selection | Part 6 ("UI doesn't need to be beautiful, but... understandable and thoughtfully designed") [REQUIRED] | M12 |
| M15 | Frontend implementation | React Native/Expo app implementing the selected UX: chat flow + provider cards + trace view if selected | Part 1 & Part 6 (delivery surface) [REQUIRED] | M14 |
| M16 | Error handling *(embedded, not batched)* | Each integration point (Gemini calls, Firecrawl calls, empty results) handles its own failure/fallback when it's built, not as a separate subsystem | Technical Expectations — "Error handling" listed explicitly [REQUIRED] | applies within M3, M4, M7, M8, M12 |
| M17 | Tests *(embedded, not batched)* | Each milestone ships tests for the logic it introduces (extraction merge with M2/M3, readiness gate with M4, dedup with M7, ranking with M9, provenance separation with M6/M11) | Technical Expectations — engineering quality | applies within M2–M12 |
| M18 | README & DESIGN.md *(maintained incrementally)* | Updated as relevant decisions/milestones land; final pass at the end for coherence only | What We'd Like You to Submit [REQUIRED] | ongoing, finalized after M15 |

## Explicitly Deferred / Not Planned

The assignment lists many bonuses; per its own guidance ("don't try
to implement every bonus"), only the agent trace (M13) is planned as
a bonus, because it's low-cost and has high interview value given the
"how does the agent decide what to do next" evaluation criterion. The
following bonuses are consciously **not** planned unless time remains
and will be documented as such in `DESIGN.md`:

- Image or social-media analysis
- Automated suspicious/low-quality provider detection as a distinct
  subsystem (light heuristics may fall out of ranking naturally)
- Full review summarization UI (raw inferred tags are used instead)
- Cost normalization across differing pricing models (beyond simple
  budget-fit comparison)
- Explicit confidence scores as a separate numeric field (evidence
  type — FACT/INFERRED/SIMULATED — serves as the confidence signal
  for this prototype)
- A process-wide, cross-session category-attribute-definition cache
  (drafted as a task during M4 planning, then reconsidered and
  removed before implementation — see D6 in `decisions.md`).
  Within-conversation reuse is already free via `ConversationState`;
  the cross-session version would only be worth building once there's
  observed evidence of real LLM attribute-proposal drift across
  sessions, not speculatively ahead of that evidence.

These are candidate follow-ups, not gaps in required scope.
