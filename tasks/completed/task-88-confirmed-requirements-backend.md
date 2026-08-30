# Task 88: Confirmed-requirements checklist + zero-confirmed-match filter (backend)
Status: DONE
Can run in parallel with: NONE (task-89 depends on this one)

## PLAN
- Goal: for each ranked provider, deterministically compute which of
  the user's stated requirements (service category, location, each
  non-budget category attribute) are confirmed by FACT evidence, and
  exclude any candidate with zero confirmed matches from the ranked
  list before it's capped to the top 5 — so an eligible lower-ranked
  candidate can backfill a removed slot.
- Inputs: `ConversationState.serviceCategory` /
  `coreAttributes.location` / `categoryAttributes` (existing);
  `ProviderCandidate.fields` FACT text (existing, `servicesOffered`/
  `policies`/`name`/`location`); the existing per-dimension scoring
  functions in `matchAndFitScores.ts` (reused, not reimplemented,
  for the location check).
- Outputs: `ProviderScore.confirmedRequirements: ConfirmedRequirement[]`
  (new field); `rankProviders` only returns candidates with at least
  one confirmed entry, still capped at `MAX_RANKED_RESULTS = 5` after
  filtering; `buildRankingExplanation` no longer includes the
  requirement-match clause (kept: geoFit/priceFit/reputation clauses).
- Constraints:
  - Do NOT change `requirementMatchScore`, `geoFitScore`,
    `priceFitScore`, `reputationScore`, `evidenceQualityScore`,
    `computeAggregateScore`, `computeFitScore`, `deriveMatchGrade`, or
    any weight/threshold. `score`/`dimensionScores`/`fitScore`/
    `matchGrade`/`explanation` for a candidate that survives the
    filter must be byte-identical to what today's code would produce
    for that same candidate.
  - The only change to `rankProviders`'s existing behavior is: (a) an
    added `confirmedRequirements` field per candidate, (b) an added
    filter step removing zero-confirmed candidates, applied AFTER
    scoring and BEFORE the `.slice(0, MAX_RANKED_RESULTS)` cap (per
    reviewer decision — filtering pre-cap so an eligible candidate
    ranked below the historical top-5 can still appear).
  - `confirmedRequirements` only considers `candidate.fields` (FACT).
    Never use `candidate.inferred` (INFERRED), reputation, or FACT
    count as a substitute — an entry is confirmed only if the
    specific requirement's value is present in FACT text (location)
    or the requirement's value lexically appears in FACT text
    (serviceCategory / category attributes).
  - Matching convention: case-insensitive substring, same lexical
    heuristic already accepted for `requirementMatchScore` (D13d) —
    do not build fuzzy/semantic/token-overlap matching; this task
    does not change the accuracy of that heuristic, only its
    granularity (per-requirement instead of one blended ratio).
  - Location check reuses `geoFitScore`'s existing bidirectional
    substring logic (a location requirement is confirmed iff
    `geoFitScore(candidate, requirements) === 1`) — do not write a
    second, different location-matching implementation.
  - Budget is excluded from `confirmedRequirements`, same exclusion
    `findBudgetAttribute` already applies in `matchAndFitScores.ts`
    (budget is a price-fit concept, not a text-match concept).
  - `dateTime` is never checked and never appears in
    `confirmedRequirements` — no FACT field represents "available on
    this specific date" (`availability` is free text, not
    date-specific), so a dateTime check would structurally never
    succeed. Do not add one.
  - `RankingRequirements` gains an optional `serviceCategory?: string`
    field (needed for the new function; existing dimension functions
    ignore it, so this is additive and does not change their
    behavior).
- Open Questions: none — filter placement (pre-cap, backend) was
  confirmed directly with the reviewer before this file was written.

## Assignment Alignment
- Requirement type: PROJECT DECISION (supports EXPLICIT requirement)
- Assignment requirement: Part 6 lists card content the user must
  quickly understand, including "Why they are a good match" and "What
  information is confirmed"; evaluation criterion 4 ("Data & Search
  Thinking... beyond simply returning the first five results") and
  Part 3's "a generic sort by star rating is not enough" both support
  ranking/filtering on genuine requirement relevance rather than a
  raw evidence-count or reputation proxy.
- Source: `docs/Home Assignment.pdf`, Part 3 p.3, Part 6 pp.3-4,
  Evaluation criterion 4 p.7.
- Rationale: the existing ranking pipeline (M9/D13) can already tell
  you *that* a candidate matched requirements in aggregate, but not
  *which* specific requirement a user can see confirmed, and never
  excludes a candidate that matched literally nothing the user asked
  for. This task adds the missing per-requirement structured signal
  and the corresponding exclusion rule, without touching the
  underlying scoring math task-27–32/79 already established and
  tested.

