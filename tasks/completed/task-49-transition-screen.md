# Task 49: Transition / search-loading screen component
Status: DONE
Can run in parallel with: 47, 48, 50, 51, 52, 53

## PLAN
- Goal: build State 2 — the bridge screen shown for the duration of
  the single `POST /conversation/:id/providers` call — per
  `design/m14-ux-spec.md` screen 2.
- Inputs: task-46's types (none needed directly — this component takes
  no domain data); `design/m14-ux-spec.md` screen 2 section (the
  "Searching the web → Checking reviews → Ranking matches" animation
  is explicitly cosmetic/indeterminate — no progress events exist on
  the backend, one synchronous call, nothing to poll).
- Outputs: NEW `frontend/src/screens/TransitionScreen.tsx`:
  ```
  Props: {} // no props — purely a self-contained cosmetic animation
  ```
  Renders the three-step indeterminate-wait sequence, cycling/
  highlighting steps on an internal timer (`setInterval`/`Animated`)
  for as long as it stays mounted. The parent (task-54) is solely
  responsible for mounting this while `POST /providers` is in flight
  and unmounting it (swapping to Recommendations or Error State) when
  that call settles — this component has no knowledge of the request
  itself, no success/failure branching, no callbacks.
- Constraints:
  - No `fetch` calls, no knowledge of `ProviderScore`/any API shape —
    purely decorative, matching the spec's explicit "do not build any
    client polling logic for this."
  - No unmount-cleanup bugs: the internal timer must be cleared on
    unmount (test this explicitly — a leaked interval after
    navigating away is a real bug class in RN).
- Open Questions: none.

## Assignment Alignment
- Requirement type: PROJECT DECISION (the assignment doesn't require a
  loading animation at all) + SUPPORT (serves the EXPLICIT Part 2
  requirement indirectly, by giving the user a comprehensible wait
  state instead of a frozen screen while real search/enrichment/
  ranking work happens server-side).
- Assignment requirement: none directly named; supports "The UI
  doesn't need to be beautiful, but it should be understandable and
  thoughtfully designed" (Part 6) and the M15 kickoff's explicit "Loading
  and error states must preserve the user's context where practical"
  constraint.
- Source: Home Assignment PDF, Part 6, closing sentence.
- Rationale: a multi-second real backend call (Firecrawl search +
  Gemini enrichment + ranking, per M7-M9) with literally no feedback
  would read as broken, not "simple" — a lightweight cosmetic
  indicator is the minimum needed for "understandable," at zero
  backend complexity cost (confirmed explicitly not to require
  polling/streaming).

## IMPLEMENT
### Files Touched
- CREATE: `frontend/src/screens/TransitionScreen.tsx`,
  `frontend/src/screens/TransitionScreen.test.tsx`
- MODIFY: none
- DO NOT TOUCH: any other file under `frontend/src/`

### Implementation Notes
- Use fake timers (`jest.useFakeTimers()`) in the test to advance the
  animation deterministically rather than relying on real wall-clock
  delays.
- Give the three step labels `testID`s (e.g. `testID="step-searching"`,
  `testID="step-reviews"`, `testID="step-ranking"`) and expose which
  one is "active" via a prop on each (e.g. an `accessibilityState` or
  a simple style/testID distinction) so the test can assert cycling
  without depending on exact visual styling.

## VALIDATE
### Unit Tests
- N/A.

### Component / Integration Tests
- [x] Renders all three step labels.
- [x] The "active" step changes over time as fake timers advance
      (proves the cycling animation runs, not just a static render).
- [x] Unmounting the component clears its internal timer (spy on
      `clearInterval`/equivalent and assert it was called on
      unmount).

### E2E Tests
- N/A (covered by task-54's integration wiring).

### Success Criteria
- [x] TS compiles with no errors.
- [x] `npm test` passes, including new tests, no regressions.
- [x] No files outside `Files Touched` modified.

## ITERATE
### Outcome
Built exactly as planned, no deviations. Created
`frontend/src/screens/TransitionScreen.tsx`: a props-less component
that cycles an `activeIndex` state (0/1/2) on a `setInterval` (1200ms)
over the three step labels pulled verbatim from
`design/m14-ux-spec.md` screen 2 ("Searching the web" / "Checking
reviews" / "Ranking matches"). Each step is a `<Text>` with a
`testID` (`step-searching`/`step-reviews`/`step-ranking`) and
`accessibilityState={{ selected: isActive }}` so tests can assert
cycling without depending on visual styling, per the task's
Implementation Notes. The interval is cleared in the `useEffect`
cleanup on unmount.

`frontend/src/screens/TransitionScreen.test.tsx` covers all three
VALIDATE checklist items 1:1 as separate `it()`s, using
`jest.useFakeTimers()`/`jest.advanceTimersByTime()` and a
`jest.spyOn(global, "clearInterval")` unmount-cleanup assertion, per
the task's stated RNTL/Jest conventions.

One real gotcha hit during implementation (not an ambiguity in the
task, just an RNTL v14 API detail not spelled out in the assignment
prompt): the `unmount` function returned by `render()` in this RNTL
version is itself `() => Promise<void>` (confirmed in
`node_modules/@testing-library/react-native/dist/render.d.ts`). Calling
it unawaited let the test assertion run before the `useEffect`
cleanup had actually flushed, so `clearIntervalSpy` read as
uncalled. Fixed by `await unmount()`. No component or test design
changes were needed beyond that.

Test/tsc results:
- `npx jest src/screens/TransitionScreen.test.tsx` — 3/3 new tests
  pass.
- `npx jest` (full frontend suite) — 5 suites / 25 tests, all pass,
  no regressions (pre-existing: `App.test.tsx`, `client.test.ts`,
  `useSession.test.ts`, `ErrorState.test.tsx`).
- `npx tsc --noEmit` — no errors.

Only the two files in `Files Touched` were created; the task file's
own `Status:` line and this ITERATE section are the only other
edits. No files outside that list were modified.

### Knowledge Updates
- Worth folding into the D17 addendum in `memory-bank/decisions.md`:
  in the currently pinned RNTL version, `render()`'s returned
  `unmount` is `async` and must be `await`ed before asserting on
  effect-cleanup side effects (e.g. a `clearInterval`/`clearTimeout`
  spy) — a synchronous `unmount()` call can race the assertion.
  (Left as a note here per instructions; not edited into
  memory-bank/decisions.md directly — that's the separate
  consolidation pass.)

### Follow-ups
- None. The chat-collapses-to-a-pill visual mentioned in
  `design/m14-ux-spec.md` screen 2 ("Chat" pill while the board loads
  underneath) is explicitly out of scope for this component per the
  task's Outputs (no props, purely the three-step animation) — that
  composition is task-54's responsibility when it mounts this screen
  alongside the collapsed chat.
