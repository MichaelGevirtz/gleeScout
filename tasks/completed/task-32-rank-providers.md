# Task 32: rankProviders orchestration (score all candidates, sort, cap to top 5)
Status: DONE
Can run in parallel with: NONE (wires together tasks 27-31)

## PLAN
- Goal: The single entry point for M9 — score every M7-discovered
  candidate (enriched or not, per D13c), sort descending by aggregate
  score, and return only the top recommendation set. Standalone
  function only, following the M7/M8 precedent (`discoverProviderCandidates`,
  `enrichProviderCandidates`) — no HTTP route wiring in this task
  (deferred to M12).
- Inputs: task-27's `RankingRequirements`/`ProviderScore` types;
  task-28's `requirementMatchScore`/`geoFitScore`/`priceFitScore`;
  task-29's `reputationScore`/`evidenceQualityScore`; task-30's
  `computeAggregateScore`; task-31's `buildRankingExplanation`;
  `ProviderCandidate[]` (task-19/20's output shape, unchanged).
- Outputs: `backend/src/ranking/rankProviders.ts` exporting:
  - `MAX_RANKED_RESULTS = 5` — named, tunable constant satisfying
    Part 2/3's "approximately 3-5" target with a simple fixed cap
    (project tuning decision, not derived from data — same category
    as `MAX_DISCOVERY_RESULTS`/`MAX_ENRICHMENT_CANDIDATES`).
  - `rankProviders({ candidates: ProviderCandidate[], requirements:
    RankingRequirements }): ProviderScore[]` — for every candidate in
    `candidates` (no filtering by whether it has `inferred` data —
    D13c), compute all five dimension scores, aggregate them via
    task-30, build the explanation via task-31, sort the resulting
    `ProviderScore[]` descending by `score`, and return only the first
    `MAX_RANKED_RESULTS` entries.
- Constraints:
  - Pure function, no I/O, no LLM call — every dependency (tasks
    27-31) is itself pure, so this orchestration layer stays pure too.
  - Must NOT filter, skip, or de-prioritize a candidate merely because
    it lacks `inferred` data — an unenriched candidate is scored on
    whatever dimensions its FACT data supports, same as any other
    candidate (D13c). This is the one behavior this task's tests must
    explicitly prove, not just assume.
  - Must NOT introduce fuzzy/near-duplicate provider detection — out
    of scope for M9 (explicitly deferred during M9 planning; M7's
    exact-URL dedup already ran upstream).
  - Do not add HTTP route wiring, Fastify handlers, or touch
    `backend/src/server.ts` — that's M12's job.
- Open Questions: none — resolved during M9 planning (D13c in
  `decisions.md`).

## Assignment Alignment
- Requirement type: PROJECT DECISION (mechanism) implementing an
  EXPLICIT requirement.
- Assignment requirement: Part 2 — "Try to return approximately 3-5
  relevant providers" (page 2); Part 3 — rank by the user's specific
  requirements with real reasoning, not a generic star-rating sort
  (page 3) (`docs/Home Assignment.pdf`).
- Source: Part 2 (page 2), Part 3 (page 3); D8 (five-dimension
  weighted scorer); D13c (enrichment cap is not a ranking-input
  filter); the M7/M8 "standalone function, route wiring deferred"
  precedent (task-20/task-25 outcomes).
- Rationale: This is the function that actually produces "the
  approximately 3-5 relevant providers" the assignment asks for, using
  the full five-dimension explainable score from D8 rather than a
  generic sort. Keeping it a standalone function (not wired to a
  route) matches the established M7/M8 pattern and keeps this task
  focused on ranking logic, not API surface design.
- Gaps/conflicts found: none.

## IMPLEMENT
### Files Touched
- CREATE: `backend/src/ranking/rankProviders.ts`
- CREATE: `backend/src/ranking/rankProviders.test.ts`
- DO NOT TOUCH: `backend/src/ranking/types.ts`,
  `backend/src/ranking/matchAndFitScores.ts`,
  `backend/src/ranking/reputationAndEvidenceScores.ts`,
  `backend/src/ranking/aggregateScore.ts`,
  `backend/src/ranking/explanation.ts` (import only, do not modify),
  `backend/src/domain/**`, `backend/src/research/**`,
  `backend/src/llm/**`, `backend/src/conversation/**`,
  `backend/src/server.ts`.

### Implementation Notes
- Build each candidate's `dimensionScores` object explicitly (one key
  per `RankingDimension`) before calling `computeAggregateScore` and
  `buildRankingExplanation` — don't recompute dimension scores twice
  for the same candidate.
