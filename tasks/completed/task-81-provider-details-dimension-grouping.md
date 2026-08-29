# Task 81: Split ProviderDetailsScreen dimension bars into fit vs. quality/evidence groups
Status: DONE
Can run in parallel with: task-79, task-80, task-82 (disjoint files, no dependency)

## PLAN
- Goal: make it visually clear in Provider Details that only 3 of the
  5 ranking dimensions drive the match grade — regroup the existing
  flat 5-bar list into two labeled sections.
- Inputs: existing `dimensionScores` prop (unchanged shape — this task
  does not need `fitScore`/`matchGrade`, only regroups the existing
  `RankingDimension` bars already rendered).
- Outputs: two sections in `ProviderDetailsScreen.tsx`: "Requirement
  fit" (`requirementMatch`, `geoFit`, `priceFit`) and "Reputation &
  evidence" (`reputation`, `evidenceQuality`), with a short caption on
  the second group clarifying it does not affect the match grade.
- Constraints:
  - Do not remove any of the 5 existing dimension bars or change their
    fill/empty-state rendering logic — only regroup them under two
    headers.
  - Do not add `fitScore`/`matchGrade` to this screen's props — out of
    scope for this task (the grade badge itself was decided against
    for this screen; only the grouping caption is in scope).
  - `DIMENSION_ORDER`'s existing per-dimension order is preserved
    within each new group.
- Open Questions: none.

## Assignment Alignment
- Requirement type: PROJECT DECISION (supports EXPLICIT requirement)
- Assignment requirement: Evaluation criterion 5, "Trust & Grounding"
  — "Can the system distinguish facts found online, inferred
  information and simulated provider responses? This is particularly
  important" — and criterion 6, "Taste" (what information matters,
  what should be hidden/grouped).
- Source: `docs/Home Assignment.pdf`, Evaluation criteria 5-6, p.7.
- Rationale: without this grouping, a user reading Provider Details
  could reasonably assume all 5 bars equally constitute "the match" —
  which contradicts the redesigned Recommendations card's explicit
  claim that match grade means requirement fit only. This keeps the
  two concepts (fit vs. reputation/evidence) visually distinguishable
  wherever dimension detail is shown, consistent with the project's
  existing FACT/INFERRED separation principle.

## IMPLEMENT
### Files Touched
- MODIFY: `frontend/src/screens/ProviderDetailsScreen.tsx`
- MODIFY: `frontend/src/screens/ProviderDetailsScreen.test.tsx`
- DO NOT TOUCH: `RecommendationsScreen.tsx`, `ContextPanel.tsx`,
  `App.tsx`, any backend file

### Implementation Notes
- Two new `View` sections with header `Text`, replacing the single
  flat `dimension-bars` container; each bar's existing `testID`s stay
  as-is so no per-bar test needs rewriting, only the surrounding
  structure/headers are new.

## VALIDATE
### Unit Tests
### Component / Integration Tests
- [ ] Both group headers render with correct dimension membership
- [ ] All 5 existing per-dimension-bar tests (fill width, "Not enough
      data" dashed state) still pass unchanged
- [ ] Caption text renders under the reputation/evidence group

### Success Criteria
- [ ] `npm test` (frontend) passes, no regressions
- [ ] `npx tsc --noEmit` clean

## ITERATE
### Outcome
Implemented as planned. Extracted a `DimensionBar` sub-component
(same rendering logic as before, unchanged) and regrouped the 5
dimension bars into `dimension-group-fit`
(requirementMatch/geoFit/priceFit) and `dimension-group-quality`
(reputation/evidenceQuality, with a caption clarifying it doesn't
affect the match grade). All existing per-bar `testID`s and the
existing fixed-order test pass unchanged (order assertion walks the
whole tree regardless of nesting). 1 new test verifying group
membership + caption text. `npm test` (frontend): 140/140 passing.
`npx tsc --noEmit`: clean.

### Knowledge Updates
Folded into the combined decisions.md/progress.md update after task-82.

### Follow-ups
None — scope was fully implemented as planned.
