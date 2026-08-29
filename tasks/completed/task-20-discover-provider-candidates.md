# Task 20: Provider discovery orchestration
Status: DONE
Can run in parallel with: NONE (depends on tasks 16, 17, 18, 19 all
being complete)

## PLAN
- Goal: A single standalone function that wires the search-query
  builder, Firecrawl boundary, per-page extraction, and deterministic
  assembly together end-to-end, given known category + location —
  completing M7. Not wired into any HTTP route or the conversation
  flow yet (per the M7 architecture review: that's deferred to
  whichever later milestone actually needs to trigger this, e.g. a
  future Recommendation API).
- Inputs: `serviceCategory: string`, `location: string` (same narrowed
  precondition as task-16 — this function does not accept a full
  `ConversationState` and does not itself decide readiness; the caller
  ensures both are known before calling).
- Outputs: `backend/src/research/discoverProviderCandidates.ts`
  exporting `discoverProviderCandidates({ serviceCategory, location,
  search?, extract? }): Promise<ProviderCandidate[]>` — `search`/
  `extract` injectable (default to task-17's `searchProviderPages` and
  task-18's `extractProviderFacts` respectively), matching the
  existing injectable-dependency pattern used throughout `llm/` and
  `conversation/`.
- Constraints:
  - Per-candidate extraction calls run **sequentially**, not in
    parallel — a deliberate choice given Gemini's documented free-tier
    limit (D2b: 5 `generateContent` requests/minute), not an oversight.
    **This is a current implementation decision driven by today's
    Gemini quota and a preference for simplicity, not an architectural
    limitation of the pipeline** — nothing about `discoverProviderCandidates`'s
    shape (sequential `for`-loop calling an injected `extract`)
    prevents swapping in a bounded-concurrency or `Promise.all` version
    later; only the loop body would change. Parallelizing is a
    legitimate future optimization (and lines up with the assignment's
    own "parallel provider research" bonus) but is explicitly out of
    scope for this task — do not add it now.
  - Whole-request Firecrawl failure (from task-17) propagates
    unchanged — this function does not catch it.
  - A single candidate's extraction failure (a thrown error from
    task-18, or `markdown: null` from task-17 meaning that one page's
    scrape failed) is caught/skipped **per candidate** — the loop
    continues to the next URL rather than aborting the whole
    operation. This is the layer where the "skip entirely on failure"
    decision actually applies; it is distinct from whole-request
    failure, which is not a per-candidate concern and is not caught
    here.
  - No new API route, no wiring into `orchestrateMessage.ts` or
    `server.ts`.
  - Do not touch `backend/src/domain/**`, `backend/src/conversation/**`,
    `backend/src/server.ts`, or any file inside `backend/src/research/`
    other than the new one.
- Open Questions: none.

## Assignment Alignment
- Requirement type: EXPLICIT
- Assignment requirement: Part 2 — "find real service providers that
  could potentially fulfill the request," end-to-end. Also Technical
  Expectations: "Agent orchestration," "Tool calling."
- Source: `docs/Home Assignment.pdf`, Part 2 (page 2), Technical
  Expectations (page 4).
- Rationale: This is the task that makes M7 actually work as a whole —
  every prior M7 task is a piece; this is the wiring, mirroring how
  `orchestrateMessage.ts` (task-12) wired together tasks 06/07/09/11
  for M4/M5. Keeping it a standalone function (no route, no
  auto-trigger) matches the project's "don't build ahead of a real
  consumer" principle — M9 (dedup) and M10 (ranking) don't exist yet
  to make a wired-in trigger useful, and premature wiring would risk
  needing rework once they land.
- Gaps/conflicts found: none.

## IMPLEMENT
### Files Touched
- CREATE: `backend/src/research/discoverProviderCandidates.ts`
- CREATE: `backend/src/research/discoverProviderCandidates.test.ts`
- DO NOT TOUCH: `backend/src/domain/**`, `backend/src/conversation/**`,
  `backend/src/server.ts`, `backend/src/research/searchQuery.ts`,
  `backend/src/research/firecrawlProvider.ts`,
  `backend/src/research/assembleCandidates.ts`,
  `backend/src/llm/providerExtraction.ts` (consume, do not modify).

### Implementation Notes
- Sequence: `buildProviderSearchQuery` → `search` (with
  `limit: MAX_DISCOVERY_RESULTS`) → `dedupByUrl` → `for` loop over
  deduped results, `await`ing `extract` one at a time, wrapping each
  in try/catch that skips on failure (and skips outright when
  `markdown` is `null`) → `assembleCandidate` per surviving result →
  filter out `null`s → return.
