# Task 98: Real Google/Yelp reputation via parallel dual-source lookup, with mock as a labeled fallback
Status: DONE
Can run in parallel with: NONE

## PLAN
- Goal: Source a provider's star rating and review count from a real, independently
  sourced Yelp/Google page whenever one can be found, keep the fabricated mock only
  as a per-provider, clearly labeled fallback, and never let a fabricated value reach
  ranking.
- Inputs: M7 discovery candidates (`ProviderCandidate[]`), the existing Firecrawl
  search boundary (`searchProviderPages`), the existing Gemini review-analysis step
  (`analyzeReviewText`), the existing mock reputation generator
  (`computeMockReputation`).
- Outputs:
  - Two source-targeted enrichment queries (Yelp + Google) fired **concurrently**
    per candidate via `Promise.allSettled`.
  - `ReviewAnalysisResultSchema` extended with `rating` / `reviewCount` /
    `ratingSourceUrl`, grounded to a single supplied page.
  - A real rating written onto `fields.rating` / `fields.reviewCount` as `Fact`s,
    with a precedence rule that only overwrites a self-reported (provider-domain)
    rating.
  - `computeMockReputation` applied only to providers with no real `fields.rating`,
    plus a `reputationSource: "real" | "mock"` provenance flag mirrored to the
    frontend.
  - A widened reputable-source allowlist shared by `reputationScore` and
    `classifySourceType`.
  - Frontend: real rating always wins over mock; mock is always labeled
    `(simulated)` on both screens.
- Constraints:
  - **Hard: exactly ONE Gemini call per enriched candidate.** Both pages are
    concatenated into one prompt. Firecrawl calls per request go 5 -> 10; Gemini
    calls stay at 5 (free tier is 5 req/min - D2b).
  - The outer `mapWithConcurrency(..., CONCURRENCY_LIMIT /* 3 */, ...)` across
    candidates is unchanged (<= 3 providers in flight x 2 searches = <= 6 concurrent
    Firecrawl calls).
  - `Promise.allSettled`, never `Promise.all` - one source failing must not lose
    the other.
  - FACT / INFERRED stay structurally separate; the qualitative `tags` -> INFERRED
    path via `assembleInferredTags` keeps its current shape and signature.
  - No fabricated value may reach `score`, `fitScore`, `matchGrade`, or ordering.
  - `buildEnrichmentQuery` stays exported (it has tests).
- Open Questions: none.

## Assignment Alignment
- Requirement type: EXPLICIT (Part 2 research / Part 3 enrichment + ranking, Part 5
  provenance), with one PROJECT DECISION element (the mock fallback itself).
- Assignment requirement: Part 2 requires researching real providers from public
  web sources; Part 3 requires enriching candidates with additional sourced signal
  and ranking on more than a raw star rating; Part 5 requires that a reader can
  always tell observed information from inferred or simulated information.
- Source: `docs/Home Assignment.pdf` - Parts 2, 3, 5.
- Rationale: Today the enrichment scrape reaches a real reviews page, discards the
  real rating (the LLM is never asked for it), and then a hash-derived fake rating
  is attached to every provider and displayed in preference to any real one. That
  is the exact inversion of Part 2/Part 5's intent: fabricated data is presented
  where observed data was available. This task makes observed data primary,
  demotes the fabrication to an explicitly labeled fallback, and keeps it out of
  ranking entirely - which also strengthens the "reputation" ranking dimension
  (Part 3), since `reputationScore` currently almost never fires for lack of an
  independently sourced rating.

## IMPLEMENT
### Files Touched
- CREATE:
  - `backend/src/shared/reviewDomains.ts` - single shared allowlist of reputable
    independent review/directory domains + classification helper.
  - `backend/src/shared/reviewDomains.test.ts`
  - `backend/src/research/applyRatingFact.ts` - pure function applying an analysis
    rating onto a candidate's FACT fields under the precedence rule.
  - `backend/src/research/applyRatingFact.test.ts`
  - `frontend/src/shared/reputationDisplay.ts` - shared real-vs-mock reputation
    line derivation + source label, used by both screens.
  - `frontend/src/shared/reputationDisplay.test.ts`
