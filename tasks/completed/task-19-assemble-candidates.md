# Task 19: Deterministic candidate assembly (dedup, cap, Fact-wrapping)
Status: DONE
Can run in parallel with: NONE (depends on task-15's schema; task-20
depends on this)

## PLAN
- Goal: The pure, deterministic layer that turns task-17's raw
  discovery results and task-18's raw per-page extraction output into
  final `ProviderCandidate[]` — owning dedup, the discovery cap,
  `Fact<T>` provenance-wrapping, and the "is this even a usable
  candidate" bar. No LLM call, no I/O.
- Inputs: task-15's `ProviderCandidate`/`DiscoveredResult` schemas
  (`backend/src/domain/provider.ts`); task-18's
  `ProviderExtractionResult` shape (as a type dependency only — this
  task does not call `extractProviderFacts` itself, task-20 does and
  passes the result in).
- Outputs: `backend/src/research/assembleCandidates.ts` exporting:
  - `MAX_DISCOVERY_RESULTS = 8` — named constant (style matches D12's
    `MAX_GATHERING_TURNS`), deliberately wider than the final 3-5
    recommendation count per the M7 architecture review. **`8` itself
    is a project tuning decision, not an assignment requirement or a
    value derived from any measurement** — chosen as "clearly more
    than 3-5 without being large enough to strain the Gemini free-tier
    rate limit (D2b) in one turn." Revisit if evidence (eval runs,
    real usage) suggests a different number serves M9/M10 better.
  - `dedupByUrl(results: DiscoveredResult[]): DiscoveredResult[]` —
    exact-URL dedup only, first occurrence wins. Mechanical
    correctness, not identity resolution (that stays M9's job).
  - `assembleCandidate({ url, extraction, retrievedAt }):
    ProviderCandidate | null` — wraps every non-null field in
    `extraction` into `Fact<T>` (`source` = domain parsed from `url`,
    `sourceUrl` = `url`, `retrievedAt` = the given timestamp). Returns
    `null` only if **every** field in `extraction` is null (true
    empty — nothing usable came from this page at all). If **any**
    single field is non-null — including cases where `name` itself is
    null but e.g. `pricing`/`rating`/`contactMethod` are populated —
    the candidate is kept.
  - **Revised candidate bar (project decision, not an assignment
    requirement — the assignment explicitly leaves "what qualifies a
    provider as a candidate" open, per its own DESIGN.md prompt)**:
    originally scoped as "URL + resolvable name," revised after review
    to "URL + at least one useful extracted field." Reasoning: by the
    time a candidate reaches this function, a scrape and a Gemini
    extraction call have already been paid for — discarding real
    extracted data (e.g. pricing, rating) solely because `name`
    specifically came back null throws away paid-for signal on a
    stricter rule than M7 actually needs. A believable failure mode
    exists where a business name renders only as a logo image (not
    parseable from markdown) while surrounding text still yields
    other fields. The floor that's kept: a candidate with literally
    nothing extracted (all ten fields null) is still dropped here —
    that's true noise, not a near-miss, and preserving it would just
    push the identical judgment call downstream without adding
    information.
- Constraints:
  - Pure functions only — no Firecrawl call, no Gemini call, no
    network/timing side effects (caller supplies `retrievedAt`
    explicitly so this stays testable with fixed timestamps).
  - Does not decide *when* a page counts as "scrape failed" (that's
    task-20's job, based on task-17's `markdown: null` signal) — this
    task only decides what to do once it has an extraction result (or
    is told to skip a URL entirely).
  - Do not touch `backend/src/domain/**` (beyond importing types),
    `backend/src/llm/**`, `backend/src/conversation/**`,
    `backend/src/server.ts`.
- Open Questions: none.

## Assignment Alignment
- Requirement type: PROJECT DECISION (mechanism), reinforcing EXPLICIT
  requirements
- Assignment requirement: Part 2's implicit "what qualifies a provider
  as a candidate?" (explicitly listed as a DESIGN.md Assumptions
  question) and Part 5 / Trust & Grounding's provenance requirement.
- Source: `docs/Home Assignment.pdf`, Part 2 (page 2), DESIGN.md
  prompts (page 5), Part 5 / eval criterion #5 (pages 3, 7).
- Rationale: This is where the M7 architecture review's dedup-scope,
  candidate-bar, cap-size, and provenance-label decisions all become
  code — each was independently confirmed against the assignment's
  own open questions (not invented ad hoc). Keeping this logic pure
  and separate from the Firecrawl/Gemini calls (tasks 17/18) makes the
  actual product decisions ("is this a real candidate?") inspectable
  and unit-testable without any mocked network calls.
- Gaps/conflicts found: none.

## IMPLEMENT
### Files Touched
- CREATE: `backend/src/research/assembleCandidates.ts`
- CREATE: `backend/src/research/assembleCandidates.test.ts`
- DO NOT TOUCH: `backend/src/domain/conversation.ts`,
  `backend/src/domain/evidence.ts`, `backend/src/llm/**`,
  `backend/src/conversation/**`, `backend/src/server.ts`,
  `backend/src/research/firecrawlProvider.ts`.

### Implementation Notes
- `source` domain-label derivation: parse the hostname out of `url`
  (e.g. `new URL(url).hostname` → `"jumparoundrentals.com"`), no
  external lookup, no LLM involvement — matches the settled "domain
  name" provenance-label decision.
- `assembleCandidate` builds the `fields` object by checking each of
  `extraction`'s ten fields individually; only non-null ones become
  `Fact<T>` entries in the result's `fields` object (matches task-15's
  `ProviderCandidateFieldsSchema`, where every field is optional).

