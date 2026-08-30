# Task 95: serviceCategory match — suffix normalization + fold into ranking
Status: DONE
Can run in parallel with: task-94

## PLAN
- Goal: Fix two related `serviceCategory` matching defects found via
  live testing: (1) the confirmed-requirements checklist misses an
  obvious category match because its substring check is too strict;
  (2) the actual ranking dimension (`requirementMatchScore`) ignores
  `serviceCategory` entirely, so even a correct checklist match never
  affects `fitScore`/`matchGrade`.
- Inputs: `backend/src/ranking/confirmedRequirements.ts` (existing
  `factText()` helper, `deriveConfirmedRequirements`,
  `deriveRequirementCatalog`); `backend/src/ranking/matchAndFitScores.ts`
  (`requirementMatchScore`).
- Outputs: A single shared, exported category-matching helper (lives
  in `confirmedRequirements.ts`, next to `factText()`) used by both
  the checklist derivation and `requirementMatchScore` — one source of
  truth, not two copies of the same logic.
- Constraints:
  - Keep the match deterministic/lexical — no LLM call added to
    scoring (D5/D8/D13d already-established; the assignment doesn't
    require semantic matching here, and adding it would reintroduce
    non-determinism into a function meant to be inspectable and cheap).
  - Do NOT "make it bidirectional like `geoFitScore`" — considered and
    rejected. `geoFitScore` compares two short, comparable location
    strings; here a short `serviceCategory` phrase is compared against
    a full paragraph of FACT text, so the reverse containment
    direction (`requirement.includes(fullText)`) can never fire. The
    actual fix is suffix stripping (see Implementation Notes).
  - Do not change `geoFitScore`, `priceFitScore`, or the
    categoryAttributes-matching part of `requirementMatchScore` — only
    the `serviceCategory` handling is in scope.
  - Do not touch `deriveRequirementCatalog`'s existing behavior of
    listing `serviceCategory` in the catalog regardless of match — that
    part (used for the trace's "unmatched" labels, task-93) is already
    correct and unaffected by this fix.
- Open Questions: none — both defects and the fix approach were
  verified against real FACT text and a real ranking trace in this
  session (Clowns.com's `servicesOffered` literally contains "Bounce
  Houses & Jumps," which the extracted `serviceCategory` "bounce house
  rental" currently fails to match; `requirementMatch: 0.00`, not
  `—`/null, was observed for every enriched candidate on that query).

## Assignment Alignment
- Requirement type: PROJECT DECISION (bug fix within already-approved,
  EXPLICIT-required M9 scope)
- Assignment requirement: Part 3 — "Then rank the providers based on
  the user's specific requirements... A generic sort by star rating is
  not enough."
- Source: `docs/Home Assignment.pdf`, page 3, Part 3.
- Rationale: `requirementMatchScore` is the mechanism specifically
  built to satisfy this requirement — a real, requirement-driven
  ranking dimension, not a star-rating sort. Live testing found it
  currently never references `serviceCategory` at all (only
  `categoryAttributes`), and its sibling checklist function
  (`deriveConfirmedRequirements`) fails to recognize an obvious
  category match due to an overly strict one-directional substring
  check — both verified against real FACT text and a real ranking
  trace. Fixing both makes the already-approved ranking dimension
  actually deliver what Part 3 asks for, without adding new scope or
  new LLM involvement in scoring.

## IMPLEMENT
### Files Touched
- MODIFY: `backend/src/ranking/confirmedRequirements.ts` — normalize
  `serviceCategory` (strip generic suffixes: "rental"/"rentals",
  "service"/"services", "provider"/"providers", "company") before the
  substring check in `deriveConfirmedRequirements`; export the
  matching helper so `matchAndFitScores.ts` can reuse it instead of
  reimplementing
- MODIFY: `backend/src/ranking/matchAndFitScores.ts` —
  `requirementMatchScore` folds in the same corrected `serviceCategory`
  match as one more matched/unmatched value alongside
  `categoryAttributes`, rather than ignoring it
- MODIFY: `backend/src/ranking/confirmedRequirements.test.ts` — cases
  for suffix-stripped matching (e.g. "bounce house rental" matching
  text containing "bounce houses")
- MODIFY: `backend/src/ranking/matchAndFitScores.test.ts` — cases
  proving `requirementMatchScore` now credits a matched
  `serviceCategory` even when `categoryAttributes` is empty (the exact
  scenario from this session, once task-94 removes the bogus
  attribute)
- DO NOT TOUCH: `geoFitScore`, `priceFitScore`,
  `deriveRequirementCatalog`'s existing catalog-listing behavior,
  `fitScore.ts`, `rankProviders.ts`

### Implementation Notes
- Suffix stripping should be a small, named list of generic category
  words, applied to `serviceCategory` only (never to
  `categoryAttributes` values or provider FACT text) — keep it a
  simple deterministic normalization, not a stemming/NLP library.
- `requirementMatchScore`'s existing null-guard (returns `null` when
  neither `servicesOffered` nor `policies` exist) should be revisited
  now that `serviceCategory` (which can also check `name`, per
  `factText(candidate, true)`) is folded in — decide during
  implementation whether the null-guard should also account for `name`
  being present, and document the choice inline if it changes.

