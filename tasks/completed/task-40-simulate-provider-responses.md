# Task 40: simulateProviderResponses orchestration (wire simulation + assembly for one selected provider)
Status: DONE
Can run in parallel with: NONE

## PLAN
- Goal: The single M11 entry point — given one selected provider, its
  M10 phrased questions, and the current state, produce that
  provider's SIMULATED question/answer pairs. Completes M11.
- Inputs: one `ProviderCandidate`, `questions: string[]` (M10's
  `prepareProviderQuestions` output for that same candidate),
  `ConversationState`, `generatedAt: string` (caller-supplied
  timestamp, same convention as task-39).
- Outputs: `simulateProviderResponses({ candidate, questions, state,
  generatedAt, simulate?, assemble? }) => Promise<{ question: string;
  answer: Simulated<string> }[]>` (both steps injectable, defaulting
  to task-38's real `simulateProviderAnswers` and task-39's real
  `assembleSimulatedAnswers` — same injectable-dependency pattern as
  task-25/task-35).
- Constraints: Standalone function only — no HTTP route wiring (that's
  M12's job, per the same explicit scope boundary M7/M8/M9/M10's
  orchestrators already set). Operates on exactly one candidate — no
  array/batch shape. Per D15, a failure in `simulate` is **not**
  caught here; it propagates to the caller unchanged (M12's future
  route maps it the same way task-12 already maps Gemini errors: known
  Gemini error → 502, anything else → 500, no internal detail leaked).
- Open Questions: none — confirmed via D15.

## Assignment Alignment
- Requirement type: EXPLICIT
- Assignment requirement: Part 5 (see task-37/task-38's quotes) —
  this task is what makes Part 5 actually invokable end-to-end for one
  provider.
- Source: `docs/Home Assignment.pdf`, Part 5.
- Rationale: Completes M11 by wiring task-38 (LLM simulation) and
  task-39 (deterministic SIMULATED-tagging) together, mirroring
  task-35's role for M10. Per D14/D15, this is invoked once per
  session — when the user selects a provider — immediately after
  M10's `prepareProviderQuestions`, not once per M9-ranked candidate.

## IMPLEMENT
### Files Touched
- CREATE:
  `backend/src/providerQuestions/simulateProviderResponses.ts`
- CREATE:
  `backend/src/providerQuestions/simulateProviderResponses.test.ts`
- DO NOT TOUCH: `backend/src/llm/providerResponseSimulation.ts`,
  `backend/src/providerQuestions/assembleSimulatedAnswers.ts`
  (consumed, not modified), `backend/src/providerQuestions/
  prepareProviderQuestions.ts` (M10's entry point — this task's
  `questions` input comes from calling it, but that composition is
  M12's future route's job, not this file's), any HTTP route file
  (`backend/src/server.ts`).

### Implementation Notes
- Body is a straight two-step pipeline: `simulate({ candidate,
  questions, state })` → raw `answers: string[]` → `assemble({
  questions, answers, generatedAt })` → return the paired result. No
  try/catch, no per-step fallback (see PLAN's Constraints).
- Empty `questions` is a normal outcome (task-38 already
  short-circuits with no Gemini call in that case) — flows straight
  through to `assemble({ questions: [], answers: [], generatedAt })`
  → `[]`, not a special case to handle here.
- This task does **not** call `prepareProviderQuestions` (M10) itself
  — `questions` is a parameter, not derived internally. Keeping M10
  and M11 as two separately-callable functions (rather than one
  fused M10+M11 function) is a deliberate interface choice: it lets a
  future M12 route call them as two explicit, individually-testable
  steps in sequence, matching D14's "runs immediately after M10 within
  the same on-demand selection call" wording (two calls in the same
  request, not one merged function).

## VALIDATE
### Unit Tests
- [ ] Non-empty `questions`: `simulate` and `assemble` both called
      once with the right arguments, result is `assemble`'s return
      value.
- [ ] Empty `questions`: `simulate` is still called with `[]` (per
      task-38's contract), `assemble` is still called with `{
      questions: [], answers: [] }`, result is `[]`.
- [ ] `simulate` throwing propagates the same error out of
      `simulateProviderResponses` unchanged (no catch, no swallow),
      and `assemble` is confirmed **not** called in that case.
- [ ] `assemble` throwing propagates the same error out of
      `simulateProviderResponses` unchanged.

### Component / Integration Tests
- [ ] End-to-end test with fake `simulate`/real `assemble` (or vice
      versa) for one candidate, validating the full call sequence and
      return shape, and asserting the result's `answer` fields
      validate against `SimulatedSchema(z.string())`.
- [ ] Regression check: `ProviderCandidate` passed in is unchanged
      after the call (confirms SIMULATED data is never written back
      onto the candidate — D15 point 2).

### E2E Tests
- (none — manual real-API smoke test may be attempted opportunistically
  if Gemini quota allows, non-blocking, same precedent as prior tasks)

### Success Criteria
- [ ] All relevant tests pass
- [ ] No regressions (`npm test` full suite still green)
- [ ] `npm run build` clean
- [ ] No live network calls in the automated suite (fakes only)
- [ ] **M11 (Provider response simulation) is fully complete** once
      this task lands
- [ ] Task scope is fully implemented

## ITERATE
### Outcome
Implemented exactly as planned. `simulateProviderResponses.ts` is a
straight two-step pipeline — `simulate({ candidate, questions, state
})` → `assemble({ questions, answers, generatedAt })` — with both
steps injectable (defaulting to task-38's real
`simulateProviderAnswers` and task-39's real
`assembleSimulatedAnswers`), no try/catch, no HTTP wiring. 6 unit
tests: non-empty call sequence, empty-questions pass-through,
simulate-throws propagation (assemble not called), assemble-throws
propagation, real-`assemble` end-to-end with `SimulatedSchema`
validation, and a candidate-not-mutated regression check. Full
suite: 34 files / 276 tests pass. `npm run build` clean. No
deviations from the task file. **M11 (Provider response simulation)
is now fully complete.**

### Knowledge Updates
None — mirrors task-35's orchestrator role for M10; no new
architectural decision.

### Follow-ups
None from this task directly. M12 (Recommendation API) is next per
the roadmap — it still has no task files yet, and per D14 must cover
two routes (initial FACT+INFERRED list; on-demand selection route
composing M10 (`prepareProviderQuestions`) + M11
(`simulateProviderResponses`) for one client-echoed candidate), with
the D14 addendum's trust-boundary clarification stated explicitly.
