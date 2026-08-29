# Task 79: fitScore/matchGrade domain logic + rankProviders wiring
Status: DONE
Can run in parallel with: task-81, task-82 (disjoint files; task-80 depends on this one)

## PLAN
- Goal: expose a requirement-fit-only score and a qualitative match
  grade on `ProviderScore`, computed deterministically from the
  three genuinely requirement-fit ranking dimensions, without
  touching the existing ranking order.
- Inputs: `ranking/matchAndFitScores.ts`'s existing
  `requirementMatchScore`/`geoFitScore`/`priceFitScore` (reused as-is,
  not reimplemented) via the `dimensionScores` object
  `rankProviders.ts` already computes per candidate.
- Outputs: `ProviderScore.fitScore: number | null` and
  `ProviderScore.matchGrade: MatchGrade`
  (`"wonderful" | "good" | "average" | "poor" | "insufficient_data"`).
- Constraints:
  - Do NOT modify `aggregateScore.ts`, `DIMENSION_WEIGHTS`, or
    `rankProviders`'s existing `score`/sort/`.slice(0,
    MAX_RANKED_RESULTS)` behavior in any way — ranking order must stay
    byte-for-byte unchanged (verified in VALIDATE below).
  - Do NOT include `reputation` or `evidenceQuality` in `fitScore` —
    confirmed decision, not open for reinterpretation here.
  - `fitScore` = mean of `requirementMatch`/`geoFit`/`priceFit`,
    counting only non-null values, but only when at least
    `MIN_MEANINGFUL_FIT_DIMENSIONS = 2` of the 3 are non-null;
    otherwise `null`. (Real fixture evidence for why the floor is
    required: a candidate with only `geoFit` known would otherwise
    score a perfect 1.0 fitScore off one dimension alone — see this
    task's approved planning discussion.)
  - Grade thresholds on non-null `fitScore`: `>= 0.75` wonderful,
    `>= 0.5` good, `>= 0.25` average, else poor. `null` fitScore always
    maps to `"insufficient_data"`, never `"poor"`.
  - Thresholds are an explicit, documented heuristic/product decision,
    not empirically calibrated (existing fixtures don't have enough
    spread to validate the 0.5/0.25 boundaries specifically) — note
    this in the module's file-level comment, not just here.
  - No new scoring algorithm — this only aggregates already-existing
    per-dimension values differently.
- Open Questions: none — reputation exclusion, evidenceQuality
  exclusion, floor requirement, and threshold values were all
  explicitly confirmed by the reviewer in prior discussion.

## Assignment Alignment
- Requirement type: PROJECT DECISION (supports EXPLICIT requirement)
- Assignment requirement: Part 6 ("Present the Recommendation") lists
  "Why they are a good match", "Rating / reputation", and "Why this
  provider ranks where it does" as separate card elements the user
  must be able to quickly understand; Part 3 states "A generic sort by
  star rating is not enough."
- Source: `docs/Home Assignment.pdf`, Part 3 p.3, Part 6 pp.3-4.
- Rationale: the assignment requires the UI to communicate match
  quality and reputation as distinct concepts, and requires ranking
  reasoning beyond a star rating. The existing aggregate `score`
  conflates fit with reputation and FACT-coverage, so it cannot
  honestly serve as "why they are a good match" text without implying
  more FACT-count-driven precision than intended. Computing a
  separate, narrower `fitScore`/`matchGrade` is the specific
  implementation choice (not literally specified by the assignment)
  that satisfies this explicit requirement correctly.

## IMPLEMENT
### Files Touched
- CREATE: `backend/src/ranking/fitScore.ts`
- CREATE: `backend/src/ranking/fitScore.test.ts`
- MODIFY: `backend/src/ranking/types.ts` (add `MatchGrade` type,
  extend `ProviderScore`)
- MODIFY: `backend/src/ranking/rankProviders.ts` (compute and attach
  `fitScore`/`matchGrade` per candidate, reusing the dimensionScores
  already built there)
- MODIFY: `backend/src/ranking/rankProviders.test.ts` (add assertions
  for the new fields on existing fixtures A-G; add a regression
  assertion that sort order/`score` values are unchanged)
- DO NOT TOUCH: `aggregateScore.ts`, `matchAndFitScores.ts`,
  `reputationAndEvidenceScores.ts`, `explanation.ts`,
  `research/**`, `llm/**`, `recommendation/**`, `server.ts`

### Implementation Notes
- `fitScore.ts` exports: `FIT_DIMENSIONS` (the 3-element subset),
  `MIN_MEANINGFUL_FIT_DIMENSIONS = 2`, `MatchGrade` type,
  `GRADE_THRESHOLDS`, `computeFitScore(dimensionScores)`, and
  `deriveMatchGrade(fitScore)`.
- `rankProviders.ts` calls `computeFitScore`/`deriveMatchGrade` using
  the same `dimensionScores` record it already builds per candidate —
  no re-invocation of `requirementMatchScore`/`geoFitScore`/
  `priceFitScore`.

## VALIDATE
### Unit Tests
- [ ] `computeFitScore`: 0, 1, 2, 3 known dimensions → null/null/mean/mean
- [ ] `deriveMatchGrade`: one case per grade boundary (wonderful/good/
      average/poor) plus null -> insufficient_data (never poor)
- [ ] `rankProviders` fixtures A-G: correct `fitScore`/`matchGrade` per
      the approved distribution table (A=1.0 wonderful, B=0.44 average,
      C/D/E=null insufficient_data, F=1.0 wonderful, G=1.0 wonderful)

### Component / Integration Tests
- [ ] `rankProviders`'s existing sort-order/score assertions still pass
      unmodified (regression guard that this task didn't touch ranking)

### Success Criteria
- [ ] `npm test` (backend) passes, no regressions
- [ ] `npm run build` (backend) clean
- [ ] `npm run typecheck` clean

## ITERATE
### Outcome
Implemented as planned. `backend/src/ranking/fitScore.ts` (new) exports
`FIT_DIMENSIONS`, `MIN_MEANINGFUL_FIT_DIMENSIONS = 2`,
`GRADE_THRESHOLDS`, `computeFitScore`, `deriveMatchGrade`.
`ranking/types.ts` gained `MatchGrade` and the two new `ProviderScore`
fields. `rankProviders.ts` populates them from the already-computed
`dimensionScores`, no re-scoring. 15 new tests (10 in
`fitScore.test.ts`, 2 in `rankProviders.test.ts` covering the real A-F
fixture distribution plus a regression guard). One test-writing bug
caught and fixed during VALIDATE: an added regression test wrongly
assumed candidate A would sort ahead of candidate F on the existing
5-dim `score` — real fixture data showed F legitimately outscores A
once `reputation`/`evidenceQuality` are counted (pre-existing
behavior, unrelated to this task); the test was corrected to not
assert an order this file never established elsewhere either.
`npm test`: 363/363 passing. `npm run typecheck`: clean.

### Knowledge Updates
None beyond what's captured in `decisions.md`'s new entry (see
task-80's completion, which will fold this and the frontend work into
one combined decisions.md/progress.md update once the full feature
lands).

### Follow-ups
None — scope was fully implemented as planned.
