# Task 93: Name the specific unmatched requirements for zero-match trace exclusions
Status: DONE
Can run in parallel with: NONE

## PLAN
- Goal: task-92 added an "Excluded" list to the ranking trace step,
  but its reason for the common case is only the coarse label "no
  confirmed requirement match" — it doesn't say which requirement(s)
  (service category, location, which category attribute) the
  candidate failed to confirm. Add that detail so a reviewer looking
  at a "6 found, 1 shown" trace can see, e.g., that a dropped
  candidate never confirmed "bounce house rental" or "New York, NY"
  in its scraped text, not just that "something" didn't match.
- Inputs: `RankingRequirements` (already available in
  `generateProviderList.ts` as `requirements`); the existing
  `ConfirmedRequirement` type (`ranking/types.ts`).
- Outputs: a new pure export `deriveRequirementCatalog(requirements):
  ConfirmedRequirement[]` in `ranking/confirmedRequirements.ts` that
  lists every requirement the ranking/confirmation logic *checks*
  (serviceCategory, location, each non-null non-budget category
  attribute) regardless of any candidate's text — i.e. the same
  enumeration `deriveConfirmedRequirements` already walks, minus its
  candidate-text check. `generateProviderList.ts`'s `excluded` trace
  entries gain `unmatched: ConfirmedRequirement[]`, populated with the
  full catalog when `confirmedRequirements.length === 0` (by
  definition every catalog entry is unmatched in that case — no
  additional per-candidate computation needed) and `[]` for the
  outside-top-5-by-score case (that exclusion isn't about matching).
  `TraceScreen.tsx` renders `unmatched` labels under each such
  excluded entry.
- Constraints:
  - Do not change `deriveConfirmedRequirements`'s existing signature
    or behavior — add a new sibling export only.
  - Do not touch `rankProviders.ts`, `ranking/types.ts` (the
    `ConfirmedRequirement` type already exists and is reused as-is),
    or `domain/trace.ts`.
  - `unmatched` for the "outside top 5 by score" reason must be an
    empty array, not omitted — keeps the trace API shape uniform for
    the frontend (always an array, never optional/undefined).
- Open Questions: none.

## Assignment Alignment
- Requirement type: RECOMMENDATION (supporting a BONUS item, same as
  task-92)
- Assignment requirement: Bonus list, page 8 — "An agent trace/debug
  view showing how the recommendation was produced." (M13 in
  `memory-bank/roadmap.md`.)
- Source: `docs/Home Assignment.pdf`, Bonus section, p.8
- Rationale: task-92 made *who* got excluded and a coarse *why*
  visible; this task closes the remaining gap identified in review —
  the trace still couldn't say *which specific requirement* a
  zero-match candidate failed on. Same bonus feature, same
  justification: strengthens an already-in-scope debug view's own
  stated purpose. Not required for the core recommendation flow to
  work.

## IMPLEMENT
### Files Touched
- MODIFY: `backend/src/ranking/confirmedRequirements.ts` (add
  `deriveRequirementCatalog` export; `deriveConfirmedRequirements`
  unchanged)
- MODIFY: `backend/src/ranking/confirmedRequirements.test.ts`
- MODIFY: `backend/src/recommendation/generateProviderList.ts`
- MODIFY: `backend/src/recommendation/generateProviderList.test.ts`
- MODIFY: `frontend/src/screens/TraceScreen.tsx`
- MODIFY: `frontend/src/screens/TraceScreen.test.tsx`
- DO NOT TOUCH: `backend/src/ranking/rankProviders.ts`,
  `backend/src/ranking/types.ts`, `backend/src/domain/trace.ts`,
  `RecommendationsScreen.tsx` / any non-trace user-facing screen.

### Implementation Notes
- `deriveRequirementCatalog` mirrors `deriveConfirmedRequirements`'s
  three checks (serviceCategory, location, non-budget
  categoryAttributes) but unconditionally pushes `{ label, kind }`
  for each — it never looks at a candidate, so it's computed once per
  `generateProviderList` call, not once per excluded candidate.
- In `generateProviderList.ts`: compute `requirementCatalog =
  deriveRequirementCatalog(requirements)` once, alongside the existing
  `requirements` local. In the `excluded` map, when
  `deriveConfirmedRequirements(c, requirements).length === 0`, set
  `unmatched: requirementCatalog`; otherwise `unmatched: []`.
- `TraceScreen.tsx`: extend the `ExcludedCandidate` local interface
  with `unmatched: { label: string; kind: string }[]`; when
  non-empty, render a second line under the provider/reason line,
  e.g. `Checked: {labels.join(", ")}` — plain text, no new icons, same
  `dimensionLine` style as adjacent detail lines.

## VALIDATE
### Unit Tests
- [x] `deriveRequirementCatalog`: returns serviceCategory + location +
      each non-null non-budget category attribute as `{label, kind}`
      entries, in the same order/shape `deriveConfirmedRequirements`
      would confirm them in, regardless of any candidate; excludes
      the budget-named attribute; returns `[]` when
      `requirements` has none of the above set.
- [x] `generateProviderList`: an excluded candidate with zero
      confirmed requirements gets `unmatched` equal to the full
      requirement catalog for that session's requirements.
- [x] `generateProviderList`: an excluded candidate that had at least
      one confirmed requirement (outside-top-5-by-score case) gets
      `unmatched: []` (new dedicated test — this also closes task-92's
      logged follow-up, which previously had no fixture exercising
      this branch).
- [x] `TraceScreen`: renders the "Checked: ..." line listing unmatched
      labels for a zero-match excluded entry; renders no such line
      when `unmatched` is empty.

### Success Criteria
- [x] All relevant tests pass (`npm test` in `backend/` and
      `frontend/`) — 399/399 backend, 169/169 frontend
- [x] No regressions in existing `confirmedRequirements.test.ts` /
      `generateProviderList.test.ts` / `TraceScreen.test.tsx` cases
- [x] Follows project conventions (deterministic, no new LLM/network
      calls, no changes to `rankProviders`'s or
      `deriveConfirmedRequirements`'s existing contracts)
- [x] Task scope fully implemented: unmatched requirement labels
      visible in both the trace API response and the Trace screen UI

## ITERATE
### Outcome
Implemented as planned. Added `deriveRequirementCatalog` as a sibling
export in `confirmedRequirements.ts` (three new tests, including one
asserting it matches `deriveConfirmedRequirements`'s output shape for
a fully-confirmed candidate). `generateProviderList.ts` computes the
catalog once per call and attaches it as `unmatched` on each excluded
entry (full catalog for zero-match exclusions, `[]` for top-5-cap
exclusions). Added a new `generateProviderList.test.ts` case
specifically for the cap branch, which also retires task-92's open
follow-up (that branch previously had no dedicated fixture).
`TraceScreen.tsx` renders a "Checked: ..." sub-line per excluded
entry when `unmatched` is non-empty. Full backend (399) and frontend
(169) suites pass; both typechecks clean.

### Knowledge Updates
None — additive instrumentation on the existing M13 bonus trace
feature, no new architectural decision.

### Follow-ups
None outstanding. The "which specific requirement failed" gap raised
in the prior conversation is now closed for the zero-match case
(the common case in practice); the top-5-cap case intentionally
reports `unmatched: []` since that exclusion isn't about matching at
all — the candidate matched something but was outscored, not
unmatched.