## IMPLEMENT
### Files Touched
- CREATE: `backend/src/ranking/confirmedRequirements.ts`
- CREATE: `backend/src/ranking/confirmedRequirements.test.ts`
- MODIFY: `backend/src/ranking/types.ts` (add `serviceCategory?` to
  `RankingRequirements`, update `deriveRankingRequirements`; add
  `ConfirmedRequirement` type and `ProviderScore.confirmedRequirements`)
- MODIFY: `backend/src/ranking/rankProviders.ts` (compute
  `confirmedRequirements` per candidate; filter zero-confirmed
  candidates before the existing sort/slice)
- MODIFY: `backend/src/ranking/rankProviders.test.ts` (update fixtures
  so existing regression assertions still hold under the new filter;
  add filter-specific tests)
- MODIFY: `backend/src/ranking/explanation.ts` (drop
  `requirementMatchClause` from the joined output; keep geoFit/
  priceFit/reputation clauses)
- MODIFY: `backend/src/ranking/explanation.test.ts`
- MODIFY: `backend/src/recommendation/generateProviderList.test.ts`
  (fixture candidates need FACT text that produces at least one
  confirmed match, or they'll be silently filtered — check and fix
  any fixture that would now legitimately return fewer providers)
- DO NOT TOUCH: `aggregateScore.ts`, `fitScore.ts`,
  `matchAndFitScores.ts`, `reputationAndEvidenceScores.ts`,
  `research/**`, `llm/**`, `domain/provider.ts`, `server.ts`,
  `recommendation/generateProviderList.ts` (production code — only
  its test file needs fixture updates), `recommendation/mockReputationSignals.ts`

### Implementation Notes
- `confirmedRequirements.ts` exports a `ConfirmedRequirement` shape
  (e.g. `{ label: string; kind: "serviceCategory" | "location" |
  "categoryAttribute" }`) and
  `deriveConfirmedRequirements(candidate, requirements)` returning
  the array — empty array means zero confirmed matches (the filter
  predicate is simply `.length > 0`, computed once and reused, not a
  second implementation of the same check).
- `label` for `serviceCategory`/`location` is the requirement's own
  value as stated by the user (e.g. `"Texas"`, `"baby shower
  photographer"`), not the provider's matched FACT text — never
  substitute the provider's full service-area string for the user's
  shorter requirement, consistent with the reviewer's original ask.
- `label` for a category attribute is that attribute's `value`
  (already a string, e.g. `"baby shower"`), not its object key.
- `rankProviders.ts`: compute `dimensionScores`/`fitScore`/
  `matchGrade`/`explanation` exactly as today for every candidate
  first, then compute `confirmedRequirements`, then filter, then
  sort + slice — order of operations matters for the "unchanged for
  survivors" guarantee.

## VALIDATE
### Unit Tests
- [ ] `deriveConfirmedRequirements`: serviceCategory confirmed when
      substring appears in name/servicesOffered/policies text; not
      confirmed when absent
- [ ] location confirmed iff `geoFitScore` would be `1`; verified via
      a case that also proves it's the same function, not a
      duplicate implementation with different results
- [ ] each non-budget category attribute checked independently
      (partial-confirmation case: 2 of 3 attributes confirmed)
- [ ] budget-named attribute never appears in the result even when its
      value happens to appear in FACT text
- [ ] a candidate with zero FACT text anywhere returns `[]`
- [ ] `explanation.ts`: requirement-match clause never appears in
      output; geoFit/priceFit/reputation clauses still appear
      unchanged from today's behavior

### Component / Integration Tests
- [ ] `rankProviders`: a candidate with `confirmedRequirements: []` is
      excluded from the result even if it would otherwise rank in the
      top 5 (proves pre-cap filtering, not post-cap)
- [ ] `rankProviders`: with filtering applied, a 6th-ranked eligible
      candidate appears in the final top-5 output when a higher-ranked
      candidate was excluded (the actual backfill behavior, not just
      "the ineligible one is gone")
- [ ] `rankProviders`: for every surviving candidate, `score`/
      `dimensionScores`/`fitScore`/`matchGrade`/`explanation` are
      identical to what today's code (no filter) produces for that
      candidate — the regression guard task-79/84 already established,
      re-verified under the new filter
- [ ] `rankProviders`: all-candidates-ineligible case returns `[]`,
      not an error
- [ ] `generateProviderList` full pipeline test still returns
      providers with the expected shape including
      `confirmedRequirements`