## VALIDATE
### Unit Tests
- [x] `confirmedRequirements.test.ts`: "bounce house rental" confirms
      against FACT text containing "bounce houses" (suffix-stripped
      match)
- [x] `confirmedRequirements.test.ts`: a genuine mismatch (e.g. "bounce
      house rental" vs. FACT text mentioning only "inflatables") still
      does NOT confirm — the accepted D13d lexical gap stays intact,
      not silently widened
- [x] `matchAndFitScores.test.ts`: `requirementMatchScore` returns a
      non-null, credit-giving value from a `serviceCategory` match
      alone, even with empty `categoryAttributes`
- [x] `matchAndFitScores.test.ts`: existing categoryAttributes-only
      test cases still pass unchanged

### Component / Integration Tests
- [x] `rankProviders.test.ts`: no regression in existing
      fixture-driven aggregate scores (spot-check any fixture that
      relies on `requirementMatch` being categoryAttributes-only) —
      `REQUIREMENTS` in that fixture has no `serviceCategory`, so this
      task's new branch never fires there; all 10 existing tests
      passed unchanged.

### E2E Tests
- N/A

### Success Criteria
- [x] `npm test` (backend) passes — 43 files / 404 tests
- [ ] Re-running this session's exact query against the live backend
      not re-verified in this pass (requires a live Firecrawl/Gemini
      run); unit coverage exercises the exact "bounce house rental" vs.
      "Bounce Houses & Jumps" scenario this criterion describes.

## ITERATE
### Outcome
Added `normalizeServiceCategory` (strips a fixed list of generic
trailing words: rental(s), service(s), provider(s), company) and
exported `serviceCategoryMatches(candidate, serviceCategory)` in
`confirmedRequirements.ts`, next to `factText`. Both
`deriveConfirmedRequirements` and `requirementMatchScore` now call
this one helper instead of `deriveConfirmedRequirements` doing its own
inline substring check and `requirementMatchScore` ignoring
`serviceCategory` entirely.

`requirementMatchScore`'s null-guard was widened from "no
servicesOffered and no policies" to also accept a candidate with only
a `name` fact, since `serviceCategoryMatches` can match via `name`
alone — otherwise a real match would never be reached. The
categoryAttributes-matching logic and combinedText computation were
left untouched, per the task's explicit scope limit.

`matchAndFitScores.ts` now imports from `confirmedRequirements.ts`,
which already imported `geoFitScore` from `matchAndFitScores.ts` —
this makes the two modules mutually import each other. Confirmed this
is safe: all cross-references are function declarations (hoisted) used
only inside other function bodies, never at module-evaluation time, so
there's no initialization-order hazard. `npm run typecheck` and
`npm test` both confirm it resolves cleanly under tsx/vitest's ESM
loader.

Full backend suite: 43 files / 404 tests pass. `npm run typecheck`
clean. The task's live-backend success criterion (re-running the
session's exact Fiesta Bounce/Clowns.com/NY Inflatables query) was not
re-executed — the new unit tests cover the identical scenario
("bounce house rental" vs. "Bounce Houses & Jumps" / vs.
"inflatables") that motivated the fix.

### Knowledge Updates
None — this is a bug fix within already-documented M9 scope; no new
architectural decision was made (suffix-stripping was already
specified in the task's Implementation Notes, not decided during
implementation).

### Follow-ups
None identified during implementation.
