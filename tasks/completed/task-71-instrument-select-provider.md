# Task 71: Instrument selectProvider with trace events
Status: DONE
Can run in parallel with: NONE

## PLAN
- Goal: `selectProvider` (M12 selection route's orchestrator) also
  produces a `TraceEvent[]` narrating M10 gap-driven question
  generation and M11 simulation, and the `/providers/select` route
  writes it to task-69's trace store.
- Inputs: task-69's `TraceEvent`/`appendTraceEvents`; the existing
  `prepareQuestions`/`simulate` injected functions (unchanged
  signatures).
- Outputs: `selectProvider` returns
  `{ answers: {question, answer}[], trace: TraceEvent[] }` instead of
  the bare answers array; `server.ts`'s `/providers/select` route
  calls `appendTraceEvents(sessionId, result.trace)` after a
  successful call, HTTP response body unchanged (`{ answers }`).
- Constraints:
  - Does **not** touch `prepareProviderQuestions.ts` or
    `analyzeGaps.ts` (M10, already `DONE`). `prepareProviderQuestions`
    only returns phrased question strings, not the underlying
    `ProviderGap[]` — so the trace cannot list gap *topics*
    (`availability`/`requirementFit`/`pricing`) without reopening that
    file. Instead the trace shows the actual phrased question text,
    which is equally informative for "what information it still
    needs" (Part 4's framing) and requires no M10 change.
  - Trace is only produced on success — a rejection from
    `prepareQuestions` or `simulate` produces no trace event and
    writes nothing to the store, same as task-70's precedent.
  - No new HTTP route in this task (that's task-72).
- Open Questions: none.

## Assignment Alignment
- Requirement type: BONUS (M13, narrowed scope — see
  `tasks/completed/task-69-trace-domain-and-store.md` and D10's
  2026-08-29 addendum in `decisions.md`)
- Assignment requirement: "An agent trace/debug view showing how the
  recommendation was produced" (Bonus, `docs/Home Assignment.pdf`
  page 8); also directly serves Part 4's "we want to see the agent
  reasoning about what it knows, what it doesn't know, and what
  information it still needs."
- Source: `docs/Home Assignment.pdf`, Bonus section and Part 4.
- Rationale: this is the M10/M11 half of "how the recommendation was
  produced" — the on-demand, per-provider question generation and
  simulated-answer step that runs after a user selects a card.

## IMPLEMENT
### Files Touched
- MODIFY: `backend/src/recommendation/selectProvider.ts`
- MODIFY: `backend/src/recommendation/selectProvider.test.ts`
- MODIFY: `backend/src/server.ts`
- MODIFY: `backend/src/server.test.ts`
- DO NOT TOUCH: `backend/src/providerQuestions/prepareProviderQuestions.ts`,
  `backend/src/providerQuestions/analyzeGaps.ts`,
  `backend/src/providerQuestions/simulateProviderResponses.ts`,
  `backend/src/domain/trace.ts`, `backend/src/store/traceStore.ts`

### Implementation Notes
- Reuses the same small `candidateLabel(candidate)` helper pattern
  task-70 introduced in `generateProviderList.ts` — duplicated locally
  here rather than extracted to a shared module (two call sites,
  matching this project's stated bar for when a shared helper is
  warranted; noted as a possible follow-up, not done speculatively).
- Trace event detail includes the literal phrased question strings
  (already safe/non-sensitive — they're what the user already sees
  paired with answers on the Simulated Q&A screen) but only the
  simulated-answer *count*, not the answer text itself, to avoid
  showing SIMULATED content in two different places in the app.

## VALIDATE
### Unit Tests
- [ ] `selectProvider` still calls `prepareQuestions` then `simulate`
      in order with the same arguments as today (existing test,
      updated only for the new `{ answers, trace }` return shape).
- [ ] Returned `trace` has a `prepareQuestions` event whose `detail`
      lists the exact questions returned by `prepareQuestions`.
- [ ] Returned `trace` has a `simulateAnswers` event whose `detail`
      has the correct answer count and no answer text.
- [ ] A zero-question case (provider already answers everything) still
      produces a `prepareQuestions` event reporting 0, not an omitted
      event.
- [ ] The two existing "propagates a rejection" tests are unaffected
      in behavior (still reject, still never produce/write a trace).

### Component / Integration Tests
- [ ] `POST /conversation/:id/providers/select` still returns
      `200 { answers }` unchanged on success (existing route test,
      mock updated to the new return shape).
- [ ] After a successful call, `getTrace(sessionId)` (task-69)
      includes the events `selectProvider` produced, appended after
      any events already written by a prior `/providers` call for the
      same session (accumulation, per task-69).

### Success Criteria
- [ ] `npm run build` clean
- [ ] `npm test` passes, no regressions

## ITERATE
### Outcome
Implemented as scoped. `selectProvider` now returns
`{ answers, trace }`; `trace` has two events (`prepareQuestions` —
lists the literal phrased questions, even when the count is 0;
`simulateAnswers` — count only, no answer text). `server.ts`'s
`/providers/select` route writes `result.trace` via
`appendTraceEvents` after a successful call; response body
(`{ answers }`) unchanged. 2 new orchestration tests (trace content,
zero-question case) + 1 new assertion in the existing route success
test. `npm test` 324/324 passing (322 pre-existing + 2 new tests),
`npm run typecheck` and `npm run build` both clean. No M10 files
touched, per Constraints.

### Knowledge Updates
None beyond what's already recorded in D10's 2026-08-29 addendum and
`progress.md`'s M13 section.

### Follow-ups
None new — task-72 (the `GET /conversation/:id/trace` debug route) is
next; both `/providers` and `/providers/select` now write to the
trace store, so it has real data to serve.
