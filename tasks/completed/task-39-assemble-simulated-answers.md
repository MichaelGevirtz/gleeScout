# Task 39: Deterministic assembly of Simulated<T> answers (question/answer pairing)
Status: DONE
Can run in parallel with: NONE

## PLAN
- Goal: Pure function that pairs each phrased question with its raw
  simulated answer (task-38's output) and wraps the answer in task-37's
  `Simulated<string>` envelope — the deterministic "tag it SIMULATED"
  step, analogous to task-19/task-24's Fact/Inferred-wrapping role.
- Inputs: `questions: string[]`, `answers: string[]` (task-38's output,
  same order/length), `generatedAt: string` (caller-supplied, per the
  no-internal-`Date.now()` convention already used by
  `assembleCandidate`/`assembleInferredTags`).
- Outputs: `assembleSimulatedAnswers({ questions, answers, generatedAt
  }) => { question: string; answer: Simulated<string> }[]`.
- Constraints: Pure function — no I/O, no LLM/Firecrawl call, no
  internal `Date.now()`. No dedup/capping logic (there's no meaningful
  notion of a duplicate question here — task-38 already guarantees
  `answers.length === questions.length`). Throws if `questions.length
  !== answers.length` (defensive — task-38 already guarantees this,
  but this function must not silently mismatch pairs if called with
  mismatched arrays directly, e.g. in a test or a future caller).
- Open Questions: none.

## Assignment Alignment
- Requirement type: PROJECT DECISION
- Assignment requirement: supports Part 5's "clearly separated ...
  observed / sourced versus inferred / simulated" requirement.
- Source: `docs/Home Assignment.pdf`, Part 5.
- Rationale: The assignment doesn't mandate a specific code shape for
  "clearly separated" — this deterministic wrapping step is this
  project's chosen mechanism (consistent with `CLAUDE.md`'s
  architecture principle: "Deterministic application logic owns
  structured state ... provenance. The LLM contributes to state but is
  never the authoritative source of application state.") The LLM
  (task-38) produces raw answer text only; this function is what
  actually stamps `generatedAt` and produces the typed `Simulated<T>`
  value the rest of the system can trust as correctly tagged.

## IMPLEMENT
### Files Touched
- CREATE:
  `backend/src/providerQuestions/assembleSimulatedAnswers.ts`
- CREATE:
  `backend/src/providerQuestions/assembleSimulatedAnswers.test.ts`
- DO NOT TOUCH: `backend/src/domain/evidence.ts` (task-37's schema is
  only consumed here, not modified), `backend/src/llm/**`,
  `backend/src/domain/provider.ts`.

### Implementation Notes
- One line of real logic per pair: `{ question: questions[i], answer:
  { value: answers[i], generatedAt } }`. Keep this genuinely minimal —
  resist adding fields (no `basis`/confidence/rationale field; not
  required by the assignment and explicitly excluded from this
  project's scope per the roadmap's "Explicitly Deferred" section on
  confidence scores).

## VALIDATE
### Unit Tests
- [ ] Matching-length `questions`/`answers` produce the correct
      `{ question, answer: { value, generatedAt } }[]` pairing, in
      order.
- [ ] Empty `questions`/`answers` (both `[]`) returns `[]`.
- [ ] Mismatched lengths throws.
- [ ] Output validates against `SimulatedSchema(z.string())` for every
      element's `answer` field (confirms task-37's schema and this
      function's output actually agree).

### Component / Integration Tests
- (none — task-40 wires this together with task-38)

### E2E Tests
- (none)

### Success Criteria
- [ ] All relevant tests pass
- [ ] No regressions (`npm test` full suite still green)
- [ ] `npm run build` clean
- [ ] Pure function only — no I/O, no LLM/Firecrawl call, no internal
      `Date.now()`
- [ ] Task scope is fully implemented

## ITERATE
### Outcome
Implemented exactly as planned. `assembleSimulatedAnswers.ts` pairs
`questions[i]`/`answers[i]` into `{ question, answer: { value,
generatedAt } }[]`, throwing on length mismatch. 4 unit tests (in-
order pairing, empty-arrays, mismatched-length throw, output
validates against `SimulatedSchema(z.string())`). Full suite: 33
files / 270 tests pass. `npm run build` clean. No deviations from the
task file.

### Knowledge Updates
None — this is a small, self-contained deterministic-wrapping step
consistent with the existing `assembleInferredTags`/`assembleCandidates`
pattern; no new architectural decision was made.

### Follow-ups
None. Task 40 (end-to-end orchestration wiring `prepareProviderQuestions`
+ `simulateProviderAnswers` + this function together) is next per M11's
plan.
