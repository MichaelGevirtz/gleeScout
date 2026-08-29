# Task 68: RecommendationsScreen empty-state message
Status: DONE
Can run in parallel with: task-65, task-66, task-67 (disjoint files)

## PLAN
- Goal: implement M16 audit Recommended Change #3 — when the backend
  legitimately returns zero ranked providers (`200 { providers: [] }`,
  a real and already-observed outcome per `decisions.md`'s M7 Finding
  3 on discovery-quality variance by category/location), show an
  explicit "no matching providers found" message instead of a
  near-blank screen with only the decorative sort row.
- Inputs: `frontend/src/screens/RecommendationsScreen.tsx` (current
  unconditional `providers.map(...)` render).
- Outputs: an explicit empty-state branch when `providers.length === 0`.
- Constraints: presentational only — no new component, no new
  dependency, no change to the populated-list rendering path, no
  change to `App.tsx`'s data flow (it already passes `providers ?? []`
  through unchanged).
- Open Questions: none.

## Assignment Alignment
- Requirement type: RECOMMENDATION (M16 audit output).
- Assignment requirement: Part 6 ("UI doesn't need to be beautiful,
  but... understandable and thoughtfully designed") — tangential; a
  silent blank result is a minor understandability gap, not an unmet
  functional requirement.
- Source: this session's M16 audit; `decisions.md`'s M7 real-API
  Finding 3.
- Rationale: small, presentational, closes a real (already-observed)
  gap without adding scope beyond what the audit already identified.

## IMPLEMENT
### Files Touched
- MODIFY: `frontend/src/screens/RecommendationsScreen.tsx` (add an
  `if (providers.length === 0)` branch with a short message, e.g. "No
  matching providers found.")
- MODIFY: `frontend/src/screens/RecommendationsScreen.test.tsx` (new
  test for the empty case)
- DO NOT TOUCH: `App.tsx`, any other screen, any backend file.

## VALIDATE
### Component / Integration Tests
- [ ] `providers={[]}` renders the empty-state message and zero
      `provider-row-*` elements.
- [ ] Existing populated-list tests still pass unchanged.

### Success Criteria
- [ ] `npm test` (frontend) passes, no regressions.
- [ ] `npx tsc --noEmit` clean.

## ITERATE
### Outcome
Implemented exactly as planned — an early-return branch in
`RecommendationsScreen` renders a `recommendations-empty` message when
`providers.length === 0`, before the decorative sort row and provider
rows. One new test confirms the empty message renders with zero
`provider-row-*`/`sort-control` elements; existing populated-list tests
unaffected. `frontend npx tsc --noEmit` clean; `frontend npm test`
103/103 passing (counted together with task-66's new tests in the same
full-suite run).

### Knowledge Updates
None beyond the M16 audit record already captured in `decisions.md` D20.

### Follow-ups
None.
