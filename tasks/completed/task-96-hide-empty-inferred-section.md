# Task 96: Hide "Inferred from reviews" section when there's no inferred data
Status: DONE
Can run in parallel with: NONE

## PLAN
- Goal: `ProviderDetailsScreen` should render nothing for the entire
  "Inferred from reviews" section (heading + caption + list container)
  when `candidate.inferred` is empty or absent, instead of always
  showing the heading and disclaimer caption with an empty list.
- Inputs: `candidate.inferred` (optional `Inferred<string>[]`).
- Outputs: `inferred-section` (and its children) absent from the tree
  when `inferredList.length === 0`; unchanged when non-empty.
- Constraints: Do not touch the "Sourced facts" section, photo
  gallery, reputation line, or sticky footer. Do not change the
  per-card rendering logic (excerpt-only-if-present, source-type
  labels) for non-empty lists.
- Open Questions: none — reversal confirmed directly by the user in
  chat (2026-08-30).

## Assignment Alignment
- Requirement type: PROJECT DECISION (reversing a prior project
  decision, not an assignment requirement)
- Assignment requirement: none directly; general UI-quality
  expectation only.
- Source: n/a
- Rationale: This reverses the decision recorded in
  `design/m14-ux-spec.md` line 148 ("the fixed caption ... is static
  copy, shown once per section, always — not conditional on
  content"), which was deliberately implemented in task-51 and is
  covered by an existing test
  (`ProviderDetailsScreen.test.tsx` — "renders the fixed caption
  exactly once, even with an empty inferred array"). User confirmed
  in chat this reversal is intentional: an empty section with just a
  disclaimer and no content is confusing/wasted UI, inconsistent with
  how the photo gallery and reputation line already hide themselves
  when there's nothing to show.

## IMPLEMENT
### Files Touched
- MODIFY: `frontend/src/screens/ProviderDetailsScreen.tsx` — wrap the
  `inferred-section` block in `inferredList.length > 0 ? (...) : null`.
- MODIFY: `frontend/src/screens/ProviderDetailsScreen.test.tsx` —
  update the "renders the fixed caption exactly once, even with an
  empty inferred array" test to instead assert the section is absent
  (`queryByTestId("inferred-section")` is null, caption text not
  found) when `inferred: []`. Leave the non-empty-list tests as is.
- MODIFY: `design/m14-ux-spec.md` line 148 — replace "shown once per
  section, always — not conditional on content" with the reversed
  rule: the whole section (heading + caption + list) is omitted when
  `inferred` is empty or absent; the caption still doesn't vary
  per-card when the section does render.
- DO NOT TOUCH: `fact-section`, `PhotoGallery`, `reputation-line`,
  `sticky-footer`, dimension bars, `SelectedProviderHeader`.

### Implementation Notes
- Match the existing conditional pattern already used for
  `reputationLine` and `photosFact` in the same component (ternary
  returning `null`).

## VALIDATE
### Unit Tests
- [ ] n/a (no unit-level logic beyond the component)

### Component / Integration Tests
- [x] `inferred-section` is absent when `candidate.inferred` is `[]`
- [x] `inferred-section` is absent when `candidate.inferred` is
      `undefined`
- [x] `inferred-section`, heading, caption, and cards still render
      correctly when `candidate.inferred` is non-empty (existing
      tests continue to pass)
- [x] `npm test` (frontend) passes — 170/170
- [x] `npx tsc --noEmit` (frontend) passes

### E2E Tests
- [ ] n/a

### Success Criteria
- [x] All relevant tests pass
- [x] No regressions to Sourced facts / photo gallery / sticky footer
- [x] Follows project conventions (matches existing conditional
      pattern in the same file)
- [x] Task scope is fully implemented

## ITERATE
### Outcome
Wrapped the `inferred-section` block in `ProviderDetailsScreen.tsx` in
`inferredList.length > 0 ? (...) : null`, matching the existing
ternary pattern already used for `reputationLine` and `photosFact` in
the same component. Updated the code comment above `INFERRED_CAPTION`
and `design/m14-ux-spec.md` line 148 to reflect the reversed rule.
Replaced the test that asserted the caption always renders (even with
an empty `inferred` array) with two tests asserting the whole section
is absent when `inferred` is `[]` or `undefined`. Full frontend suite:
170/170 passing; `tsc --noEmit` clean.

### Knowledge Updates
This reverses the task-51-era decision (recorded in
`design/m14-ux-spec.md` line 148) that the "Inferred from reviews"
caption should render unconditionally. Confirmed directly by the user
in chat (2026-08-30) after I flagged the conflict with the existing
spec line and test — not a case of the code being wrong, a genuine
change of intent.

### Follow-ups
None.
