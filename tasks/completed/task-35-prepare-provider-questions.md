# Task 35: prepareProviderQuestions orchestration (wire gap analysis + phrasing for one selected provider)
Status: DONE
Can run in parallel with: NONE

## PLAN
- Goal: Given **the single provider the user selected** in the UI (see
  D14) and the current `ConversationState`, produce that provider's
  phrased provider-conversation questions — the M10 entry point M12's
  future selection route will call.
- Inputs: one `ProviderCandidate` (the client-echoed object from the
  M9-ranked list the user selected — see D14; this function does not
  care where it came from, only that it's one candidate), the
  `ConversationState`.
- Outputs: `string[]` — the phrased questions for that provider, in
  the same order as task-33's gap list. `[]` if the provider has no
  gaps (still a valid, meaningful result, not an error).
- Constraints: Standalone function only — no HTTP route wiring, same
  explicit scope boundary M7/M8/M9's orchestrators already set
  (deferred to M12). Operates on exactly one candidate — no array/batch
  shape. A failure in either step is **not** caught here; it propagates
  to the caller (M12's future route, which maps it the same way
  task-12's message route already maps Gemini errors: known Gemini
  error → 502, anything else → 500, no internal detail leaked).
- Open Questions: none.

## Assignment Alignment
- Requirement type: EXPLICIT
- Assignment requirement: Part 4 (see task-33's quote).
- Source: `docs/Home Assignment.pdf`, Part 4.
- Rationale: Completes M10 by wiring task-33 (deterministic gap
  analysis) and task-34 (LLM phrasing) for one provider. Per D14, this
  is invoked once per session — when the user selects a provider — not
  once per M9-ranked candidate. That's the reason this task is scoped
  to a single candidate rather than a list: an earlier draft of this
  task (pre-D14) planned an array-based batch orchestrator with
  per-candidate catch-and-continue resilience, appropriate for
  processing all 5 ranked candidates in the background. D14 replaced
  that trigger model, and batch resilience stopped making sense along
  with it — there is no "other candidate" to fall back to when the one
  thing the user just asked about fails; that failure should surface as
  a real error, not silently resolve to `questions: []` as if nothing
  were missing.

## IMPLEMENT
### Files Touched
- CREATE: `backend/src/providerQuestions/prepareProviderQuestions.ts` —
  `prepareProviderQuestions({ candidate, state, analyze?, phrase? })`
  (both steps injectable, defaulting to task-33's real
  `analyzeProviderGaps` and task-34's real `generateProviderQuestions`,
  same injectable-dependency pattern as task-20/task-25) →
  `Promise<string[]>`.
- CREATE:
  `backend/src/providerQuestions/prepareProviderQuestions.test.ts`
- DO NOT TOUCH: `backend/src/providerQuestions/analyzeGaps.ts`,
  `backend/src/llm/providerQuestionPhrasing.ts` (consumed, not
  modified), any HTTP route file (`backend/src/server.ts`).

### Implementation Notes
- Body is a straight two-step pipeline: `analyze({ candidate, state })`
  → `phrase({ candidate, gaps, state })` → return the phrased
  questions. No try/catch, no per-step fallback — errors from either
  step propagate to the caller unchanged (see PLAN's Constraints).
- Zero gaps is a normal outcome (task-34 already short-circuits with no
  Gemini call in that case) — this function returns `[]` straight
  through, not an error and not a special case to handle here.

## VALIDATE
### Unit Tests
- [x] Candidate with gaps: `analyze` and `phrase` both called once with
      the right arguments, result is the phrased questions from
      `phrase`.
- [x] Candidate with no gaps: `analyze` returns `[]`, `phrase` is still
      called with `[]` (per task-34's contract), result is `[]`.
- [x] `analyze` throwing propagates the same error out of
      `prepareProviderQuestions` unchanged (no catch, no swallow).
- [x] `phrase` throwing propagates the same error out of
      `prepareProviderQuestions` unchanged.

### Component / Integration Tests
- [x] End-to-end test with fake `analyze`/`phrase` for one candidate,
      validating the full call sequence and return shape.

### E2E Tests
- (none — manual real-API smoke test may be attempted opportunistically
  if Gemini quota allows, non-blocking, same precedent as prior tasks)

### Success Criteria
- [x] All relevant tests pass
- [x] No regressions (`npm test` full suite still green)
- [x] `npm run build` clean
- [x] No live network calls in the automated suite (fakes only)
- [x] **M10 (Provider-specific questions) is fully complete** once this
      task lands — the single-provider, on-demand shape confirmed by
      D14
- [x] Task scope is fully implemented

## ITERATE
### Outcome
`backend/src/providerQuestions/prepareProviderQuestions.ts` implemented
exactly per the (D14-revised) plan: `prepareProviderQuestions({
candidate, state, analyze?, phrase? })` — a two-line pipeline
(`analyze` → `phrase`) with no try/catch, so a failure in either step
propagates unchanged to the caller. `AnalyzeFn`/`PhraseFn` injectable
types default to task-33's real `analyzeProviderGaps` and task-34's
real `generateProviderQuestions` respectively (same pattern as
task-20/task-25's injectable dependencies). 5 new tests covering the
happy path, the zero-gap path, both propagation cases (analyze throws /
phrase throws, with phrase confirmed *not* called when analyze throws),
and one end-to-end test combining the real `analyzeProviderGaps` with a
fake `phrase` across a candidate that produces all three gap topics.
`npm test` 250/250 passing (245 pre-existing + 5 new), `npm run build`
clean, no live network calls in the automated suite.

**M10 (Provider-specific questions) is now fully complete** — tasks
33-35 are all `DONE`: `backend/src/providerQuestions/types.ts` (task-33),
`backend/src/providerQuestions/analyzeGaps.ts` (task-33),
`backend/src/llm/providerQuestionPhrasing.ts` (task-34), and
`backend/src/providerQuestions/prepareProviderQuestions.ts` (task-35).
`prepareProviderQuestions` is a standalone function only — not wired to
any HTTP route yet. Per D14, its real caller will be M12's future
provider-selection route, invoked with exactly the one client-echoed
`ProviderCandidate` the user selected, not a batch across M9's ranked
list.

### Knowledge Updates
`memory-bank/progress.md` to record M10's completion (mirroring the
M7/M8/M9 completion-entry style): what was built, current
`npm test`/`npm run build` status, and the explicit note that
`prepareProviderQuestions` awaits M12 for HTTP wiring.

### Follow-ups
- M11 (provider response simulation) is next per the roadmap, and per
  D7's addendum will need a new `Simulated<T>` schema in
  `backend/src/domain/evidence.ts` (anticipated there since task-14,
  landing with its "first real consumer").
- M12 has no task files yet (one-milestone-at-a-time convention) — when
  planned, its provider-selection route task must explicitly state the
  D14 trust-boundary clarification (client-echoed candidate is
  Zod-validated for shape only, never verified as genuine or matched
  against a prior server response) rather than let the schema check
  read as a security check.
