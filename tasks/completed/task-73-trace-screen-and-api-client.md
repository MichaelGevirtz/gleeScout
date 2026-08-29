# Task 73: TraceScreen component + fetchTrace API client function
Status: DONE
Can run in parallel with: NONE

## PLAN
- Goal: a standalone, presentational, prop-driven `TraceScreen` that
  renders task-69/70/71/72's trace data as a human-readable
  debug/transparency view — plus the API client function that fetches
  it. No wiring into `App.tsx` yet (that's task-74) — same split M15
  used between building screens (tasks 48-53) and wiring them in
  (task-54).
- Inputs: `GET /conversation/:id/trace`'s `{ events: TraceEvent[] }`
  shape (task-72, already live on the backend).
- Outputs:
  - `frontend/src/domain/types.ts` — new `TraceEvent` interface
    mirroring the backend's `backend/src/domain/trace.ts` exactly.
  - `frontend/src/api/client.ts` — new `fetchTrace(sessionId)`.
  - `frontend/src/screens/TraceScreen.tsx` — new component, props
    `{ events: TraceEvent[], onBack: () => void }`, no fetching inside
    the component (matches every other M15 screen).
- Constraints:
  - No `App.tsx`/`RecommendationsScreen.tsx` changes in this task —
    the entry-point affordance and screen-state wiring are task-74.
  - Never render a full `ProviderCandidate` — only what's already in
    each `TraceEvent.detail` (query strings, counts, provider labels +
    numeric scores, question text).
  - Renders per-`step` content by a small switch over the six known
    step names (`discover`/`enrich`/`rank`/`recommend`/
    `prepareQuestions`/`simulateAnswers`) rather than a generic
    JSON-object pretty-printer — this project's trace events have a
    small, fully-known set of shapes (all defined in task-70/71), so a
    generic renderer would just be indirection with no real payoff. An
    unrecognized `step` renders its `summary` only (safe fallback, not
    a hard error).
  - Explicit "Debug / Transparency View" banner at the top, per the
    scope-widening discussion — this must never be mistaken for normal
    product UI.
- Open Questions: none.

## Assignment Alignment
- Requirement type: BONUS (M13, widened scope — see D10's 2026-08-29
  addendum in `decisions.md` and `progress.md`'s M13 section)
- Assignment requirement: "An agent trace/debug view showing how the
  recommendation was produced" (Bonus, `docs/Home Assignment.pdf`
  page 8) — this is the "view" half; task-72 already built the "debug
  endpoint" half.
- Source: `docs/Home Assignment.pdf`, Bonus section.
- Rationale: a JSON API response alone doesn't satisfy "view"
  literally; this is the smallest component that does.

## IMPLEMENT
### Files Touched
- CREATE: `frontend/src/screens/TraceScreen.tsx`
- CREATE: `frontend/src/screens/TraceScreen.test.tsx`
- MODIFY: `frontend/src/domain/types.ts`
- MODIFY: `frontend/src/api/client.ts`
- MODIFY: `frontend/src/api/client.test.ts`
- DO NOT TOUCH: `frontend/src/App.tsx`,
  `frontend/src/screens/RecommendationsScreen.tsx`

### Implementation Notes
- `fetchTrace` is a bodyless `GET`, matching `getConversation`'s
  existing pattern exactly (`Content-Type` omitted per D-whatever
  governs `request()`'s existing bodyless-omission behavior — task-60).
- Numbered sections render in the order events arrive (the trace
  store is append-only and already ordered), not a hardcoded fixed
  step order — a session where `/providers` was called twice (e.g. the
  user re-searched) shows every run, in order, honestly.

## VALIDATE
### Unit Tests
- [ ] `fetchTrace` returns `{ events }` on success.
- [ ] `fetchTrace` throws `ApiError` on failure.
- [ ] `fetchTrace` omits `Content-Type` (bodyless GET), consistent with
      the existing Content-Type-header test group.

### Component / Integration Tests
- [ ] Renders the "Debug / Transparency View" banner.
- [ ] Renders one numbered section per event, in order.
- [ ] `discover` step renders the search query and candidate count.
- [ ] `rank` step renders each provider's label, score, and per-
      dimension scores (including a `null` dimension shown as a dash,
      not `"null"`).
- [ ] `prepareQuestions` step renders each question; a zero-question
      case renders a clear "no further questions needed" message, not
      an empty section.
- [ ] `simulateAnswers` step renders only the answer count, never
      answer text.
- [ ] Empty `events` array renders a "no trace recorded yet" state,
      not a blank screen.
- [ ] Pressing the back control calls `onBack`.

### Success Criteria
- [ ] `npm test` passes, no regressions
- [ ] `npx tsc --noEmit` clean

## ITERATE
### Outcome
Implemented as scoped. `frontend/src/domain/types.ts` gained
`TraceEvent`; `frontend/src/api/client.ts` gained `fetchTrace`
(bodyless GET, same pattern as `getConversation`). New
`frontend/src/screens/TraceScreen.tsx` — presentational, props
`{ events, onBack }`, renders a "Debug / Transparency View" banner, a
back control, an empty state, and one numbered section per event with
a per-`step` detail renderer for all six known step shapes (unknown
steps fall back to `summary`-only). No `App.tsx`/
`RecommendationsScreen.tsx` changes, per Constraints.

7 new component tests + 2 new/1 modified `client.test.ts` cases (10
total). One real finding surfaced during VALIDATE: this project's RNTL
`toHaveTextContent` does **exact** normalized-text matching by
default (`exact: true`, confirmed by reading
`node_modules/@testing-library/react-native/dist/matches.js` directly
rather than guessing), not substring — unlike jest-dom's web
convention this project's earlier screen tests never had to
disambiguate, since every prior testID pointed at an element whose
full text equals the expected string exactly. Every multi-content
assertion here (a section containing a title *and* a summary *and*
detail lines under one testID) needed `{ exact: false }` passed
explicitly; fixed before this task was marked done, not left broken.
Worth folding into `.claude/CLAUDE.md`'s existing RNTL-gotchas list as
a new, 6th item — not done here since CLAUDE.md wasn't in this task's
`Files Touched` (flagged below as a Follow-up instead, consistent with
task-56's precedent for the same kind of out-of-scope-but-worth-
recording finding).

`frontend npm test`: 14 suites / 115 tests passing (105 pre-existing +
10 new). `npx tsc --noEmit` clean.

### Knowledge Updates
- New RNTL gotcha (see Outcome): `toHaveTextContent` defaults to exact
  match, not substring — pass `{ exact: false }` explicitly whenever
  asserting against a testID whose element contains more than just the
  expected string.

### Follow-ups
- Fold the `toHaveTextContent`/`{ exact: false }` gotcha into
  `.claude/CLAUDE.md`'s RNTL gotchas list (currently 5 items) the next
  time that file is otherwise being touched.
- task-74 (planned, not yet written): wire `TraceScreen` into
  `App.tsx`'s screen-state machine, add the "How was this
  recommendation produced?" entry-point affordance to
  `RecommendationsScreen`, and have `App.tsx` call `fetchTrace` on
  navigation to it. This is the last planned M13 task.