## VALIDATE
### Unit Tests
- [ ] `dedupByUrl` removes an exact duplicate URL, keeping the first
      occurrence.
- [ ] `dedupByUrl` leaves distinct URLs untouched, including ones with
      only trivial differences (e.g. differing query strings are
      treated as distinct — no fuzzy matching, that's M9's job).
- [ ] `assembleCandidate` with a fully-populated extraction produces a
      `ProviderCandidate` where every populated field is a valid
      `Fact` with the given `url`/`retrievedAt` and a domain-derived
      `source`.
- [ ] `assembleCandidate` with every field null returns `null` (the
      true-empty case).
- [ ] `assembleCandidate` with `extraction.name === null` but at least
      one other field populated (e.g. `pricing`, `rating`) returns a
      valid `ProviderCandidate` — `fields.name` is absent, other
      populated fields are present as `Fact`s. This is the case the
      candidate-bar revision exists for; confirm it's actually kept,
      not silently dropped.
- [ ] `assembleCandidate` with only `name` populated (all other fields
      null) returns a valid `ProviderCandidate` with an otherwise-empty
      `fields` object beyond `name`.
- [ ] `MAX_DISCOVERY_RESULTS` is exported and equals 8.

### Component / Integration Tests
- N/A — no live consumers yet (task-20 wires it in).

### E2E Tests
- N/A.

### Success Criteria
- [ ] All new tests pass; existing suite still passes.
- [ ] `npm run build` clean.
- [ ] Zero I/O, zero LLM calls, zero non-determinism (no `Date.now()`
      or similar called internally — timestamps are always passed in).

## ITERATE
### Outcome
Implemented as scoped, no deviations. `backend/src/research/assembleCandidates.ts`
exports `MAX_DISCOVERY_RESULTS = 8`, `dedupByUrl`, and `assembleCandidate`.
`assembleCandidate` builds `fields` by only assigning a key when the
corresponding `extraction` field is non-null (rather than assigning
`undefined` explicitly), so `fields.name` is genuinely absent — not a
present key with an `undefined` value — matching the "fields.name is
absent" validation requirement precisely. `dedupByUrl` uses a `Set<string>`
over `result.url`, first occurrence wins. `source` is derived via
`new URL(url).hostname`, no external lookup. 7 new tests (all listed
Unit Tests cases), `npm test` 108/108 passing, `npm run build` clean.
Zero I/O, zero LLM calls, zero internal `Date.now()`/non-determinism —
`retrievedAt` is always caller-supplied.

### Knowledge Updates
- `memory-bank/progress.md`: added Task 19 bullet under Implemented,
  plus a Validation Status line (108/108).
- `DESIGN.md`: added one Architecture Decisions bullet on the
  candidate bar ("useful field, not just a name") — this was the one
  point from this task with real product-level significance beyond
  implementation detail; the rest (dedup mechanics, cap value) stays
  at the decisions-log/task-file level per the skill's guidance.
- No new entry added to `memory-bank/decisions.md`: the underlying
  product decision (revised candidate bar, dedup scope, cap size,
  provenance-label choice) was already made and confirmed during the
  M7 architecture review that preceded tasks 15-18, not made or
  changed during this task's implementation. It's documented in this
  task file's own `## PLAN` section and referenced narratively in
  `progress.md`'s task-15 outcome, but was never backfilled as a
  numbered `D`-entry in `decisions.md` — a pre-existing gap, not
  something this task introduced. Flagged under Follow-ups below
  rather than fixed inline, since backfilling it isn't this task's
  scope.

### Follow-ups
- M9 (dedup/identity resolution) will receive some candidates with no
  `name` under the revised bar. M9's design must account for this —
  e.g. treat a nameless candidate as automatically non-mergeable
  (skip name-based matching for it) rather than assuming `name` is
  always available. Not solved here; flagged for M9 planning.
- The M7 architecture review's decisions (revised candidate bar,
  dedup scope, `MAX_DISCOVERY_RESULTS` cap size, domain-name
  provenance label) were never backfilled into `memory-bank/decisions.md`
  as a numbered `D`-entry — they currently live only in task-15/16/17's
  outcomes and this task's `## PLAN`. Worth a small standalone
  backfill task if the decision log's completeness matters for
  interview review; not blocking any current milestone.
