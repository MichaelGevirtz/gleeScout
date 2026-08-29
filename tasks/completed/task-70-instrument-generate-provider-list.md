# Task 70: Instrument generateProviderList with trace events
Status: DONE
Can run in parallel with: NONE

## PLAN
- Goal: `generateProviderList` (M12 list route's orchestrator) also
  produces a `TraceEvent[]` narrating discovery → enrichment → ranking
  → recommendation, and the `/providers` route writes it to task-69's
  trace store.
- Inputs: task-69's `TraceEvent`/`appendTraceEvents`; the existing
  `discover`/`enrich`/`rank` injected functions (unchanged signatures).
- Outputs: `generateProviderList` returns
  `{ providers: ProviderScore[], trace: TraceEvent[] }` instead of
  bare `ProviderScore[]`; `server.ts`'s `/providers` route calls
  `appendTraceEvents(sessionId, result.trace)` after a successful call,
  HTTP response body unchanged (`{ providers }`).
- Constraints:
  - Does **not** touch `discoverProviderCandidates.ts` or
    `enrichProviderCandidates.ts` (M7/M8, already `DONE`) — trace
    detail is derived only from what `generateProviderList` can
    already observe from those functions' existing return values.
    Concretely this means: no separate pre-/post-dedup candidate
    count (dedup happens inside `discoverProviderCandidates`, whose
    return value is already deduped — `generateProviderList` only ever
    sees the final count), and enrichment is bucketed into
    "enriched with signal" / "enriched, no signal found" / "not
    enriched" by inspecting each candidate's `.inferred` field, not a
    true attempted/succeeded/failed breakdown (a failed enrichment and
    a beyond-cap-skipped one both read as "not enriched" from the
    outside — see task-69's Follow-ups for the open option of a richer
    `onStep` callback into M7/M8 later, not done here).
  - Trace is only produced on success — a thrown error (missing
    `serviceCategory`/`location`, or a rejected `discover`/`enrich`,
    or a throwing `rank`) produces no trace event and writes nothing
    to the store, matching the existing 429/502/500 error paths'
    behavior (unchanged).
  - No new HTTP route in this task (that's task-72).
- Open Questions: none.

## Assignment Alignment
- Requirement type: BONUS (M13, narrowed scope — see
  `tasks/completed/task-69-trace-domain-and-store.md` and D10's
  2026-08-29 addendum in `decisions.md`)
- Assignment requirement: "An agent trace/debug view showing how the
  recommendation was produced" (Bonus, `docs/Home Assignment.pdf`
  page 8). `generateProviderList` is one of the two functions that
  literally produce a recommendation.
- Source: `docs/Home Assignment.pdf`, Bonus section.
- Rationale: this is the M7/M8/M9 half of "how the recommendation was
  produced" — discovery, enrichment, and ranking.

## IMPLEMENT
### Files Touched
- MODIFY: `backend/src/recommendation/generateProviderList.ts`
- MODIFY: `backend/src/recommendation/generateProviderList.test.ts`
- MODIFY: `backend/src/server.ts`
- MODIFY: `backend/src/server.test.ts`
- DO NOT TOUCH: `backend/src/research/discoverProviderCandidates.ts`,
  `backend/src/research/enrichProviderCandidates.ts`,
  `backend/src/ranking/rankProviders.ts`, `backend/src/domain/trace.ts`,
  `backend/src/store/traceStore.ts`

### Implementation Notes
- Reuses `buildProviderSearchQuery` (task-16, pure) a second time
  purely for display — safe, since it's the exact same deterministic
  function `discoverProviderCandidates` already calls internally with
  the same inputs; no new coupling to its implementation.
- A small local `candidateLabel(candidate)` helper
  (`fields.name?.value ?? new URL(candidate.url).hostname`) is used
  only for the ranking trace event's per-provider labels — not
  exported, not a shared module, matching this project's precedent of
  small single-use local helpers (`enrichProviderCandidates.ts`'s own
  `buildQueryFor`) rather than a premature shared utility.
- Trace event detail never includes a full `ProviderCandidate` — only
  the query string, counts, and (for ranking) each candidate's label +
  numeric scores.

## VALIDATE
### Unit Tests
- [ ] `generateProviderList` still calls discover → enrich → rank in
      order with the same arguments as today (existing test, updated
      only for the new `{ providers, trace }` return shape).
- [ ] Returned `trace` contains one `discover` event with the correct
      query string and candidate count.
- [ ] Returned `trace`'s `enrich` event correctly buckets a mix of
      candidates with non-empty `.inferred`, empty `.inferred`, and no
      `.inferred` at all.
- [ ] Returned `trace`'s `rank` event lists one entry per ranked
      provider with its label and scores.
- [ ] The three existing "throws before calling discover/enrich/rank"
      and three "propagates a rejection" tests are unaffected in
      behavior (still reject, still never produce/write a trace).

### Component / Integration Tests
- [ ] `POST /conversation/:id/providers` still returns `200 { providers }`
      unchanged on success (existing route test, mock updated to the
      new return shape).
- [ ] After a successful call, `getTrace(sessionId)` (task-69) returns
      the events `generateProviderList` produced.

### Success Criteria
- [ ] `npm run build` clean
- [ ] `npm test` passes, no regressions

## ITERATE
### Outcome
Implemented as scoped. `generateProviderList` now returns
`{ providers, trace }`; `trace` has four events (`discover`, `enrich`,
`rank`, `recommend`) built entirely from data already visible to the
function (no M7/M8 files touched). `server.ts`'s `/providers` route
writes `result.trace` via `appendTraceEvents` after a successful call;
response body (`{ providers }`) unchanged. 1 new orchestration test
(trace content across all four events) + 1 new assertion in the
existing route success test (`getTrace(sessionId)` returns what was
written). `npm test` 322/322 passing (321 pre-existing + 1 new test),
`npm run typecheck` and `npm run build` both clean.

### Knowledge Updates
None beyond what's already recorded in D10's 2026-08-29 addendum and
`progress.md`'s M13 section.

### Follow-ups
None new — task-71 (selectProvider instrumentation) is next, same
established pattern.