- MODIFY:
  - `backend/src/research/enrichmentQuery.ts` (+ its test)
  - `backend/src/research/enrichProviderCandidates.ts` (+ its test)
  - `backend/src/llm/reviewAnalysis.ts` (+ its test)
  - `backend/src/research/assembleInferredTags.ts` (+ its test)
  - `backend/src/ranking/reputationAndEvidenceScores.ts` (+ its test)
  - `backend/src/domain/provider.ts`
  - `backend/src/recommendation/generateProviderList.ts` (+ its test)
  - `frontend/src/domain/types.ts`
  - `frontend/src/screens/RecommendationsScreen.tsx` (+ its test)
  - `frontend/src/screens/ProviderDetailsScreen.tsx` (+ its test)
  - `DESIGN.md`
- DO NOT TOUCH:
  - `backend/src/shared/concurrency.ts` (`mapWithConcurrency` and the outer
    concurrency limit are unchanged).
  - `backend/src/recommendation/mockReputationSignals.ts` (the generator itself is
    correct; only *when* it is applied changes).
  - `backend/src/ranking/rankProviders.ts` and the other dimension scorers.
  - Anything under M10/M11 simulation.

### Implementation Notes
- **Queries**: `buildYelpEnrichmentQuery` -> `"{name} {location} site:yelp.com"`,
  `buildGoogleEnrichmentQuery` -> `"{name} {location} google reviews"`. When a
  candidate has no `fields.location`, the location term is omitted (matching the
  existing `buildQueryFor` fallback behavior). `buildEnrichmentQuery` is left
  exported and untouched.
- **Parallel fetch**: per candidate, `Promise.allSettled([yelpSearch, googleSearch])`.
  Rejected settlements are logged and ignored. Pages with `markdown === null` are
  dropped. Results are deduped by URL (both searches can land on the same page).
  If zero usable pages remain, the candidate passes through unchanged.
- **One LLM call**: `analyzeReviewText` now takes `pages: { url, markdown }[]` and
  builds a single prompt with each page labeled by its URL. `AnalyzeFn` in
  `enrichProviderCandidates.ts` changes shape to match.
- **Tag provenance tradeoff (recorded deliberately)**: `assembleInferredTags` keeps
  its current single-`url` signature per this task's constraint, so when two pages
  are analyzed together the resulting INFERRED tags are all attributed to one
  "primary" page, chosen deterministically as Yelp-then-Google in search order. An
  excerpt actually lifted from the Google page would therefore carry the Yelp URL as
  its `evidenceSourceUrl`. Accepted for now because it stays inside INFERRED (never
  FACT) and keeps this task's scope; per-tag source attribution is logged as a
  follow-up rather than implemented inline.
- **Rating grounding (deterministic, not trusted from the LLM)**: a returned rating
  is applied only when `rating !== null` **and** `ratingSourceUrl` is exactly one of
  the URLs supplied in the prompt. This is a code-side check, not just a prompt rule
  - the LLM is a contributor to state, never the authority for it.
- **Precedence**: overwrite an existing `fields.rating` only when its `sourceUrl`
  hostname (`stripWww`) equals the provider's own hostname, or when no rating
  exists. An independently sourced rating is never displaced. `rating` and
  `reviewCount` are treated as one pair: when the rating is overwritten and the
  analysis returned no review count, the stale review count is dropped rather than
  left mismatched (`reputationScore` requires both to share a `sourceUrl`).
- **`source` is the bare hostname**, per `assembleCandidates.ts`'s convention -
  `reputationScore` matches on `rating.source`, not on the URL.
- **Widened allowlist**: `backend/src/shared/reviewDomains.ts` holds the reputable
  independent-directory domains (GigSalad, The Bash, WeddingWire, The Knot,
  Thumbtack, Eventective). `reputationScore` accepts google.com, yelp.com, or any of
  these; `classifySourceType` returns `"directory"` (an already-existing `SourceType`
  member that was previously unreachable) for them. This changes one existing
  assertion - `weddingwire.com` classified as `"other"` - which is the intended
  behavior change, not a regression.
- **Mock as fallback**: in `generateProviderList.ts`, after ranking, each provider
  gets `reputationSource: "real"` when `fields.rating` exists, otherwise
  `computeMockReputation(url)` plus `reputationSource: "mock"`. Still applied
  strictly after ranking so it cannot touch score/order.
