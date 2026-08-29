# Task 28: Requirement-match, geo-fit, and price-fit dimension scores
Status: DONE
Can run in parallel with: task-29 (both depend only on task-27's
types; neither depends on the other's output)

## PLAN
- Goal: Three pure, deterministic scoring functions — one per
  dimension — each taking a `ProviderCandidate` and
  `RankingRequirements` and returning a `number` in `[0, 1]` or `null`
  when the dimension can't be computed for that candidate (per the
  agreed missing-data rule: excluded, not zero).
- Inputs: task-27's `RankingRequirements`/`ProviderScore` types
  (`backend/src/ranking/types.ts`); `ProviderCandidate` from
  `backend/src/domain/provider.ts`.
- Outputs: `backend/src/ranking/matchAndFitScores.ts` exporting:
  - `requirementMatchScore(candidate, requirements): number | null` —
    case-insensitive substring matching (D13d — lexical, not
    semantic, no LLM call) between each non-null
    `requirements.categoryAttributes[key].value` and the combined text
    of `candidate.fields.servicesOffered.value` (joined) and
    `candidate.fields.policies.value`. **The `categoryAttributes` entry
    identified as the budget (via the same `findBudgetAttribute` lookup
    `priceFitScore` uses, below) is excluded from the set of values
    checked here** (D13d addendum) — budget already has its own
    `priceFitScore` dimension, and a dollar string like `"$500"` would
    essentially never appear in `servicesOffered`/`policies` text, so
    including it would double-count budget's influence while
    artificially depressing every candidate's match score for a reason
    unrelated to service/category fit. Score = (# non-budget
    requirement values matched) / (# non-null, non-budget requirement
    values checked). Returns `null` if there are zero such values to
    check, or if the candidate has neither `servicesOffered` nor
    `policies` FACTs to check against.
  - `geoFitScore(candidate, requirements): number | null` —
    case-insensitive substring overlap between `requirements.location`
    and `candidate.fields.location.value` (either containing the
    other counts as a match). Returns `1` (match) or `0` (no match)
    when both sides are present; `null` if either side is missing.
  - `priceFitScore(candidate, requirements): number | null` — locates
    the user's budget via `findBudgetAttribute` (D13g: first
    `categoryAttributes` key matching `/budget/i` with a non-null
    `value`), parses one dollar amount from it and from
    `candidate.fields.pricing.value` via `parseDollarAmount` (below).
    If either side is missing or unparseable → `null`. Otherwise:
    `providerPrice <= budget` → `1`; else
    `max(0, 1 - (providerPrice - budget) / budget)` (linear falloff,
    floored at 0 — a project tuning formula, not derived from data;
    documented here and in code, revisit if evidence suggests a
    different shape).
  - `parseDollarAmount(text: string): number | null` (exported,
    independently testable) — D13e's rule: regex-extract all
    `$`-prefixed numeric amounts (handling `,` thousands separators
    and optional decimals, e.g. `$1,095` → `1095`). Exactly one match
    → return it. Zero matches or more than one (including ranges like
    `"$200-$300"` or multi-value strings like `"$175... to
    $365-$1,095"`) → `null`. Never averages, never picks a bound.
- Constraints:
  - Pure functions only — no I/O, no LLM call, no `Date.now()` or
    other non-determinism.
  - Do not implement `reputationScore` or `evidenceQualityScore`
    (task-29), the weighted aggregate (task-30), or the explanation
    builder (task-31).
  - `findBudgetAttribute` may stay a private (non-exported) helper
    within this file — it is now called from both `priceFitScore` (to
    find the budget) and `requirementMatchScore` (to exclude it), so
    both functions must use the exact same helper rather than each
    reimplementing the `/budget/i` lookup — do not duplicate this
    logic.
- Open Questions: none — resolved during M9 planning (D13d incl. its
  post-review addendum, D13e, D13g in `decisions.md`).

## Assignment Alignment
- Requirement type: PROJECT DECISION (mechanism), supporting an
  EXPLICIT requirement.
- Assignment requirement: Part 3 — rank providers "based on the
  user's specific requirements," explicitly warning "a generic sort
  by star rating is not enough" (`docs/Home Assignment.pdf`, page 3).
  These three dimensions are the requirement-fit half of D8's
  five-dimension scorer.
- Source: Part 3, page 3; D8 (five-dimension scorer); D13d incl. its
  addendum (lexical match, documented limitation, budget excluded from
  requirement matching), D13e (price-parsing conservatism), D13g
  (budget-key lookup heuristic).
- Rationale: Deterministic, inspectable scoring functions with no LLM
  call keep ranking cheap, reproducible, and directly testable against
  fixed fixtures — consistent with D5/D8's LLM-out-of-the-scoring-loop
  principle.
- Gaps/conflicts found: none. Known, explicitly documented
  limitations (lexical-not-semantic matching; range-priced strings
  parse to `null`) are accepted tradeoffs, not gaps.

