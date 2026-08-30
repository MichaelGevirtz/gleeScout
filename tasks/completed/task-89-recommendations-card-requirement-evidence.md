# Task 89: Provider card redesign — requirement-based evidence presentation (frontend)
Status: DONE
Can run in parallel with: NONE (depends on task-88's `confirmedRequirements` field)

## PLAN
- Goal: redesign the Recommendations provider card so it primarily
  answers "why is this provider a match for what I asked for" —
  showing the user's confirmed requirements as checkmarks — instead
  of a generic provider-information dump, and remove redundant/
  low-value copy and metadata.
- Inputs: `ProviderScore.confirmedRequirements` (task-88, new field);
  `ProviderScore.matchGrade`/`explanation` (existing, `explanation`
  now trimmed by task-88); everything else on `ProviderCandidate`
  (unchanged).
- Outputs: redesigned `RecommendationsScreen.tsx` card; a small new
  presentational component rendering the confirmed-requirements list.
- Constraints:
  - `MatchGradeBadge` renders the grade label only — remove its fixed
    per-grade subtitle (`"Meets most of your stated requirements"`
    etc.) entirely; the label alone is sufficient per the reviewer's
    instruction.
  - The confirmed-requirements list renders exactly what task-88
    computed (`label`/`kind` pairs) — do not re-derive confirmation on
    the frontend, do not use any LLM-generated text to decide what's
    confirmed, do not fall back to showing unconfirmed requirements
    with a different visual treatment (no ✗ / greyed state — out of
    scope per the reviewer's confirmed answer to that open question:
    every card is guaranteed ≥1 confirmed entry by task-88's filter,
    so only confirmed items are ever shown).
  - Remove the "X facts sourced" / "Y inferred" counter row entirely
    from the card. Do not remove the underlying data model — Provider
    Details keeps full FACT/INFERRED evidence unchanged.
  - Remove the "Sort: Best match" pill entirely (including its
    `sort-control` testID) — do not add a real sort control, do not
    change provider ordering (ordering is still exactly what
    task-88's `rankProviders` returns).
  - Keep the trimmed `explanation` string (task-88 already removed
    its requirement-match clause) as the "short provider-specific
    useful information" line — do not remove it, do not shorten it
    further.
  - Keep the existing reputation line (`deriveMockReputation` ??
    `deriveRating`) and price/location rows exactly as they render
    today — this task repositions the card, it does not change what
    those helpers compute.
  - Do not touch `ProviderDetailsScreen.tsx`, `ContextPanel.tsx`,
    `App.tsx`, or any backend file.
- Open Questions: none.

## Assignment Alignment
- Requirement type: PROJECT DECISION (supports EXPLICIT requirement)
- Assignment requirement: Part 6's card content list ("Who the
  provider is", "Why they are a good match", "What information is
  confirmed", "Why this provider ranks where it does") and evaluation
  criterion 6 ("Taste" — "good decisions about what information
  matters, what the user should see, and what complexity should
  remain hidden").
- Source: `docs/Home Assignment.pdf`, Part 6 pp.3-4, Evaluation
  criterion 6 p.7.
- Rationale: this is the concrete card layout consuming task-88's new
  `confirmedRequirements` field, directly answering Part 6's "what
  information is confirmed" bullet with structured per-requirement
  evidence instead of a generic sentence, while the Taste criterion
  supports removing the debug-flavored fact/inferred counters and the
  decorative, non-functional sort pill.

## IMPLEMENT
### Files Touched
- CREATE: `frontend/src/components/ConfirmedRequirementsList.tsx`
- CREATE: `frontend/src/components/ConfirmedRequirementsList.test.tsx`
- MODIFY: `frontend/src/domain/types.ts` (mirror `ConfirmedRequirement`
  and `ProviderScore.confirmedRequirements`, same hand-mirror pattern
  as every other backend type here)
- MODIFY: `frontend/src/components/MatchGradeBadge.tsx` (drop the
  per-grade subtitle; label only)
- MODIFY: `frontend/src/components/MatchGradeBadge.test.tsx`
- MODIFY: `frontend/src/screens/RecommendationsScreen.tsx`
- MODIFY: `frontend/src/screens/RecommendationsScreen.test.tsx`
- MODIFY: `frontend/src/App.test.tsx` (add `confirmedRequirements` to
  `providerScoreFixture`, same fixture-gap pattern task-80 hit for
  `fitScore`/`matchGrade`)
- DO NOT TOUCH: `ProviderDetailsScreen.tsx`, `ContextPanel.tsx`,
  `App.tsx` (production code), `TraceScreen.tsx`, any backend file

### Implementation Notes
- Proposed card hierarchy: rank/name -> `MatchGradeBadge` (label only)
  -> `ConfirmedRequirementsList` (✓ per confirmed requirement) ->
  trimmed `explanation` sentence -> price/location row (unchanged) ->
  reputation line (unchanged) -> facts/inferred counters removed ->
  "View details".
- `ConfirmedRequirementsList` is purely presentational: given
  `ConfirmedRequirement[]`, renders one "✓ {label}" row per entry, no
  logic beyond mapping.

## VALIDATE
### Component / Integration Tests
- [ ] `MatchGradeBadge` renders the label for all 5 grades; no
      subtitle/explanation text renders for any grade
- [ ] `ConfirmedRequirementsList` renders one row per entry with a
      checkmark and the exact `label` text, in input order
- [ ] `RecommendationsScreen`: a provider's confirmed requirements
      render as checkmarks matching `confirmedRequirements` exactly
      (all-confirmed case, single-confirmed case, multiple-but-not-all
      case)
- [ ] `RecommendationsScreen`: provider-specific service-area/FACT
      text is never substituted for the user's requested value in the
      checklist (asserted against a fixture where the two differ, e.g.
      a multi-city `servicesOffered` string vs. a short `location`
      requirement label)
- [ ] `RecommendationsScreen`: `sort-control` testID no longer renders
      anywhere on the screen
- [ ] `RecommendationsScreen`: facts/inferred counter text no longer
      renders anywhere on the screen
- [ ] `RecommendationsScreen`: trimmed `explanation` text still
      renders verbatim as received
- [ ] `RecommendationsScreen`: existing heading/subtitle/count/
      trace-link/price/location/rating/`onSelectRow` tests still pass
- [ ] `App.test.tsx`: full suite passes with the updated
      `providerScoreFixture`

### Success Criteria
- [ ] `frontend/npm test` full suite green, no regressions
- [ ] `frontend/npx tsc --noEmit` clean
- [ ] Provider Details screen unchanged and still shows full FACT/
      INFERRED evidence (manual check — no test file touched there)

## ITERATE
### Outcome
Implemented as planned, no deviations:
- New `frontend/src/components/ConfirmedRequirementsList.tsx` —
  purely presentational, renders `provider.confirmedRequirements` as
  "✓ {label}" rows in input order, `null` when empty (no unconfirmed/
  greyed state built).
- `frontend/src/domain/types.ts` — mirrored
  `ConfirmedRequirementKind`/`ConfirmedRequirement` and added
  `ProviderScore.confirmedRequirements`.
- `frontend/src/components/MatchGradeBadge.tsx` — dropped the fixed
  per-grade subtitle and the `match-grade-explanation` testID
  entirely; label-only badge, `GRADE_COPY` replaced with a simple
  `GRADE_LABELS` lookup.
- `frontend/src/screens/RecommendationsScreen.tsx` — removed
  `countFactsSourced` and its rendered row, removed the "Sort: Best
  match" pill and its `metaRow`/`sortPill`/`sortLabel` styles, added
  `ConfirmedRequirementsList` between `MatchGradeBadge` and the
  (unchanged) `explanation` line. Price/location/rating derivation
  and rendering untouched.
- Test updates: `MatchGradeBadge.test.tsx` rewritten (label-only
  assertions, explicit `match-grade-explanation` absence check); new
  `ConfirmedRequirementsList.test.tsx` (2 tests); `RecommendationsScreen.test.tsx`
  — `makeProvider()` fixture gained a default `confirmedRequirements`
  entry, the old fact/inferred-count test replaced with an explicit
  absence check, added a non-empty-screen sort-control absence check,
  3 checklist-rendering tests (all/one/partial), and 1 test proving
  the checklist shows the user's short location label rather than the
  provider's full multi-city service-area FACT text. `App.test.tsx`'s
  `providerScoreFixture` gained `confirmedRequirements`.
- `frontend/npm test`: 158/158 passing (151 pre-existing + 7 net new).
  `frontend/npx tsc --noEmit`: clean.
- `ProviderDetailsScreen.tsx`, `ContextPanel.tsx`, `App.tsx`
  (production code), `TraceScreen.tsx`, and all backend files were not
  touched, per the DO NOT TOUCH list — confirmed `TraceScreen.tsx`
  uses its own locally-defined score-detail shape, not the
  `ProviderScore` type, so it was unaffected by the new field even
  without being touched.
- `DESIGN.md` gained one Architecture Decisions bullet (the
  confirmed-requirements-per-card + pre-cap exclusion behavior, at
  product level, no implementation detail).

### Knowledge Updates
Folded into D28 in `decisions.md` (task-88's entry, extended to cover
this task) and a combined `progress.md` entry alongside task-88.

### Follow-ups
None currently scoped. This closes the provider-card requirement-
evidence feature pair (task-88 backend + task-89 frontend).