- **Frontend**: a real `fields.rating` always beats mock (reversing the current
  `deriveMockReputation(candidate) ?? deriveRating(candidate)`). Real renders
  `4.8 - 340 reviews - Yelp`; mock renders `4.3 - 210 reviews (simulated)`.
  The `(simulated)` label is mandatory on every screen - `ProviderDetailsScreen`'s
  quieter disclosure line is kept only as an *additional* line under the mock case,
  no longer as a substitute for the label.

## VALIDATE
### Unit Tests
- [ ] Yelp and Google queries are built in the documented formats, with and without
      a known location.
- [ ] Both searches are issued for one candidate and **overlap in time** (asserted
      with deferred promises, not just call count).
- [ ] Yelp rejects, Google resolves -> Google's rating still lands as a FACT.
- [ ] Both reject -> candidate passes through unchanged (mock fills in later).
- [ ] Exactly ONE `analyze` call per candidate even when both pages return, and it
      receives both pages.
- [ ] Duplicate URLs across the two searches are analyzed once.
- [ ] A rating whose `ratingSourceUrl` was not among the supplied pages is discarded.
- [ ] A self-reported (provider-domain) rating IS overwritten by a Yelp one.
- [ ] An independently sourced rating is NOT overwritten.
- [ ] A stale review count is dropped when the rating is overwritten without one.
- [ ] `reputationScore` accepts the widened directory allowlist and still rejects
      the provider's own domain and mismatched `sourceUrl` pairs.
- [ ] `reputationScore` is unaffected by `reputationRating` /
      `reputationReviewCount` (explicit regression test).
- [ ] `classifySourceType` returns `"directory"` for the allowlisted directories.
- [ ] Ordering is stable and the outer `CONCURRENCY_LIMIT` is still respected.

### Component / Integration Tests
- [ ] `generateProviderList` attaches mock reputation only to providers lacking a
      real `fields.rating`, and sets `reputationSource` correctly for both cases.
- [ ] `generateProviderList` still leaves score/dimensionScores/fitScore/matchGrade
      /order untouched by the mock attachment.
- [ ] Frontend: a real rating renders with its source and WITHOUT "(simulated)".
- [ ] Frontend: a mock rating renders WITH "(simulated)" on both screens.
- [ ] Frontend: when both are present, the real one wins.

### Success Criteria
- [ ] `cd backend && npm test && npm run typecheck && npm run build` all pass
- [ ] `cd frontend && npm test && npm run typecheck` all pass
- [ ] Gemini calls per provider-list request unchanged (1 per enriched candidate);
      Firecrawl calls 5 -> 10
- [ ] No fabricated value reaches `score`, `fitScore`, or `matchGrade`
- [ ] `DESIGN.md` reputation assumption updated + Optimizations note added

## ITERATE
### Outcome
Implemented in full; every VALIDATE box passes.

**Backend.** `enrichmentQuery.ts` gained `buildYelpEnrichmentQuery` /
`buildGoogleEnrichmentQuery` (location term dropped when unknown);
`buildEnrichmentQuery` kept exported and untouched.
`enrichProviderCandidates.ts` now fires both per candidate via
`Promise.allSettled` inside a new `gatherPages` helper — rejected settlements
are logged and ignored, `markdown === null` pages dropped, URLs deduped (both
searches can land on the same page), and a candidate with zero usable pages
passes through untouched without any LLM call. The outer
`mapWithConcurrency(..., CONCURRENCY_LIMIT /* 3 */, ...)` is unchanged, so
Firecrawl peaks at 3 x 2 = 6 in flight while Gemini stays at exactly one call
per candidate.

`ReviewAnalysisResultSchema` gained `rating` (1-5, nullable), `reviewCount`
(non-negative int, nullable) and `ratingSourceUrl` (nullable), with prompt rules
forbidding estimation, cross-page averaging, and mixing a rating from one page
with a count from another. `analyzeReviewText` now takes `pages[]` and labels
each by URL in one combined prompt.

New `applyRatingFact.ts` owns the FACT write and enforces two gates the LLM
cannot talk its way past: (1) grounding — `ratingSourceUrl` must be exactly one
of the URLs supplied in the prompt, so an invented or reconstructed URL is
discarded; (2) precedence — an existing rating is overwritten only when its
`sourceUrl` hostname (`stripWww`) equals the provider's own, so an independently
sourced rating is never displaced. `source` is written as the bare hostname per
`assembleCandidates.ts`'s convention, which is what `reputationScore` matches on.
A stale `reviewCount` is dropped when a rating is replaced without one, rather
than left paired with a different page.

