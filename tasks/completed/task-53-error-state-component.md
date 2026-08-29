# Task 53: Error state component
Status: DONE
Can run in parallel with: 47, 48, 49, 50, 51, 52

## PLAN
- Goal: one reusable error-display component, used after either of the
  two provider-search API failures, per `design/m14-ux-spec.md` screen
  7 — the single place the "retry always repeats the same failed call"
  rule (Open Decision #5) is enforced at the UI layer.
- Inputs: `design/m14-ux-spec.md` screen 7 section.
- Outputs: NEW `frontend/src/components/ErrorState.tsx`:
  ```
  Props: {
    message: string;   // e.g. "We couldn't reach the server." / a mapped ApiError message
    onRetry: () => void;
  }
  ```
  Renders the error message and a single retry control calling
  `onRetry()` — no internal logic about *what* gets retried; the
  caller (task-54) is responsible for passing an `onRetry` that
  re-issues the exact same failed request with the same inputs (e.g.
  the same candidate object for a failed selection), per Open
  Decision #5.
- Constraints:
  - No knowledge of `ApiError`/the API client — takes a plain string
    message, kept fully decoupled from the network layer so it's
    reusable and trivially testable.
  - Does not itself decide navigation on retry (e.g. does not know
    "go back to chat") — purely `onRetry()` callback plus optional
    display state, nothing more.
- Open Questions: none.

## Assignment Alignment
- Requirement type: EXPLICIT (Technical Expectations explicitly lists
  "Error handling" among what's specifically evaluated) + SUPPORT for
  the UX-constraint "loading and error states must preserve the
  user's context where practical" from the M15 kickoff.
- Assignment requirement: "We are particularly interested in seeing
  how you structure: ... Error handling" (Technical Expectations).
- Source: Home Assignment PDF, Technical Expectations section.
- Rationale: the backend already has real, distinct failure modes for
  both provider-search calls (502 for a known Gemini/Firecrawl error,
  500 generic, 409 for a not-ready session on the list route) — this
  component is the one place those surface to the user, so its
  behavior (always same-request retry, chat context never lost) is
  worth isolating and testing on its own rather than re-implementing
  ad hoc wherever a call can fail.

## IMPLEMENT
### Files Touched
- CREATE: `frontend/src/components/ErrorState.tsx`,
  `frontend/src/components/ErrorState.test.tsx`
- MODIFY: none
- DO NOT TOUCH: any other file under `frontend/src/`

### Implementation Notes
- `testID`s: `testID="error-message"`, `testID="error-retry"`.

## VALIDATE
### Unit Tests
- N/A.

### Component / Integration Tests
- [x] Renders the given `message`.
- [x] Tapping retry calls `onRetry` exactly once per tap.

### E2E Tests
- N/A (covered by task-54's integration wiring, including the actual
  "same request re-issued" behavior, which requires the real API
  client/hook and so belongs there, not here).

### Success Criteria
- [x] TS compiles with no errors.
- [x] `npm test` passes, including new tests, no regressions.
- [x] No files outside `Files Touched` modified.

## ITERATE
### Outcome
Built exactly as planned, no deviations. Created
`frontend/src/components/ErrorState.tsx` — a plain, decoupled
`{ message: string; onRetry: () => void }` component rendering the
message in a `Text` (`testID="error-message"`) and a `Pressable`
retry control (`testID="error-retry"`) that calls `onRetry()` with no
internal retry/navigation logic, per the constraints. Created
`frontend/src/components/ErrorState.test.tsx` with two RNTL tests
matching the VALIDATE checklist: (1) renders the given message
(asserted via `toHaveTextContent` on the `error-message` testID), (2)
tapping retry calls `onRetry` exactly once per tap — asserted by
firing two separate presses and checking the call count increments
by exactly one each time (1, then 2), which also rules out
double-firing per tap. Both `render` and `fireEvent.press` calls are
awaited per the documented RNTL v14 + React 19 async requirement.

Test results: `npm test -- src/components/ErrorState.test.tsx` → 2/2
new tests pass. Full `npm test` → 5 suites / 25 tests, all pass, no
regressions (pre-existing suites: App.test.tsx, client.test.ts,
useSession.test.ts, TransitionScreen.test.tsx, plus the new
ErrorState.test.tsx). `npx tsc --noEmit` → no output, no errors.

Only the two files listed under `Files Touched` were created; no
other files were modified (repo has no `.git` at the root to diff
against, but no other Edit/Write calls were made in this task).

### Knowledge Updates
None — no new patterns or constraints discovered beyond what
D17/its addendum already document. This task didn't need module
mocking or any RNTL API beyond `render`/`fireEvent.press`, both
already covered by the existing App.test.tsx toolchain-proof test.

### Follow-ups
None. task-54 (integration wiring) is responsible for supplying a
real `onRetry` that re-issues the exact same failed request per Open
Decision #5 — out of scope here per this task's own E2E note.
