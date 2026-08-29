# Task 34: LLM phrasing of provider gap questions (batched per provider)
Status: DONE
Can run in parallel with: NONE

## PLAN
- Goal: Take task-33's deterministic `ProviderGap[]` for one provider and
  have Gemini phrase each one as a natural, specific question — never
  reconsidering which gaps exist, only wording them (same phrasing-only
  boundary as task-11, applied per-provider instead of per-conversation-
  turn). Per D14, this runs once per session — for the single provider
  the user selected — not once per ranked candidate; this function's
  signature already only ever handled one provider's gaps at a time, so
  nothing here changes structurally.
- Inputs: `ProviderGap[]` (task-33), the `ProviderCandidate` (for
  natural phrasing context — e.g. referencing the provider's own known
  pricing/name), `ConversationState` (for referencing the user's
  request naturally, e.g. "for your event on [date]").
- Outputs: `string[]` of phrased questions, same order/length as the
  input `gaps` array; `[]` straight through with **no Gemini call** if
  `gaps` is `[]` (Part 4's own point — "there is no reason to ask"
  — and directly answers the assignment's "limiting unnecessary LLM
  calls" optimization interest).
- Constraints: Reuses task-05's `generateStructuredJson` wrapper
  (same pattern as task-11/task-18/task-23). One Gemini call per
  provider, not one call per gap — batching a provider's 1-3 gaps into
  a single call, not implemented as a loop calling task-11's
  single-question function N times.
- Open Questions: none.

## Assignment Alignment
- Requirement type: EXPLICIT
- Assignment requirement: Part 4 (see task-33's quote — same
  requirement, LLM-phrasing half). Also touches the Optimizations
  DESIGN.md prompt ("Limiting unnecessary LLM calls") via the
  zero-gaps short-circuit.
- Source: `docs/Home Assignment.pdf`, Part 4; Optimizations section.
- Rationale: D5 requires the LLM to phrase, not decide, what's asked.
  Batching per provider (vs. one call per gap) is a project decision:
  a provider typically has 1-3 gaps, so one call per provider keeps
  cost/latency proportional to gap count, not one Gemini call per gap,
  with no loss of phrasing quality since all gaps for one provider
  share the same context anyway. Per D14, this call happens at most
  once per session (only for the user-selected provider), which is an
  even stronger reason not to fragment it into per-gap calls — the user
  is actively waiting on this response.

## IMPLEMENT
### Files Touched
- CREATE: `backend/src/llm/providerQuestionPhrasing.ts` —
  `ProviderQuestionsResultSchema`/`ProviderQuestionsResult`
  (`{ questions: string[] }`), `generateProviderQuestions({ candidate,
  gaps, state, generate? })`.
- CREATE: `backend/src/llm/providerQuestionPhrasing.test.ts`
- DO NOT TOUCH: `backend/src/providerQuestions/**` (task-33's output is
  consumed, not modified), `backend/src/llm/questionPhrasing.ts`
  (existing M4 file, untouched), `backend/src/llm/geminiClient.ts`.

### Implementation Notes
- System instruction mirrors task-11's: gaps are already decided, not
  the LLM's to add/remove/reorder; respond with exactly one question
  per gap, same order, JSON `{ questions: string[] }`.
- Post-validation sanity checks (mirroring task-11's empty-question
  throw): every returned question is non-empty after `trim()`; the
  returned array length equals `gaps.length` — throw a plain `Error`
  (not a new error class; task-05's `GeminiValidationError` already
  covers schema-shape mismatches, this only guards a valid-shape but
  wrong-length/blank response) otherwise.
- Prompt includes each gap's `topic` + `description` (task-33's
  deterministic text) plus minimal known-provider/known-request context
  for natural phrasing only (candidate name/pricing if known; user's
  service category/date/location) — same "known state for phrasing
  only" framing as `questionPhrasing.ts`'s `formatKnownState`.

## VALIDATE
### Unit Tests
- [x] Empty `gaps` array returns `[]` without invoking `generate` at all
      (assert the injected fake was never called).
- [x] One gap → one phrased question, `generate` called once.
- [x] Multiple gaps (2-3) → same count of phrased questions, in order.
- [x] Blank/whitespace-only question anywhere in the response throws.
- [x] Mismatched response array length (fewer/more questions than gaps)
      throws.
- [x] A `GeminiValidationError` from the underlying wrapper (malformed
      JSON shape) propagates unchanged, reusing task-05's real error
      class via a fake client (same pattern as task-06's test).

### Component / Integration Tests
- (none — no live network calls in the automated suite, consistent with
  every prior LLM-wrapper task)

### E2E Tests
- (none — manual real-API check may be attempted opportunistically if
  Gemini quota allows, non-blocking per D2b's established precedent)

### Success Criteria
- [x] All relevant tests pass
- [x] No regressions (`npm test` full suite still green)
- [x] `npm run build` clean
- [x] No live network calls in the automated test suite
- [x] Task scope is fully implemented

## ITERATE
### Outcome
`backend/src/llm/providerQuestionPhrasing.ts` implemented exactly per
plan: `ProviderQuestionsResultSchema`/`generateProviderQuestions({
candidate, gaps, state, generate? })`, reusing task-05's
`generateStructuredJson`. Zero-gaps short-circuit confirmed with no
`generate` call (asserted via `vi.fn`, not just an empty result).
Post-validation checks both length-mismatch and blank-question cases,
each throwing a plain `Error`, distinct from task-05's
`GeminiValidationError` (which is instead confirmed to propagate
unchanged for a malformed-shape response, via a fake client, same
pattern as task-06/task-11). 6 new tests, `npm test` 245/245 passing
(239 pre-existing + 6 new), `npm run build` clean, no live network
calls in the automated suite.

### Knowledge Updates
`memory-bank/progress.md` to record: M10's second task is done,
245/245 tests passing.

### Follow-ups
None — task-35 (orchestration) is next, wiring task-33 + this task for
one candidate.