### Success Criteria
- [ ] `backend/npm test` full suite green, no regressions
- [ ] `backend/npm run typecheck` and `npm run build` clean
- [ ] Existing ranking order/score tests pass (updated only where the
      new filter legitimately changes which candidates survive, never
      where it shouldn't)

## ITERATE
### Outcome
Implemented as planned, no deviations:
- `backend/src/ranking/confirmedRequirements.ts` (new): exports
  `deriveConfirmedRequirements(candidate, requirements)`. serviceCategory
  checked against `name`+`servicesOffered`+`policies` FACT text; location
  reuses `geoFitScore` exactly (imported, not reimplemented); each
  non-budget category attribute checked independently against
  `servicesOffered`+`policies` text only, matching
  `requirementMatchScore`'s existing convention; budget excluded via a
  locally-defined `findBudgetKey` (kept local rather than exporting
  `matchAndFitScores.ts`'s private helper, to honor that file's DO NOT
  TOUCH boundary — trivial duplication of one `/budget/i` regex check,
  not a second algorithm). `dateTime` is never checked, per plan.
- `backend/src/ranking/types.ts`: `RankingRequirements` gained optional
  `serviceCategory`; `deriveRankingRequirements` now maps it from
  `state.serviceCategory` (`null` → `undefined`); added
  `ConfirmedRequirementKind`/`ConfirmedRequirement`; `ProviderScore`
  gained `confirmedRequirements: ConfirmedRequirement[]`.
- `backend/src/ranking/rankProviders.ts`: computes
  `confirmedRequirements` per candidate alongside the existing
  dimension scores (no change to their computation), then filters
  `.confirmedRequirements.length > 0` **before** the existing
  sort+`.slice(0, MAX_RANKED_RESULTS)` — confirmed as pre-cap filtering
  by a dedicated backfill test.
- `backend/src/ranking/explanation.ts`: removed `requirementMatchClause`
  and its call site entirely; geoFit/priceFit/reputation clauses
  unchanged.
- Test updates: `rankProviders.test.ts` needed **zero** fixture changes
  to its existing assertions — every pre-existing non-D candidate
  already had a genuine location or category-attribute match, so
  nothing pre-existing was newly filtered out (verified test-by-test
  before writing new tests, not assumed). Added 3 new tests (attaches
  `confirmedRequirements`; excludes an all-zero-confirmed candidate;
  backfill — a weak-but-eligible candidate appears when 5
  higher-scoring zero-confirmed candidates are filtered out pre-cap,
  with per-dimension math worked out by hand to guarantee the
  unconfirmed candidates would have outscored the eligible one absent
  filtering). `explanation.test.ts`: 2 tests restructured (dropped
  "mentions requirement match" assertions, added a
  "never mentions a requirement-match clause regardless of score"
  parametrized test mirroring the existing evidence-quality test).
  `types.test.ts`: updated the "exactly N keys" test to 3 keys, added a
  `serviceCategory`-mapping test. `generateProviderList.test.ts`: added
  `confirmedRequirements: []` to all 5 `ProviderScore` fixture literals
  (that file always injects a fake `rank`, so real filtering logic
  never runs there) and fixed one assertion that checked the exact
  shape of the object passed to `rank` (now includes `serviceCategory`).
  New `confirmedRequirements.test.ts`, 7 tests covering every VALIDATE
  case.
- `backend/npm test`: 383/383 passing (372 pre-existing + 11 net new:
  +3 rankProviders, +7 confirmedRequirements, +1 types.test; explanation
  net 0, restructured in place). `backend/npm run typecheck` and
  `npm run build`: clean.
- `aggregateScore.ts`, `fitScore.ts`, `matchAndFitScores.ts`,
  `reputationAndEvidenceScores.ts`, `research/**`, `llm/**`,
  `domain/provider.ts`, `server.ts`,
  `recommendation/generateProviderList.ts` (production code),
  `recommendation/mockReputationSignals.ts` were not touched, per the
  DO NOT TOUCH list.

### Knowledge Updates
Recorded as `decisions.md` D28 and a `progress.md` entry.

### Follow-ups
- Task-89 (frontend card redesign) is next: render
  `confirmedRequirements` as the "why this matches" checklist, drop
  `MatchGradeBadge`'s subtitle, remove the fact/inferred counters and
  sort pill.
- The serviceCategory whole-phrase substring check is a known,
  accepted lexical limitation (same class as D13d) — a provider
  site's own phrasing rarely matches the user's exact requested
  phrase verbatim. Not fixed here; recorded for awareness only, same
  treatment as D13d.
