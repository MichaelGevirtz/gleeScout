# Task 80: RecommendationsScreen card redesign around match grade
Status: DONE
Can run in parallel with: task-81, task-82 (disjoint files); depends on task-79

## PLAN
- Goal: replace the current debug-flavored provider row ("Signals:
  3/5") with a scannable card whose primary hierarchy is name/rank ->
  match grade -> short fit explanation -> key decision info ->
  reputation -> FACT/INFERRED evidence -> View details, per the
  approved design.
- Inputs: `ProviderScore.fitScore`/`matchGrade` (task-79, must land
  first — this task hand-mirrors the same shape into the frontend's
  plain-type domain layer, same pattern as every prior M15/desktop
  task).
- Outputs: redesigned `RecommendationsScreen.tsx`; new
  `MatchGradeBadge` presentational component.
- Constraints:
  - Raw numeric `fitScore` is never rendered in the UI — only the
    bucketed grade label + one fixed sentence per grade.
  - `MatchGradeBadge` contains zero thresholds/math — it is a pure
    label/copy/color lookup keyed by the `MatchGrade` string the
    backend already computed. No new scoring logic on the frontend.
  - Fixed per-grade copy (exact wording, avoids implying quality/
    evidence/certainty per the approved language decision):
    - wonderful -> "Wonderful match" / "Meets your stated requirements
      very well"
    - good -> "Good match" / "Meets most of your stated requirements"
    - average -> "Average match" / "Partially meets your stated
      requirements"
    - poor -> "Poor match" / "Meets few of your stated requirements"
    - insufficient_data -> "Not enough information to assess fit"
      (no "match" word, distinct neutral treatment, never styled as
      "Poor")
  - The existing per-candidate `explanation` string (already tested,
    grounded in real dimension values) is kept and shown as the
    specific "why" detail beneath the fixed grade sentence — do not
    remove it, Part 6 requires "why this provider ranks where it does"
    and this is the only place that's answered concretely.
  - `reputation` (rating/reviews) is rendered as its own line, visually
    separate from the match-grade block, never inside it.
  - Card shows price/location/rating only when the underlying FACT
    exists; omit the row entirely when absent (no dash placeholder),
    per the existing project convention already used for price.
  - Do not add a "capacity" or "service type" badge — no such field
    exists on `ProviderCandidateFields`; do not fabricate one.
  - Do not touch `App.tsx` — `ProviderScore` already flows through
    unchanged, no new prop wiring needed.
- Open Questions: none.

## Assignment Alignment
- Requirement type: PROJECT DECISION (supports EXPLICIT requirement)
- Assignment requirement: Part 6's provider-card bullets ("Who the
  provider is", "Why they are a good match", "Rating / reputation",
  "Why this provider ranks where it does") and the "Taste" evaluation
  criterion ("good decisions about what information matters, what the
  user should see, and what complexity should remain hidden").
- Source: `docs/Home Assignment.pdf`, Part 6 pp.3-4, Evaluation
  criterion 6 p.7.
- Rationale: this task is the concrete card layout implementing the
  fitScore/matchGrade values task-79 exposes, directly answering
  Part 6's card content list and the Taste criterion's "hide
  complexity" instruction (raw scores/signal counts hidden; a single
  scannable grade + one sentence surfaced instead).

## IMPLEMENT
### Files Touched
- CREATE: `frontend/src/components/MatchGradeBadge.tsx`
- CREATE: `frontend/src/components/MatchGradeBadge.test.tsx`
- MODIFY: `frontend/src/domain/types.ts` (mirror `MatchGrade`,
  `fitScore`, `matchGrade` on `ProviderScore` — same hand-mirror
  pattern as every other backend type here)
- MODIFY: `frontend/src/screens/RecommendationsScreen.tsx`
- MODIFY: `frontend/src/screens/RecommendationsScreen.test.tsx`
- DO NOT TOUCH: `App.tsx`, `ProviderDetailsScreen.tsx`,
  `ContextPanel.tsx`, any backend file

### Implementation Notes
- Reuse existing `deriveName`/`derivePrice`/`deriveRating` helpers
  already in `RecommendationsScreen.tsx` where still applicable;
  remove the `countSignals`/`DIMENSION_COUNT`/"Signals: X/5" line
  entirely (superseded by the grade).
- Keep `countFactsSourced`/inferred-count display — FACT/INFERRED
  evidence stays, just repositioned per the approved hierarchy.

## VALIDATE
### Unit Tests
- [ ] `MatchGradeBadge` renders correct label + copy per grade
      (all 5 states), no raw number rendered anywhere

### Component / Integration Tests
- [ ] `RecommendationsScreen`: renders grade badge per provider;
      renders `explanation` verbatim as before; reputation line
      renders separately from the grade block; price/location/rating
      omitted (not dashed) when absent; `onSelectRow` still called
      with the exact unreshaped `ProviderScore`; existing heading/
      subtitle/count/trace-link tests still pass
- [ ] Explicit negative assertion: no numeric `fitScore` or percentage
      string appears in any rendered text

### Success Criteria
- [ ] `npm test` (frontend) passes, no regressions
- [ ] `npx tsc --noEmit` clean

## ITERATE
### Outcome
Implemented as planned. `frontend/src/domain/types.ts` mirrors
`MatchGrade`/`fitScore`/`matchGrade`. New
`frontend/src/components/MatchGradeBadge.tsx` — pure label/copy/color
lookup, zero thresholds. `RecommendationsScreen.tsx` redesigned per
the approved hierarchy: rank/name -> grade badge -> explanation ->
price/location -> reputation (rating) -> facts/inferred -> "View
details". "Signals: X/5" line removed. Price/location/rating rows are
omitted entirely (not dashed) when absent, per the approved
"capacity"/fabrication constraint. Found and fixed one pre-existing
fixture gap while running the full suite: `App.test.tsx`'s
`providerScoreFixture` predated `fitScore`/`matchGrade` and crashed
`MatchGradeBadge` on `undefined` grade lookup — added the two fields
to that fixture (1-line fix, not a scope expansion). 8 new tests in
`RecommendationsScreen.test.tsx` (grade rendering, insufficient_data
never says "Poor", no raw number/percentage anywhere, price/rating
omission), 6 new tests in `MatchGradeBadge.test.tsx` (one per grade +
the insufficient_data negative check). `npm test` (frontend): 139/139
passing. `npx tsc --noEmit`: clean.

### Knowledge Updates
Folded into the combined decisions.md/progress.md update after task-82.

### Follow-ups
None — scope was fully implemented as planned.