- `retrievedAt` for each candidate is captured at the moment its
  extraction call resolves (`new Date().toISOString()`), not a single
  batch timestamp — matches the settled per-candidate timing decision.

## VALIDATE
### Unit Tests
- [ ] Fake `search` returns 3 distinct results, fake `extract` returns
      a populated result for each — output is 3 `ProviderCandidate`s,
      `extract` called exactly 3 times, in order (proving sequential,
      not concurrent, execution — e.g. via a call-order/timing fake
      similar in spirit to task-13's concurrency tests, but proving
      the opposite: no overlap).
- [ ] Fake `search` returns a result with `markdown: null` — that URL
      is skipped, `extract` is never called for it, and it doesn't
      appear in the output.
- [ ] Fake `extract` throws for one of several candidates — that one
      is skipped, the rest still produce candidates, and the function
      does not reject overall.
- [ ] Fake `extract` returns `name: null` but another field populated
      (e.g. `pricing`) for one candidate — kept in output per task-19's
      revised candidate bar (URL + at least one useful field, name
      optional), with `fields.name` absent; rest unaffected.
- [ ] Fake `extract` returns every field null for one candidate —
      dropped from output (the true-empty floor from task-19), rest
      unaffected.
- [ ] Fake `search` throws (whole-request failure) — the function
      rejects; the error propagates unchanged, is not swallowed.
- [ ] Duplicate URLs from `search` result in only one extraction call
      for that URL (dedup applied before extraction, not after —
      avoids wasted Gemini calls on known duplicates).

### Component / Integration Tests
- [ ] End-to-end against fakes for both `search` and `extract`
      (no real network calls) confirms the full pipeline shape: given
      category+location in, a `ProviderCandidate[]` out, matching
      task-15's schema.

### E2E Tests
- N/A. Manual real-API smoke check recommended at completion, subject
  to Gemini/Firecrawl quota availability (non-blocking, same pattern
  as prior LLM-integration tasks).

### Success Criteria
- [ ] All new tests pass; existing suite still passes.
- [ ] `npm run build` clean.
- [ ] **M7 (Firecrawl provider research) is complete** once this task
      lands — `discoverProviderCandidates` is the first real, callable
      consumer of the whole M7 pipeline (tasks 15-20).
- [ ] No live network calls in `npm test`.

## ITERATE
### Outcome
Implemented as planned, no deviations. `discoverProviderCandidates`
wires `buildProviderSearchQuery` → injected `search` (default
`searchProviderPages`, `limit: MAX_DISCOVERY_RESULTS`) → dedup (via
`assembleCandidates.ts`'s `dedupByUrl`, applied to the search results
before extraction, with markdown paired back per-URL from the first
occurrence) → sequential `for` loop over the deduped results,
`await`ing injected `extract` (default `extractProviderFacts`) one at
a time → per-candidate try/catch skip on thrown error, and an
up-front skip when `markdown` is `null` (no `extract` call in that
case) → `assembleCandidate` with `retrievedAt` captured immediately
after each `extract` call resolves → filter out `null`s → return.
Whole-request `search` failure is not caught and propagates as-is.

8 new tests added (7 unit + 1 integration), all against fakes only —
no live network calls. Full suite: `npm test` 124/124 passing (116
pre-existing + 8 new). `npm run build` clean. Only the two new files
were touched (`discoverProviderCandidates.ts`,
`discoverProviderCandidates.test.ts`); nothing else in
`backend/src/research/` or the DO-NOT-TOUCH list was modified.

**M7 (Firecrawl provider research) is complete.**
`discoverProviderCandidates` is not wired into any route or the
conversation flow, per the task's explicit scope — it is a standalone,
directly-testable function awaiting a real consumer (M9/M10/a future
Recommendation API).

### Knowledge Updates
- M7 is fully complete (tasks 15–20 all `DONE`). `memory-bank/roadmap.md`
  and `memory-bank/progress.md` should reflect this; M8 (Enrichment) is
  now unblocked per the roadmap's dependency column.
- No architectural decisions were made or changed during this task —
  it followed task-19's `assembleCandidate`/`dedupByUrl` API and
  task-12's established injectable-dependency pattern exactly as
  specified in `## IMPLEMENT`.

### Follow-ups
- Wiring `discoverProviderCandidates` into an actual API route or the
  conversation flow is explicitly deferred — next real consumer is
  whichever milestone needs it (M9 dedup, M10 ranking, or a
  Recommendation API), not created speculatively here.
- Parallelizing per-candidate extraction (currently sequential by
  deliberate choice) is a legitimate future optimization tied to the
  assignment's "parallel provider research" bonus — not attempted
  here given the known Gemini free-tier rate limit (D2b).
