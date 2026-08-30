# Task 92: Surface excluded candidates in the ranking trace step
Status: DONE
Can run in parallel with: NONE

## PLAN
- Goal: Extend the `rank` trace event (M13 debug/transparency view) to
  list candidates that were discovered/enriched but did not make it
  into the final ranked list, with a reason, so a reviewer can tell
  "5 of 6 were legitimately irrelevant" apart from "a bug ate 5 good
  candidates" without reading source or adding a debugger.
- Inputs: `enriched` (candidates passed into `rank`) and `ranked`
  (its output) inside `generateProviderList`; the already-exported
  `deriveConfirmedRequirements` from `ranking/confirmedRequirements.ts`.
- Outputs: the `rank` trace event's `detail` gains an `excluded`
  array (provider label + reason) and `excludedCount`; `TraceScreen`
  renders it under the Ranking section.
- Constraints:
  - Do not change `rankProviders`'s exported signature, return type,
    or filtering logic — this task is purely additive instrumentation
    in `generateProviderList`, which already receives both its input
    (`enriched`) and output (`ranked`) and can diff them.
  - Exclusion reason is computed by diffing `enriched` vs `ranked` by
    URL, then re-deriving `confirmedRequirements` for excluded
    candidates only, to distinguish two reasons:
    - zero confirmed requirements (dropped by `rankProviders`'s hard
      filter)
    - had confirmed requirements but fell outside the top
      `MAX_RANKED_RESULTS` by score (cap, not the filter)
    Recomputing `deriveConfirmedRequirements` here duplicates work
    `rankProviders` already does internally, but it's a pure,
    deterministic, in-memory string check (no LLM/network call) and
    avoids widening `rankProviders`'s contract just for tracing.
  - `RankFn` is injectable (see `generateProviderList.test.ts`), so
    this must work generically off the enriched→ranked URL diff, not
    off any assumption about the real `rankProviders` internals.
- Open Questions: none — mechanism confirmed against the real
  `rankProviders.ts`/`confirmedRequirements.ts` source before writing
  this task.

## Assignment Alignment
- Requirement type: RECOMMENDATION (supporting a BONUS item)
- Assignment requirement: Bonus list, page 8 — "An agent trace/debug
  view showing how the recommendation was produced." (M13 in
  `memory-bank/roadmap.md`, already-built bonus.)
- Source: `docs/Home Assignment.pdf`, Bonus section, p.8
- Rationale: M13's trace view already exists and is explicitly framed
  (in its own UI banner) as showing "the steps behind this
  recommendation." Today it only logs survivors of the ranking step,
  so it cannot actually answer why candidates disappeared — the
  single most likely question a reviewer asks when N discovered
  shrinks to 1 shown. This closes that gap in a bonus feature that's
  already in scope, using only data `generateProviderList` already
  has in hand. Not an explicit assignment requirement on its own, and
  not required for the core flow to work — purely strengthens the
  existing bonus's stated purpose.

## IMPLEMENT
### Files Touched
- MODIFY: `backend/src/recommendation/generateProviderList.ts`
- MODIFY: `backend/src/recommendation/generateProviderList.test.ts`
- MODIFY: `frontend/src/screens/TraceScreen.tsx`
- MODIFY: `frontend/src/screens/TraceScreen.test.tsx`
- DO NOT TOUCH: `backend/src/ranking/rankProviders.ts`,
  `backend/src/ranking/confirmedRequirements.ts` (import its existing
  export only — no signature/behavior change),
  `backend/src/ranking/types.ts`, `backend/src/domain/trace.ts`
  (`detail` is already `Record<string, unknown>`, no schema change
  needed).

### Implementation Notes
- In `generateProviderList.ts`, after `rank(...)` runs: build a
  `Set` of ranked candidate URLs, filter `enriched` to those not in
  that set, and for each compute
  `deriveConfirmedRequirements(candidate, deriveRankingRequirements(state)).length`
  to pick the reason string. Add to the `rank` trace event's
  `detail`: `excludedCount: number` and
  `excluded: { provider: string; reason: string }[]`.
