# Task 83: Add fitScore/matchGrade/explanation to the rank trace event
Status: DONE
Can run in parallel with: NONE

## PLAN
- Goal: close a real gap found while debugging a live "why did this
  provider get Poor match" question — the M13 agent trace's "rank"
  step already logs `score`/`dimensionScores` per candidate but was
  never updated (task-79) to include `fitScore`/`matchGrade`, so
  answering "why this grade" required manually re-deriving the
  computation with a scratch script instead of just reading the trace.
- Inputs: `ProviderScore.fitScore`/`matchGrade` (task-79, already
  computed, not recomputed here).
- Outputs: each entry in the "rank" trace event's `detail.scores[]`
  array also carries `fitScore`, `matchGrade`, and `explanation` — the
  trace becomes self-sufficient to answer "why did provider X get
  grade Y and rank Z" without external reproduction.
- Constraints:
  - Purely additive to the existing trace `detail.scores[]` shape — no
    change to `dimensionScores`/`score`, no change to ranking, no new
    trace step, no new endpoint.
  - Do not add a parallel console-logging mechanism — the existing
    trace (persisted per-session, exposed via `GET
    /conversation/:id/trace`, already rendered by `TraceScreen.tsx`)
    is the established, already-approved mechanism for "how was this
    recommendation produced" (D10); duplicating it would be scope
    creep this project has already rejected once (D10 explicitly chose
    a lightweight trace over a full observability stack).
  - Do not touch `selectProvider.ts`'s trace (same one-shared-timestamp
    gap noted in D24 as a separate follow-up, unrelated to this task).
- Open Questions: none. (Scope note: `TraceScreen.tsx`'s rank-step
  rendering was checked before writing this plan and found to be a
  typed, explicit renderer — not generic JSON — so it's now in scope
  too; leaving it out would add the new fields to the API/trace store
  but keep them invisible in the one bonus feature this task exists to
  serve.)

## Assignment Alignment
- Requirement type: RECOMMENDATION (targeted fix to an already-
  implemented BONUS)
- Assignment requirement: "An agent trace/debug view showing how the
  recommendation was produced" (`docs/Home Assignment.pdf` p.8,
  Bonus), and Part 6's "Why this provider ranks where it does."
- Source: `docs/Home Assignment.pdf`, Bonus p.8; Part 6 p.4.
- Rationale: the trace already existed and already logged the 5
  dimension scores, but silently fell out of sync with task-79's new
  fitScore/matchGrade fields, so it could no longer fully answer "how
  was this recommendation produced" for the newest part of the
  recommendation (the match grade) — a real, demonstrated gap, not a
  hypothetical one (surfaced by an actual user question this session).

## IMPLEMENT
### Files Touched
- MODIFY: `backend/src/recommendation/generateProviderList.ts`
- MODIFY: `backend/src/recommendation/generateProviderList.test.ts`
- MODIFY: `frontend/src/screens/TraceScreen.tsx`
- MODIFY: `frontend/src/screens/TraceScreen.test.tsx`
- DO NOT TOUCH: `ranking/**`, `selectProvider.ts`, `server.ts`,
  `domain/trace.ts` (schema's existing `detail: z.record(...)` already
  accepts arbitrary additional keys, no schema change needed)

### Implementation Notes
- Backend: one-line change to the `scores` mapping in the `rank` trace
  event: add `fitScore: p.fitScore, matchGrade: p.matchGrade,
  explanation: p.explanation` alongside the existing `provider`/
  `score`/`dimensionScores` fields.
- Frontend: extend `RankScore` with the three new fields; render
  matchGrade + fitScore (em-dash when null) + explanation inside the
  existing `scoreBlock`, same visual weight as the dimension lines.

## VALIDATE
### Unit Tests
- [ ] `generateProviderList`'s existing "returns a trace describing
      discovery, enrichment, and ranking" test updated to assert the
      three new fields are present in `rankEvent.detail.scores[0]`

### Component / Integration Tests
- [ ] `TraceScreen` renders matchGrade/fitScore/explanation for each
      rank-step score block; null fitScore renders an em-dash, never a
      fabricated number

### Success Criteria
- [ ] `npm test` (backend and frontend) passes, no regressions
- [ ] backend `npm run typecheck`/`npm run build` clean; frontend `npx
      tsc --noEmit` clean

## ITERATE
### Outcome
Implemented as planned, scope widened once (documented in PLAN's Open
Questions note) after finding `TraceScreen.tsx`'s rank-step rendering
is a typed, explicit renderer rather than generic JSON — leaving it
untouched would have left the new fields invisible in the one feature
this task exists to serve. `generateProviderList.ts`'s rank trace
event now carries `fitScore`/`matchGrade`/`explanation` per candidate,
alongside the pre-existing `score`/`dimensionScores`.
`TraceScreen.tsx` renders a grade line ("Wonderful match (fitScore:
0.83)", em-dash for null) and the explanation text inside each score
block. 3 backend test fixtures updated (new required `ProviderScore`
fields) plus the exact-equal trace-detail assertion extended; 2 new
frontend tests (grade+explanation rendering, null-fitScore em-dash).
`backend npm test`: 363/363. `backend npm run typecheck`/`build`:
clean. `frontend npm test`: 144/144. `frontend npx tsc --noEmit`:
clean. No regressions.

The trace (`GET /conversation/:id/trace`, already exposed and
rendered) is now self-sufficient to answer "why did provider X get
grade Y" — every dimension score, the fitScore that was derived from
them, the resulting grade, and the plain-language explanation are all
in one place, closing the exact gap that required manual script
reproduction earlier this session.

### Knowledge Updates
Recorded as D25's closing note in `decisions.md` rather than a new
D-entry — this is a direct, same-day completion of D25's own scope
(the trace should have carried these fields from the start; task-79
simply missed updating the one consumer that duplicates
`ProviderScore`'s shape into a separate trace payload).

### Follow-ups
None — scope was fully implemented as planned (with the one documented
widening above).
