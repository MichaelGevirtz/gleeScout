# Task 78: Real per-step timing in generateProviderList's trace events
Status: DONE
Can run in parallel with: task-77

## PLAN
- Goal: `generateProviderList`'s trace events (`discover`/`enrich`/
  `rank`/`recommend`) carry real per-step timing, so a future "why was
  this request slow" question can be answered from the trace endpoint
  instead of needing a code trace like this one.
- Inputs: `generateProviderList.ts`'s existing four-event trace
  (task-70); `TraceEventSchema` (`backend/src/domain/trace.ts`).
- Outputs: `TraceEventSchema` gains an optional `durationMs: number`
  field; each of the four trace events' `timestamp` reflects when that
  step actually completed (not one shared timestamp computed after
  everything finished, as today), and `durationMs` reflects that
  step's own wall-clock time.
- Constraints:
  - Today's bug, concretely: `generateProviderList.ts` computes
    `const timestamp = new Date().toISOString()` once, *after*
    `discover`/`enrich`/`rank` have all already resolved, and reuses
    it for all four events — so the persisted trace currently cannot
    show which step was slow. This task fixes exactly that.
  - Scoped to `generateProviderList.ts` only. `selectProvider.ts`
    (task-71's trace instrumentation) is not touched — same kind of
    timing gap may exist there, but that's a separate, equally-small
    follow-up, not bundled into this task.
  - `durationMs` must be additive/optional on the schema — do not
    break any existing consumer of `TraceEvent` (frontend trace
    screen, `traceStore.ts`) that doesn't read it.
  - Do not change what each event's `detail`/`summary` says — only
    `timestamp` accuracy and the new `durationMs` field.
  - Does not touch `discoverProviderCandidates.ts` or
    `enrichProviderCandidates.ts` — same boundary task-70 already
    established (trace derived only from what `generateProviderList`
    can observe from those functions' return values, not from inside
    them).
- Open Questions: none.

## Assignment Alignment
- Requirement type: RECOMMENDATION (supports the already-implemented
  BONUS)
- Assignment requirement: Bonus section, "An agent trace/debug view
  showing how the recommendation was produced."
- Source: `docs/Home Assignment.pdf`, Bonus section (p.8).
- Rationale: the trace (M13, `tasks/completed/task-70-*.md`) already
  exists as this project's one implemented bonus. As built today it
  cannot actually show *how long* any step took — only that it
  happened — which undercuts "how the recommendation was produced"
  for the one question that matters most when investigating latency
  (this task exists because that exact gap blocked diagnosing a real
  slow request). Fixing it is a small, targeted correction to existing
  bonus scope, not new scope.

## IMPLEMENT
### Files Touched
- MODIFY: `backend/src/domain/trace.ts`
- MODIFY: `backend/src/domain/trace.test.ts`
- MODIFY: `backend/src/recommendation/generateProviderList.ts`
- MODIFY: `backend/src/recommendation/generateProviderList.test.ts`
- DO NOT TOUCH: `backend/src/research/discoverProviderCandidates.ts`,
  `backend/src/research/enrichProviderCandidates.ts`,
  `backend/src/ranking/rankProviders.ts`, `backend/src/server.ts`,
  `backend/src/store/traceStore.ts`, `backend/src/recommendation/selectProvider.ts`

### Implementation Notes
- Capture `Date.now()` immediately before and after each of the
  `discover`/`enrich`/`rank` calls already made in
  `generateProviderList` (no new calls, just timing the existing
  ones); `recommend`'s event has no real work of its own (it just
  summarizes the ranked result) so its `durationMs` will legitimately
  be ~0 and its `timestamp` matches `rank`'s completion.
- Each event's `timestamp` becomes `new Date(<that step's own end
  time>).toISOString()` instead of one value shared by all four.

## VALIDATE
### Unit Tests
- [ ] `TraceEventSchema` accepts an event with `durationMs` present
      and one without it (optional field, backward compatible).
- [ ] `generateProviderList`'s trace test asserts the four events'
      `timestamp`s are non-decreasing and distinct where the
      underlying phases take measurable time (e.g., via injected
      `discover`/`enrich`/`rank` fakes with an artificial delay), not
      four identical values as today.
- [ ] Each event's `durationMs` is a non-negative number.
- [ ] Existing "trace only produced on success, nothing on a thrown
      error" behavior (task-70) is unchanged.

### Component / Integration Tests
- [ ] `POST /conversation/:id/providers` → `GET /conversation/:id/trace`
      round-trip (existing route test) still returns the same four
      steps, now with real timing fields, response body otherwise
      unchanged.

### Success Criteria
- [ ] `npm run typecheck` and `npm run build` clean
- [ ] `npm test` passes, no regressions
- [ ] No change to the `/providers` or `/trace` route response shapes
      beyond the new optional `durationMs` field inside trace events

## ITERATE
### Outcome
Implemented as scoped. `TraceEventSchema` gained an optional
`durationMs: number` field (`.nonnegative()`). `generateProviderList.ts`
now captures `Date.now()` around each of `discover`/`enrich`/`rank`
and stamps each of the four trace events with its own step's real
completion `timestamp` and `durationMs`, instead of one shared
timestamp computed after everything finished; `recommend` gets
`durationMs: 0` and `rank`'s completion timestamp, since it has no
real work of its own. No changes to `detail`/`summary` content, route
response shapes, or any file outside the four listed. `npm test`: 39
files / 350 tests passing (4 new in `domain/trace.test.ts` — accepts/
rejects `durationMs`; 1 new in `generateProviderList.test.ts` proving
real per-step timing via injected `discover`/`enrich` fakes with
artificial delay). `npm run typecheck` and `npm run build` both clean.

### Knowledge Updates
`memory-bank/decisions.md` D24 added. `memory-bank/progress.md`
updated with this task's entry. DESIGN.md not changed — this is an
implementation-detail-level fix (a new optional field, timing
accuracy) to an already-documented bonus feature, not a new
architecture point.

### Follow-ups
- `selectProvider.ts`'s own trace events (task-71) likely have the
  same one-shared-timestamp gap this task fixed here — a natural,
  equally small next task, not bundled into this one (see D24).
- Neither this task nor task-77 has been observed against a live
  request with real `GEMINI_API_KEY`/`FIRECRAWL_API_KEY` yet. Now that
  real per-step timing exists, a manual check against the real
  "clown, New York" scenario (hit `/providers` for a real session,
  then `GET /trace`) would let the two improvements actually be
  measured together instead of reasoned about from code.
- The frontend trace screen and `TransitionScreen`'s cosmetic 3-step
  loop still don't read `durationMs` or reflect real backend progress
  — that's the separate, larger UI change flagged as recommendation
  #4 in the original latency investigation, deliberately not folded
  into task-77/78.