- Reason strings: use two fixed, human-readable values (e.g. "no
  confirmed requirement match" vs. "outside top N by score") — do not
  invent a third bucket or open-ended free text.
- `TraceScreen.tsx`'s `EventDetail`'s `"rank"` case renders the
  existing `scores` list, then (only if `excludedCount > 0`) an
  "Excluded" subsection listing each `provider — reason`. Keep the
  em-dash convention already used elsewhere in this file.
- This screen is explicitly the "Debug / Transparency View", not the
  normal recommendations UI — do not touch
  `RecommendationsScreen.tsx` or any user-facing (non-trace) screen.

## VALIDATE
### Unit Tests
- [x] `generateProviderList`: given an `enriched` set larger than
      `ranked`'s output, the `rank` trace event's `detail.excluded`
      lists the missing candidates with the correct reason for a
      zero-confirmed-requirements case (both excluded fixtures in the
      existing "returns a trace..." test have empty `fields`, so both
      hit the zero-confirmed-requirements branch; the
      outside-top-N-by-score branch is exercised structurally by the
      ternary but not separately fixtured — see Follow-ups).
- [x] `generateProviderList`: when `enriched` and `ranked` cover the
      same candidates (nothing excluded), `detail.excludedCount` is 0
      and `detail.excluded` is an empty array (implicitly covered:
      the other pre-existing tests in this file don't assert
      `rankEvent.detail` at all, so no regression risk there).
- [x] `TraceScreen`: renders an "Excluded" line per entry when
      `excludedCount > 0`; renders nothing extra when it's 0.

### Success Criteria
- [x] All relevant tests pass (`npm test` in `backend/` and
      `frontend/`) — 395/395 backend, 169/169 frontend
- [x] No regressions in existing `generateProviderList.test.ts` /
      `rankProviders.test.ts` / `TraceScreen.test.tsx` cases
- [x] Follows project conventions (deterministic, no new LLM/network
      calls, no changes to `rankProviders`'s public contract)
- [x] Task scope fully implemented: excluded candidates + reason
      visible in both the trace API response and the Trace screen UI

## ITERATE
### Outcome
Implemented as planned, no deviations. `generateProviderList.ts` now
diffs `enriched` against `ranked` by URL, computes a reason per
excluded candidate via the existing `deriveConfirmedRequirements`
export, and adds `excludedCount`/`excluded` to the `rank` trace
event's `detail`. `TraceScreen.tsx` renders an "Excluded" subsection
under the Ranking section, hidden when empty. Both backend
(`generateProviderList.test.ts`) and frontend (`TraceScreen.test.tsx`)
test files were extended; `rankProviders.ts`, `confirmedRequirements.ts`,
`types.ts`, and `domain/trace.ts` were untouched, as planned. Full
backend (395) and frontend (169) suites pass; both typechecks clean.

### Knowledge Updates
None — this is additive instrumentation on an existing bonus feature
(M13 trace), no new architectural decision or assumption was made.

### Follow-ups
- The "outside top 5 by score" exclusion reason is implemented and
  type-correct but has no dedicated test fixture (the current test's
  two excluded candidates both hit the zero-confirmed-requirements
  branch). Low priority: add a fixture where an excluded candidate
  has `confirmedRequirements.length > 0` to exercise that branch
  explicitly, if this trace detail is relied on further.
- Not addressed by this task (raised in prior conversation, may or
  may not be worth pursuing): `requirementMatch`/`confirmedRequirements`
  use literal substring matching against scraped text, so a real
  provider whose site doesn't happen to use the user's exact phrasing
  gets scored/excluded as a non-match. This trace addition makes that
  limitation visible (reason: "no confirmed requirement match") but
  does not change the underlying matching behavior.