- Sort with a stable comparator (`(a, b) => b.score - a.score]`) —
  tie-breaking behavior beyond score order is not specified and not
  worth over-designing for a prototype.
- Fixture note (D13h interaction): task-30's `MIN_MEANINGFUL_DIMENSIONS`
  floor means a candidate with fewer than 2 non-null dimensions scores
  `0` regardless of `evidenceQuality`. Integration fixtures for the
  "normal ranking" test cases should give each candidate at least 2
  meaningful dimensions (e.g. real `location`/`servicesOffered` plus
  whatever else) unless a fixture is deliberately testing the floor
  itself — otherwise candidates will unexpectedly tie at `0`.

## VALIDATE
### Unit Tests
- N/A beyond what the integration test below covers — this task is
  thin orchestration over already-unit-tested pieces (tasks 28-31).

### Component / Integration Tests
- [ ] Given >5 realistic `ProviderCandidate` fixtures with varied
      FACT completeness (including at least one candidate with no
      `inferred` field and one with `inferred` present), `rankProviders`
      returns exactly `MAX_RANKED_RESULTS` entries, sorted descending
      by `score`.
- [ ] A candidate with zero enrichment (`inferred` absent) but strong
      FACT data (e.g. good requirement match + in-budget pricing)
      still ranks ahead of a weaker enriched candidate — the direct
      regression test for D13c ("enrichment cap is not a ranking
      filter").
- [ ] Each returned `ProviderScore.dimensionScores` has exactly the
      five expected keys, and `explanation` is a non-empty string
      consistent with task-31's rules (e.g. no literal "evidence
      quality" text).
- [ ] A candidate whose only rating is self-reported (provider's own
      domain, per D13a) still appears in the output (if otherwise
      competitive) with `dimensionScores.reputation === null` — proves
      the D13a gate flows through end-to-end, not just in task-29's
      unit tests.

### E2E Tests
- N/A — no HTTP route in this milestone.

### Success Criteria
- [ ] All new tests pass; existing suite still passes.
- [ ] `npm run build` clean.
- [ ] No I/O, no LLM call, no non-determinism.
- [ ] `MAX_RANKED_RESULTS` is exported and equals 5.

## ITERATE
### Outcome
Implemented exactly as planned, no deviations. Created
`backend/src/ranking/rankProviders.ts` exporting `MAX_RANKED_RESULTS
= 5` and `rankProviders({ candidates, requirements })`, which maps
every candidate (no `inferred`-based filtering, per D13c) to a
`ProviderScore` by building its `dimensionScores` object once, then
calling task-30's `computeAggregateScore` and task-31's
`buildRankingExplanation` against that same object (no duplicate
dimension computation), then sorts descending by `score` and slices
to the top 5. Created `backend/src/ranking/rankProviders.test.ts`
with 6 hand-built candidate fixtures (one with strong FACT data and
no enrichment, one weaker-FACT-but-enriched, one at the
`MIN_MEANINGFUL_DIMENSIONS` floor exactly, one below the floor, one
requirement-match-only, one uniformly strong) covering all four
Component/Integration checklist cases: >5-candidate cap-and-sort,
the D13c unenriched-beats-weaker-enriched regression (verified
against hand-computed expected ordering, not just "some order"),
exact five-key `dimensionScores` shape plus explanation-quality
check, and the D13a self-reported-rating flow-through (`reputation:
null` while the candidate still appears and scores > 0 on its other
dimensions). All 4 new tests passed on the first run, confirming the
hand-computed expectations. Full suite 226/226 passing (222
pre-existing + 4 new); `npm run build` clean. Pure function only —
no I/O, no LLM call, no `server.ts`/route changes. Did not touch
`types.ts`, `matchAndFitScores.ts`, `reputationAndEvidenceScores.ts`,
`aggregateScore.ts`, `explanation.ts`, or any excluded directory.

### Knowledge Updates
None beyond what D8/D13a/D13c already recorded — this task wired
together already-made decisions with no new architectural choice.
**M9 (Ranking) is now fully complete**: `rankProviders` is the single
entry point producing the "approximately 3-5 relevant providers" the
assignment asks for (capped at 5), scored via the full five-dimension
explainable formula and sorted descending.

### Follow-ups
None from this task itself. `rankProviders` is a standalone function
only — HTTP route wiring is explicitly deferred to M12, per the
task's own scope and the established M7/M8 precedent.