## IMPLEMENT
### Files Touched
- CREATE: `backend/src/ranking/matchAndFitScores.ts`
- CREATE: `backend/src/ranking/matchAndFitScores.test.ts`
- DO NOT TOUCH: `backend/src/ranking/types.ts` (import only, do not
  modify), `backend/src/domain/**`, `backend/src/research/**`,
  `backend/src/llm/**`, `backend/src/conversation/**`,
  `backend/src/server.ts`.

### Implementation Notes
- `servicesOffered` is `Fact<string[]>` (an array) — join with a
  space or newline before substring-matching, don't iterate and
  short-circuit in a way that skips `policies` when `servicesOffered`
  is absent (or vice versa) — check whichever FACT(s) exist.
- `findBudgetAttribute(categoryAttributes)` iterates
  `Object.entries(categoryAttributes)`, returns the first entry whose
  key matches `/budget/i` and whose `value` is non-null; returns
  `undefined` otherwise. `requirementMatchScore` calls this same
  helper and, if it returns an entry, filters that key out of the
  values it builds its match set from — it does not just re-run the
  `/budget/i` regex separately.

## VALIDATE
### Unit Tests
- [ ] `requirementMatchScore`: all requirement values found in
      `servicesOffered` → `1`.
- [ ] `requirementMatchScore`: half the requirement values found →
      `0.5`.
- [ ] `requirementMatchScore`: no `servicesOffered`/`policies` FACT at
      all → `null`.
- [ ] `requirementMatchScore`: no non-null category-attribute values
      to check → `null`.
- [ ] `requirementMatchScore`: a `budget` entry (e.g. `"$500"`) present
      alongside other category attributes does NOT affect the score —
      compare against the same fixture with the budget entry removed
      entirely and assert identical results (the direct regression
      test for the budget double-counting correction).
- [ ] `requirementMatchScore`: only a `budget` entry present, no other
      category attributes → `null` (nothing non-budget left to check).
- [ ] `geoFitScore`: user location substring of provider location
      (e.g. `"Austin"` vs `"Austin, TX"`) → `1`.
- [ ] `geoFitScore`: no overlap → `0`.
- [ ] `geoFitScore`: either side missing → `null`.
- [ ] `parseDollarAmount("$200")` → `200`.
- [ ] `parseDollarAmount("$1,095")` → `1095`.
- [ ] `parseDollarAmount("Starting at $150")` → `150`.
- [ ] `parseDollarAmount("$200-$300")` → `null`.
- [ ] `parseDollarAmount("$175... to $365-$1,095")` → `null` (the
      exact ambiguous example from M9 planning review).
- [ ] `parseDollarAmount("Contact for pricing")` → `null`.
- [ ] `priceFitScore`: provider price under/equal to budget → `1`.
- [ ] `priceFitScore`: provider price over budget → value strictly
      between `0` and `1`, per the linear-falloff formula.
- [ ] `priceFitScore`: no `categoryAttributes` key matches
      `/budget/i` → `null`.
- [ ] `priceFitScore`: budget present but `candidate.fields.pricing`
      absent → `null`.
- [ ] `priceFitScore`: budget value itself is an unparseable/ambiguous
      string → `null`.

### Component / Integration Tests
- N/A — no consumer yet (task-30/32 wire these in).

### E2E Tests
- N/A.

### Success Criteria
- [ ] All new tests pass; existing suite still passes.
- [ ] `npm run build` clean.
- [ ] No I/O, no LLM call, no non-determinism.

## ITERATE
### Outcome
Implemented as planned, no deviations. `backend/src/ranking/matchAndFitScores.ts`
(CREATE) exports `requirementMatchScore`, `geoFitScore`, `priceFitScore`,
and `parseDollarAmount`, plus a private `findBudgetAttribute` helper
shared by `requirementMatchScore` (to exclude the budget entry) and
`priceFitScore` (to locate it) — exactly as specified, no duplicated
`/budget/i` lookup. All four functions are pure (no I/O, no LLM call,
no `Date.now()`). 22 new tests in `matchAndFitScores.test.ts` covering
every VALIDATE checklist item (including the budget-exclusion
regression test and the exact `"$175... to $365-$1,095"` ambiguous
case from M9 planning review) plus one extra case confirming
`policies` alone (no `servicesOffered`) is checked correctly. `npm
test`: 208/208 passing — task-29 (reputation/evidence-quality scores)
landed concurrently in a separate session on disjoint files
(`backend/src/ranking/reputationAndEvidenceScores.ts`,
`backend/src/shared/hostname.ts`), so the 22 tests added here sit
alongside its 17; no file conflicts, no shared state. `npm run build`
clean. No `DO NOT TOUCH` file touched.

### Knowledge Updates
None beyond what D13d/D13e/D13g already captured during M9 planning —
no new architectural decision was made during implementation, no
deviation from the approved plan. Added one DESIGN.md bullet
(Architecture Decisions) summarizing the lexical-match tradeoff and
the budget-exclusion/price-parsing-conservatism rationale at a
product-level, no implementation detail.

### Follow-ups
None new. Task-30 (weighted aggregate + minimum-evidence floor) and
task-31 (explanation builder) are the next consumers of this and
task-29's dimension scores — all five M9 dimension-scoring functions
now exist.
