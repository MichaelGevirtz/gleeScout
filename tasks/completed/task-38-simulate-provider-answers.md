# Task 38: Gemini call — simulate raw answers to a provider's questions
Status: DONE
Can run in parallel with: task-37 (disjoint files — evidence.ts/
evidence.test.ts vs. providerResponseSimulation.ts — neither consumes
the other's output)

## PLAN
- Goal: One batched Gemini call per provider that simulates plausible
  answers to that provider's M10 phrased questions, given the
  provider's known FACT context and the user's requirements — raw
  string answers only, no `Simulated<T>` wrapping (task-39's job).
- Inputs: a `ProviderCandidate` (for known FACT context — name,
  pricing, etc.), the current `ConversationState` (for the user's
  requirements — date/time, location, category attributes), and the
  `questions: string[]` produced by M10's `prepareProviderQuestions`
  (per D15, plain strings — no `ProviderGap`/topic dependency).
- Outputs: `simulateProviderAnswers({ candidate, questions, state,
  generate? }) => Promise<string[]>` — one answer per question, same
  order, same length as `questions`.
- Constraints: Reuse task-05's `generateStructuredJson` exactly as
  task-34's `generateProviderQuestions` does (same injectable
  `generate` pattern). One call per provider, not one call per
  question (D14/D15's "limit unnecessary LLM calls" precedent).
  Validate the response has exactly one answer per question (same
  count-mismatch guard as task-34) and that no answer is blank after
  trimming. If `questions` is empty, short-circuit with **no** Gemini
  call and return `[]` (mirrors task-34's empty-gaps short-circuit,
  confirmed via a spy, not just an empty result).
- Open Questions: none.

## Assignment Alignment
- Requirement type: EXPLICIT
- Assignment requirement: Part 5 — "Instead of actually contacting
  providers, simulate their responses using an LLM," with the worked
  example (known $350 starting price / delivery within 20 miles / 4.8
  rating → simulated "available on requested date," "final price:
  $425," "setup requires ~45 minutes").
- Source: `docs/Home Assignment.pdf`, Part 5.
- Rationale: This is the actual LLM simulation step Part 5 describes —
  the model reasons over what's already known (FACT context) plus what
  it's being asked (M10's questions) to produce a plausible
  hypothetical answer, exactly matching the worked example's shape.

## IMPLEMENT
### Files Touched
- CREATE: `backend/src/llm/providerResponseSimulation.ts` —
  `SimulatedAnswersResultSchema`/`SimulatedAnswersResult` (`{ answers:
  string[] }`) and `simulateProviderAnswers({ candidate, questions,
  state, generate? })`.
- CREATE: `backend/src/llm/providerResponseSimulation.test.ts`
- DO NOT TOUCH: `backend/src/llm/providerQuestionPhrasing.ts`,
  `backend/src/providerQuestions/**`, `backend/src/domain/evidence.ts`
  (task-37's schema is consumed by task-39, not here), any HTTP route
  file.

### Implementation Notes
- Reuse (don't duplicate) task-34's `formatContext`-style helper if
  practical, or write a narrow local equivalent — known provider
  name/pricing + requested category/date/location. Do not pull in
  `candidate.inferred` (INFERRED tags) — out of scope per the M11
  planning discussion; simulation grounds itself on FACT context and
  the questions being asked, not reputation signal.
- System instruction must make the hypothetical framing explicit and
  instruct the model to answer as the provider plausibly would (in the
  style of the Part 5 worked example: concrete-sounding, specific
  values), not hedge or refuse to answer because "no real provider was
  contacted." This is a simulation the LLM is asked to perform, not a
  request to fabricate deceptive real-world claims — frame the system
  instruction accordingly.
- Same two post-validation guards as task-34: length mismatch → throw;
  any blank (post-trim) answer → throw.

## VALIDATE
### Unit Tests
- [ ] Non-empty `questions`: `generate` called once with a prompt
      containing all questions + candidate/state context; result is
      the trimmed answers array.
- [ ] Empty `questions`: `generate` is **not** called (spy assertion),
      result is `[]`.
- [ ] Answer-count mismatch (`generate` returns fewer/more answers
      than questions) throws.
- [ ] A blank/whitespace-only answer in the result throws.
- [ ] A genuine `GeminiValidationError` from a fake client propagates
      unchanged (same pattern as task-06/task-11/task-34).

### Component / Integration Tests
- (none yet — task-40 wires this together with task-39)

### E2E Tests
- (none — manual real-API check may be attempted opportunistically if
  Gemini quota allows, non-blocking, same precedent as prior LLM-call
  tasks)

### Success Criteria
- [ ] All relevant tests pass
- [ ] No regressions (`npm test` full suite still green)
- [ ] `npm run build` clean
- [ ] No live network calls in the automated suite (fakes only)
- [ ] Task scope is fully implemented

## ITERATE
### Outcome
Implemented exactly as planned. Created
`backend/src/llm/providerResponseSimulation.ts` mirroring task-34's
`generateProviderQuestions` pattern: `SimulatedAnswersResultSchema`
(`{ answers: string[] }`), a system instruction framing the answers
as an explicit hypothetical simulation (per Part 5's worked example
style — concrete-sounding, specific values, no hedging/refusal), and
`simulateProviderAnswers({ candidate, questions, state, generate? })`
using the same injectable `generate` pattern reusing task-05's
`generateStructuredJson`. Empty `questions` short-circuits with no
Gemini call. Same two post-validation guards as task-34
(length-mismatch throw, blank-answer throw). No
`candidate.inferred` used, per the M11 scoping note. Test file
mirrors task-34's test file: 6 unit tests (empty short-circuit with
spy assertion, single question, multiple questions in order, blank
answer throws, count-mismatch throws, real `GeminiValidationError`
propagates via a fake `GeminiClient`).

Full suite: `npm test` — 32 files, 266 tests, all passing (6 new).
`npm run build` — clean, no errors.

### Knowledge Updates
None beyond what's already captured in decisions.md (D14/D15 — same
injectable-`generate`, one-call-per-entity pattern now used a third
time: task-06/34/38).

### Follow-ups
None. task-39 will wrap these raw string answers into
`Simulated<T>`-typed evidence per task-37's schema; task-40 wires
task-37/38/39 together end-to-end per provider.
