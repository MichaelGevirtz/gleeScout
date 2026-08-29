# Task 74: Wire TraceScreen into App.tsx + Recommendations entry point
Status: DONE
Can run in parallel with: NONE

## PLAN
- Goal: make task-73's `TraceScreen` reachable from the running app —
  the last planned M13 task, completing the user-visible flow
  `Recommendations → "How was this recommendation produced?" → Trace/Debug view`.
- Inputs: `fetchTrace` (task-73), `TraceScreen` (task-73).
- Outputs:
  - `RecommendationsScreen` gains an `onViewTrace: () => void` prop and
    a "How was this recommendation produced?" pressable link, rendered
    in both the populated-list and empty-state branches (a trace
    exists — discovery/enrichment/ranking ran — even when zero
    providers matched).
  - `App.tsx` gains a `"trace"` screen state, a `traceEvents` state
    slot (`TraceEvent[] | null`, `null` = not loaded yet), and a
    `runFetchTrace` callback following the exact same
    set-error-null → set-loading → fetch → set-result-or-error pattern
    `runProviderSearch`/`runSelectProvider` already use. Loading state
    reuses the existing `TransitionScreen` (no new loading UI).
    `onBack` reuses the existing `handleBackToMatches` (same
    destination as Provider Details/Simulated Q&A's back buttons).
- Constraints:
  - No new loading component — `TransitionScreen` covers it, matching
    every other async transition in this file.
  - The desktop split-pane branch needs no special-casing: it already
    activates whenever `isDesktop && providers !== null`, and the
    trace screen is only reachable after providers exist, so it falls
    into the existing split-pane/right-pane rendering for free (same
    as Provider Details/Simulated Q&A today).
  - `ContextPanel`'s `currentlyViewing` stays computed only for
    `providerDetails`/`simulatedQA` (unchanged) — the trace view isn't
    "viewing a provider," so it correctly shows nothing extra there.
- Open Questions: none.

## Assignment Alignment
- Requirement type: BONUS (M13, widened scope — see D10's 2026-08-29
  addendum in `decisions.md` and `progress.md`'s M13 section)
- Assignment requirement: "An agent trace/debug view showing how the
  recommendation was produced" (Bonus, `docs/Home Assignment.pdf`
  page 8).
- Source: `docs/Home Assignment.pdf`, Bonus section.
- Rationale: this is the wiring that makes the already-built view and
  already-built endpoint (tasks 69-73) actually reachable from the
  app — completing M13's full slice, end to end.

## IMPLEMENT
### Files Touched
- MODIFY: `frontend/src/App.tsx`
- MODIFY: `frontend/src/App.test.tsx`
- MODIFY: `frontend/src/screens/RecommendationsScreen.tsx`
- MODIFY: `frontend/src/screens/RecommendationsScreen.test.tsx`
- DO NOT TOUCH: `frontend/src/screens/TraceScreen.tsx`,
  `frontend/src/api/client.ts`, `frontend/src/components/ContextPanel.tsx`

### Implementation Notes
- Remember RNTL's `toHaveTextContent` is exact-match by default
  (task-73 finding) — use `{ exact: false }` for any multi-content
  assertion added here too.

## VALIDATE
### Component / Integration Tests
- [ ] `RecommendationsScreen`: the trace link is present and calls
      `onViewTrace` when pressed, in both the populated and empty-state
      branches.
- [ ] `App`: pressing the trace link from Recommendations navigates to
      the trace screen, showing `TransitionScreen` while `fetchTrace`
      is pending, then `TraceScreen` with the resolved events.
- [ ] `App`: a `fetchTrace` rejection shows `ErrorState`, and retry
      re-issues the identical call.
- [ ] `App`: pressing the trace screen's back control returns to
      Recommendations without re-calling `fetchProviders`.
- [ ] `App` (desktop): from a wide viewport, reaching the trace screen
      still renders inside the existing split-pane right pane with
      `ContextPanel` staying mounted, same as Provider Details/
      Simulated Q&A today.

### Success Criteria
- [ ] `npm test` passes, no regressions
- [ ] `npx tsc --noEmit` clean

## ITERATE
### Outcome
Implemented as scoped. `RecommendationsScreen` gained `onViewTrace` and
a "How was this recommendation produced?" link (`view-trace-link`),
rendered in both the populated and empty-state branches. `App.tsx`
gained the `"trace"` screen state, `traceEvents` state, and
`runFetchTrace` (identical shape to `runProviderSearch`/
`runSelectProvider`); the `"trace"` content branch shows
`TransitionScreen` while loading and `TraceScreen` once resolved, with
`onBack` reusing `handleBackToMatches`. No new loading component, no
desktop-branch special-casing needed — both confirmed true by the new
tests. 2 new `RecommendationsScreen` tests + 4 new `App.test.tsx`
integration tests (navigate+load+results, error+retry, back without
re-fetching providers, desktop split-pane). `frontend npm test`: 14
suites / 121 tests passing (117 pre-existing + 4 new integration tests
— the 2 RecommendationsScreen tests were already counted in task-73's
"pending" work, landing here). `npx tsc --noEmit` clean.

This completes the full user-visible M13 flow:
`Recommendations → "How was this recommendation produced?" → Trace/Debug view`,
matching the design proposed and approved earlier in this session.

### Knowledge Updates
M13 is now fully complete — all four remaining planned tasks
(70/71/72/73/74 — five, not four; task-73 split the frontend plumbing
from this task's wiring) are done. `memory-bank/progress.md` should
get a closing summary marking M13 complete end-to-end (backend trace
capture + debug endpoint + frontend view), superseding the "in
progress" note added when task-69 landed.

### Follow-ups
None — M13 is complete. Only the pre-existing, already-recorded
follow-ups remain open: folding the `toHaveTextContent`/
`{ exact: false }` gotcha into `.claude/CLAUDE.md` (noted in task-73),
and the already-documented option of threading a richer `onStep`
callback into M7/M8's discovery/enrichment functions for finer-grained
trace detail (noted in task-69), neither blocking.
