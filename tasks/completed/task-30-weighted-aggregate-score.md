# Task 30: Weighted aggregate score (exclude + renormalize on missing dimensions)
Status: DONE
Can run in parallel with: task-31 (both depend only on tasks 27-29's
outputs; neither depends on the other's output)

## PLAN
- Goal: Combine the five per-dimension scores (tasks 28-29) into a
  single `0-1` total score, per D13f's equal-weight decision and the
  earlier agreed missing-data rule (exclude the dimension, renormalize
  the remaining weights).
- Inputs: `RankingDimension`/`ProviderScore` types (task-27); the five
  dimension-scoring functions (tasks 28-29) as a type dependency only
  — this task receives already-computed `Record<RankingDimension,
  number | null>`, it does not call the scoring functions itself
  (task-32 does that wiring).
- Outputs: `backend/src/ranking/aggregateScore.ts` exporting:
  - `DIMENSION_WEIGHTS: Record<RankingDimension, number>` — all five
    set to `0.2`. Documented per D13f as an explainable-baseline
    project decision, not an assignment requirement or a claim of
    optimality.
  - `MIN_MEANINGFUL_DIMENSIONS = 2` (named, tunable constant; D13h).
  - `computeAggregateScore(dimensionScores: Record<RankingDimension,
    number | null>): number` — first counts how many of the five
    dimensions are non-`null`. **If that count is `<
    MIN_MEANINGFUL_DIMENSIONS`, return `0` immediately** — do not run
    the weighted-renormalize computation at all (D13h: since
    `evidenceQualityScore` is never `null`, a candidate missing every
    other dimension would otherwise have `evidenceQuality` inflate to
    100% of the weight under plain renormalization, which is not a
    meaningful fit score). Otherwise, for each dimension with a
    non-`null` score, accumulate `weight * score` into a running total
    and `weight` into a running weight-sum; final result =
    `totalWeightedScore / totalWeightUsed`.
- Constraints:
  - Pure function only — no I/O, no LLM call, no non-determinism.
  - Do not implement the explanation builder (task-31) or the
    top-level orchestrator (task-32).
  - Do not change `DIMENSION_WEIGHTS`'s values away from equal `0.2`
    without a new, separately-documented decision — this task
    implements D13f's already-made choice, it does not re-litigate it.
  - Do not build a proportional "confidence factor" that scales the
    score by how many dimensions are known, or any other graduated
    model — D13h explicitly rejects this in favor of a hard floor.
    `MIN_MEANINGFUL_DIMENSIONS` is the only new piece of logic this
    task adds beyond straight weighted renormalization.
- Open Questions: none — resolved during M9 planning (D13f, D13h in
  `decisions.md`).

## Assignment Alignment
- Requirement type: PROJECT DECISION (mechanism), supporting an
  EXPLICIT requirement.
- Assignment requirement: Part 3 — explainable ranking, not a generic
  sort (`docs/Home Assignment.pdf`, page 3); "How does the agent
  decide what to do next?" / architecture-decision expectations for
  DESIGN.md (page 5-6).
- Source: Part 3, page 3; D8 (weighted scorer); D13f (equal weights as
  baseline); D13h (minimum-evidence floor); the earlier-agreed
  missing-data renormalization rule (M9 planning conversation, also
  referenced in D13a/D13b/D13e).
- Rationale: A transparent, named-constant weighting scheme with an
  explicit renormalization rule is trivially explainable in an
  interview ("why did provider A outrank B?" is answerable by reading
  five numbers and one formula) and keeps every candidate's score
  comparable even though different candidates will have different
  missing dimensions. The minimum-evidence floor (D13h) closes the one
  case where that transparency would otherwise produce a misleading
  result — a candidate scored entirely on FACT-completeness with zero
  validated fit to the user's actual request.
- Gaps/conflicts found: none.

## IMPLEMENT
### Files Touched
- CREATE: `backend/src/ranking/aggregateScore.ts`
- CREATE: `backend/src/ranking/aggregateScore.test.ts`
- DO NOT TOUCH: `backend/src/ranking/types.ts`,
  `backend/src/ranking/matchAndFitScores.ts`,
  `backend/src/ranking/reputationAndEvidenceScores.ts` (import types
  only, do not modify), `backend/src/domain/**`,
  `backend/src/research/**`, `backend/src/llm/**`,
  `backend/src/conversation/**`, `backend/src/server.ts`.

### Implementation Notes
- Iterate `Object.entries(DIMENSION_WEIGHTS)` rather than hardcoding
  the five dimension names twice, so the weight table stays the single
  source of truth for which dimensions exist.

## VALIDATE
### Unit Tests
- [ ] All five dimensions non-null, equal scores (e.g. all `0.8`) →
      aggregate equals that same value (`0.8`).
- [ ] All five dimensions non-null, mixed scores → aggregate equals
      the plain average (since weights are equal).
- [ ] One dimension `null`, four non-null (≥ `MIN_MEANINGFUL_DIMENSIONS`)
      → aggregate computed only from the remaining four, correctly
      renormalized (verify against a hand-computed expected value, not
      just "some number").
- [ ] Exactly two dimensions non-null (meets the floor exactly) →
      normal renormalized computation runs, not forced to `0` —
      confirms the floor is `<` not `<=`.
- [ ] Four dimensions `null`, only `evidenceQuality` non-null (`1`
      non-null dimension, below `MIN_MEANINGFUL_DIMENSIONS`) → returns
      `0`, regardless of how high `evidenceQuality`'s own score is.
      This is the direct regression test for D13h — confirms
      `evidenceQuality` alone can never carry 100% of the score.
- [ ] All five dimensions `null` (`0` non-null) → returns `0`, does
      not throw.
- [ ] `DIMENSION_WEIGHTS` has exactly the five expected keys, each
      equal to `0.2`, summing to `1`.
- [ ] `MIN_MEANINGFUL_DIMENSIONS` is exported and equals `2`.

### Component / Integration Tests
- N/A — no consumer yet (task-32 wires this in).

### E2E Tests
- N/A.

### Success Criteria
- [ ] All new tests pass; existing suite still passes.
- [ ] `npm run build` clean.
- [ ] No I/O, no LLM call, no non-determinism.

## ITERATE
### Outcome
Implemented exactly as planned, no deviations. Created
`backend/src/ranking/aggregateScore.ts` exporting `DIMENSION_WEIGHTS`
(all five dimensions at `0.2`), `MIN_MEANINGFUL_DIMENSIONS = 2`, and
`computeAggregateScore`, iterating `Object.entries(DIMENSION_WEIGHTS)`
per the implementation note. Created
`backend/src/ranking/aggregateScore.test.ts` covering all 8 VALIDATE
checklist cases (equal scores, mixed scores/plain average, one-null
renormalization with a hand-computed expected value, exactly-2 floor
boundary, evidenceQuality-alone-returns-0 regression test for D13h,
all-null-returns-0, weight-table shape, exported constant value). All
8 new tests pass; full suite 224/224 passing (216 pre-existing + 8
new); `npm run build` clean. Pure function only — no I/O, no LLM
call, no `Date.now()`. Did not touch `types.ts`,
`matchAndFitScores.ts`, `reputationAndEvidenceScores.ts`, or any
excluded directory.

### Knowledge Updates
None beyond what D13f/D13h already recorded — this task implemented
an already-made decision with no new architectural choice.

### Follow-ups
None. Task-32 (rankProviders orchestrator) is the next consumer, per
the approved execution order.
