# Task 22: Deterministic enrichment search query builder
Status: DONE
Can run in parallel with: task-21, task-23

## PLAN
- Goal: A pure, deterministic function that builds the search query
  used to find review/reputation content about one already-discovered
  provider candidate — the M8 analog of task-16's
  `buildProviderSearchQuery`, but aimed at finding *reviews about a
  specific business* rather than *businesses in a category*.
- Inputs: a provider's known name (from its M7 `fields.name` FACT, if
  present) and location/service area; no LLM call, no I/O.
- Outputs: `buildEnrichmentQuery({ providerName, location }): string`
  in a new `backend/src/research/enrichmentQuery.ts`.
- Constraints: Pure function only — no Firecrawl call, no candidate
  selection/capping logic (that's task-25's job), no fallback-to-hostname
  logic embedded here (the caller decides what `providerName` to pass;
  this function just formats a query string from whatever it's given).
- Open Questions: none.

## Assignment Alignment
- Requirement type: PROJECT DECISION (mechanism), reinforcing an EXPLICIT requirement
- Assignment requirement: Part 2 lists Google results/Yelp/local
  directories/marketplace listings as valid search targets; Part 3
  explicitly calls out reviews as the source of enrichment signal.
- Source: `docs/Home Assignment.pdf`, Part 2 (page 2), Part 3 (page 2-3).
- Rationale: Mirrors task-16's already-approved pattern (deterministic
  query template, no LLM call for query construction) applied to the
  review-search case decided during M8 planning: one new Firecrawl
  search+scrape per enriched candidate, aimed at review content,
  reusing the existing `firecrawlProvider.ts` boundary unchanged.
- Gaps/conflicts found: none.

## IMPLEMENT
### Files Touched
- CREATE: `backend/src/research/enrichmentQuery.ts`
- CREATE: `backend/src/research/enrichmentQuery.test.ts`
- DO NOT TOUCH: `backend/src/domain/**`, `backend/src/llm/**`,
  `backend/src/research/searchQuery.ts`,
  `backend/src/research/firecrawlProvider.ts`,
  `backend/src/research/assembleCandidates.ts`,
  `backend/src/research/discoverProviderCandidates.ts`,
  `backend/src/conversation/**`, `backend/src/server.ts`.

### Implementation Notes
- Template: `` `${providerName} reviews ${location}` `` — same flat
  string-template approach as `buildProviderSearchQuery`, no
  normalization, no LLM involvement.
- Does not decide what to do when a candidate has no known name — that
  fallback (e.g. using the candidate's hostname) is task-25's
  responsibility as the orchestrator deciding what `providerName`
  value to pass in; this function only formats whatever string it's given.

## VALIDATE
### Unit Tests
- [ ] Builds the expected query string from a provider name + location.
- [ ] Output changes when either input changes.
- [ ] Passes strings through as-is, with no normalization (matches task-16's precedent).

### Component / Integration Tests
- N/A — no consumer yet (task-25 wires it in).

### E2E Tests
- N/A.

### Success Criteria
- [ ] All new tests pass; existing suite still passes.
- [ ] `npm run build` clean.
- [ ] Pure function, zero I/O.

## ITERATE
### Outcome
Implemented exactly as planned, no deviations. Created
`backend/src/research/enrichmentQuery.ts` exporting
`buildEnrichmentQuery({ providerName, location })`, a pure function
returning the `` `${providerName} reviews ${location}` `` template —
mirrors `buildProviderSearchQuery` (task-16) structurally, including
its test shape (base case, input-change case, no-normalization
pass-through case). 3 new tests, `npm test` 131/131 passing (128
pre-existing + 3 new), `npm run build` clean. No consumer wired yet
(task-25's job, per scope).

### Knowledge Updates
None — this is a small, self-contained mirror of an already-documented
pattern (task-16); no new architectural decision was made.

### Follow-ups
None beyond what's already scoped to task-25 (wiring this into the
enrichment orchestrator, including the no-known-name fallback logic).
