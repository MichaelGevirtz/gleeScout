# Task 72: GET /conversation/:id/trace debug route
Status: DONE
Can run in parallel with: NONE

## PLAN
- Goal: expose task-69's trace store over HTTP so a client (task-73's
  frontend screen, or manual inspection) can read a session's trace.
- Inputs: `getTrace` (task-69), `getSession` (existing session store,
  used only for the 404 check — trace itself doesn't require session
  data).
- Outputs: `GET /conversation/:id/trace` — 404 unknown session, 200
  `{ events: TraceEvent[] }` otherwise (`[]` for a known session that
  hasn't run `/providers` or `/providers/select` yet — that's a valid
  "nothing produced yet" state, not an error).
- Constraints: read-only route, no side effects, no phase gate (a
  trace can be legitimately inspected regardless of conversation
  phase), no `runSerialized` (matches `/providers`'s own precedent —
  read-only, nothing written back to `ConversationState`).
- Open Questions: none.

## Assignment Alignment
- Requirement type: BONUS (M13, narrowed scope — see task-69/70/71 and
  D10's 2026-08-29 addendum in `decisions.md`)
- Assignment requirement: "An agent trace/debug view showing how the
  recommendation was produced" (Bonus, `docs/Home Assignment.pdf`
  page 8) — this is the "debug endpoint" half; task-73 is the "view"
  half.
- Source: `docs/Home Assignment.pdf`, Bonus section.
- Rationale: with task-70/71 now writing real trace data, this is the
  minimal route needed to read it back.

## IMPLEMENT
### Files Touched
- MODIFY: `backend/src/server.ts`
- MODIFY: `backend/src/server.test.ts`
- DO NOT TOUCH: `backend/src/domain/trace.ts`, `backend/src/store/traceStore.ts`

### Implementation Notes
- Mirrors the existing `GET /conversation/:id` route's 404 shape
  exactly (`{ error: "Session not found" }`), for consistency with
  every other route in this file.

## VALIDATE
### Component / Integration Tests
- [ ] 404 for an unknown session id.
- [ ] 200 `{ events: [] }` for a known session with no trace yet.
- [ ] 200 `{ events: [...] }` matching exactly what a prior
      `/providers` call wrote for that session.

### Success Criteria
- [ ] `npm run build` clean
- [ ] `npm test` passes, no regressions

## ITERATE
### Outcome
Implemented as scoped. `GET /conversation/:id/trace` added to
`server.ts` — 404 `{ error: "Session not found" }` for an unknown
session (same shape as `GET /conversation/:id`), 200
`{ events: TraceEvent[] }` otherwise (`getTrace` never throws, so no
try/catch needed). No phase gate, no `runSerialized`, read-only. 3 new
route tests (404, empty-trace 200, real-trace-after-a-/providers-call
200 — the last one needed to inline a ready `ConversationState`
directly via `createInitialState` + overrides rather than reuse the
`/providers` describe block's own `readyState` helper, which is local
to that block). `npm test` 327/327 passing (324 pre-existing + 3 new),
`npm run typecheck` and `npm run build` both clean.

### Knowledge Updates
None beyond what's already recorded in D10's 2026-08-29 addendum and
`progress.md`'s M13 section.

### Follow-ups
None new — task-73 (the frontend `TraceScreen`) is next and is the
last planned M13 task; it consumes this route directly.