New `shared/reviewDomains.ts` holds the reputable independent-directory
allowlist (GigSalad, The Bash, WeddingWire, The Knot, Thumbtack, Eventective) and
is the single source of truth for both `reputationScore` (which now accepts
google/yelp/directory instead of google/yelp only) and `classifySourceType`
(which now returns the previously unreachable `"directory"` `SourceType`). One
pre-existing assertion changed intentionally: `weddingwire.com` used to classify
as `"other"`.

`generateProviderList.ts` resolves reputation provenance strictly after ranking:
a candidate with a real `fields.rating` is marked `reputationSource: "real"` and
gets no mock; only candidates without one get `computeMockReputation` plus
`reputationSource: "mock"`. `mockReputationSignals.ts` itself was not touched.

**Frontend.** New `shared/reputationDisplay.ts` is the single source of truth for
which number a screen shows — a real FACT rating always beats the mock, and the
`(simulated)` label is applied by the shared formatter rather than by each
screen. `RecommendationsScreen.tsx`'s inverted
`deriveMockReputation(candidate) ?? deriveRating(candidate)` is gone; the card now
renders `4.8 - 340 reviews - Yelp` for a real rating and
`4.3 - 217 reviews (simulated)` for the fallback. `ProviderDetailsScreen.tsx`
uses the same helper: real ratings get a "Sourced from Google" line, mock ratings
now carry the mandatory `(simulated)` label *and* keep the quieter disclosure
underneath — the label is no longer substituted away there (this supersedes the
task-84/D26 treatment).

**Validation run.**
- `backend`: `npm test` 45 files / 449 tests passing; `npm run typecheck` clean;
  `npm run build` clean.
- `frontend`: `npm test` 18 suites / 183 tests passing; `npm run typecheck`
  clean.
- Gemini call budget verified by test, not by inspection: "makes exactly ONE
  analyze call per candidate, receiving both pages".
- Concurrency verified with a deferred promise (Google's search observes Yelp's
  still pending), not with a call count.
- Two explicit regression tests assert `reputationScore` is unmoved by
  `reputationRating` / `reputationReviewCount`.

**Not done / deliberately out of scope**: per-tag source attribution — see
Follow-ups.

### Knowledge Updates
- `decisions.md` D26 needs the addendum recorded below: mock reputation is now a
  labeled per-provider fallback, not a universal display value, and the Provider
  Details "quiet disclosure instead of the (simulated) word" choice from task-84
  is superseded — the label is now mandatory everywhere, with the disclosure line
  kept as an addition.
- `decisions.md` should record the new call-budget shape: the dual-source lookup
  doubles Firecrawl calls (5 -> 10 per provider-list request) while holding Gemini
  at 5, because both pages go into one prompt. This is the reasoning any future
  "add a third source" task must repeat.
- `progress.md` updated with the task-98 entry.
- `DESIGN.md`: reputation assumption rewritten (real when found, labeled mock
  fallback otherwise, never in ranking) and an Optimizations bullet added for the
  parallel dual-source lookup with a single combined LLM call.

### Follow-ups
- **Per-tag evidence source attribution.** With two pages analyzed in one call,
  `assembleInferredTags` still attributes every INFERRED tag to a single
  "primary" page (Yelp before Google). A tag actually lifted from the Google page
  therefore carries the Yelp URL as its `evidenceSourceUrl`. Kept deliberately in
  scope-bounds here (it stays inside INFERRED and never touches FACT), but the
  honest fix is a nullable per-tag `sourceUrl` in `ReviewAnalysisResultSchema.tags`
  with `assembleInferredTags` falling back to the primary page when it is null.
  Worth a small task of its own.
- **Real-API validation.** The dual-source path has only been exercised against
  fakes. A manual run against live Firecrawl + Gemini would confirm the
  source-targeted queries actually return Yelp/Google pages for real providers
  and that the LLM's `ratingSourceUrl` echoes a supplied URL exactly often enough
  for the grounding gate not to reject nearly everything. Note D2b's free-tier
  daily cap before running it repeatedly.
- **Directory allowlist tuning.** The six directories are a hand-picked guess at
  what enrichment will land on; real-API evidence may show the searches
  consistently returning other sites (or Yelp blocking the scrape entirely), in
  which case the list should follow the evidence rather than intuition.
